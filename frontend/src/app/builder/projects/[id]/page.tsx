"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type ProjectDashboard } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import { DemoBadge } from "@/components/StatusPill";

export default function Project() { return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Inner /></Gate>; }

function Inner() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<ProjectDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [b, setB] = useState({ name: "Tower A", num_floors: 12, building_type: "residential", num_basements: 0, parking_levels: 0, commercial_ground_floor: false, amenities: "", auto_units_per_floor: 0 });
  const load = () => api.project(id).then(setP).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id]);
  async function addBuilding() {
    setMsg(null);
    try { const r = await api.addBuilding(id, b); setMsg(r.message); setAdding(false); load(); } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }
  if (err) return <div className="page text-red-300">{err}</div>;
  if (!p) return <ScanLoader text="Loading project" className="p-16" />;
  const c = p.counts;
  return (
    <div className="page">
      <Link href="/builder" className="text-sm text-slate-500 hover:underline">← Dashboard</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">{p.name}</h1><div className="text-slate-500">{p.city} · {p.locality} {p.address && `· ${p.address}`} · {p.developer}</div></div>
        <div className="flex items-center gap-2">{p.is_demo && <DemoBadge text="Demonstration parcel" />}<span className={`pill ${p.status === "Verified" ? "pill-verified" : p.status === "Under verification" ? "pill-pending" : "pill-draft"}`}>{p.status}</span></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Buildings", c.buildings, ""], ["Floors", c.floors, ""], ["Units", c.units, ""], ["Pending requests", c.pending + c.modification_requests, "warn"], ["Conflicts", c.conflicts, "bad"]].map(([l, v, t]) => (
          <div key={l as string} className="card stat"><div className="label">{l}</div><div className={`n ${t}`}>{v}</div></div>
        ))}
      </div>
      {msg && <div className={`mt-4 rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
      <div className="mt-8 flex items-center justify-between"><h2 className="h2">Buildings</h2><button onClick={() => setAdding(!adding)} className="btn-accent">+ Add building</button></div>
      {adding && (
        <div className="card mt-3 space-y-3 p-5">
          <div className="label">Building details</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm"><span className="text-slate-500">Building name</span><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-slate-500">Number of floors</span><input type="number" min={1} max={99} value={b.num_floors} onChange={(e) => setB({ ...b, num_floors: +e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-slate-500">Building type</span><select value={b.building_type} onChange={(e) => setB({ ...b, building_type: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="mixed">Mixed</option></select></label>
            <label className="text-sm"><span className="text-slate-500">Basement levels (optional)</span><input type="number" min={0} max={9} value={b.num_basements} onChange={(e) => setB({ ...b, num_basements: +e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-slate-500">Auto-create units per floor (optional)</span><input type="number" min={0} max={8} value={b.auto_units_per_floor} onChange={(e) => setB({ ...b, auto_units_per_floor: +e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /><span className="text-xs text-slate-500">0 = you add units one by one with the boundary editor</span></label>
            <label className="text-sm"><span className="text-slate-500">Amenities (optional)</span><input value={b.amenities} onChange={(e) => setB({ ...b, amenities: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Gym, pool…" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.commercial_ground_floor} onChange={(e) => setB({ ...b, commercial_ground_floor: e.target.checked })} /> Commercial ground floor</label>
          <div className="flex gap-2"><button onClick={addBuilding} className="btn-accent">Add building</button><button onClick={() => setAdding(false)} className="btn-ghost">Cancel</button></div>
        </div>
      )}
      {p.buildings.length === 0 && !adding && <div className="card mt-3 p-6 text-center text-slate-500">No buildings yet. Add your first tower.</div>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {p.buildings.map((bd) => (
          <Link key={bd.id} href={`/builder/buildings/${bd.id}`} className="card p-4 hover:border-accent">
            <div className="text-lg font-semibold">{bd.name}</div>
            <div className="text-sm text-slate-500">{bd.num_floors} floors{bd.num_basements ? ` + ${bd.num_basements} basement` : ""} · {bd.units} units</div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="pill pill-verified">{bd.verified} verified</span><span className="pill pill-pending">{bd.pending} pending</span>{bd.conflicts > 0 && <span className="pill pill-conflict">{bd.conflicts} conflict</span>}
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-8 text-xs text-slate-500">Technical land-record ID (prototype, ULPIN-format): <span className="font-mono">{p.land_record_id}</span> · <Link href={`/parcel/${p.id}`} className="text-accent hover:underline">View in 3D</Link> · <Link href="/map" className="text-accent hover:underline">Advanced GIS view</Link></div>
    </div>
  );
}
