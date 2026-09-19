"use client";
import Link from "next/link";
import type { Analysis } from "@/lib/api";

function Row({ k, children, tone }: { k: string; children: React.ReactNode; tone?: string }) {
  return <div className="impact-row"><dt>{k}</dt><dd className={tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : ""}>{children}</dd></div>;
}

/**
 * "What does this change affect?" - a plain summary of the existing change analysis.
 * Every row comes from /analysis; nothing is calculated here. The backend does not analyse
 * underground or common areas, so there is deliberately no row for them.
 */
export default function PropertyImpact({ an, label }: { an: Analysis; label: string }) {
  const c = an.change;
  if (!c) return null;
  const overlaps = c.impacted.filter((i) => i.kind === "overlap");
  const adjacent = c.impacted.filter((i) => i.kind === "adjacent");
  const outsideBuilding = c.containment?.building_outside_after_sqm ?? 0;
  const outsideParcel = c.containment?.parcel_outside_after_sqm ?? 0;
  const state = c.mode === "registered_vs_proposed"
    ? { text: "Proposed only. Waiting for authority review; the registered record is unchanged.", tone: "warn" }
    : c.approved === false ? { text: "Recorded WITHOUT the owner's approval.", tone: "bad" }
    : { text: "Approved and recorded as a new version.", tone: "ok" };
  const sign = (n: number) => (n >= 0 ? "+" : "");
  return (
    <section className="card p-4" aria-labelledby="impact-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="impact-title" className="font-semibold">Property impact</h2><span className="label">What does this change affect?</span></div>
      <dl className="mt-3">
        <Row k="Changed property">Unit {label}</Row>
        <Row k="Area change">{c.area_before_sqft.toLocaleString()} → {c.area_after_sqft.toLocaleString()} sq ft ({sign(c.area_pct)}{c.area_pct}%)</Row>
        <Row k="Boundary displacement">{c.edge_moves.length ? c.edge_moves.map((m) => m.text).join(" ") : "No edge moved by 5 cm or more."}{c.centroid_shift_m > 0.05 ? ` Centre moved ${c.centroid_shift_m} m towards ${c.direction}.` : ""}</Row>
        <Row k="New overlap" tone={overlaps.length ? "bad" : "ok"}>{overlaps.length ? overlaps.map((o) => `${o.label}: about ${o.overlap_sqm} m² (${o.overlap_pct}% of that unit)`).join("; ") : "None detected"}</Row>
        <Row k="Affected neighbours">
          {c.impacted.length === 0 ? "None detected" : (
            <ul className="space-y-0.5">{[...overlaps, ...adjacent].map((i) => <li key={i.tpid}><Link href={`/property/${i.tpid}`} className="text-accent hover:underline">{i.label}</Link> · {i.kind === "overlap" ? "overlapped" : `within ${i.distance_m} m`}</li>)}</ul>
          )}
        </Row>
        <Row k="Building / parcel" tone={outsideBuilding > 0 || outsideParcel > 0 ? "bad" : undefined}>{outsideBuilding > 0 ? `${outsideBuilding} m² falls outside the registered building. ` : "Stays inside the registered building. "}{outsideParcel > 0 ? `${outsideParcel} m² falls outside the land parcel.` : "Stays inside the land parcel."}</Row>
        <Row k="Approval state" tone={state.tone}>{state.text}</Row>
      </dl>
      <p className="mt-3 text-xs text-ink-dim">{an.labels?.analysis ?? "Tribhoomi analysis"} of stored geometry · {an.labels?.demo ?? "Demonstration dataset"}. Supports an authority&apos;s review; it is not a legal finding.</p>
    </section>
  );
}
