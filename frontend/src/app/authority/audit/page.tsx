"use client";
import { api, type AuditRow } from "@/lib/api";
import Gate from "@/components/Gate";
import AuditTable from "@/components/AuditTable";
import LoadError from "@/components/LoadError";
import { useLoad } from "@/lib/useLoad";
import ScanLoader from "@/components/ScanLoader";
export default function Audit() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }
function Inner() {
  const { data: rows, error, reload } = useLoad(() => api.audit());
  if (error) return <LoadError message={error} onRetry={reload} what="the audit log" />;
  return <div className="page"><h1 className="h1">Audit log</h1><p className="lead">Every recorded action across the registry: who, what, when, before and after.</p><div className="mt-4">{rows ? <AuditTable rows={rows} /> : <ScanLoader text="Loading audit log" />}</div></div>;
}
