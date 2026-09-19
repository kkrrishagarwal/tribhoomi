"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Alert, type PropertyPage } from "@/lib/api";
import StatusPill from "@/components/StatusPill";

export default function Saved() {
  const [rows, setRows] = useState<PropertyPage[] | null>(null); const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => { api.alerts().then((a) => setAlerts(a.alerts)).catch(() => null); }, []);
  useEffect(() => { let ids: string[] = []; try { ids = JSON.parse(localStorage.getItem("tribhoomi.saved") || "[]"); } catch {} Promise.all(ids.map((i) => api.property(i).catch(() => null))).then((r) => setRows(r.filter(Boolean) as PropertyPage[])); }, []);
  return (
    <div className="page"><h1 className="h1">Saved properties</h1><p className="lead">Properties you starred while browsing (kept in this browser).</p>
      {alerts.length > 0 && <div className="card mt-4 p-4"><div className="font-semibold">Alerts for properties you watch</div><ul className="mt-2 space-y-1 text-sm">{alerts.slice(0, 8).map((a, i) => <li key={i}><span className="font-mono text-xs text-slate-500">{a.at.slice(0, 10)}</span> {a.building} — {a.label}: {a.event} <Link href={`/property/${a.tpid}`} className="text-accent underline">view</Link></li>)}</ul></div>}
      {rows && rows.length === 0 && <div className="card mt-4 p-6 text-center text-slate-500">Nothing saved yet. <Link href="/discover" className="text-accent underline">Discover properties</Link></div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{rows?.map((p) => <Link key={p.tpid} href={`/property/${p.tpid}`} className="card p-4 hover:border-accent"><div className="flex justify-between"><div className="font-semibold">{p.building.name} — {p.label}</div><StatusPill status={p.verification_status} /></div><div className="text-sm text-slate-500">{p.project.name} · {p.area_sqft.toLocaleString()} sq ft · integrity {p.integrity.score}/100</div></Link>)}</div>
    </div>
  );
}
