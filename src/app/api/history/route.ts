import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function parseBranchId(raw: string | null): 1 | 2 | 3 {
  const n = Number(raw);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

export async function GET(req: Request) {
  const user = getSessionUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(10, Number(url.searchParams.get("limit") || 100)));
  const branchId = parseBranchId(url.searchParams.get("branchId"));

  const db = getDb();
  const rows = db.prepare(`
    SELECT se.recorded_at, p.name as product_name, se.stock_packs, u.username
    FROM stock_entries se
    JOIN products p ON p.id = se.product_id
    JOIN users u ON u.id = se.recorded_by
    WHERE se.branch_id = ?
    ORDER BY se.id DESC
    LIMIT ?
  `).all(branchId, limit);

  return NextResponse.json({ branchId, rows });
}
