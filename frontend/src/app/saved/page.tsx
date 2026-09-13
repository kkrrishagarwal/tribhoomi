"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type PropertyPage } from "@/lib/api";
import StatusPill from "@/components/StatusPill";

export default function Saved() {
  const [rows, setRows] = useState<PropertyPage[] | null>(null);
  useEffect(() => { let ids: string[] = []; try { ids = JSON.parse(localStorage.getItem("tribhoomi.saved") || "[]"); } catch {} Promise.all(ids.map((i) => api.property(i).catch(() => null))).then((r) => setRows(r.filter(Boolean) as PropertyPage[])); }, []);
  return (
    <div className="page"><h1 className="h1">Saved properties</h1><p className="lead">Properties you starred while browsing (kept in this browser).</p>
      {rows && rows.length === 0 && <div className="card mt-4 p-6 text-center text-slate-500">Nothing saved yet. <Link href="/discover" className="text-accent underline">Discover properties</Link></div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{rows?.map((p) => <Link key={p.tpid} href={`/property/${p.tpid}`} className="card p-4 hover:border-accent"><div className="flex justify-between"><div className="font-semibold">{p.building.name} — {p.label}</div><StatusPill status={p.verification_status} /></div><div className="text-sm text-slate-500">{p.project.name} · {p.area_sqft.toLocaleString()} sq ft · integrity {p.integrity.score}/100</div></Link>)}</div>
    </div>
  );
}
