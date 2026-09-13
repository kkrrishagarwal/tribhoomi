"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ChangeAnalysis as CA } from "@/lib/api";
const BoundaryEditor = dynamic(() => import("@/components/BoundaryEditor"), { ssr: false });
const RISK: Record<string, string> = { low: "pill-verified", medium: "pill-pending", high: "pill-conflict" };

/** Geometry change intelligence: what changed, where, by how much, and who is affected. */
export default function ChangeAnalysis({ c, footprint, neighbours, title }: { c: CA; footprint: number[][]; neighbours: { label: string; tpid: string; volume: { min: number[]; max: number[] } }[]; title?: string }) {
  const overlapIds = new Set(c.impacted.filter((i) => i.kind === "overlap").map((i) => i.tpid));
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{title ?? (c.mode === "registered_vs_proposed" ? "What changed? Registered version vs proposed version" : "What changed? Registered baseline vs current record")}</div>
        <span className={`pill ${RISK[c.risk]}`}>Risk: {c.risk}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">Tribhoomi analysis · {c.mode === "registered_vs_proposed" ? `proposal by ${c.proposed_by}` : c.approved === false ? "current version was NOT approved by the owner" : "approved change"}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Before", `${c.area_before_sqft.toLocaleString()} sq ft`], ["After", `${c.area_after_sqft.toLocaleString()} sq ft`], ["Difference", `${c.area_diff_sqft >= 0 ? "+" : ""}${c.area_diff_sqft.toLocaleString()} sq ft`], ["Change", `${c.area_pct >= 0 ? "+" : ""}${c.area_pct}%`]].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 p-2 text-center"><div className="text-xs text-slate-500">{k}</div><div className="font-mono text-lg">{v}</div></div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="text-sm">
          <div className="label">Boundary movement</div>
          <ul className="mt-1 space-y-0.5">{c.edge_moves.length ? c.edge_moves.map((m) => <li key={m.edge}>{m.text}</li>) : <li className="text-slate-500">No edge moved by 5 cm or more.</li>}
            {c.centroid_shift_m > 0.05 && <li className="text-slate-500">Centre moved {c.centroid_shift_m} m towards {c.direction}; changed region ≈ {c.changed_region_sqm} m².</li>}</ul>
          <div className="label mt-3">Neighbours affected</div>
          <ul className="mt-1 space-y-1">
            {c.impacted.length ? c.impacted.map((i) => <li key={i.tpid} className={i.kind === "overlap" ? "text-red-300" : ""}>{i.kind === "overlap" ? "⚠" : "•"} {i.reason} <Link href={`/property/${i.tpid}`} className="text-accent underline">compare</Link></li>) : <li className="text-slate-500">No neighbouring unit is affected.</li>}
          </ul>
          {c.leaves_building && <div className="mt-2 text-red-300">⚠ Extends beyond the registered building area.</div>}
          <div className="mt-3 rounded-lg bg-slate-50 p-2"><b>Why it matters:</b> {c.why_it_matters}</div>
        </div>
        <div>
          <div className="label mb-1">Before (dashed) · after (orange) · overlapping neighbours (red)</div>
          <BoundaryEditor footprint={footprint} readOnly height={240} value={{ min: [c.after.min[0], c.after.min[1]], max: [c.after.max[0], c.after.max[1]] }} onChange={() => {}}
            before={{ min: [c.before.min[0], c.before.min[1]], max: [c.before.max[0], c.before.max[1]] }}
            neighbours={neighbours.map((n) => ({ label: n.label, volume: n.volume, conflict: overlapIds.has(n.tpid) }))} />
        </div>
      </div>
    </div>
  );
}
