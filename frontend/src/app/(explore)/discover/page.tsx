"use client";
import RoleGuide from "@/components/RoleGuide";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type PropertyUnit } from "@/lib/api";
import StatusPill, { DemoBadge } from "@/components/StatusPill";
import ScanLoader from "@/components/ScanLoader";

function Inner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? ""); const [rows, setRows] = useState<PropertyUnit[] | null>(null); const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string; city: string }[]>([]);
  const search = async (term = q) => { setBusy(true); try { const d = await api.discover(term); setRows(d.results); setProjects(d.projects); } finally { setBusy(false); } };
  useEffect(() => { search(params.get("q") ?? ""); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="page">
      <div className="mx-auto max-w-3xl text-center"><DemoBadge text="Demonstration dataset" /><h1 className="h1 mt-3">Find &amp; verify a property</h1><p className="lead">Search by project, building, unit number or Tribhoomi Property ID.</p></div>
      <div className="card mx-auto mt-5 flex max-w-3xl gap-2 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="e.g. Tribhoomi Heights, Tower A, 8-C or TRB-TA1-F08-U03" className="flex-1 rounded-lg border px-3 py-2" />
        <button onClick={() => search()} className="btn-accent">Search</button>
      </div>
      <div className="mx-auto max-w-3xl"><RoleGuide on={["public", "investor"]} /></div>
      {projects.length > 0 && <div className="mx-auto mt-3 flex max-w-3xl flex-wrap gap-1.5 text-sm">{projects.slice(0, 12).map((p) => <button key={p.id} onClick={() => { setQ(p.name); search(p.name); }} className="btn-ghost !py-1">{p.name} <span className="text-slate-500">· {p.city}</span></button>)}</div>}
      {busy && <ScanLoader text="Searching registry" />}
      {rows && !busy && (
        <div className="mx-auto mt-5 max-w-3xl">
          <div className="text-sm text-slate-500">{rows.length} propert{rows.length === 1 ? "y" : "ies"}{q && ` for “${q}”`}</div>
          {rows.length === 0 && <div className="card mt-2 p-6 text-center text-slate-500">No property matches. Try a project name such as <button onClick={() => { setQ("Tribhoomi"); search("Tribhoomi"); }} className="text-accent underline">Tribhoomi</button>, or check the ID on the passport.</div>}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {rows.map((u) => (
              <Link key={u.tpid} href={`/property/${u.tpid}`} className="card p-4 hover:border-accent">
                <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{u.building.name} — {u.label}</div><div className="text-sm text-slate-500">{u.project.name}, {u.project.city}</div></div><StatusPill status={u.verification_status} /></div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm"><span>{u.unit_type}</span><span>{u.area_sqft.toLocaleString()} sq ft</span><span>{u.floor_label}</span><span className="font-mono text-xs text-slate-500">{u.tpid}</span></div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default function Discover() { return <Suspense fallback={<ScanLoader text="Loading" />}><Inner /></Suspense>; }
