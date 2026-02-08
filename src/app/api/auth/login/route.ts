import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT id, username, password_hash, role, email FROM users WHERE username = ?").get(username) as any;

  if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  setSessionCookie({ id: user.id, username: user.username, role: user.role, email: user.email });

  const redirectTo = user.role === "OWNER" ? "/owner/dashboard" : "/empleado/stock";
  return NextResponse.json({ redirectTo });
}
