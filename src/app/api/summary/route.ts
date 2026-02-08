import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { computeStatus, yyyyMmDd } from "@/lib/calc";

export async function GET() {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const products = db.prepare("SELECT * FROM products WHERE active = 1").all() as any[];

  const totalProducts = products.length;
  const alertProducts = products.filter((p) => computeStatus(p.current_stock_packs, p.margin_minimum_packs) === "ALERTA");
  const alertCount = alertProducts.length;
  const okCount = totalProducts - alertCount;
  const avgStock = totalProducts ? Math.round(products.reduce((a, p) => a + p.current_stock_packs, 0) / totalProducts) : 0;

  const today = new Date();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(yyyyMmDd(d));
  }

  const avgStockSeries = days.map((day) => {
    const rows = db.prepare(`
      SELECT se.product_id, se.stock_packs
      FROM stock_entries se
      WHERE se.recorded_date = ?
      ORDER BY se.recorded_at DESC
    `).all(day) as any[];

    if (rows.length === 0) return 0;

    const map = new Map<number, number>();
    for (const r of rows) if (!map.has(r.product_id)) map.set(r.product_id, r.stock_packs);
    const vals = [...map.values()];
    return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0;
  });

  return NextResponse.json({
    kpis: { totalProducts, alertCount, okCount, avgStock },
    avgStockSeries,
    alertProducts: alertProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      current_stock_packs: p.current_stock_packs,
      margin_minimum_packs: p.margin_minimum_packs
    }))
  });
}
