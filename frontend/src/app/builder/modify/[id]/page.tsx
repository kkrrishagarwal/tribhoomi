"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type BuildingDetail, type PropertyPage, type Validation } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import BoundaryEditor, { type Box } from "@/components/BoundaryEditor";
import ValidationPanel from "@/components/ValidationPanel";

export default function Modify() { return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Inner /></Gate>; }

const OPTIONS = ["Extend unit", "Reduce unit", "Move boundary", "Merge units", "Split unit", "Modify layout", "Other"];

function Inner() {
  const { id } = useParams<{ id: string }>(); const router = useRouter();
  const [p, setP] = useState<PropertyPage | null>(null); const [b, setB] = useState<BuildingDetail | null>(null);
  const [box, setBox] = useState<Box | null>(null); const [orig, setOrig] = useState<Box | null>(null);
  const [kind, setKind] = useState(OPTIONS[0]); const [reason, setReason] = useState("");
  const [v, setV] = useState<Validation | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.property(id).then(async (pp) => { setP(pp); const bb = await api.building(pp.building.id); setB(bb); const o: Box = { min: [pp.volume!.min[0], pp.volume!.min[1]], max: [pp.volume!.max[0], pp.volume!.max[1]] }; setOrig(o); setBox(o); }).catch((e) => setMsg(`Error: ${e.message}`));
  }, [id]);
  useEffect(() => {
    if (!box || !b || !p) return;
    const t = setTimeout(() => api.validateUnit({ building_id: b.id, floor_number: p.floor_number, label: p.label, unit_id: p.id, volume: { min: [box.min[0], box.min[1], 0], max: [box.max[0], box.max[1], 0] } }).then(setV).catch(() => null), 300);
    return () => clearTimeout(t);
  }, [box, b, p]);
  async function submit() {
    if (!box || !orig || !p) return; setBusy(true); setMsg(null);
    const dx = box.min[0] - orig.min[0], dy = box.min[1] - orig.min[1];
    const dw = (box.max[0] - box.min[0]) - (orig.max[0] - orig.min[0]), dd = (box.max[1] - box.min[1]) - (orig.max[1] - orig.min[1]);
    try { const r = await api.requestChange(p.land_record_id, { dx, dy, dw, dd, reason: `${kind}: ${reason}` }); setMsg(r.message); setTimeout(() => router.push(`/property/${p.tpid}`), 1200); }
    catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
  }
  if (!p || !b || !box || !orig) return msg ? <div className="page text-red-300">{msg}</div> : <ScanLoader text="Loading property" className="p-16" />;
  const floor = b.floors.find((x) => x.floor_number === p.floor_number)!;
  const a0 = (orig.max[0] - orig.min[0]) * (orig.max[1] - orig.min[1]), a1 = (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]);
  return (
    <div className="page">
      <Link href={`/property/${p.tpid}`} className="text-sm text-slate-500 hover:underline">← {p.label} · {p.building.name}</Link>
      <h1 className="h1 mt-2">Request modification</h1>
      <p className="lead">The verified boundary is never overwritten. Your proposal goes to the owner and the authority; the original stays as version {p.version_count || 1}.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="text-slate-500">Type of change</span><select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="text-sm"><span className="text-slate-500">Reason (shown to the owner and authority)</span><input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. as-built survey correction" /></label>
          </div>
          <BoundaryEditor footprint={b.footprint_local} parcel={b.parcel_local} value={box} onChange={(nb) => setBox(nb ?? orig)} before={orig}
            neighbours={floor.units.filter((u) => u.tpid !== p.tpid).map((u) => ({ label: u.label, volume: u.volume!, conflict: !!v?.conflicts.some((c) => c.with_tpid === u.tpid) }))} />
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Original</div><div className="font-mono text-lg">{Math.round(a0 * 10.7639).toLocaleString()} sq ft</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Proposed</div><div className="font-mono text-lg">{Math.round(a1 * 10.7639).toLocaleString()} sq ft</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Change</div><div className={`font-mono text-lg ${a1 - a0 > 0 ? "text-emerald-300" : a1 - a0 < 0 ? "text-amber-300" : ""}`}>{a1 - a0 >= 0 ? "+" : ""}{Math.round((a1 - a0) * 10.7639).toLocaleString()} sq ft</div></div>
          </div>
          {msg && <div className={`rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
          <div className="flex gap-2"><button onClick={submit} disabled={busy || reason.trim().length < 3} className="btn-accent">Submit modification for review</button><button onClick={() => setBox(orig)} className="btn-ghost">Reset boundary</button></div>
        </div>
        <div>{v ? <ValidationPanel v={v} compact /> : <div className="card p-4 text-sm text-slate-500">Adjust the boundary to see validation.</div>}</div>
      </div>
    </div>
  );
}
