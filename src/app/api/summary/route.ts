import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { computeStatus, yyyyMmDd } from "@/lib/calc";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function parseBranchId(raw: string | null): 1 | 2 | 3 {
  const n = Number(raw);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
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
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const branchId = parseBranchId(url.searchParams.get("branchId"));
  const today = todayYMD();

  const db = getDb();

  // ✅ mantener consistencia con Products: auto-inactivar vencidos
  autoInactivateExpiredBranchProducts(db, branchId);

  // ✅ “visibles” en la sucursal (activos + dentro de vigencia)
  const visibleProducts = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.category,
      bp.current_stock_packs,
      bp.margin_minimum_packs
    FROM branch_products bp
    JOIN products p ON p.id = bp.product_id
    WHERE bp.branch_id = ?
      AND bp.active = 1
      AND (bp.start_date IS NULL OR bp.start_date = '' OR bp.start_date <= ?)
      AND (bp.end_date   IS NULL OR bp.end_date   = '' OR bp.end_date   >= ?)
    ORDER BY p.name ASC
  `).all(branchId, today, today) as any[];

  const totalProducts = visibleProducts.length;

  const alertProducts = visibleProducts.filter(
    (p) => computeStatus(p.current_stock_packs, p.margin_minimum_packs) === "ALERTA"
  );

  const alertCount = alertProducts.length;
  const okCount = totalProducts - alertCount;

  const avgStock = totalProducts
    ? Math.round(visibleProducts.reduce((a, p) => a + (p.current_stock_packs ?? 0), 0) / totalProducts)
    : 0;

  // últimos 30 días (avg del último stock cargado por producto ese día, por sucursal)
  const todayDate = new Date();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    days.push(yyyyMmDd(d));
  }

  const avgStockSeries = days.map((day) => {
    const rows = db.prepare(`
      SELECT se.product_id, se.stock_packs
      FROM stock_entries se
      WHERE se.branch_id = ?
        AND se.recorded_date = ?
      ORDER BY se.recorded_at DESC
    `).all(branchId, day) as any[];

    if (rows.length === 0) return 0;

    const map = new Map<number, number>();
    for (const r of rows) {
      if (!map.has(r.product_id)) map.set(r.product_id, r.stock_packs);
    }

    const vals = [...map.values()];
    return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0;
  });

  return NextResponse.json({
    branchId,
    kpis: { totalProducts, alertCount, okCount, avgStock },
    avgStockSeries,
    alertProducts: alertProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      current_stock_packs: p.current_stock_packs,
      margin_minimum_packs: p.margin_minimum_packs,
    })),
  });
}
