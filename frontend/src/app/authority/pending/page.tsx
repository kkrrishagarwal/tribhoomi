"use client";
import { useEffect, useState } from "react";
import { api, type PropertyUnit } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import PendingTable from "@/components/PendingTable";
export default function Pending() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }
function Inner() {
  const [rows, setRows] = useState<PropertyUnit[] | null>(null);
  useEffect(() => { api.authorityDashboard().then((d) => setRows(d.pending)).catch(() => setRows([])); }, []);
  return <div className="page"><h1 className="h1">Pending verification</h1><p className="lead">Units submitted by builders, oldest first.</p><div className="mt-4">{rows ? <PendingTable rows={rows} empty="No pending submissions." /> : <ScanLoader text="Loading" />}</div></div>;
}
