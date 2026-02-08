import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const active = url.searchParams.get("active");
  const db = getDb();

  const rows = active === "1"
    ? db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY name ASC").all()
    : db.prepare("SELECT * FROM products ORDER BY name ASC").all();

  return NextResponse.json({ products: rows });
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const now = nowIso();

  const product_code = String(body.product_code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const category = String(body.category || "Otros").trim();
  const current_stock_packs = Math.max(0, Math.floor(Number(body.current_stock_packs ?? 0)));
  const margin_minimum_packs = Math.max(0, Math.floor(Number(body.margin_minimum_packs ?? 0)));
  const lead_time_days = Math.max(0, Math.floor(Number(body.lead_time_days ?? 1)));
  const units_per_pack = Math.max(1, Math.floor(Number(body.units_per_pack ?? 1)));
  const min_packs_order = Math.max(1, Math.floor(Number(body.min_packs_order ?? 1)));

  if (!product_code || !name) return NextResponse.json({ error: "Código y nombre son obligatorios" }, { status: 400 });

  const db = getDb();
  try {
    const info = db.prepare(`
      INSERT INTO products
      (product_code, name, category, current_stock_packs, margin_minimum_packs, lead_time_days, units_per_pack, min_packs_order, active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(product_code, name, category, current_stock_packs, margin_minimum_packs, lead_time_days, units_per_pack, min_packs_order, 1, now, now);

    return NextResponse.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}
