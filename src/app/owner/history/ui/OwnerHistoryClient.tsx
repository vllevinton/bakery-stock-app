"use client";
import React, { useEffect, useState } from "react";

type Row = { recorded_at: string; product_name: string; stock_packs: number; username: string };

export default function OwnerHistoryClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/history?limit=100");
    const data = await res.json();
    setRows(data.rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-slate-600">Cargando…</div>;

  return (
    <div>
      <div className="mb-3">
        <div className="text-2xl font-extrabold">Historial de Actualizaciones</div>
        <div className="text-sm text-slate-500">Últimos 100 registros.</div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-100 text-slate-700">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Stock Registrado</th>
              <th className="px-4 py-3">Registrado Por</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-slate-200">
                <td className="px-4 py-3">{new Date(r.recorded_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold">{r.product_name}</td>
                <td className="px-4 py-3 text-lg font-extrabold">{r.stock_packs}</td>
                <td className="px-4 py-3 text-slate-600">{r.username}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
