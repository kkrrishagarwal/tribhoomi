"use client";
import { useEffect, useState } from "react";
import { api, type AuditRow } from "@/lib/api";
import Gate from "@/components/Gate";
import AuditTable from "@/components/AuditTable";
import ScanLoader from "@/components/ScanLoader";
export default function Audit() { return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Inner /></Gate>; }
function Inner() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => { api.audit().then(setRows).catch(() => setRows([])); }, []);
  return <div className="page"><h1 className="h1">Audit trail</h1><p className="lead">Every important action on your projects, in order.</p><div className="mt-4">{rows ? <AuditTable rows={rows} /> : <ScanLoader text="Loading audit trail" />}</div></div>;
}
