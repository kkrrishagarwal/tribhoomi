"use client";
import type { Trust } from "@/lib/api";
export default function TrustSummary({ t }: { t: Trust }) {
  const tone = t.tone === "ok" ? "border-emerald-400 bg-emerald-50" : t.tone === "warn" ? "border-amber-400 bg-amber-50" : "border-red-400 bg-red-50";
  const cell = (k: string, v: string, ok?: boolean) => (
    <div key={k} className="rounded-lg bg-slate-50 p-2.5"><div className="label">{k}</div><div className={`mt-0.5 text-sm font-medium ${ok === false ? "text-red-300" : ok ? "text-emerald-300" : ""}`}>{v}</div></div>
  );
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="label">Property trust summary · Tribhoomi analysis</div><div className="text-lg font-bold">{t.tone === "ok" ? "🟢" : t.tone === "warn" ? "⚠" : "🔴"} {t.overall}</div></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cell("Verification", t.verification.label, t.verification.ok)}{cell("Geometry", t.geometry.label, t.geometry.ok)}{cell("History", t.history.label)}
        {cell("Changes", t.changes.label, t.changes.unapproved_versions ? false : undefined)}{cell("Disputes", t.disputes.label, t.disputes.ok)}{cell("Data completeness", t.completeness.label)}
      </div>
      <div className="mt-2 text-xs text-slate-500">{t.note}</div>
    </div>
  );
}
