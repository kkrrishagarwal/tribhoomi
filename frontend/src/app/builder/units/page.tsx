"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type PropertyUnit } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import StatusPill from "@/components/StatusPill";

export default function Units() { return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Inner /></Gate>; }
function Inner() {
  const [rows, setRows] = useState<PropertyUnit[] | null>(null); const [q, setQ] = useState(""); const [st, setSt] = useState("");
  useEffect(() => { api.builderUnits().then((d) => setRows(d.units)).catch(() => setRows([])); }, []);
  if (!rows) return <ScanLoader text="Loading units" className="p-16" />;
  const f = rows.filter((u) => (!st || u.verification_status === st) && (!q || `${u.label} ${u.building.name} ${u.project.name} ${u.tpid}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="page">
      <h1 className="h1">Units</h1>
      <div className="mt-3 flex flex-wrap gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search unit, building, project or TPID" className="w-72 rounded-lg border px-3 py-2 text-sm" />
        {["", "verified", "pending", "conflict", "draft", "rejected"].map((s) => <button key={s} onClick={() => setSt(s)} className={`rounded-lg px-3 py-1.5 text-sm ${st === s ? "btn-primary" : "btn-ghost"}`}>{s || "All"}</button>)}</div>
      <div className="card mt-3 overflow-x-auto"><table className="tbl cards">
        <thead><tr><th>Unit</th><th>Building · Project</th><th>Floor</th><th>Area</th><th>Status</th><th>TPID</th></tr></thead>
        <tbody>{f.map((u) => <tr key={u.tpid}><td data-l="Unit" className="font-medium"><Link href={`/property/${u.tpid}`} className="text-accent hover:underline">{u.label}</Link></td><td data-l="Building">{u.building.name} · {u.project.name}</td><td data-l="Floor">{u.floor_label}</td><td data-l="Area">{u.area_sqft.toLocaleString()} sq ft</td><td data-l="Status"><StatusPill status={u.verification_status} /></td><td data-l="TPID" className="font-mono text-xs">{u.tpid}</td></tr>)}
          {f.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500">No units match.</td></tr>}</tbody></table></div>
    </div>
  );
}
