import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { computeReplenishPacks, computeStatus, yyyyMmDd } from "@/lib/calc";
import { sendMail } from "@/lib/mailer";

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
    <p>Se detectaron productos con stock por debajo del mínimo recomendado para asegurar stock disponible mañana.</p>
    ${blocks}
  `;
}

function fmtEmployeeMail(items: any[]) {
  const lines = items.map((it) => `• ${escapeHtml(it.name)} (${escapeHtml(it.product_code)}): reabastecer ${it.replenish_packs} packs`).join("<br/>");
  return `<h3>Reabastecer (packs)</h3><p>${lines}</p>`;
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "EMPLOYEE") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Sin items" }, { status: 400 });

  const db = getDb();
  const now = nowIso();
  const date = yyyyMmDd(new Date());

  const getProduct = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1");
  const updateStock = db.prepare("UPDATE products SET current_stock_packs = ?, updated_at = ? WHERE id = ?");
  const insertEntry = db.prepare("INSERT INTO stock_entries (product_id, stock_packs, recorded_by, recorded_at, recorded_date) VALUES (?,?,?,?,?)");

  const changed: any[] = [];
  for (const it of items) {
    const productId = Number(it.productId);
    const stockPacks = Math.max(0, Math.floor(Number(it.stockPacks ?? 0)));
    const p = getProduct.get(productId) as any;
    if (!p) continue;
    if (p.current_stock_packs === stockPacks) continue;

    updateStock.run(stockPacks, now, productId);
    insertEntry.run(productId, stockPacks, user.id, now, date);
    changed.push({ ...p, stock_packs: stockPacks });
  }

  if (changed.length === 0) return NextResponse.json({ message: "No hay cambios para guardar." });

  const alerts = changed
    .map((p) => {
      const status = computeStatus(p.stock_packs, p.margin_minimum_packs);
      const replenish = computeReplenishPacks(p.stock_packs, p.margin_minimum_packs, p.min_packs_order);
      return { ...p, status, replenish_packs: replenish };
    })
    .filter((p) => p.status === "ALERTA" && p.replenish_packs > 0);

  const recentLog = db.prepare("SELECT COUNT(*) as c FROM alert_logs WHERE product_id = ? AND sent_at >= datetime('now','-24 hours')");
  const insertLog = db.prepare(`
    INSERT INTO alert_logs (product_id, stock_packs, margin_minimum_packs, replenish_packs, sent_to, reason, sent_at)
    VALUES (?,?,?,?,?,?,?)
  `);

  const toNotify: any[] = [];
  for (const a of alerts) {
    const c = (recentLog.get(a.id) as any).c as number;
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
      await sendMail({ to: recipientsOwner, subject: "ALERTA DE STOCK", html: fmtOwnerMail(toNotify), text: "ALERTA DE STOCK" });
    }
    if (recipientsEmployee.length) {
      await sendMail({
        to: recipientsEmployee,
        subject: "Reabastecer (packs)",
        html: fmtEmployeeMail(toNotify),
        text: toNotify.map((x) => `${x.name} (${x.product_code}): ${x.replenish_packs} packs`).join("\n")
      });
    }

    const sentTo = JSON.stringify({ owner: recipientsOwner, employee: recipientsEmployee });
    for (const a of toNotify) insertLog.run(a.id, a.stock_packs, a.margin_minimum_packs, a.replenish_packs, sentTo, "EMPLOYEE_SAVE", now);
  }

  return NextResponse.json({
    message: toNotify.length > 0
      ? `Cambios guardados. Se enviaron alertas por ${toNotify.length} producto(s).`
      : "Cambios guardados. No hubo alertas nuevas para notificar."
  });
}
