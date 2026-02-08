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

function parseBranchId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n !== 1 && n !== 2 && n !== 3) return null;
  return n;
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

export async function GET(req: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const activeParam = url.searchParams.get("active"); // "1" | null
  const branchParam = url.searchParams.get("branchId"); // owner selector
  const db = getDb();
  const today = todayYMD();

  // ---- Resolver branchId según rol ----
  let branchId: number | null = null;

  if (user.role === "EMPLEADO") {
    // para empleados, la sucursal sale del usuario
    // (si no está seteada, es un problema de datos)
    // @ts-ignore
    branchId = typeof user.branch_id === "number" ? user.branch_id : null;
    if (!branchId) {
      return NextResponse.json({ error: "Empleado sin sucursal asignada (branch_id)" }, { status: 400 });
    }
  } else {
    // owner: elige sucursal por query, default 1 si no manda nada
    branchId = parseBranchId(branchParam) ?? 1;
  }

  // 1) auto-inactivar vencidos SOLO para esta sucursal
  autoInactivateExpiredBranchProducts(db, branchId);

  // 2) EMPLEADO: solo “visibles” (activos + vigentes por fechas)
  if (user.role === "EMPLEADO") {
    const rows = db.prepare(
      `
      SELECT
        p.id as id,
        p.product_code,
        p.name,
        p.category,
        bp.current_stock_packs,
        bp.margin_minimum_packs,
        p.lead_time_days,
        p.units_per_pack,
        p.min_packs_order,
        bp.active,
        bp.start_date,
        bp.end_date,
        bp.updated_at,
        p.created_at
      FROM branch_products bp
      JOIN products p ON p.id = bp.product_id
      WHERE bp.branch_id = ?
        AND bp.active = 1
        AND (bp.start_date IS NULL OR bp.start_date = '' OR bp.start_date <= ?)
        AND (bp.end_date   IS NULL OR bp.end_date   = '' OR bp.end_date   >= ?)
      ORDER BY p.name ASC
      `
    ).all(branchId, today, today);

    return NextResponse.json({ products: rows, branchId });
  }

  // 3) OWNER: ve TODO por defecto, o solo “activos vigentes” si ?active=1
  const rows =
    activeParam === "1"
      ? db.prepare(
          `
          SELECT
            p.id as id,
            p.product_code,
            p.name,
            p.category,
            bp.current_stock_packs,
            bp.margin_minimum_packs,
            p.lead_time_days,
            p.units_per_pack,
            p.min_packs_order,
            bp.active,
            bp.start_date,
            bp.end_date,
            bp.updated_at,
            p.created_at
          FROM branch_products bp
          JOIN products p ON p.id = bp.product_id
          WHERE bp.branch_id = ?
            AND bp.active = 1
            AND (bp.start_date IS NULL OR bp.start_date = '' OR bp.start_date <= ?)
            AND (bp.end_date   IS NULL OR bp.end_date   = '' OR bp.end_date   >= ?)
          ORDER BY p.name ASC
          `
        ).all(branchId, today, today)
      : db.prepare(
          `
          SELECT
            p.id as id,
            p.product_code,
            p.name,
            p.category,
            bp.current_stock_packs,
            bp.margin_minimum_packs,
            p.lead_time_days,
            p.units_per_pack,
            p.min_packs_order,
            bp.active,
            bp.start_date,
            bp.end_date,
            bp.updated_at,
            p.created_at
          FROM branch_products bp
          JOIN products p ON p.id = bp.product_id
          WHERE bp.branch_id = ?
          ORDER BY p.name ASC
          `
        ).all(branchId);

  return NextResponse.json({ products: rows, branchId });
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const now = nowIso();
  const today = todayYMD();

  // El owner puede mandar branchId en query o body (para setear defaults de esa sucursal)
  // Si no manda nada, usamos 1
  // (esto NO limita: luego lo puede activar/desactivar por sucursal)
  const url = new URL(req.url);
  const branchId = parseBranchId(url.searchParams.get("branchId")) ?? parseBranchId(String(body.branchId ?? "")) ?? 1;

  const product_code = String(body.product_code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const category = String(body.category || "Otros").trim();

  // Defaults (para la sucursal seleccionada)
  const current_stock_packs = Math.max(0, Math.floor(Number(body.current_stock_packs ?? 0)));
  const margin_minimum_packs = Math.max(0, Math.floor(Number(body.margin_minimum_packs ?? 0)));
  const lead_time_days = Math.max(0, Math.floor(Number(body.lead_time_days ?? 1)));
  const units_per_pack = Math.max(1, Math.floor(Number(body.units_per_pack ?? 1)));
  const min_packs_order = Math.max(1, Math.floor(Number(body.min_packs_order ?? 1)));

  const start_date = normalizeYmdOrNull(body.start_date);
  const end_date = normalizeYmdOrNull(body.end_date);

  if (start_date && end_date && start_date > end_date) {
    return NextResponse.json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin" }, { status: 400 });
  }

  // active por sucursal (default 0 para no aparecer hasta que el owner lo active)
  // Si vos preferís que nazca activo en la sucursal elegida, dejalo en 1.
  let active = body.active === undefined ? 0 : (String(body.active) === "0" || body.active === false ? 0 : 1);
  if (end_date && end_date < today) active = 0;

  if (!product_code || !name) {
    return NextResponse.json({ error: "Código y nombre son obligatorios" }, { status: 400 });
  }

  const db = getDb();

  try {
    const tx = db.transaction(() => {
      // 1) Insertar en catálogo (products)
      const info = db.prepare(`
        INSERT INTO products
        (
          product_code, name, category,
          current_stock_packs, margin_minimum_packs, lead_time_days,
          units_per_pack, min_packs_order,
          active, start_date, end_date,
          created_at, updated_at
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        product_code,
        name,
        category,
        0, // catalog stock NO se usa más (se usa por sucursal), lo dejamos en 0
        0, // catalog margin idem
        lead_time_days,
        units_per_pack,
        min_packs_order,
        1, // catalog siempre "activo" como ítem del catálogo; la visibilidad real es por sucursal
        null,
        null,
        now,
        now
      );

      const productId = Number(info.lastInsertRowid);

      // 2) Crear registros por sucursal en branch_products (por defecto inactivos)
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
          isSelected ? margin_minimum_packs : margin_minimum_packs, // podés dejar 0 si preferís
          now
        );
      }

      return productId;
    });

    const id = tx();
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}
