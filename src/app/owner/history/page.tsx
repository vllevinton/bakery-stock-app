import { requireRole } from "@/lib/guard";
import { Topbar } from "@/components/Topbar";
import { OwnerTabs } from "@/components/OwnerTabs";
import OwnerHistoryClient from "./ui/OwnerHistoryClient";

export default function OwnerHistoryPage() {
  requireRole("OWNER");
  return (
    <div className="min-h-screen">
      <Topbar title="Panel de Control" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <OwnerTabs active="history" />
        </div>
        <OwnerHistoryClient />
      </div>
    </div>
  );
}
