"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Analysis } from "@/lib/api";
import ChangeAnalysis from "@/components/analysis/ChangeAnalysis";
import PropertyImpact from "@/components/analysis/PropertyImpact";
import WhyFlagged from "@/components/analysis/WhyFlagged";
import PropertyRelationships from "@/components/analysis/PropertyRelationships";
import ProductLoop from "@/components/ProductLoop";
import SimulationPanel from "@/components/analysis/SimulationPanel";
import RiskTimeline from "@/components/analysis/RiskTimeline";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import StatusPill from "@/components/StatusPill";
import BoundaryEditor from "@/components/BoundaryEditor";
import ValidationPanel from "@/components/ValidationPanel";
import AuditTable from "@/components/AuditTable";

type Review = Awaited<ReturnType<typeof api.authorityReview>>;

export default function ReviewPage() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }

function Inner() {
  const { id } = useParams<{ id: string }>(); const router = useRouter();
  const [r, setR] = useState<Review | null>(null); const [note, setNote] = useState(""); const [cat, setCat] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [an, setAn] = useState<Analysis | null>(null); const [tab, setTab] = useState<"changed" | "simulate" | "timeline" | null>(null);
  useEffect(() => { api.authorityReview(id).then(setR).catch((e) => setMsg(`Error: ${e.message}`)); api.analysis(id).then((a) => { setAn(a); if (a.change) setTab("changed"); }).catch(() => null); }, [id]);
  async function decide(d: "approve" | "reject" | "changes") {
    setBusy(true); setMsg(null);
    try {
      const pendingCr = an?.change?.mode === "registered_vs_proposed" ? an.change.proposal_id : null;
      const res = pendingCr ? await api.decideV2(pendingCr, d, note, cat) : await api.authorityDecideV2(id, d, note, cat);
      setMsg("message" in res ? (res as any).message : `Modification ${d === "approve" ? "approved" : d === "reject" ? "rejected" : "sent back for correction"}.`);
      setTimeout(() => router.push("/authority"), 1400);
    } catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
  }
  if (!r) return msg ? <div className="page text-red-300">{msg}</div> : <ScanLoader text="Loading verification request" className="p-16" />;
  const u = r.unit;
  return (
    <div className="page">
      <Link href="/authority" className="text-sm text-slate-500 hover:underline">← Review queue</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><div className="label">Property verification request</div><h1 className="h1">{u.building.name} — Unit {u.label}</h1><div className="text-slate-500">{u.project.name}, {u.project.city} · {u.floor_label} · {u.unit_type} · {u.area_sqft.toLocaleString()} sq ft</div></div>
        <div className="flex flex-col items-end gap-2"><StatusPill status={u.verification_status} /><span className="demo-badge">Simulated authority · demo mode</span></div>
      </div>
      <ProductLoop className="mt-4" active={4} caption="You are the reviewer. Tribhoomi shows what changed and who it affects; the decision and its reason are yours, and both are kept in the audit trail." />
      <div className="mt-3"><WhyFlagged an={an} flags={u.flags} status={u.verification_status} /></div>
      {an && (
        <div className="mt-4 flex flex-wrap gap-2">
          {an.change && <button onClick={() => setTab(tab === "changed" ? null : "changed")} className={tab === "changed" ? "btn-primary" : "btn-ghost"}>What changed?</button>}
          <button onClick={() => setTab(tab === "simulate" ? null : "simulate")} className={tab === "simulate" ? "btn-primary" : "btn-ghost"}>Simulate modification</button>
          <button onClick={() => setTab(tab === "timeline" ? null : "timeline")} className={tab === "timeline" ? "btn-primary" : "btn-ghost"}>Risk timeline</button>
        </div>
      )}
      {an && tab === "changed" && an.change && <div className="mt-3 space-y-3"><ChangeAnalysis c={an.change} footprint={r.building.footprint_local} neighbours={r.neighbours.map((n) => ({ label: n.label, tpid: n.tpid, volume: n.volume }))} /><PropertyImpact an={an} label={u.label} /></div>}
      {an && tab === "simulate" && <div className="mt-3"><SimulationPanel tpid={u.tpid} footprint={r.building.footprint_local} parcel={r.parcel.local} current={{ min: [u.volume!.min[0], u.volume!.min[1]], max: [u.volume!.max[0], u.volume!.max[1]] }} neighbours={r.neighbours.map((n) => ({ label: n.label, tpid: n.tpid, volume: n.volume }))} /></div>}
      {an && tab === "timeline" && <div className="card mt-3 p-4"><RiskTimeline events={an.timeline} /></div>}
      {an && <div className="card mt-3 p-3 text-sm"><span className="label">Tribhoomi insight</span> <span className="ml-2">{an.insight}</span></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-3"><div className="label">Tribhoomi Property ID</div><div className="font-mono text-lg text-accent">{u.tpid}</div></div>
        <div className="card p-3"><div className="label">Submitted by</div><div>{u.project.developer}</div></div>
        <div className="card p-3"><div className="label">Land record (technical)</div><div className="font-mono text-xs">{u.land_record_id}</div><div className="text-xs text-slate-500">{r.parcel.is_demo ? "Demonstration parcel, not a government record" : ""}</div></div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="card p-4"><div className="label mb-2">Evidence · unit geometry with neighbours (grey dashed = building outline)</div>
            <BoundaryEditor footprint={r.building.footprint_local} parcel={r.parcel.local} readOnly height={360} value={{ min: [u.volume!.min[0], u.volume!.min[1]], max: [u.volume!.max[0], u.volume!.max[1]] }} onChange={() => {}}
              neighbours={r.neighbours.map((n) => ({ label: n.label, volume: n.volume, conflict: r.validation.conflicts.some((c) => c.with_tpid === n.tpid) }))} />
            <div className="mt-2 flex gap-2 text-sm"><Link href={`/parcel/${u.project.id}`} className="btn-ghost !py-1">View in 3D</Link><Link href={`/property/${u.tpid}`} className="btn-ghost !py-1">Public property page</Link></div>
          </div>
          {an && <PropertyRelationships an={an} label={u.label} />}
          {r.versions.length > 0 && <div className="card p-4"><div className="label mb-2">Previous versions</div><ul className="text-sm">{r.versions.map((v) => <li key={v.id}>v{v.version_number} · {v.created_at.slice(0, 10)} · {v.approval_status} · {v.plot_number}</li>)}</ul></div>}
          <div><div className="label mb-2">Audit history</div><AuditTable rows={r.audit} /></div>
        </div>
        <div className="space-y-4">
          <ValidationPanel v={r.validation} compact />
          <div className="card p-4">
            <div className="font-semibold">Decision{an?.change?.mode === "registered_vs_proposed" && <span className="ml-2 text-xs font-normal text-amber-300">on the pending modification #{an.change.proposal_id}</span>}</div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"><option value="">Reason category (required for reject / changes)</option>{(an?.decision_categories ?? ["Boundary correction", "Duplicate property", "Area mismatch", "Missing information", "Parcel conflict", "Neighbour conflict", "Documentation issue", "Other"]).map((c) => <option key={c}>{c}</option>)}</select>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Additional note for the permanent record" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
            {msg && <div className={`mt-2 rounded-lg p-2 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={() => decide("approve")} disabled={busy || !(u.verification_status === "pending" || an?.change?.mode === "registered_vs_proposed")} className="btn-accent justify-center">{an?.change?.mode === "registered_vs_proposed" ? "Approve modification · record new version" : "Approve · mark verified"}</button>
              <button onClick={() => decide("changes")} disabled={busy || !(u.verification_status === "pending" || an?.change?.mode === "registered_vs_proposed") || (!cat && note.trim().length < 3)} className="btn-ghost justify-center">Request changes</button>
              <button onClick={() => decide("reject")} disabled={busy || !(u.verification_status === "pending" || an?.change?.mode === "registered_vs_proposed") || (!cat && note.trim().length < 3)} className="btn-ghost justify-center text-red-300">Reject</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Every decision is written to the audit log with your name and timestamp. Approval issues a verification ID.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
