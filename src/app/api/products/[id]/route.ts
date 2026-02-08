import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const now = nowIso();

  const db = getDb();
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch = {
    product_code: String(body.product_code ?? existing.product_code).toUpperCase(),
    name: String(body.name ?? existing.name),
    category: String(body.category ?? existing.category),
    current_stock_packs: Math.max(0, Math.floor(Number(body.current_stock_packs ?? existing.current_stock_packs))),
    margin_minimum_packs: Math.max(0, Math.floor(Number(body.margin_minimum_packs ?? existing.margin_minimum_packs))),
    lead_time_days: Math.max(0, Math.floor(Number(body.lead_time_days ?? existing.lead_time_days))),
    units_per_pack: Math.max(1, Math.floor(Number(body.units_per_pack ?? existing.units_per_pack))),
    min_packs_order: Math.max(1, Math.floor(Number(body.min_packs_order ?? existing.min_packs_order)))
  };

  try {
    db.prepare(`
      UPDATE products SET
        product_code = ?, name = ?, category = ?,
        current_stock_packs = ?, margin_minimum_packs = ?, lead_time_days = ?,
        units_per_pack = ?, min_packs_order = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      patch.product_code, patch.name, patch.category,
      patch.current_stock_packs, patch.margin_minimum_packs, patch.lead_time_days,
      patch.units_per_pack, patch.min_packs_order,
      now, id
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number(params.id);
  const db = getDb();
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE products SET active = 0, updated_at = ? WHERE id = ?").run(nowIso(), id);
  return NextResponse.json({ ok: true });
}
