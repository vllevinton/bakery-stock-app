import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { computeReplenishPacks, computeStatus, yyyyMmDd } from "@/lib/calc";
import { sendMail } from "@/lib/mailer";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function fmtOwnerMail(items: any[]) {
  const blocks = items.map((it) => `
    <div style="margin:20px 0;">
      <div><b>Producto:</b> ${escapeHtml(it.name)} (${escapeHtml(it.product_code)})</div>
      <div><b>Stock actual:</b> ${it.stock_packs}</div>
      <div><b>Mínimo recomendado (margen mínimo):</b> ${it.margin_minimum_packs}</div>
      <div><b>Reabastecer al menos:</b> ${it.replenish_packs}</div>
      <div><b>Mínimo por pedido (min_packs_pedido):</b> ${it.min_packs_order}</div>
    </div>
  `).join("");

  return `
    <h2>ALERTA DE STOCK</h2>
    <p>Se detectaron productos con stock por debajo del mínimo recomendado.</p>
    ${blocks}
  `;
}

function fmtEmployeeMail(items: any[]) {
  const lines = items.map((it) => `• ${escapeHtml(it.name)}: reabastecer ${it.replenish_packs} packs`).join("<br/>");
  return `<h3>Reabastecer (packs)</h3><p>${lines}</p>`;
}

function getUserBranchId(user: any): number | null {
  const b =
    (typeof user?.branch_id === "number" ? user.branch_id : null) ??
    (typeof user?.branchId === "number" ? user.branchId : null);

  if (!b || !Number.isFinite(b)) return null;
  return b;
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "EMPLEADO") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchId = getUserBranchId(user);
  if (!branchId) {
    return NextResponse.json({ error: "Empleado sin sucursal asignada (branch_id)" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Sin items" }, { status: 400 });

  const db = getDb();
  const now = nowIso();
  const date = yyyyMmDd(new Date());
  const today = todayYMD();

  const getVisibleProduct = db.prepare(`
    SELECT
      p.id as id,
      p.product_code,
      p.name,
      p.category,
      p.lead_time_days,
      p.units_per_pack,
      p.min_packs_order,
      bp.current_stock_packs,
      bp.margin_minimum_packs,
      bp.active,
      bp.start_date,
      bp.end_date
    FROM branch_products bp
    JOIN products p ON p.id = bp.product_id
    WHERE bp.branch_id = ?
      AND bp.product_id = ?
      AND bp.active = 1
      AND (bp.start_date IS NULL OR bp.start_date = '' OR bp.start_date <= ?)
      AND (bp.end_date   IS NULL OR bp.end_date   = '' OR bp.end_date   >= ?)
    LIMIT 1
  `);

  const updateBranchStock = db.prepare(`
    UPDATE branch_products
    SET current_stock_packs = ?, updated_at = ?
    WHERE branch_id = ? AND product_id = ?
  `);

  const insertEntry = db.prepare(`
    INSERT INTO stock_entries
      (product_id, stock_packs, recorded_by, recorded_at, recorded_date, branch_id)
    VALUES (?,?,?,?,?,?)
  `);

  const changed: any[] = [];

  db.transaction(() => {
    for (const it of items) {
      const productId = Number(it.productId);
      if (!Number.isFinite(productId)) continue;

      const raw = it.stockPacks ?? 0;
      const stockPacks = Math.max(0, Math.floor(Number(raw)));
      if (!Number.isFinite(stockPacks)) continue;

      const p = getVisibleProduct.get(branchId, productId, today, today) as any;
      if (!p) continue;

      if (Number(p.current_stock_packs) === stockPacks) continue;

      updateBranchStock.run(stockPacks, now, branchId, productId);
      insertEntry.run(productId, stockPacks, user.id, now, date, branchId);

      changed.push({ ...p, stock_packs: stockPacks });
    }
  })();

  if (changed.length === 0) {
    return NextResponse.json({ message: "No hay cambios para guardar." });
  }

  const alerts = changed
    .map((p) => {
      const status = computeStatus(p.stock_packs, p.margin_minimum_packs);
      const replenish = computeReplenishPacks(p.stock_packs, p.margin_minimum_packs, p.min_packs_order);
      return { ...p, status, replenish_packs: replenish };
    })
    .filter((p) => p.status === "ALERTA" && p.replenish_packs > 0);

  const recentLog = db.prepare(`
    SELECT COUNT(*) as c
    FROM alert_logs
    WHERE branch_id = ?
      AND product_id = ?
      AND sent_at >= datetime('now','-24 hours')
  `);

  const insertLog = db.prepare(`
    INSERT INTO alert_logs (branch_id, product_id, stock_packs, margin_minimum_packs, replenish_packs, sent_to, reason, sent_at)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const toNotify: any[] = [];
  for (const a of alerts) {
    const c = Number((recentLog.get(branchId, a.id) as any)?.c ?? 0);
    if (c > 0) continue;
    toNotify.push(a);
  }

  if (toNotify.length > 0) {
    const ownerEmail = process.env.OWNER_EMAIL;
    const bakeryEmail = process.env.BAKERY_EMAIL;
    const employeeEmail = user.email;

    const recipientsOwner = [ownerEmail, bakeryEmail].filter(Boolean) as string[];
    const recipientsEmployee = [employeeEmail].filter(Boolean) as string[];

    if (recipientsOwner.length) {
      await sendMail({
        to: recipientsOwner,
        subject: `ALERTA DE STOCK (Sucursal ${branchId})`,
        html: fmtOwnerMail(toNotify),
        text: "ALERTA DE STOCK",
      });
    }

    if (recipientsEmployee.length) {
      await sendMail({
        to: recipientsEmployee,
        subject: `Reabastecer (Sucursal ${branchId})`,
        html: fmtEmployeeMail(toNotify),
        text: toNotify.map((x) => `${x.name}: ${x.replenish_packs} packs`).join("\n"),
      });
    }

    const sentTo = JSON.stringify({ owner: recipientsOwner, employee: recipientsEmployee, branchId });

    for (const a of toNotify) {
      insertLog.run(branchId, a.id, a.stock_packs, a.margin_minimum_packs, a.replenish_packs, sentTo, "EMPLOYEE_SAVE", now);
    }
  }

  return NextResponse.json({
    message:
      toNotify.length > 0
        ? `Cambios guardados. Se enviaron alertas por ${toNotify.length} producto(s).`
        : "Cambios guardados. No hubo alertas nuevas para notificar.",
  });
}
