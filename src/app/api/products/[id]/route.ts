import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function todayYMD() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function normalizeYmdOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normalizeActive(v: any, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true") return 1;
  if (s === "0" || s === "false") return 0;
  const n = Number(v);
  if (!Number.isNaN(n)) return n ? 1 : 0;
  return fallback;
}

function parseBranchId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n !== 1 && n !== 2 && n !== 3) return null;
  return n;
}

function ensureBranchProductRow(db: ReturnType<typeof getDb>, branchId: number, productId: number) {
  const now = nowIso();
  const existing = db
    .prepare("SELECT 1 FROM branch_products WHERE branch_id = ? AND product_id = ?")
    .get(branchId, productId) as any;

  if (existing) return;

  db.prepare(`
    INSERT INTO branch_products
      (branch_id, product_id, active, start_date, end_date, current_stock_packs, margin_minimum_packs, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(branchId, productId, 0, null, null, 0, 0, now);
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
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = getDb();
  const body = await req.json().catch(() => ({}));
  const now = nowIso();
  const today = todayYMD();

  // branchId: por query o body; default 1 si no viene
  const url = new URL(req.url);
  const branchId =
    parseBranchId(url.searchParams.get("branchId")) ??
    parseBranchId(String(body.branchId ?? "")) ??
    1;

  // Auto-inactivar vencidos de ESA sucursal antes de operar
  autoInactivateExpiredBranchProducts(db, branchId);

  const existingProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as any;
  if (!existingProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Garantiza que exista el row por sucursal
  ensureBranchProductRow(db, branchId, productId);

  const existingBP = db
    .prepare("SELECT * FROM branch_products WHERE branch_id = ? AND product_id = ?")
    .get(branchId, productId) as any;

  // -------------------------
  // 1) Actualizar catálogo (products)
  // -------------------------
  const product_code = String(body.product_code ?? existingProduct.product_code).trim().toUpperCase();
  const name = String(body.name ?? existingProduct.name).trim();
  const category = String(body.category ?? existingProduct.category).trim();

  const lead_time_days = Math.max(0, Math.floor(Number(body.lead_time_days ?? existingProduct.lead_time_days)));
  const units_per_pack = Math.max(1, Math.floor(Number(body.units_per_pack ?? existingProduct.units_per_pack)));
  const min_packs_order = Math.max(1, Math.floor(Number(body.min_packs_order ?? existingProduct.min_packs_order)));

  // -------------------------
  // 2) Actualizar por sucursal (branch_products)
  // -------------------------
  const current_stock_packs = Math.max(0, Math.floor(Number(body.current_stock_packs ?? existingBP.current_stock_packs ?? 0)));
  const margin_minimum_packs = Math.max(0, Math.floor(Number(body.margin_minimum_packs ?? existingBP.margin_minimum_packs ?? 0)));

  const active = normalizeActive(body.active, Number(existingBP.active ?? 1));

  const start_date =
    body.start_date === undefined
      ? (existingBP.start_date ? String(existingBP.start_date) : null)
      : normalizeYmdOrNull(body.start_date);

  const end_date =
    body.end_date === undefined
      ? (existingBP.end_date ? String(existingBP.end_date) : null)
      : normalizeYmdOrNull(body.end_date);

  // Validación start <= end
  if (start_date && end_date && start_date > end_date) {
    return NextResponse.json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin" }, { status: 400 });
  }

  // Regla: si end_date ya pasó => forzar inactive (sin reprogramar)
  const finalActive = end_date && end_date < today ? 0 : active;

  try {
    db.transaction(() => {
      // Catálogo
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
      `).run(
        product_code,
        name,
        category,
        lead_time_days,
        units_per_pack,
        min_packs_order,
        now,
        productId
      );

      // Por sucursal
      db.prepare(`
        UPDATE branch_products SET
          current_stock_packs = ?,
          margin_minimum_packs = ?,
          active = ?,
          start_date = ?,
          end_date = ?,
          updated_at = ?
        WHERE branch_id = ? AND product_id = ?
      `).run(
        current_stock_packs,
        margin_minimum_packs,
        finalActive,
        start_date,
        end_date,
        now,
        branchId,
        productId
      );
    })();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const db = getDb();
  const now = nowIso();

  // branchId: por query; default 1
  const url = new URL(req.url);
  const branchId = parseBranchId(url.searchParams.get("branchId")) ?? 1;

  // Si no existe el producto, 404
  const existingProduct = db.prepare("SELECT id FROM products WHERE id = ?").get(productId) as any;
  if (!existingProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Garantiza row en branch_products y luego lo desactiva para ESA sucursal
  ensureBranchProductRow(db, branchId, productId);

  db.prepare(`
    UPDATE branch_products
    SET active = 0, start_date = NULL, end_date = NULL, updated_at = ?
    WHERE branch_id = ? AND product_id = ?
  `).run(now, branchId, productId);

  return NextResponse.json({ ok: true });
}
