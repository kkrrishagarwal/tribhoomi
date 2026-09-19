"use client";
import { api, type PropertyUnit } from "@/lib/api";
import Gate from "@/components/Gate";
import LoadError from "@/components/LoadError";
import { useLoad } from "@/lib/useLoad";
import ScanLoader from "@/components/ScanLoader";
import PendingTable from "@/components/PendingTable";
export default function Pending() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }
function Inner() {
  const { data: rows, error, reload } = useLoad(() => api.authorityDashboard().then((d) => d.pending));
  if (error) return <LoadError message={error} onRetry={reload} what="the pending list" />;
  return <div className="page"><h1 className="h1">Pending verification</h1><p className="lead">Units submitted by builders, oldest first.</p><div className="mt-4">{rows ? <PendingTable rows={rows} empty="No pending submissions." /> : <ScanLoader text="Loading" />}</div></div>;
}
