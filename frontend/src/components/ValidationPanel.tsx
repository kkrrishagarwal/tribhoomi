"use client";
import { useState } from "react";
import type { Validation } from "@/lib/api";

/** Plain-language validation checklist + score. Technical details stay behind a toggle. */
export default function ValidationPanel({ v, compact = false }: { v: Validation; compact?: boolean }) {
  const [tech, setTech] = useState(false);
  const tone = v.score >= 90 ? "ok" : v.score >= 70 ? "warn" : "bad";
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Property validation</div>
        <div className={`stat-inline font-mono text-2xl font-semibold ${tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-red-300"}`}>{v.score} <span className="text-sm text-slate-500">/ 100</span></div>
      </div>
      <ul className={`mt-3 space-y-1.5 ${compact ? "text-sm" : ""}`}>
        {v.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2">
            <span className={c.ok ? "text-emerald-300" : c.severity === "warning" ? "text-amber-300" : "text-red-300"}>{c.ok ? "✓" : "⚠"}</span>
            <div><div>{c.text}</div>{!c.ok && c.why && <div className="text-sm text-slate-500">{c.why}</div>}</div>
          </li>
        ))}
      </ul>
      {v.conflicts.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
          <div className="font-semibold text-red-800">⚠ Conflict detected</div>
          {v.conflicts.map((c) => <p key={c.with_tpid} className="mt-1 text-sm">This unit overlaps about <b>{c.overlap_sqm} m²</b> with <b>{c.with_unit}</b> ({c.with_tpid}).</p>)}
          <p className="mt-2 text-sm text-slate-500"><b>Why does this matter?</b> Two property units cannot occupy the same registered space. Adjust the boundary, or submit it and let the authority decide.</p>
        </div>
      )}
      <button onClick={() => setTech(!tech)} className="mt-3 text-xs text-slate-500 underline">{tech ? "Hide" : "Advanced technical details"}</button>
      {tech && <pre className="mt-2 overflow-x-auto rounded bg-slate-900/90 p-2 font-mono text-xs">{v.technical.join("\n")}{"\n"}drawn area {v.drawn_area_sqm} m²</pre>}
    </div>
  );
}
