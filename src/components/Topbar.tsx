import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export function Topbar({ title }: { title: string }) {
  const user = getSessionUser();
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🍞</span>
            <div className="text-xl font-bold text-brand-800">{title}</div>
          </div>
          {user ? <div className="text-sm text-slate-500">Bienvenido, {user.username}</div> : null}
        </div>
        {user ? (
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/api/auth/logout">
            Salir
          </Link>
        ) : null}
      </div>
    </div>
  );
}
