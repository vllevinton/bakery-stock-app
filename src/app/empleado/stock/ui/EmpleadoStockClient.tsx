"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { computeStatus } from "@/lib/calc";

type Product = {
  id: number;
  product_code: string;
  name: string;
  category: string;
  current_stock_packs: number;
  margin_minimum_packs: number;
};

export default function EmpleadoStockClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products?active=1");
    const data = await res.json();
    setProducts(data.products);
    const init: Record<number, number> = {};
    for (const p of data.products) init[p.id] = p.current_stock_packs;
    setDraft(init);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const anyChanged = useMemo(
    () => products.some((p) => (draft[p.id] ?? p.current_stock_packs) !== p.current_stock_packs),
    [products, draft]
  );

  async function saveAll() {
    setMsg(null);
    setSaving(true);
    try {
      const items = products.map((p) => ({ productId: p.id, stockPacks: Number(draft[p.id] ?? p.current_stock_packs) }));
      const res = await fetch("/api/stock/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      setMsg(data.message || "Guardado.");
      await load();
    } catch (e: any) {
      setMsg(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-600">Cargando productos…</div>;

  return (
    <div className="space-y-4">
      {products.map((p) => {
        const value = draft[p.id] ?? p.current_stock_packs;
        const status = computeStatus(value, p.margin_minimum_packs);
        return (
          <div key={p.id} className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-bold">{p.name}</div>
                <div className="text-sm text-slate-500">{p.product_code} · {p.category}</div>
              </div>
              <Badge variant={status === "OK" ? "ok" : "alert"}>{status === "OK" ? "✓ OK" : "⚠ Alerta"}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-600">Margen mínimo</div>
                <div className="text-lg font-semibold">{p.margin_minimum_packs} packs</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Stock actual (packs)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [p.id]: Math.max(0, Math.floor(Number(e.target.value || 0))) }))}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-4 flex justify-center">
        <Button className="w-full max-w-xl py-4 text-base" onClick={saveAll} disabled={saving || !anyChanged}>
          {saving ? "Guardando…" : "Guardar Todos los Cambios"}
        </Button>
      </div>

      {msg ? <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}
