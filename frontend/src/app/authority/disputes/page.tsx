"use client";
import LoadError from "@/components/LoadError";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type ChangeRequest, type Dispute } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import ScanLoader from "@/components/ScanLoader";

const DiffMap = dynamic(() => import("@/components/DiffMap"), { ssr: false });

type Overview = { open_disputes: Dispute[]; resolved_disputes: Dispute[]; pending_requests: ChangeRequest[]; decided_requests: ChangeRequest[]; tampered_units: { unit_ulpin: string; label: string; parcel_id: number }[]; counts: Record<string, number> };

export default function AdminPage() {
  const s = useSession();
  const { t } = useT();
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.adminOverview().then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { if (s.role === "admin") load(); }, [s]);

  if (s.role !== "admin") return <div className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">Sign in as the <b>Government authority</b> to open the audit view. <Link href="/signin?role=authority&next=%2Fauthority%2Fdisputes" className="btn-accent mt-3 justify-center">Sign in (demo mode)</Link></div>;
  if (err) return <LoadError message={err} onRetry={load} what="the disputes" />;
  if (!d) return <ScanLoader text="Loading audit queue" className="p-16" />;

  const Before = ({ b, a }: { b: any; a: any }) => (
    <table className="text-[11px]">
      <thead><tr className="text-slate-500"><th></th><th className="text-left">Before</th><th className="text-left">After</th></tr></thead>
      <tbody>
        <tr><td className="pr-2 text-slate-500">Plot no.</td><td>{b?.plot_number ?? "—"}</td><td className={b?.plot_number !== a?.plot_number ? "font-semibold text-orange-700" : ""}>{a?.plot_number ?? "—"}</td></tr>
        {b?.version !== undefined && <tr><td className="pr-2 text-slate-500">Version</td><td>v{b.version}</td><td>v{a?.version} {a?.approval_status && <span className={a.approval_status === "unapproved" ? "text-red-700" : ""}>({a.approval_status})</span>}</td></tr>}
        <tr><td className="pr-2 text-slate-500">Boundary</td><td colSpan={2}>{JSON.stringify(b?.geometry?.coordinates?.[0]) === JSON.stringify(a?.geometry?.coordinates?.[0]) ? "unchanged" : <span className="font-semibold text-orange-700">changed (see map)</span>}</td></tr>
      </tbody>
    </table>
  );

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Disputes &amp; modification requests</h1>
        <p className="text-sm text-slate-600">Every open dispute and pending change request across the registry, with the before/after record side by side. No raw tables needed.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Open disputes", d.counts.disputes_open], ["Pending change requests", d.counts.requests_pending], ["Units changed without approval", d.tampered_units.length], ["Plot versions on record", d.counts.versions_total]].map(([l, v]) => (
          <div key={l as string} className="card p-3"><div className="label">{l}</div><div className="text-2xl font-semibold tabular-nums">{v}</div></div>
        ))}
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold text-red-800">{t("h.openDisputes")} ({d.open_disputes.length})</div>
        {d.open_disputes.map((x) => (
          <div key={x.id} className="mt-3 grid gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs md:grid-cols-[1fr_300px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Dispute #{x.id} · {x.building_name} · {x.unit_label}</span>
                <span className={`rounded px-1.5 py-0.5 text-white ${x.status === "open" ? "bg-red-600" : "bg-amber-500"}`}>{x.status}</span>
                <span className="text-slate-500">{x.created_at.slice(0, 10)}</span>
              </div>
              <div className="font-mono text-slate-500">{x.unit_ulpin}</div>
              <div className="mt-1">Raised by <b>{x.raised_by}</b>{x.owner ? ` (registered owner: ${x.owner.name})` : ""}{x.change_request_id ? ` · against change request #${x.change_request_id}` : ""}{x.plot_version_id ? ` · against version record #${x.plot_version_id}` : ""}</div>
              <div className="mt-1 rounded bg-white px-2 py-1">“{x.description}”</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {x.flags.has_unapproved_change && <span className="glow-danger animate-pulse-danger rounded bg-red-600 px-1.5 py-0.5 font-mono uppercase tracking-wider text-white">record changed WITHOUT owner approval</span>}
                <Before b={x.diff.before} a={x.diff.after} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/verify?ulpin=${encodeURIComponent(x.unit_ulpin)}`} className="btn-ghost !py-1">Full history</Link>
                <Link href={`/parcel/${x.parcel_id}`} className="btn-ghost !py-1">3D view</Link>
                {x.status === "open" && <button onClick={() => api.setDisputeStatus(x.id, "investigating").then(load)} className="btn-primary !py-1">Start investigation</button>}
                <button onClick={() => api.setDisputeStatus(x.id, "resolved").then(load)} className="btn-ghost !py-1">Mark resolved</button>
              </div>
            </div>
            {x.diff.before && <DiffMap before={x.diff.before.geometry} after={x.diff.after?.geometry ?? null} labels={[`v${x.diff.before.version} registered`, `v${x.diff.after?.version} current`]} height={200} />}
          </div>
        ))}
        {!d.open_disputes.length && <div className="mt-2 text-xs text-slate-500">No open disputes.</div>}
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold text-amber-900">{t("h.pendingRequests")} ({d.pending_requests.length})</div>
        {d.pending_requests.map((c) => (
          <div key={c.id} className="mt-3 grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs md:grid-cols-[1fr_300px]">
            <div>
              <div className="font-semibold">Request #{c.id} · {c.building_name} · {c.unit_label} → {c.proposed_plot_number}</div>
              <div className="font-mono text-slate-500">{c.unit_ulpin}</div>
              <div className="mt-1">By <b>{c.requested_by}</b> on {c.created_at.slice(0, 10)} · awaiting {c.affected_owner?.name}</div>
              <div className="mt-1 rounded bg-white px-2 py-1">Reason: {c.reason}</div>
              {c.diff && <div className="mt-2"><Before b={c.diff.before} a={c.diff.after} /></div>}
            </div>
            {c.diff && <DiffMap before={c.diff.before.geometry} after={c.diff.after.geometry} labels={["Registered", "Proposed"]} height={200} />}
          </div>
        ))}
        {!d.pending_requests.length && <div className="mt-2 text-xs text-slate-500">Nothing pending.</div>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4 text-xs"><div className="text-sm font-semibold">Decided change requests</div>
          <ul className="mt-2 space-y-1">{d.decided_requests.map((c) => <li key={c.id} className="rounded bg-slate-50 px-2 py-1">#{c.id} {c.unit_label}: <b>{c.status}</b> by {c.affected_owner?.name} · {c.reason}</li>)}{!d.decided_requests.length && <li className="text-slate-500">None.</li>}</ul></div>
        <div className="card p-4 text-xs"><div className="text-sm font-semibold">Resolved disputes</div>
          <ul className="mt-2 space-y-1">{d.resolved_disputes.map((x) => <li key={x.id} className="rounded bg-slate-50 px-2 py-1">#{x.id} {x.unit_label}: {x.description}</li>)}{!d.resolved_disputes.length && <li className="text-slate-500">None.</li>}</ul></div>
      </div>
    </div>
  );
}
