"use client";
import Tech, { coordText, sizeText } from "@/components/Tech";
import LoadError from "@/components/LoadError";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type ChangeRequest, type Notice, type UnitRow } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import ScanLoader from "@/components/ScanLoader";
import UlpinBadge from "@/components/UlpinBadge";

const DiffMap = dynamic(() => import("@/components/DiffMap"), { ssr: false });

type Overview = { investor: string; units: UnitRow[]; pending_requests: ChangeRequest[]; past_requests: ChangeRequest[]; notifications: Notice[] };

export default function InvestorPage() {
  const s = useSession();
  const { t } = useT();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dispute, setDispute] = useState<{ ulpin: string; text: string; cr?: number | null } | null>(null);

  const load = () => api.investorOverview().then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { if (s.role === "owner" || s.role === "investor" || s.role === "admin") load(); }, [s]);

  if (s.role !== "owner" && s.role !== "investor" && s.role !== "admin") return <div className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">Sign in as a <b>Property Owner</b> to see changes to your property.</div>;
  if (err) return <LoadError message={err} onRetry={load} what="your plots" />;
  if (!data) return <ScanLoader text="Loading registered plots" className="p-16" />;

  async function decide(id: number, d: "approve" | "reject") {
    try { const r = await api.decide(id, d, note); setMsg(d === "approve" ? `Approved. ${r.unit.label} is now version ${r.unit.flags?.version_count}.` : "Rejected. The registered record is unchanged."); setNote(""); load(); }
    catch (e: any) { setMsg(`Error: ${e.message}`); }
  }
  async function fileDispute() {
    if (!dispute) return;
    try { const r = await api.fileDispute({ unit_ulpin: dispute.ulpin, description: dispute.text, change_request_id: dispute.cr ?? null }); setMsg(r.message); setDispute(null); load(); }
    catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Changes · {s.name}</h1>
        <p className="text-sm text-slate-600">Each card shows the <b>current registered record</b>. Nothing here can change without your approval; if it did, it is flagged.</p>
      </div>
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}

      {data.pending_requests.length > 0 && (
        <div className="card border-amber-300 p-4">
          <div className="text-sm font-semibold text-amber-900">⚠ {t("h.pending")} ({data.pending_requests.length})</div>
          {data.pending_requests.map((c) => (
            <div key={c.id} className="mt-3 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs md:grid-cols-[1fr_320px]">
              <div>
                <div className="font-medium">#{c.id} · {c.building_name} · {c.unit_label} → <span className="text-orange-700">{c.proposed_plot_number}</span></div>
                <div className="font-mono text-slate-500">{c.unit_ulpin}</div>
                <div className="mt-1">Requested by <b>{c.requested_by}</b> on {c.created_at.slice(0, 10)}</div>
                <div className="mt-1 rounded bg-white px-2 py-1">Reason: {c.reason}</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note to the builder" className="mt-2 w-full rounded border border-slate-300 px-2 py-1" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => decide(c.id, "approve")} className="btn-primary">Approve → creates new version</button>
                  <button onClick={() => decide(c.id, "reject")} className="btn-ghost">Reject</button>
                  <button onClick={() => setDispute({ ulpin: c.unit_ulpin, text: "", cr: c.id })} className="btn-ghost text-red-700">Report a problem</button>
                </div>
              </div>
              {c.diff && <DiffMap before={c.diff.before.geometry} after={c.diff.after.geometry} labels={["Registered boundary", "Proposed boundary"]} height={200} />}
            </div>
          ))}
        </div>
      )}

      {dispute && (
        <div className="card border-red-300 p-4 text-xs">
          <div className="text-sm font-semibold text-red-800">Report a problem · {dispute.ulpin}</div>
          <textarea autoFocus value={dispute.text} onChange={(e) => setDispute({ ...dispute, text: e.target.value })} rows={3} className="mt-2 w-full rounded border border-slate-300 px-2 py-1" placeholder="Describe what is wrong (number, boundary, location, ownership…)" />
          <div className="mt-2 flex gap-2"><button onClick={fileDispute} disabled={dispute.text.trim().length < 5} className="btn-accent">File dispute with the registry</button><button onClick={() => setDispute(null)} className="btn-ghost">Cancel</button></div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.units.map((u) => {
          const bad = u.flags?.has_unapproved_change || u.flags?.has_open_dispute;
          const baseline = u.flags && u.flags.version_count > 1 ? null : null;
          return (
            <div key={u.id} className={`card p-4 text-xs ${bad ? "border-red-300 glow-danger animate-pulse-danger" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">{u.label} <span className="font-normal text-slate-500">· {u.building_name}</span></div>
                  <div className="mt-1"><UlpinBadge ulpin={u.unit_ulpin} /></div>
                </div>
                <div className="text-right">
                  <div className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">Registered on {u.registered_on}</div>
                  <div className="mt-1 text-slate-500">record v{u.flags?.version_count}</div>
                </div>
              </div>
              {u.flags?.has_unapproved_change && <div className="mt-2 rounded bg-red-50 px-2 py-1 text-red-800">⚠ This record was changed without your approval (v{u.flags.version_count}). Baseline v1 is preserved in the version history.</div>}
              {u.flags?.has_open_dispute && <div className="mt-1 rounded bg-red-50 px-2 py-1 text-red-800">Dispute filed · {u.disputes?.[0]?.status}</div>}
              <dl className="mt-2 grid grid-cols-[100px_1fr] gap-x-2 gap-y-0.5">
                <dt className="text-slate-500">Plot number</dt><dd>{u.label}</dd>
                <dt className="text-slate-500">Area / usage</dt><dd>{u.area_sqm} m² · {u.usage_type}</dd>
                <dt className="text-slate-500">Size</dt><dd>{sizeText(u.volume)}</dd>
              </dl>
              <Tech>Boundary corners (x, y in metres)<br />{coordText(u.volume)}</Tech>
              <div className="mt-2"><DiffMap before={u.footprint} after={baseline} labels={["Current registered boundary", ""]} height={140} /></div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/verify?ulpin=${encodeURIComponent(u.unit_ulpin)}`} className="btn-ghost !py-1">Version history</Link>
                <Link href={`/parcel/${u.parcel_id}`} className="btn-ghost !py-1">3D view</Link>
                <button onClick={() => setDispute({ ulpin: u.unit_ulpin, text: "" })} className="btn-ghost !py-1 text-red-700">Report a problem</button>
              </div>
            </div>
          );
        })}
        {!data.units.length && <div className="text-sm text-slate-500">No units registered to {data.investor}.</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><div className="text-sm font-semibold">{t("h.notifications")}</div>
          <ul className="mt-2 space-y-1 text-xs">{data.notifications.map((n) => <li key={n.id} className="rounded bg-slate-50 px-2 py-1">{n.message} <span className="text-slate-400">· {n.created_at.slice(0, 16).replace("T", " ")}</span></li>)}{!data.notifications.length && <li className="text-slate-500">Inbox empty.</li>}</ul></div>
        <div className="card p-4"><div className="text-sm font-semibold">Past decisions</div>
          <ul className="mt-2 space-y-1 text-xs">{data.past_requests.map((c) => <li key={c.id} className="rounded bg-slate-50 px-2 py-1">#{c.id} {c.unit_label}: {c.status} · {c.reason}</li>)}{!data.past_requests.length && <li className="text-slate-500">None.</li>}</ul></div>
      </div>
    </div>
  );
}
