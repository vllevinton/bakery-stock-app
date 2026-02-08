import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export function requireRole(role: "EMPLEADO" | "OWNER") {
  const user = getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(user.role === "OWNER" ? "/owner/dashboard" : "/empleado/stock");
  return user;
}

export function requireAuth() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  return user;
}
