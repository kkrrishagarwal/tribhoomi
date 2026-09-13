"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type PropertyUnit } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import { DemoBadge } from "@/components/StatusPill";
import PendingTable from "@/components/PendingTable";

export default function Authority() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }

function Inner() {
  const [d, setD] = useState<{ authority: string; counts: Record<string, number>; pending: PropertyUnit[]; conflicts: PropertyUnit[] } | null>(null);
  useEffect(() => { api.authorityDashboard().then(setD).catch(() => null); }, []);
  if (!d) return <ScanLoader text="Loading verification queue" className="p-16" />;
  const c = d.counts;
  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="label">Property verification command center</div><h1 className="h1">{d.authority === "admin" ? "Authority Demo User" : d.authority}</h1></div><DemoBadge /></div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Pending registrations", c.pending, "warn", "/authority/pending"], ["Conflicts", c.conflicts, "bad", "/authority/conflicts"], ["Modification requests", c.modification_requests, "warn", "/authority/disputes"], ["Active disputes", c.disputes, "bad", "/authority/disputes"], ["Recently verified", c.verified, "ok", "/dashboard"]].map(([l, v, t, h]) => (
          <Link key={l as string} href={h as string} className="card stat hover:border-accent"><div className="label">{l}</div><div className={`n ${t}`}>{v}</div></Link>
        ))}
      </div>
      <h2 className="h2 mt-8">Pending verification</h2>
      <div className="mt-3"><PendingTable rows={d.pending} empty="Nothing pending. New builder submissions appear here." /></div>
    </div>
  );
}
