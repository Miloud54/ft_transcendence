import { Suspense } from "react";
import { DashboardContent } from "./dashboard-content";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading dashboard...</p>}>
      <DashboardContent />
    </Suspense>
  );
}
