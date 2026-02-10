"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

type Row = {
  recorded_at: string;
  product_name: string;
  stock_packs: number;
  username: string;
};

function ymd(v: string) {
  // recorded_at viene ISO, esto lo convierte a YYYY-MM-DD local
  const d = new Date(v);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function OwnerHistoryClient({ branchId }: { branchId: 1 | 2 | 3 }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ filtros (producto + rango fechas)
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/history?branchId=${branchId}&limit=100`, { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data.rows) ? data.rows : []);
    setLoading(false);
  }

  // ✅ recargar cuando cambia sucursal
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // ✅ aplicar filtros en cliente
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesText = !needle
        ? true
        : `${r.product_name} ${r.username}`.toLowerCase().includes(needle);

      if (!matchesText) return false;

      if (!from && !to) return true;

      const d = ymd(r.recorded_at);
      const fs = from || "0000-01-01";
      const fe = to || "9999-12-31";
      return d >= fs && d <= fe;
    });
  }, [rows, q, from, to]);

  if (loading) return <div className="text-slate-600">Cargando…</div>;

  return (
    <div>
      <div className="mb-3">
        <div className="text-2xl font-extrabold">Historial de Actualizaciones</div>
        <div className="text-sm text-slate-500">
          Sucursal <b>{branchId}</b> · últimos 100 registros.
        </div>
      </div>

      {/* ✅ FILTROS */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input
          label="Buscar (producto / usuario)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej: Pan, sucursal1, etc."
        />

        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Desde</div>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Hasta</div>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
            }}
          >
            Limpiar
          </Button>
        </div>
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
            {filtered.map((r, idx) => (
              <tr key={idx} className="border-t border-slate-200">
                <td className="px-4 py-3">{new Date(r.recorded_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold">{r.product_name}</td>
                <td className="px-4 py-3 text-lg font-extrabold">{r.stock_packs}</td>
                <td className="px-4 py-3 text-slate-600">{r.username}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr className="border-t border-slate-200">
                <td className="px-4 py-6 text-sm text-slate-500" colSpan={4}>
                  No hay registros que coincidan con los filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
