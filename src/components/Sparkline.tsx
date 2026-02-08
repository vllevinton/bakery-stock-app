import React from "react";

export function Sparkline({ values }: { values: number[] }) {
  const w = 760, h = 220;
  if (!values.length) return <div className="text-sm text-slate-500">Sin datos todavía.</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * (w - 20) + 10;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand-700" />
      {pts.map(([x, y], idx) => <circle key={idx} cx={x} cy={y} r="4" className="fill-brand-500" />)}
    </svg>
  );
}
