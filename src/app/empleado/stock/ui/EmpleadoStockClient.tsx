"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";

type Product = {
  id: number;
  name: string;
  current_stock_packs: number; // viene del backend, pero el empleado NO lo ve
};

export default function EmpleadoStockClient() {
  const [products, setProducts] = useState<Product[]>([]);
  // draft como string para permitir vacío ""
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/products?active=1", { cache: "no-store" });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setLoading(false);
      throw new Error(`Error /api/products (${res.status}): ${txt}`);
    }

    const data = await res.json();
    const list = (data?.products ?? []) as Product[];
    setProducts(list);

    // ✅ input vacío SIEMPRE (no precargar lo anterior)
    const init: Record<number, string> = {};
    for (const p of list) init[p.id] = "";
    setDraft(init);

    setLoading(false);
  }

  useEffect(() => {
    load().catch((e: any) => setMsg(e?.message || "Error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opción B: solo se envían los que tengan número válido
  const itemsToSend = useMemo(() => {
    const items: { productId: number; stockPacks: number }[] = [];

    for (const p of products) {
      const raw = (draft[p.id] ?? "").trim();
      if (raw === "") continue;

      // Solo enteros >= 0
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      const stockPacks = Math.max(0, Math.floor(n));

      items.push({ productId: p.id, stockPacks });
    }

    return items;
  }, [products, draft]);

  const canSave = itemsToSend.length > 0;

  async function saveAll() {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/stock/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ Opción B: solo enviamos los completados
        body: JSON.stringify({ items: itemsToSend }),
      });

      const txt = await res.text().catch(() => "");
      let data: any = {};
      try {
        data = txt ? JSON.parse(txt) : {};
      } catch {
        // si no es JSON, igual mostramos error friendly
      }

      if (!res.ok) {
        throw new Error(data?.error || `No se pudo guardar (HTTP ${res.status})`);
      }

      setMsg(data.message || "Guardado.");
      // recargar lista y resetear inputs a vacío nuevamente
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-600">Cargando productos…</div>;

  return (
    <div className="space-y-3">
      {products.map((p) => (
        <div key={p.id} className="card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-base font-semibold">{p.name}</div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 whitespace-nowrap">Ingresar packs</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                placeholder="0"
                value={draft[p.id] ?? ""}
                onChange={(e) => {
                  // permitir vacío
                  const v = e.target.value;
                  if (v === "") {
                    setDraft((d) => ({ ...d, [p.id]: "" }));
                    return;
                  }
                  // solo dígitos
                  if (!/^\d+$/.test(v)) return;

                  // limitar a ~5 caracteres si querés (como pediste visualmente)
                  const limited = v.slice(0, 5);
                  setDraft((d) => ({ ...d, [p.id]: limited }));
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="sticky bottom-4 flex justify-center">
        <Button className="w-full max-w-xl py-4 text-base" onClick={saveAll} disabled={saving || !canSave}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      {msg ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}
