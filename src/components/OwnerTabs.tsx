"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type TabKey = "dashboard" | "products" | "history";

export function OwnerTabs({
  active,
  branchId,
}: {
  active: TabKey;
  branchId: 1 | 2 | 3;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const withBranch = (href: string) => `${href}?branchId=${branchId}`;

  const tab = (href: string, label: string, key: TabKey) => {
    const is = active === key;
    return (
      <Link
        href={withBranch(href)}
        className={
          "rounded-xl px-4 py-2 text-sm font-semibold transition " +
          (is ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-slate-100")
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2">
      {tab("/owner/dashboard", "Resumen", "dashboard")}
      {tab("/owner/products", "Productos", "products")}
      {tab("/owner/history", "Historial", "history")}

      <div className="ml-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={branchId}
          onChange={(e) => {
            const next = Number(e.target.value) as 1 | 2 | 3;
            // quedate en la misma pestaña y solo cambia branchId
            router.push(`${pathname}?branchId=${next}`);
          }}
        >
          <option value={1}>Sucursal 1</option>
          <option value={2}>Sucursal 2</option>
          <option value={3}>Sucursal 3</option>
        </select>
      </div>
    </div>
  );
}
