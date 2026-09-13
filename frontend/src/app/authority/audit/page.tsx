"use client";
import { useEffect, useState } from "react";
import { api, type AuditRow } from "@/lib/api";
import Gate from "@/components/Gate";
import AuditTable from "@/components/AuditTable";
import ScanLoader from "@/components/ScanLoader";
export default function Audit() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }
function Inner() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => { api.audit().then(setRows).catch(() => setRows([])); }, []);
  return <div className="page"><h1 className="h1">Audit log</h1><p className="lead">Every recorded action across the registry: who, what, when, before and after.</p><div className="mt-4">{rows ? <AuditTable rows={rows} /> : <ScanLoader text="Loading audit log" />}</div></div>;
}
