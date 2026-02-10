import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeYmdOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function parseBranchId(raw: any): 1 | 2 | 3 | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n !== 1 && n !== 2 && n !== 3) return null;
  return n as 1 | 2 | 3;
}

function normalizeActive(v: any, fallback: number) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true") return 1;
  if (s === "0" || s === "false") return 0;
  const n = Number(v);
  if (!Number.isNaN(n)) return n ? 1 : 0;
  return fallback;
}

function autoInactivateExpiredBranchProducts(db: ReturnType<typeof getDb>, branchId: number) {
  const now = nowIso();
  const today = todayYMD();

  db.prepare(`
    UPDATE branch_products
    SET active = 0, updated_at = ?
    WHERE branch_id = ?
      AND end_date IS NOT NULL
      AND end_date <> ''
      AND end_date < ?
      AND active <> 0
  `).run(now, branchId, today);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  const branchId =
    parseBranchId(url.searchParams.get("branchId")) ??
    parseBranchId(body.branchId) ??
    1;

  const db = getDb();
  const now = nowIso();
  const today = todayYMD();

  autoInactivateExpiredBranchProducts(db, branchId);

  const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as any;
  if (!prod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bp = db
    .prepare("SELECT * FROM branch_products WHERE branch_id = ? AND product_id = ?")
    .get(branchId, productId) as any;
  if (!bp) return NextResponse.json({ error: "Not found (branch_products)" }, { status: 404 });

  // Catálogo
  const product_code = String(body.product_code ?? prod.product_code).trim().toUpperCase();
  const name = String(body.name ?? prod.name).trim();
  const category = String(body.category ?? prod.category).trim();

  const lead_time_days = Math.max(0, Math.floor(Number(body.lead_time_days ?? prod.lead_time_days)));
  const units_per_pack = Math.max(1, Math.floor(Number(body.units_per_pack ?? prod.units_per_pack)));
  const min_packs_order = Math.max(1, Math.floor(Number(body.min_packs_order ?? prod.min_packs_order)));

  // Por sucursal
  const current_stock_packs = Math.max(0, Math.floor(Number(body.current_stock_packs ?? bp.current_stock_packs)));
  const margin_minimum_packs = Math.max(0, Math.floor(Number(body.margin_minimum_packs ?? bp.margin_minimum_packs)));

  const start_date =
    body.start_date === undefined
      ? (bp.start_date ? String(bp.start_date) : null)
      : normalizeYmdOrNull(body.start_date);

  const end_date =
    body.end_date === undefined
      ? (bp.end_date ? String(bp.end_date) : null)
      : normalizeYmdOrNull(body.end_date);

  if (start_date && end_date && start_date > end_date) {
    return NextResponse.json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin" }, { status: 400 });
  }

  let active = normalizeActive(body.active, Number(bp.active ?? 1));
  if (end_date && end_date < today) active = 0; // vencido => inactivo

  try {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE products SET
          product_code = ?,
          name = ?,
          category = ?,
          lead_time_days = ?,
          units_per_pack = ?,
          min_packs_order = ?,
          updated_at = ?
        WHERE id = ?
      `).run(product_code, name, category, lead_time_days, units_per_pack, min_packs_order, now, productId);

      db.prepare(`
        UPDATE branch_products SET
          active = ?,
          start_date = ?,
          end_date = ?,
          current_stock_packs = ?,
          margin_minimum_packs = ?,
          updated_at = ?
        WHERE branch_id = ? AND product_id = ?
      `).run(active, start_date, end_date, current_stock_packs, margin_minimum_packs, now, branchId, productId);
    });

    tx();
    return NextResponse.json({ ok: true, branchId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const db = getDb();
  const prod = db.prepare("SELECT id FROM products WHERE id = ?").get(productId) as any;
  if (!prod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM branch_products WHERE product_id = ?").run(productId);
    db.prepare("DELETE FROM products WHERE id = ?").run(productId);
  });

  tx();
  return NextResponse.json({ ok: true });
}
