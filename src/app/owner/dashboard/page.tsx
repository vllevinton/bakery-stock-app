import { requireRole } from "@/lib/guard";
import { Topbar } from "@/components/Topbar";
import { OwnerTabs } from "@/components/OwnerTabs";
import { Sparkline } from "@/components/Sparkline";
import { headers } from "next/headers";

function parseBranchId(raw: any): 1 | 2 | 3 {
  const n = Number(String(raw ?? "").trim());
  if (n === 1 || n === 2 || n === 3) return n;
  return 1;
}

async function getSummary(branchId: 1 | 2 | 3) {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) throw new Error("No se pudo determinar el host para construir la URL.");

  const url = `${proto}://${host}/api/summary?branchId=${branchId}`;

  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    headers: {
      cookie: h.get("cookie") ?? "",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error /api/summary (${res.status}): ${txt}`);
  }

  return res.json();
}

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams?: { branchId?: string };
}) {
  requireRole("OWNER");

  const branchId = parseBranchId(searchParams?.branchId);
  const data = await getSummary(branchId);

  return (
    <div className="min-h-screen">
      <Topbar title="Panel de Control" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          {/* IMPORTANTÍSIMO: OwnerTabs tiene que preservar branchId en los links */}
          <OwnerTabs active="dashboard" branchId={branchId} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="card p-5">
            <div className="text-xs text-slate-500">TOTAL PRODUCTOS</div>
            <div className="mt-1 text-3xl font-extrabold">{data.kpis.totalProducts}</div>
          </div>

          <div className="card p-5">
            <div className="text-xs text-slate-500">EN ALERTA</div>
            <div className="mt-1 text-3xl font-extrabold text-rose-600">{data.kpis.alertCount}</div>
          </div>

          <div className="card p-5">
            <div className="text-xs text-slate-500">OK</div>
            <div className="mt-1 text-3xl font-extrabold text-emerald-600">{data.kpis.okCount}</div>
          </div>

          <div className="card p-5">
            <div className="text-xs text-slate-500">STOCK PROMEDIO</div>
            <div className="mt-1 text-3xl font-extrabold">{data.kpis.avgStock}</div>
          </div>
        </div>

        <div className="mt-6 card p-6">
          <div className="mb-2 text-lg font-bold">Promedio de Stock - Últimos 30 Días</div>
          <div className="mb-3 text-sm text-slate-500">
            Basado en el historial de cargas de los empleados.
          </div>
          <Sparkline values={data.avgStockSeries} />
        </div>

        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold text-rose-700">
            ⚠ Productos en Alerta
          </div>

          {data.alertProducts.length === 0 ? (
            <div className="text-sm text-slate-600">No hay productos en alerta.</div>
          ) : (
            <div className="space-y-3">
              {data.alertProducts.map((p: any) => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-sm text-slate-500">{p.category}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-slate-500">Stock actual</div>
                      <div className="text-2xl font-extrabold text-rose-600">
                        {p.current_stock_packs}
                      </div>
                      <div className="text-sm text-slate-500">
                        Margen: {p.margin_minimum_packs}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
