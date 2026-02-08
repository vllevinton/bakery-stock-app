import { requireRole } from "@/lib/guard";
import { Topbar } from "@/components/Topbar";
import EmpleadoStockClient from "./ui/EmpleadoStockClient";


export default function EmpleadoStockPage() {
  requireRole("EMPLEADO");

  return (
    <div className="min-h-screen">
      <Topbar title="Stock Diario" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
          <b>Instrucciones:</b> Actualiza el stock actual (en <b>packs</b>) de cada producto. Se enviarán alertas automáticas cuando el stock sea bajo.
        </div>

        <EmpleadoStockClient />
      </div>
    </div>
  );
}
