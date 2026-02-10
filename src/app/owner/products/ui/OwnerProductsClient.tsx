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

  // por sucursal
  current_stock_packs: number;
  margin_minimum_packs: number;
  active: number;
  start_date: string | null;
  end_date: string | null;

  // catálogo
  lead_time_days: number;
  units_per_pack: number;
  min_packs_order: number;
};

const categories = ["Pan", "Pastelería", "Dulces", "Salados", "Otros"];

function toNumOrUndefined(v: string) {
  const s = String(v ?? "").trim();
  if (s === "") return undefined;
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n)) return undefined;
  return n;
}
function toIntOrZero(v: string) {
  const n = toNumOrUndefined(v);
  return typeof n === "number" ? Math.max(0, n) : 0;
}
function toIntMin1(v: string) {
  const n = toNumOrUndefined(v);
  return typeof n === "number" ? Math.max(1, n) : 1;
}
function ymdOrNull(v: string) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export default function OwnerProductsClient() {
  const [branchId, setBranchId] = useState<1 | 2 | 3>(1);

  // ✅ filtros
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/products?active=0&branchId=${branchId}`, { cache: "no-store" });
    const data = await res.json();
    setProducts(Array.isArray(data.products) ? data.products : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // ✅ rows con filtros (texto + fechas por vigencia + activos/inactivos)
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const matchesText = (p: Product) => {
      if (!needle) return true;
      const hay = `${p.name} ${p.product_code} ${p.category}`.toLowerCase();
      return hay.includes(needle);
    };

    // rango producto = [start..end] (si falta => infinito)
    // rango filtro   = [from..to]   (si falta => infinito)
    // mostrar si se solapan: start <= to && end >= from
    const overlaps = (p: Product) => {
      if (!from && !to) return true;

      const ps = (p.start_date ?? "").trim() || "0000-01-01";
      const pe = (p.end_date ?? "").trim() || "9999-12-31";
      const fs = from || "0000-01-01";
      const fe = to || "9999-12-31";

      return ps <= fe && pe >= fs;
    };

    const matchesActive = (p: Product) => {
      const isActive = Number(p.active) === 1;
      if (statusFilter === "ALL") return true;
      if (statusFilter === "ACTIVE") return isActive;
      return !isActive;
    };

    return products.filter((p) => matchesText(p) && overlaps(p) && matchesActive(p));
  }, [products, q, from, to, statusFilter]);

  async function createProduct(p: any) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/products?branchId=${branchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, branchId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear");
      setOpenNew(false);
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  async function updateProduct(id: number, p: any) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/products/${id}?branchId=${branchId}`, {
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
      setMsg(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(p: Product) {
    const ok = confirm(`¿Eliminar "${p.name}" del catálogo COMPLETO?\nEsto lo borra de todas las sucursales.`);
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al eliminar");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-slate-600">Cargando…</div>;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-extrabold">Gestión de Productos</div>
          <div className="text-sm text-slate-500">
            Estás viendo <b>Sucursal {branchId}</b>. Stock / margen son en <b>packs</b>. Fechas también son por sucursal.
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ✅ SIN el texto “Sucursal” */}
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(Number(e.target.value) as any)}
          >
            <option value={1}>Sucursal 1</option>
            <option value={2}>Sucursal 2</option>
            <option value={3}>Sucursal 3</option>
          </select>

          <Button onClick={() => setOpenNew(true)}>＋ Agregar Producto</Button>
        </div>
      </div>

      {msg ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          {msg}
        </div>
      ) : null}

      {/* ✅ FILTROS */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Input
          label="Buscar producto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, código, categoría…"
        />

        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Estado</div>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </label>

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
              setStatusFilter("ALL");
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
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Stock (packs)</th>
              <th className="px-4 py-3">Margen (packs)</th>
              <th className="px-4 py-3">Lead Time</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => {
              const status = computeStatus(p.current_stock_packs, p.margin_minimum_packs);
              const dateTxt = p.start_date || p.end_date ? `${p.start_date ?? "—"} → ${p.end_date ?? "—"}` : "—";

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
                    <div className="text-xs text-slate-600">{dateTxt}</div>
                    <div className="text-xs">
                      {p.active ? (
                        <span className="text-emerald-700">Activo</span>
                      ) : (
                        <span className="text-slate-500">Inactivo</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setOpenEdit(true);
                        }}
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => deleteProduct(p)}
                        disabled={busy}
                      >
                        🗑
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* EDIT */}
      <Modal
        open={openEdit}
        title={`Editar Producto (Sucursal ${branchId})`}
        onClose={() => {
          setOpenEdit(false);
          setEditing(null);
        }}
      >
        {editing ? (
          <ProductForm
            mode="edit"
            initial={editing}
            submitLabel={busy ? "Actualizando…" : "Actualizar Producto"}
            disabled={busy}
            onSubmit={(p) => updateProduct(editing.id, p)}
          />
        ) : null}
      </Modal>

      {/* NEW */}
      <Modal
        open={openNew}
        title={`Nuevo Producto (se crea en Sucursal ${branchId})`}
        onClose={() => setOpenNew(false)}
      >
        <ProductForm
          mode="new"
          initial={{
            product_code: "",
            name: "",
            category: "Pan",

            current_stock_packs: "",
            margin_minimum_packs: "",
            lead_time_days: "1",
            units_per_pack: "1",
            min_packs_order: "1",

            active: true,
            start_date: "",
            end_date: ""
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
  mode,
  initial,
  onSubmit,
  submitLabel,
  disabled
}: {
  mode: "new" | "edit";
  initial: any;
  onSubmit: (p: any) => void;
  submitLabel: string;
  disabled: boolean;
}) {
  const [p, setP] = useState<any>(() => shapeInitial(mode, initial));

  useEffect(() => {
    setP(shapeInitial(mode, initial));
  }, [mode, initial]);

  const set = (k: string, v: any) => setP((prev: any) => ({ ...prev, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();

        const payload: any = {
          product_code: String(p.product_code || "").trim().toUpperCase(),
          name: String(p.name || "").trim(),
          category: String(p.category || "Otros").trim(),

          lead_time_days: Math.max(0, Math.floor(Number(p.lead_time_days || 0))),
          units_per_pack: toIntMin1(p.units_per_pack),
          min_packs_order: toIntMin1(p.min_packs_order),

          current_stock_packs: toIntOrZero(p.current_stock_packs),
          margin_minimum_packs: toIntOrZero(p.margin_minimum_packs),

          active: !!p.active,

          start_date: ymdOrNull(p.start_date),
          end_date: ymdOrNull(p.end_date)
        };

        onSubmit(payload);
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Código"
          value={p.product_code}
          onChange={(e) => set("product_code", e.target.value.toUpperCase())}
          placeholder="Ej: PAN"
        />
        <Input
          label="Nombre del Producto"
          value={p.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej: Pan francés"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Categoría</div>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={p.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Lead Time (días)"
          type="number"
          min={0}
          step={1}
          value={p.lead_time_days}
          onChange={(e) => set("lead_time_days", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Stock (packs) - Sucursal"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={p.current_stock_packs}
          onChange={(e) => set("current_stock_packs", e.target.value)}
          placeholder="(vacío)"
        />
        <Input
          label="Margen mínimo (packs) - Sucursal"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={p.margin_minimum_packs}
          onChange={(e) => set("margin_minimum_packs", e.target.value)}
          placeholder="(vacío)"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Unidades por pack"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={p.units_per_pack}
          onChange={(e) => set("units_per_pack", e.target.value)}
        />
        <Input
          label="Min packs pedido (múltiplos)"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={p.min_packs_order}
          onChange={(e) => set("min_packs_order", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Activo desde</div>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={p.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Activo hasta</div>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={p.end_date}
            onChange={(e) => set("end_date", e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!!p.active} onChange={(e) => set("active", e.target.checked)} />
        Activo en esta sucursal
      </label>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
      </div>

      <div className="text-xs text-slate-500">
        * ALERTA: stock &lt; margen mínimo. Reponer (packs) se redondea a múltiplos de <b>min packs pedido</b>.
        <br />
        * Si <b>Activo hasta</b> es menor a hoy, el backend fuerza <b>inactivo</b> automáticamente.
      </div>
    </form>
  );
}

function shapeInitial(mode: "new" | "edit", initial: any) {
  if (mode === "new") return initial;

  return {
    product_code: initial.product_code ?? "",
    name: initial.name ?? "",
    category: initial.category ?? "Otros",

    current_stock_packs: String(initial.current_stock_packs ?? ""),
    margin_minimum_packs: String(initial.margin_minimum_packs ?? ""),

    lead_time_days: String(initial.lead_time_days ?? "1"),
    units_per_pack: String(initial.units_per_pack ?? "1"),
    min_packs_order: String(initial.min_packs_order ?? "1"),

    active: Number(initial.active ?? 1) === 1,

    start_date: initial.start_date ?? "",
    end_date: initial.end_date ?? ""
  };
}
