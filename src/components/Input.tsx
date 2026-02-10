import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string };

export function Input({ label, className = "", ...props }: Props) {
  const value =
    props.value === null || props.value === undefined
      ? ""
      : (props.value as any);

  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-slate-700">{label}</div> : null}
      <input
        {...props}
        value={value}
        className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 ${className}`}
      />
    </label>
  );
}
