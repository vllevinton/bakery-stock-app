import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" };

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const v =
    variant === "primary"
      ? "bg-brand-700 text-white hover:bg-brand-800"
      : variant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : "bg-transparent text-slate-700 hover:bg-slate-100";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
