"use client";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type ChangeRequest, type Notice, type UnitRow } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import ScanLoader from "@/components/ScanLoader";
import ChangeRequestForm from "@/components/ChangeRequestForm";

type Overview = { builder: string; parcels: any[]; editable: UnitRow[]; locked: UnitRow[]; change_requests: ChangeRequest[]; notifications: Notice[] };

export default function BuilderPage() {
  const s = useSession();
  const { t } = useT();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [active, setActive] = useState<{ unit: UnitRow; mode: "edit" | "request" | "assign" } | null>(null);
  const [assign, setAssign] = useState({ owner_name: "", owner_email: "", ownership_type: "freehold" });

  const load = () => api.builderOverview().then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { if (s.role !== "public") load(); }, [s]);

  if (s.role === "public") return <div className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">Switch to a <b>Builder</b> identity from the header dropdown to open the builder desk.</div>;
  if (err) return <div className="p-8 text-red-600">{err}</div>;
  if (!data) return <ScanLoader text="Loading builder desk" className="p-16" />;

  const pending = data.change_requests.filter((c) => c.status === "pending");

  async function doAssign(u: UnitRow) {
    try { const r = await api.assign(u.unit_ulpin, assign); setMsg(r.message); setActive(null); setAssign({ owner_name: "", owner_email: "", ownership_type: "freehold" }); load(); }
    catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  const Row = ({ u, locked }: { u: UnitRow; locked: boolean }) => (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="w-28 font-medium">{u.label}</span>
      <span className="font-mono text-slate-500">{u.unit_ulpin}</span>
      <span className="text-slate-500">{u.building_name} · {u.area_sqm} m² · {u.usage_type}</span>
      {locked && u.ownership[0] && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">🔒 {u.ownership[0].owner_name} · {u.ownership[0].registered_date}</span>}
      {u.flags?.version_count ? <Link href={`/verify?ulpin=${encodeURIComponent(u.unit_ulpin)}`} className="rounded bg-slate-100 px-1.5 py-0.5">v{u.flags.version_count}</Link> : null}
      {u.flags?.has_pending_request && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">request pending</span>}
      {u.flags?.has_unapproved_change && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">unapproved change</span>}
      {u.flags?.has_open_dispute && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">disputed</span>}
      <span className="ml-auto flex gap-1">
        {!locked && <button onClick={() => setActive({ unit: u, mode: "edit" })} className="btn-ghost !py-1">Edit</button>}
        {!locked && <button onClick={() => setActive({ unit: u, mode: "assign" })} className="btn-primary !py-1">Assign to investor</button>}
        {locked && <button onClick={() => setActive({ unit: u, mode: "request" })} disabled={u.flags?.has_pending_request} className="btn-accent !py-1">Request change</button>}
      </span>
    </li>
  );

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Modification requests · {data.builder}</h1>
          <p className="text-sm text-slate-600">Registered and verified units are locked: a change is proposed as a modification request, reviewed by the owner and the authority, and only then recorded as a new version.</p>
        </div>
        <Link href="/builder" className="btn-ghost">← Dashboard</Link>
      </div>
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}

      {active && active.mode !== "assign" && <ChangeRequestForm unit={active.unit} mode={active.mode} onDone={(m) => { setMsg(m); setActive(null); load(); }} onCancel={() => setActive(null)} />}
      {active && active.mode === "assign" && (
        <div className="rounded-xl border border-slate-300 bg-white p-4 text-xs shadow-lg">
          <div className="text-sm font-semibold">Assign {active.unit.label} to an investor</div>
          <div className="font-mono text-slate-500">{active.unit.unit_ulpin}</div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <label className="flex flex-col"><span className="text-slate-500">Investor name</span><input value={assign.owner_name} onChange={(e) => setAssign({ ...assign, owner_name: e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></label>
            <label className="flex flex-col"><span className="text-slate-500">Email</span><input value={assign.owner_email} onChange={(e) => setAssign({ ...assign, owner_email: e.target.value })} className="rounded border border-slate-300 px-2 py-1" placeholder="name@example.in" /></label>
            <label className="flex flex-col"><span className="text-slate-500">Tenure</span><select value={assign.ownership_type} onChange={(e) => setAssign({ ...assign, ownership_type: e.target.value })} className="rounded border border-slate-300 px-2 py-1"><option>freehold</option><option>leasehold</option><option>joint</option></select></label>
          </div>
          <p className="mt-2 text-amber-800">This registers the sale and snapshots the current plot number, boundary and ULPIN as version 1. After this you can no longer edit the unit directly.</p>
          <div className="mt-3 flex gap-2"><button onClick={() => doAssign(active.unit)} className="btn-accent" disabled={!assign.owner_name || !assign.owner_email}>Register & lock baseline</button><button onClick={() => setActive(null)} className="btn-ghost">Cancel</button></div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">{t("h.editable")} ({data.editable.length})</div>
          <ul className="divide-y divide-slate-100">{data.editable.map((u) => <Row key={u.id} u={u} locked={false} />)}{!data.editable.length && <li className="p-3 text-xs text-slate-500">No unsold units.</li>}</ul>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">{t("h.locked")} ({data.locked.length})</div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">{data.locked.map((u) => <Row key={u.id} u={u} locked />)}</ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="text-sm font-semibold">My change requests</div>
          <ul className="mt-2 space-y-2 text-xs">
            {data.change_requests.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-200 p-2">
                <div className="flex items-center gap-2"><span className="font-medium">#{c.id} · {c.unit_label}</span><span className={`rounded px-1.5 py-0.5 ${c.status === "pending" ? "bg-amber-100 text-amber-800" : c.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{c.status}</span><span className="ml-auto text-slate-500">{c.created_at.slice(0, 10)}</span></div>
                <div className="font-mono text-slate-500">{c.unit_ulpin}</div>
                <div className="mt-1">{c.reason}</div>
                {c.affected_owner && <div className="text-slate-500">awaiting / decided by {c.affected_owner.name}</div>}
              </li>
            ))}
            {!data.change_requests.length && <li className="text-slate-500">None yet.</li>}
          </ul>
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold">{t("h.notifications")} {pending.length ? <span className="ml-1 rounded bg-amber-100 px-1.5 text-amber-800">{pending.length} pending</span> : null}</div>
          <ul className="mt-2 space-y-1 text-xs">
            {data.notifications.map((n) => <li key={n.id} className="rounded bg-slate-50 px-2 py-1">{n.message} <span className="text-slate-400">· {n.created_at.slice(0, 16).replace("T", " ")}</span></li>)}
            {!data.notifications.length && <li className="text-slate-500">Inbox empty.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
