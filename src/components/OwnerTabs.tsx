import Link from "next/link";

export function OwnerTabs({ active }: { active: "dashboard" | "products" | "history" }) {
  const tab = (href: string, label: string, key: "dashboard" | "products" | "history") => {
    const is = active === key;
    return (
      <Link
        href={href}
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
    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      {tab("/owner/dashboard", "Resumen", "dashboard")}
      {tab("/owner/products", "Productos", "products")}
      {tab("/owner/history", "Historial", "history")}
    </div>
  );
}
