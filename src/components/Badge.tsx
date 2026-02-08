import React from "react";

export function Badge({ variant, children }: { variant: "ok" | "alert"; children: React.ReactNode }) {
  const cls =
    variant === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-rose-50 text-rose-700 border-rose-200";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${cls}`}>{children}</span>;
}
