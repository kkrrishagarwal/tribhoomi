"use client";
/**
 * Read-only info for a real market-context project. Intentionally has no ULPIN, no
 * ownership panel and no link into the integrity module: these are real companies.
 */
import type { MarketProject } from "@/lib/api";

const CONF: Record<string, { label: string; cls: string }> = {
  verified: { label: "verified · RERA filing", cls: "bg-emerald-100 text-emerald-800" },
  listing_based: { label: "listing-based · unverified", cls: "bg-amber-100 text-amber-800" },
  unknown: { label: "unverified", cls: "bg-slate-100 text-slate-600" },
};

export default function MarketInfo({ p, compact = false }: { p: MarketProject; compact?: boolean }) {
  const c = CONF[p.confidence] ?? CONF.unknown;
  const v = (x: string) => (x === "unknown" ? <span className="text-slate-400">unknown</span> : x);
  return (
    <div className={compact ? "text-[12px]" : "text-xs"} style={{ minWidth: 220 }}>
      <div className="label" style={{ color: "#8b9bb0" }}>Regional context · real project</div>
      <div className="mt-0.5 font-semibold">{p.project_name}</div>
      <div className="text-slate-500">{p.builder_name} · {p.locality}, {p.city}</div>
      <dl className="mt-2 grid grid-cols-[84px_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-slate-500">RERA ID</dt><dd className="font-mono">{v(p.rera_id)}</dd>
        <dt className="text-slate-500">Status</dt><dd>{v(p.status)}</dd>
        <dt className="text-slate-500">Units</dt><dd>{v(p.total_units)}{p.towers !== "unknown" ? ` · ${p.towers} towers` : ""}{p.floors !== "unknown" ? ` · ${p.floors} floors` : ""}</dd>
        <dt className="text-slate-500">Type</dt><dd>{p.property_type}</dd>
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${c.cls}`}>{c.label}</span>
        <span className="text-[10px] text-slate-500">{p.data_source} · {p.data_date}</span>
      </div>
      {p.notes && <p className="mt-1 text-[10px] leading-snug text-slate-500">{p.notes}</p>}
      <p className="mt-1 text-[10px] text-slate-500">Informational only — no ULPIN, ownership or dispute data is attached to real projects.</p>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="glass rounded-lg px-3 py-2 text-[11px]">
      <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: "#2563eb", boxShadow: "0 0 8px rgba(34,232,200,0.6)" }} /> Live demo buildings (interactive, synthetic)</div>
      <div className="mt-1 flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border border-slate-400 bg-slate-500" /> Regional context (informational, real RERA data)</div>
    </div>
  );
}
