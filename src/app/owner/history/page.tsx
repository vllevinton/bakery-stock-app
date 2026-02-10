import { requireRole } from "@/lib/guard";
import { Topbar } from "@/components/Topbar";
import { OwnerTabs } from "@/components/OwnerTabs";
import OwnerHistoryClient from "./ui/OwnerHistoryClient";

function parseBranchId(raw: any): 1 | 2 | 3 {
  const n = Number(String(raw ?? "").trim());
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

export default function OwnerHistoryPage({
  searchParams,
}: {
  searchParams: { branchId?: string };
}) {
  requireRole("OWNER");

  const branchId = parseBranchId(searchParams?.branchId);

  return (
    <div className="min-h-screen">
      <Topbar title="Panel de Control" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <OwnerTabs active="history" branchId={branchId} />
        </div>
        <OwnerHistoryClient branchId={branchId} />
      </div>
    </div>
  );
}
