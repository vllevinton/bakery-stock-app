import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export type SessionUser = {
  id: number;
  username: string;
  role: "EMPLEADO" | "OWNER";
  email?: string | null;
  branch_id?: number | null; // ✅ NUEVO
};

const COOKIE_NAME = "panaderia_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET env var");
  return s;
}

export function setSessionCookie(user: SessionUser) {
  const token = jwt.sign({ ...user }, secret(), { expiresIn: "7d" });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function getSessionUser(): SessionUser | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, secret()) as SessionUser;
  } catch {
    return null;
  }
}
