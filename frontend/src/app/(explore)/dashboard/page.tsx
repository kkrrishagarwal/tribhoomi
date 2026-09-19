"use client";
import LoadError from "@/components/LoadError";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Dashboard, type MarketContext } from "@/lib/api";
import ScanLoader from "@/components/ScanLoader";

// Fixed categorical order (validated palette): blue, orange, aqua, yellow.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

function StatTile({ label, value, hint, accent, tone }: { label: string; value: number | string; hint?: string; accent?: boolean; tone?: "warn" | "danger" }) {
  const hot = tone && Number(value) > 0;   // only glow amber/red when there is actually something to look at
  return (
    <div className={`card hud p-4 ${accent ? "glow" : hot && tone === "danger" ? "glow-danger animate-pulse-danger" : hot && tone === "warn" ? "glow-warn" : ""}`}>
      <div className="label">{label}</div>
      <div className={`hud-number mt-1 text-4xl font-semibold ${hot ? tone : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Bars({ title, data, keyOrder }: { title: string; data: Record<string, number>; keyOrder?: string[] }) {
  const keys = keyOrder ?? Object.keys(data).sort();
  const max = Math.max(1, ...keys.map((k) => data[k] ?? 0));
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2">
        {keys.map((k, i) => {
          const v = data[k] ?? 0;
          return (
            <li key={k} className="grid grid-cols-[96px_1fr_40px] items-center gap-2 text-xs" title={`${k}: ${v}`}>
              <span className="capitalize text-slate-700">{k.replace("_", " ")}</span>
              <span className="h-3 w-full rounded-sm bg-slate-100" style={{ background: "rgba(159,176,195,0.12)" }}>
                <span className="block h-3 rounded-r-sm" style={{ width: `${(v / max) * 100}%`, background: SERIES[i % SERIES.length] }} />
              </span>
              <span className="text-right tabular-nums text-slate-700">{v}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useT();
  const [d, setD] = useState<Dashboard | null>(null);
  const [mc, setMc] = useState<MarketContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.dashboard().then(setD).catch((e) => setError(String(e))); api.marketContext().then(setMc).catch(() => null); }, []);

  if (error) return <LoadError message={error.replace(/^Error: /, "")} what="the registry statistics" />;
  if (!d) return <ScanLoader text="Aggregating registry" className="p-16" />;
  const c = d.counts;

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{t("h.dashboard")}</h1>
        <p className="text-sm text-slate-600">Live totals from the database. “ULPINs generated” counts every parcel, building, level, unit and sub-surface layer that holds its own ID.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Parcels" value={c.parcels} hint="surface (2D ULPIN)" />
        <StatTile label="Buildings" value={c.buildings} hint={`${c.floors} levels incl. basements`} />
        <StatTile label="3D ULPINs generated" value={c.ulpins_generated} hint={`${c.units} units · ${c.underground_layers} layers`} accent />
        <StatTile label="Conflicts flagged" value={c.conflicts_flagged} hint="by topology validator" tone="warn" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Units registered (locked)" value={c.units_locked} hint={`${c.units_unsold} still unsold / editable`} />
        <StatTile label="Plot versions on record" value={c.plot_versions} hint="append-only history" />
        <StatTile label="Changed without approval" value={c.tampered_units} hint="caught by version history" tone="danger" />
        <StatTile label="Open disputes" value={c.disputes_open} hint={`${c.requests_pending} change request(s) pending`} tone="warn" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Bars title="Units by usage" data={d.units_by_usage} keyOrder={["residential", "commercial", "parking", "utility"]} />
        <Bars title="Ownership by tenure" data={d.ownership_by_type} />
        <Bars title="Sub-surface / air layers" data={d.layers_by_type} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-2">Parcel</th><th className="px-4 py-2">2D ULPIN</th><th className="px-4 py-2 text-right">Levels</th><th className="px-4 py-2 text-right">Units</th><th className="px-4 py-2 text-right">Conflicts</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {d.per_parcel.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-accent">{p.ulpin_2d}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.floors}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.units}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${p.conflicts ? "font-semibold text-red-700" : ""}`}>{p.conflicts}</td>
                <td className="px-4 py-2 text-right"><Link href={`/parcel/${p.id}`} className="text-xs text-navy-700 hover:underline">3D view →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mc && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm text-ink-muted">Supporting context: {mc.summary.projects} real NCR projects (informational, never linked to ULPINs)</summary>
          <div className="mt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-semibold">Regional context · real NCR projects ({mc.summary.projects}, {mc.summary.mapped} on the map)</div>
            <div className="text-[11px] text-slate-500">{Object.entries(mc.summary.by_confidence).map(([k, v]) => `${v} ${k.replace("_", "-")}`).join(" · ")}</div>
          </div>
          <p className="mt-1 text-xs text-slate-500">{mc.summary.disclaimer}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="py-1 pr-3">Project</th><th className="py-1 pr-3">Builder</th><th className="py-1 pr-3">City · locality</th><th className="py-1 pr-3">RERA ID</th><th className="py-1 pr-3 text-right">Units</th><th className="py-1 pr-3">Status</th><th className="py-1">Confidence</th></tr></thead>
              <tbody>
                {[...mc.features, ...mc.unmapped].map((f) => { const p = f.properties; const u = (x: string) => x === "unknown" ? <span className="text-slate-400">unknown</span> : x; return (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="py-1 pr-3 font-medium">{p.project_name}{!p.has_location && <span className="ml-1 text-[10px] text-slate-400" title="no verified coordinates">· not mapped</span>}</td><td className="py-1 pr-3">{p.builder_name}</td><td className="py-1 pr-3">{p.city} · {p.locality}</td>
                    <td className="py-1 pr-3 font-mono">{u(p.rera_id)}</td><td className="py-1 pr-3 text-right tabular-nums">{u(p.total_units)}</td><td className="py-1 pr-3">{u(p.status)}</td>
                    <td className="py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] ${p.confidence === "verified" ? "bg-emerald-100 text-emerald-800" : p.confidence === "listing_based" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{p.confidence.replace("_", "-")}</span></td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
          </div>
        </details>
      )}
      {d.recent_conflicts.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold">Flagged conflicts</div>
          <ul className="mt-2 space-y-2 text-xs">
            {d.recent_conflicts.map((cf, i) => (
              <li key={i} className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-900">
                <span className="font-semibold">{cf.kind.replace("_", " ")}</span> · <span className="font-mono">{cf.ulpin_a}</span>{cf.ulpin_b && <> ↔ <span className="font-mono">{cf.ulpin_b}</span></>}
                <p className="mt-1">{cf.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
