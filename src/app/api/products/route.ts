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

function sessionBranchId(user: any): number | null {
  // soporta sesiones viejas/nuevas
  const b1 = typeof user?.branchId === "number" ? user.branchId : null;
  const b2 = typeof user?.branch_id === "number" ? user.branch_id : null;
  return b1 ?? b2;
}

export async function GET(req: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const activeParam = url.searchParams.get("active"); // "1" => solo visibles
  const branchParam = url.searchParams.get("branchId");

  const db = getDb();
  const today = todayYMD();

  // Resolver branchId por rol
  let branchId: number | null = null;

  if (user.role === "EMPLEADO") {
    branchId = sessionBranchId(user);
    if (!branchId) {
      return NextResponse.json({ error: "Empleado sin sucursal asignada (branch_id)" }, { status: 400 });
    }
  } else {
    branchId = parseBranchId(branchParam) ?? 1;
  }

  autoInactivateExpiredBranchProducts(db, branchId);

  const baseSelect = `
    SELECT
      p.id as id,
      p.product_code,
      p.name,
      p.category,

      bp.current_stock_packs,
      bp.margin_minimum_packs,
      bp.active,
      bp.start_date,
      bp.end_date,

      p.lead_time_days,
      p.units_per_pack,
      p.min_packs_order
    FROM branch_products bp
    JOIN products p ON p.id = bp.product_id
    WHERE bp.branch_id = ?
  `;

  // EMPLEADO: siempre visibles (active + fechas)
  if (user.role === "EMPLEADO") {
    const rows = db.prepare(`
      ${baseSelect}
        AND bp.active = 1
        AND (bp.start_date IS NULL OR bp.start_date = '' OR bp.start_date <= ?)
        AND (bp.end_date   IS NULL OR bp.end_date   = '' OR bp.end_date   >= ?)
      ORDER BY p.name ASC
    `).all(branchId, today, today);

    return NextResponse.json({ products: rows, branchId });
  }

  // OWNER:
  // - si active=1 => visibles (active + fechas)
  // - si no => todo de la sucursal
  const rows =
    activeParam === "1"
      ? db.prepare(`
          ${baseSelect}
            AND bp.active = 1
            AND (bp.start_date IS NULL OR bp.start_date = '' OR bp.start_date <= ?)
            AND (bp.end_date   IS NULL OR bp.end_date   = '' OR bp.end_date   >= ?)
          ORDER BY p.name ASC
        `).all(branchId, today, today)
      : db.prepare(`
          ${baseSelect}
          ORDER BY p.name ASC
        `).all(branchId);

  return NextResponse.json({ products: rows, branchId });
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  const branchId = parseBranchId(url.searchParams.get("branchId")) ?? parseBranchId(body.branchId) ?? 1;

  const db = getDb();
  const now = nowIso();
  const today = todayYMD();

  const product_code = String(body.product_code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const category = String(body.category || "Otros").trim();

  // Catálogo
  const lead_time_days = Math.max(0, Math.floor(Number(body.lead_time_days ?? 1)));
  const units_per_pack = Math.max(1, Math.floor(Number(body.units_per_pack ?? 1)));
  const min_packs_order = Math.max(1, Math.floor(Number(body.min_packs_order ?? 1)));

  // Por sucursal
  const current_stock_packs = Math.max(0, Math.floor(Number(body.current_stock_packs ?? 0)));
  const margin_minimum_packs = Math.max(0, Math.floor(Number(body.margin_minimum_packs ?? 0)));
  const start_date = normalizeYmdOrNull(body.start_date);
  const end_date = normalizeYmdOrNull(body.end_date);

  if (!product_code || !name) {
    return NextResponse.json({ error: "Código y nombre son obligatorios" }, { status: 400 });
  }
  if (start_date && end_date && start_date > end_date) {
    return NextResponse.json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin" }, { status: 400 });
  }

  let active = normalizeActive(body.active, 1);
  if (end_date && end_date < today) active = 0;

  try {
    const tx = db.transaction(() => {
      // 1) Insert catálogo (products)
      const info = db.prepare(`
        INSERT INTO products
          (product_code, name, category,
           current_stock_packs, margin_minimum_packs,
           lead_time_days, units_per_pack, min_packs_order,
           active, start_date, end_date,
           created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        product_code,
        name,
        category,
        0, // ya no se usa global
        0, // ya no se usa global
        lead_time_days,
        units_per_pack,
        min_packs_order,
        1,   // el item existe en catálogo
        null,
        null,
        now,
        now
      );

      const productId = Number(info.lastInsertRowid);

      // 2) Crear branch_products para las 3 sucursales
      const branches = db.prepare("SELECT id FROM branches ORDER BY id ASC").all() as any[];

      const ins = db.prepare(`
        INSERT INTO branch_products
          (branch_id, product_id, active, start_date, end_date, current_stock_packs, margin_minimum_packs, updated_at)
        VALUES (?,?,?,?,?,?,?,?)
      `);

      for (const b of branches) {
        const isSelected = Number(b.id) === branchId;

        ins.run(
          b.id,
          productId,
          isSelected ? active : 0,
          isSelected ? start_date : null,
          isSelected ? end_date : null,
          isSelected ? current_stock_packs : 0,
          isSelected ? margin_minimum_packs : 0,
          now
        );
      }

      return productId;
    });

    const id = tx();
    return NextResponse.json({ id, branchId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}
