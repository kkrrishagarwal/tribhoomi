"use client";
import Link from "next/link";
import type { PropertyUnit } from "@/lib/api";
import StatusPill from "@/components/StatusPill";

export default function PendingTable({ rows, empty }: { rows: PropertyUnit[]; empty: string }) {
  if (!rows.length) return <div className="card p-6 text-center text-slate-500">{empty}</div>;
  return (
    <div className="card overflow-x-auto"><table className="tbl cards">
      <thead><tr><th>Unit</th><th>Project · Building</th><th>Floor</th><th>Area</th><th>Status</th><th>Integrity</th><th></th></tr></thead>
      <tbody>{rows.map((u) => (
        <tr key={u.tpid}><td data-l="Unit" className="font-medium">{u.label}<div className="font-mono text-xs text-slate-500">{u.tpid}</div></td><td data-l="Project">{u.project.name} · {u.building.name}</td><td data-l="Floor">{u.floor_label}</td><td data-l="Area">{u.area_sqft.toLocaleString()} sq ft</td><td data-l="Status"><StatusPill status={u.verification_status} /></td><td data-l="Integrity" className="font-mono">{u.integrity.score}/100</td><td className="text-right"><Link href={`/authority/review/${u.tpid}`} className="btn-primary !py-1">Review</Link></td></tr>
      ))}</tbody></table></div>
  );
}

