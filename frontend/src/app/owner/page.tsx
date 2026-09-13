"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Alert, type PropertyPage } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import StatusPill from "@/components/StatusPill";

export default function Owner() { return <Gate roles={["owner", "admin"]} signin="/signin/owner"><Inner /></Gate>; }
function Inner() {
  const s = useSession(); const [rows, setRows] = useState<PropertyPage[] | null>(null); const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => { api.ownerProperties().then((d) => setRows(d.properties)).catch(() => setRows([])); api.alerts().then((a) => setAlerts(a.alerts)).catch(() => null); }, [s]);
  if (!rows) return <ScanLoader text="Loading your properties" className="p-16" />;
  return (
    <div className="page">
      <h1 className="h1">My property</h1><p className="lead">{s.name} · {rows.length} registered propert{rows.length === 1 ? "y" : "ies"}. Anything that changes shows up here and on the Changes page.</p>
      {alerts.length > 0 && (
        <div className="card mt-4 p-4"><div className="flex items-center justify-between"><div className="font-semibold">Property change alerts</div><div className="text-xs text-slate-500">Tribhoomi application notifications, not government alerts</div></div>
          <ul className="mt-2 space-y-2">{alerts.slice(0, 6).map((a, i) => <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{a.building} — {a.label}</span><span className="font-mono text-xs text-slate-500">{a.at.slice(0, 16).replace("T", " ")}</span></div><div>{a.event}{a.area && <> · area {a.area.before_sqft.toLocaleString()} → {a.area.after_sqft.toLocaleString()} sq ft</>}{a.pending_modification && <span className="ml-1 text-amber-300">· pending authority review</span>}</div><Link href={`/property/${a.tpid}`} className="text-accent underline">View change</Link></li>)}</ul></div>
      )}
      {rows.length === 0 && <div className="card mt-4 p-6 text-center text-slate-500">No property is registered to {s.user}. Pick a demo owner from the sign-in page to see data.</div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((p) => {
          const bad = p.flags.has_unapproved_change || p.disputes_open > 0;
          return (
            <Link key={p.tpid} href={`/property/${p.tpid}`} className={`card p-4 hover:border-accent ${bad ? "border-red-400" : ""}`}>
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{p.building.name} — {p.label}</div><div className="text-sm text-slate-500">{p.project.name}, {p.project.city}</div></div><StatusPill status={p.verification_status} /></div>
              <div className="mt-2 font-mono text-sm text-accent">{p.tpid}</div>
              <div className="mt-1 text-sm text-slate-500">{p.unit_type} · {p.area_sqft.toLocaleString()} sq ft · registered {p.owner?.registered_on} · integrity {p.integrity.score}/100</div>
              {bad && <div className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">⚠ {p.flags.has_unapproved_change ? "Changed without your approval. " : ""}{p.disputes_open > 0 ? `${p.disputes_open} dispute open.` : ""}</div>}
              {p.pending_modification && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">A modification request is waiting for your decision.</div>}
            </Link>
          );
        })}
      </div>
      <div className="mt-6 text-sm text-slate-500">Need to approve or reject a modification request? <Link href="/changes" className="text-accent hover:underline">Open Changes</Link>.</div>
    </div>
  );
}
