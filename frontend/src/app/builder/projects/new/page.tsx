"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type ParcelFeature } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import Gate from "@/components/Gate";

const CITIES = ["Greater Noida", "Noida", "Ghaziabad", "Gurugram", "Delhi", "Faridabad"];

export default function NewProject() {
  return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Form /></Gate>;
}

function Form() {
  const s = useSession(); const router = useRouter();
  const [f, setF] = useState({ name: "", developer: "", city: "Greater Noida", locality: "", address: "", project_type: "residential", parcel: "demo", existing_parcel_id: 0 });
  const [free, setFree] = useState<ParcelFeature[]>([]);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setF((x) => ({ ...x, developer: s.name })); api.parcels().then((fc) => setFree(fc.features.filter((p) => p.properties.buildings.length === 0))).catch(() => null); }, [s]);
  async function submit() {
    setBusy(true); setErr(null);
    try { const r = await api.createProject({ ...f, existing_parcel_id: f.parcel === "existing" ? f.existing_parcel_id || null : null }); router.push(`/builder/projects/${r.project.id}`); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  // plain function (not a nested component) so inputs keep focus while typing
  const field = (k: keyof typeof f, label: string, ph?: string) => (
    <label className="block text-sm"><span className="text-slate-500">{label}</span><input value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
  );
  return (
    <div className="page"><div className="mx-auto max-w-2xl">
      <Link href="/builder" className="text-sm text-slate-500 hover:underline">← Dashboard</Link>
      <h1 className="h1 mt-2">Create new project</h1>
      <p className="lead">A project is the land parcel your buildings stand on.</p>
      <div className="card mt-5 space-y-4 p-6">
        <div className="label">Project details</div>
        {field("name", "Project name", "e.g. Tribhoomi Heights")}
        {field("developer", "Developer name")}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="text-slate-500">City</span><select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2">{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          {field("locality", "Locality", "e.g. Sector 10")}
        </div>
        {field("address", "Address", "Plot / street")}
        <label className="block text-sm"><span className="text-slate-500">Project type</span><select value={f.project_type} onChange={(e) => setF({ ...f, project_type: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="mixed">Mixed use</option></select></label>
        <div className="label pt-2">Land parcel</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => setF({ ...f, parcel: "demo" })} className={`card p-3 text-left ${f.parcel === "demo" ? "border-accent" : ""}`}><div className="font-medium">Create demonstration parcel</div><div className="text-xs text-slate-500">A synthetic plot placed in {f.city}. Not a government record.</div></button>
          <button onClick={() => setF({ ...f, parcel: "existing" })} className={`card p-3 text-left ${f.parcel === "existing" ? "border-accent" : ""}`} disabled={!free.length}><div className="font-medium">Use an existing empty parcel</div><div className="text-xs text-slate-500">{free.length ? `${free.length} available` : "none available"}</div></button>
        </div>
        {f.parcel === "existing" && <select value={f.existing_parcel_id} onChange={(e) => setF({ ...f, existing_parcel_id: Number(e.target.value) })} className="w-full rounded-lg border px-3 py-2 text-sm"><option value={0}>Choose a parcel</option>{free.map((p) => <option key={p.id} value={p.id}>{p.properties.name} · {p.properties.ulpin_2d}</option>)}</select>}
        {err && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"><b>Could not create the project.</b> {err}</div>}
        <button onClick={submit} disabled={busy || f.name.trim().length < 2} className="btn-accent w-full justify-center text-base">{busy ? "Creating…" : "Create project"}</button>
      </div>
    </div></div>
  );
}
