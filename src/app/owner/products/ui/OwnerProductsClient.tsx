"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { computeStatus } from "@/lib/calc";

type Product = {
  id: number;
  product_code: string;
  name: string;
  category: string;
  current_stock_packs: number;
  margin_minimum_packs: number;
  lead_time_days: number;
  units_per_pack: number;
  min_packs_order: number;
  active: number;
};

const categories = ["Pan", "Pastelería", "Dulces", "Salados", "Otros"];

export default function OwnerProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products?active=1");
    const data = await res.json();
    setProducts(data.products);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => products, [products]);

  async function createProduct(p: Partial<Product>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear");
      setOpenNew(false);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateProduct(id: number, p: Partial<Product>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al actualizar");
      setOpenEdit(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(p: Product) {
    const ok = confirm(`¿Estás seguro de eliminar "${p.name}"?`);
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al eliminar");
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-slate-600">Cargando…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold">Gestión de Productos</div>
          <div className="text-sm text-slate-500">Todos los valores de stock / margen son en <b>packs</b>.</div>
        </div>
        <Button onClick={() => setOpenNew(true)}>＋ Agregar Producto</Button>
      </div>

      {msg ? <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{msg}</div> : null}

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-100 text-slate-700">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Margen</th>
              <th className="px-4 py-3">Lead Time</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const status = computeStatus(p.current_stock_packs, p.margin_minimum_packs);
              return (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.product_code}</div>
                  </td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3 text-lg font-extrabold">{p.current_stock_packs}</td>
                  <td className="px-4 py-3">{p.margin_minimum_packs}</td>
                  <td className="px-4 py-3">{p.lead_time_days}d</td>
                  <td className="px-4 py-3">
                    <Badge variant={status === "OK" ? "ok" : "alert"}>{status === "OK" ? "✓ OK" : "⚠ Alerta"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => { setEditing(p); setOpenEdit(true); }}>✏️</Button>
                      <Button variant="ghost" className="text-rose-600" onClick={() => deleteProduct(p)} disabled={busy}>🗑</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={openEdit} title="Editar Producto" onClose={() => { setOpenEdit(false); setEditing(null); }}>
        {editing ? (
          <ProductForm
            initial={editing}
            submitLabel={busy ? "Actualizando…" : "Actualizar Producto"}
            disabled={busy}
            onSubmit={(p) => updateProduct(editing.id, p)}
          />
        ) : null}
      </Modal>

      <Modal open={openNew} title="Nuevo Producto" onClose={() => setOpenNew(false)}>
        <ProductForm
          initial={{
            product_code: "",
            name: "",
            category: "Pan",
            current_stock_packs: 0,
            margin_minimum_packs: 10,
            lead_time_days: 1,
            units_per_pack: 1,
            min_packs_order: 1
          }}
          submitLabel={busy ? "Creando…" : "Crear Producto"}
          disabled={busy}
          onSubmit={(p) => createProduct(p)}
        />
      </Modal>
    </div>
  );
}

function ProductForm({
  initial,
  onSubmit,
  submitLabel,
  disabled
}: {
  initial: any;
  onSubmit: (p: any) => void;
  submitLabel: string;
  disabled: boolean;
}) {
  const [p, setP] = useState<any>(initial);

  useEffect(() => { setP(initial); }, [initial]);

  const set = (k: string, v: any) => setP((prev: any) => ({ ...prev, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(p);
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Código (product_id)" value={p.product_code} onChange={(e) => set("product_code", e.target.value.toUpperCase())} placeholder="Ej: PAN" />
        <Input label="Nombre del Producto" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Pan francés" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Categoría</div>
          <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" value={p.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Input label="Lead Time (días)" type="number" min={0} step={1} value={p.lead_time_days} onChange={(e) => set("lead_time_days", Math.max(0, Math.floor(Number(e.target.value || 0))))} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Stock Actual (packs)" type="number" min={0} step={1} value={p.current_stock_packs} onChange={(e) => set("current_stock_packs", Math.max(0, Math.floor(Number(e.target.value || 0))))} />
        <Input label="Margen Mínimo (packs)" type="number" min={0} step={1} value={p.margin_minimum_packs} onChange={(e) => set("margin_minimum_packs", Math.max(0, Math.floor(Number(e.target.value || 0))))} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Unidades por pack" type="number" min={1} step={1} value={p.units_per_pack} onChange={(e) => set("units_per_pack", Math.max(1, Math.floor(Number(e.target.value || 1))))} />
        <Input label="Min packs pedido (múltiplos)" type="number" min={1} step={1} value={p.min_packs_order} onChange={(e) => set("min_packs_order", Math.max(1, Math.floor(Number(e.target.value || 1))))} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={disabled}>{submitLabel}</Button>
      </div>

      <div className="text-xs text-slate-500">
        * ALERTA: stock &lt; margen mínimo. Reponer (packs) se redondea a múltiplos de <b>min packs pedido</b>.
      </div>
    </form>
  );
}
