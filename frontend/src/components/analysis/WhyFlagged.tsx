"use client";
import type { Analysis, UnitFlags } from "@/lib/api";

const LEVEL: Record<string, string> = { critical: "pill-conflict", high: "pill-conflict", medium: "pill-pending", low: "pill-verified" };

/** Reasons a record needs attention, taken only from stored facts and the existing analysis. Pure, so it can be reasoned about. */
export function flagReasons(an: Analysis | null, flags?: UnitFlags, status?: string): string[] {
  const out: string[] = [];
  const c = an?.change;
  if (c) {
    c.edge_moves.forEach((m) => out.push(m.text));
    if (Math.abs(c.area_pct) >= 0.1) out.push(`Area ${c.area_pct >= 0 ? "increased" : "decreased"} by ${Math.abs(c.area_pct)}%.`);
    c.impacted.filter((i) => i.kind === "overlap").forEach((i) => out.push(`Overlap detected with ${i.label} (about ${i.overlap_sqm} m²).`));
    const near = c.impacted.filter((i) => i.kind === "adjacent");
    if (near.length) out.push(`Neighbouring ${near.length === 1 ? "property" : "properties"} affected: ${near.map((i) => i.label).join(", ")}.`);
    if (c.leaves_building) out.push("The new boundary extends beyond the registered building.");
    if (c.mode === "registered_vs_proposed") out.push("The modification is a proposal that has not been approved.");
    else if (c.approved === false) out.push("The current record was changed without the owner's approval.");
  }
  if (status === "conflict" && !c) out.push("Its boundary conflicts with another registered unit.");
  if (flags?.has_unapproved_change && !c) out.push("The record contains a change that was never approved.");
  if (flags?.has_open_dispute) out.push("A dispute about this property is open.");
  if (flags?.has_pending_request && !c) out.push("A modification request is waiting for a decision.");
  return out;
}

export default function WhyFlagged({ an, flags, status }: { an: Analysis | null; flags?: UnitFlags; status?: string }) {
  const reasons = flagReasons(an, flags, status);
  const p = an?.priority;
  if (reasons.length === 0 && (!p || p.level === "low")) return null;
  return (
    <section className="flagged" aria-labelledby="why-flagged">
      <h2 id="why-flagged" className="label !text-amber-300">Why is this flagged?</h2>
      {reasons.length > 0 && <ul className="mt-2 space-y-1 text-sm">{reasons.map((r) => <li key={r} className="flex gap-2"><span aria-hidden className="text-amber-300">•</span><span>{r}</span></li>)}</ul>}
      {p && (
        <div className="mt-3 border-t border-[rgba(251,191,36,0.25)] pt-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="text-ink-muted">Tribhoomi review priority:</span><span className={`pill ${LEVEL[p.level]}`}>{p.level.toUpperCase()} · {p.action}</span><span className="font-mono text-xs text-ink-dim">{p.score}/100</span></div>
          {p.factors.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">{p.factors.map((f) => <li key={f.reason}><span className="font-mono text-ink">+{f.points}</span> {f.reason}</li>)}</ul>}
          <details className="tech"><summary>How is this priority worked out?</summary><div className="mt-1 text-xs text-ink-muted">{p.method}</div></details>
        </div>
      )}
    </section>
  );
}
