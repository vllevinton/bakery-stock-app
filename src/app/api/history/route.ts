import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(10, Number(url.searchParams.get("limit") || 100)));

  const db = getDb();
  const rows = db.prepare(`
    SELECT se.recorded_at, p.name as product_name, se.stock_packs, u.username
    FROM stock_entries se
    JOIN products p ON p.id = se.product_id
    JOIN users u ON u.id = se.recorded_by
    ORDER BY se.id DESC
    LIMIT ?
  `).all(limit);

  return NextResponse.json({ rows });
}
