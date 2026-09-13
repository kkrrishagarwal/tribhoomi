"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type PropertyUnit, type QueueRow } from "@/lib/api";
import PriorityBadge from "@/components/analysis/PriorityBadge";
import StatusPill from "@/components/StatusPill";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import { DemoBadge } from "@/components/StatusPill";
import PendingTable from "@/components/PendingTable";

export default function Authority() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }

function Inner() {
  const [d, setD] = useState<{ authority: string; counts: Record<string, number>; pending: PropertyUnit[]; conflicts: PropertyUnit[] } | null>(null);
  const [q, setQ] = useState<QueueRow[] | null>(null);
  useEffect(() => { api.authorityDashboard().then(setD).catch(() => null); api.authorityQueue().then((r) => setQ(r.queue)).catch(() => setQ([])); }, []);
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
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2"><h2 className="h2">Review priority</h2><div className="flex gap-2 text-sm"><span className="text-slate-500">Tribhoomi review-priority heuristic</span><Link href="/authority/map" className="btn-ghost !py-1">Spatial conflict map</Link></div></div>
      {q && (
        <div className="card mt-3 divide-y" style={{ borderColor: "rgba(159,176,195,0.14)" }}>
          {q.slice(0, 12).map((r) => (
            <div key={r.tpid} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="w-40"><div className="font-medium">{r.building.name} — {r.label}</div><div className="font-mono text-xs text-slate-500">{r.tpid}</div></div>
              <StatusPill status={r.verification_status} />{r.pending_modification && <span className="pill pill-pending">modification pending</span>}
              <PriorityBadge p={r.priority} />
              <Link href={`/authority/review/${r.tpid}`} className="btn-primary ml-auto !py-1">{r.priority.action}</Link>
            </div>
          ))}
          {q.length === 0 && <div className="p-4 text-slate-500">Nothing needs attention right now.</div>}
        </div>
      )}
      <h2 className="h2 mt-8">Pending verification</h2>
      <div className="mt-3"><PendingTable rows={d.pending} empty="Nothing pending. New builder submissions appear here." /></div>
    </div>
  );
}
