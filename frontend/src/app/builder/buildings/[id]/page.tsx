"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type BuildingDetail, type PropertyUnit, type Validation } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import StatusPill from "@/components/StatusPill";
import BoundaryEditor, { type Box } from "@/components/BoundaryEditor";
import ValidationPanel from "@/components/ValidationPanel";
import Checklist from "@/components/analysis/Checklist";
import { type Checklist as CL } from "@/lib/api";

export default function Building() { return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Inner /></Gate>; }

const SQFT = 10.7639;

function Inner() {
  const { id } = useParams<{ id: string }>();
  const [b, setB] = useState<BuildingDetail | null>(null);
  const [floorNo, setFloorNo] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ label: "", unit_type: "3 BHK", usage_type: "residential", declared_area_sqft: "", sale_status: "available" });
  const [box, setBox] = useState<Box | null>(null);
  const [v, setV] = useState<Validation | null>(null);
  const [saved, setSaved] = useState<PropertyUnit | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [ck, setCk] = useState<CL | null>(null);
  const load = () => api.building(id).then((d) => { setB(d); if (floorNo === null) setFloorNo(d.floors.find((x) => x.floor_number >= 0)?.floor_number ?? 0); }).catch((e) => setMsg(`Error: ${e.message}`));
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id]);
  const floor = useMemo(() => b?.floors.find((x) => x.floor_number === floorNo) ?? null, [b, floorNo]);

  // live validation while drawing (debounced)
  useEffect(() => {
    if (!adding || !box || !b || floorNo === null) { setV(null); return; }
    const t = setTimeout(() => api.validateUnit({ building_id: b.id, floor_number: floorNo, label: f.label || "?", unit_type: f.unit_type, declared_area_sqft: f.declared_area_sqft ? Number(f.declared_area_sqft) : null, volume: { min: [box.min[0], box.min[1], 0], max: [box.max[0], box.max[1], 0] } }).then(setV).catch(() => null), 300);
    return () => clearTimeout(t);
  }, [box, f.label, f.declared_area_sqft, adding, b, floorNo, f.unit_type]);

  async function save() {
    if (!b || floorNo === null || !box) return; setBusy(true); setMsg(null);
    try {
      const r = await api.createUnit({ building_id: b.id, floor_number: floorNo, label: f.label, unit_type: f.unit_type, usage_type: f.usage_type, declared_area_sqft: f.declared_area_sqft ? Number(f.declared_area_sqft) : null, sale_status: f.sale_status, volume: { min: [box.min[0], box.min[1], 0], max: [box.max[0], box.max[1], 0] } });
      setSaved(r.unit); setV(r.validation); setMsg(r.message); load();
      api.checklist(r.unit.tpid).then(setCk).catch(() => setCk(null));
    } catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
  }
  async function submit(tpid: string) {
    setBusy(true); setMsg(null);
    try { const r = await api.submitUnit(tpid); setMsg(r.message); setSaved(r.unit); load(); } catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
  }
  const reset = () => { setAdding(false); setBox(null); setV(null); setSaved(null); setF({ label: "", unit_type: "3 BHK", usage_type: "residential", declared_area_sqft: "", sale_status: "available" }); };

  if (!b) return msg ? <div className="page text-red-300">{msg}</div> : <ScanLoader text="Loading building" className="p-16" />;
  const all = b.floors.flatMap((x) => x.units);
  return (
    <div className="page">
      <Link href={`/builder/projects/${b.project.id}`} className="text-sm text-slate-500 hover:underline">← {b.project.name}</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><div className="label">{b.project.name}</div><h1 className="h1">{b.name}</h1><div className="text-slate-500">{b.num_floors} floors · {all.length} units · {all.filter((u) => u.verification_status === "pending").length} pending · {all.filter((u) => u.verification_status === "conflict").length} conflict</div></div>
        <Link href={`/parcel/${b.project.id}`} className="btn-ghost">View in 3D</Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-1">
        {[...b.floors].reverse().map((fl) => (
          <button key={fl.floor_number} onClick={() => { setFloorNo(fl.floor_number); reset(); }} className={`rounded-lg px-3 py-1.5 text-sm ${floorNo === fl.floor_number ? "btn-primary" : "btn-ghost"}`}>{fl.label}<span className="ml-1 text-xs text-slate-500">({fl.units.length})</span></button>
        ))}
      </div>

      {floor && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="flex items-center justify-between"><h2 className="h2">{floor.label}</h2>{!adding && <button onClick={() => { reset(); setAdding(true); }} className="btn-accent">+ Add unit</button>}</div>
            {adding && (
              <div className="card mt-3 space-y-3 p-4">
                <div className="label">Register new unit</div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm"><span className="text-slate-500">Unit number</span><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={`${floor.floor_number}-C`} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
                  <label className="text-sm"><span className="text-slate-500">Property type</span><select value={f.unit_type} onChange={(e) => setF({ ...f, unit_type: e.target.value, usage_type: ["Shop", "Office"].includes(e.target.value) ? "commercial" : "residential" })} className="mt-1 w-full rounded-lg border px-3 py-2">{["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Shop", "Office"].map((t) => <option key={t}>{t}</option>)}</select></label>
                  <label className="text-sm"><span className="text-slate-500">Declared area (sq ft)</span><input type="number" value={f.declared_area_sqft} onChange={(e) => setF({ ...f, declared_area_sqft: e.target.value })} placeholder="1245" className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
                  <label className="text-sm"><span className="text-slate-500">Status</span><select value={f.sale_status} onChange={(e) => setF({ ...f, sale_status: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2">{["available", "reserved", "sold", "occupied"].map((t) => <option key={t}>{t}</option>)}</select></label>
                </div>
                <div className="label pt-1">Unit boundary</div>
                <BoundaryEditor footprint={b.footprint_local} parcel={b.parcel_local} value={box} onChange={setBox}
                  neighbours={floor.units.map((u) => ({ label: u.label, volume: u.volume!, conflict: !!v?.conflicts.some((c) => c.with_tpid === u.tpid) }))} />
                {box && f.declared_area_sqft && (
                  <div className="flex flex-wrap gap-4 text-sm"><span>Declared: <b>{Number(f.declared_area_sqft).toLocaleString()} sq ft</b></span><span>Drawn: <b>{Math.round((box.max[0] - box.min[0]) * (box.max[1] - box.min[1]) * SQFT).toLocaleString()} sq ft</b></span>
                    <span className="text-slate-500">Difference: {(Math.round((box.max[0] - box.min[0]) * (box.max[1] - box.min[1]) * SQFT) - Number(f.declared_area_sqft)).toLocaleString()} sq ft</span></div>
                )}
                {msg && <div className={`rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
                <div className="flex flex-wrap gap-2">
                  {!saved && <button onClick={save} disabled={busy || !box || !f.label.trim()} className="btn-primary">{busy ? "Saving…" : "Save unit (draft)"}</button>}
                  {saved && saved.verification_status !== "pending" && <button onClick={() => submit(saved.tpid)} disabled={busy || (ck ? !ck.ready : false)} className="btn-accent" title={ck && !ck.ready ? "Fix the checklist items first" : ""}>Submit for verification</button>}
                  {saved && saved.verification_status === "pending" && <Link href={`/property/${saved.tpid}`} className="btn-primary">Open property page</Link>}
                  <button onClick={reset} className="btn-ghost">{saved ? "Done" : "Cancel"}</button>
                </div>
                {saved && ck && saved.verification_status !== "pending" && <Checklist c={ck} onFix={() => { setSaved(null); setCk(null); }} />}
                {saved && (
                  <div className="rounded-lg border border-slate-300 p-3 text-sm">
                    <div className="label">Tribhoomi Property ID</div>
                    <div className="font-mono text-xl text-accent">{saved.tpid}</div>
                    <div className="text-xs text-slate-500">Tribhoomi's internal identity linking the project, building, floor and unit. Not an official government number.</div>
                    <div className="mt-2 flex items-center gap-2"><StatusPill status={saved.verification_status} /><span className="text-slate-500">{saved.verification_status === "pending" ? "Waiting for the authority. You cannot mark a unit verified yourself." : "Submit it so the authority can verify it."}</span></div>
                  </div>
                )}
              </div>
            )}
            {!adding && (
              <div className="card mt-3 overflow-x-auto">
                <table className="tbl cards">
                  <thead><tr><th>Unit</th><th>Type</th><th>Area</th><th>Status</th><th>ID</th><th></th></tr></thead>
                  <tbody>
                    {floor.units.map((u) => (
                      <tr key={u.tpid}>
                        <td data-l="Unit" className="font-medium">{u.label}</td><td data-l="Type">{u.unit_type}</td><td data-l="Area">{u.area_sqft.toLocaleString()} sq ft</td>
                        <td data-l="Status"><StatusPill status={u.verification_status} /></td><td data-l="ID" className="font-mono text-xs">{u.tpid}</td>
                        <td className="text-right"><Link href={`/property/${u.tpid}`} className="text-accent hover:underline">Open</Link>{u.verification_status === "draft" || u.verification_status === "conflict" ? <button onClick={() => submit(u.tpid)} className="btn-ghost ml-2 !py-1">Submit</button> : <Link href={`/builder/modify/${u.tpid}`} className="btn-ghost ml-2 !py-1">Request modification</Link>}</td>
                      </tr>
                    ))}
                    {floor.units.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500">No units on this floor yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {!adding && msg && <div className={`mt-3 rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
          </div>
          <div>{v ? <ValidationPanel v={v} compact /> : <div className="card p-4 text-sm text-slate-500">{adding ? "Draw the unit boundary to see live validation." : "Select a unit or add a new one."}</div>}</div>
        </div>
      )}
    </div>
  );
}
