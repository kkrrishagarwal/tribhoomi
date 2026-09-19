"use client";
import Link from "next/link";
import type { Analysis } from "@/lib/api";

/**
 * Where a unit sits (parcel > building > floor > unit) and which neighbours a change reaches.
 * Only relationships present in the analysis are drawn: the hierarchy from `graph.nodes`, the spatial
 * links from `change.impacted` and `graph.conflicts`. No relationship is inferred here.
 */
export default function PropertyRelationships({ an, label }: { an: Analysis; label: string }) {
  const c = an.change;
  const links = c?.impacted ?? [];
  const conflicts = an.graph.conflicts.filter((k) => !links.some((l) => l.tpid === k.tpid));
  const cause = c ? (c.mode === "registered_vs_proposed" ? "Proposed boundary modification" : c.approved === false ? "Unapproved boundary change" : "Approved boundary change") : "";
  return (
    <section className="card p-4" aria-labelledby="rel-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="rel-title" className="font-semibold">Property relationships</h2><span className="label">where it sits · what it touches</span></div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <ol className="rel-chain">
          {an.graph.nodes.map((n) => (
            <li key={n.id}><Link href={n.href} className={`rel-node ${n.id === "unit" ? "rel-node-on" : ""}`}><span className="rel-type">{n.type}</span><span className="font-medium">{n.label}</span></Link></li>
          ))}
        </ol>
        <div>
          <div className="label">Neighbours / spatial impact</div>
          {links.length === 0 && conflicts.length === 0 && <p className="mt-2 text-sm text-ink-muted">No neighbouring unit is affected by a recorded or proposed change.</p>}
          <ul className="mt-2 space-y-3">
            {links.map((l) => (
              <li key={l.tpid}>
                <ol className="rel-chain rel-chain-tight">
                  <li><span className="rel-node rel-node-on"><span className="font-medium">{label}</span></span></li>
                  <li><span className="rel-node"><span className="rel-type">cause</span>{cause}</span></li>
                  <li><span className={`rel-node ${l.kind === "overlap" ? "rel-node-bad" : ""}`}><span className="rel-type">effect</span>{l.kind === "overlap" ? `Overlap · about ${l.overlap_sqm} m²` : `Comes within ${l.distance_m} m`}</span></li>
                  <li><Link href={`/property/${l.tpid}`} className={`rel-node ${l.kind === "overlap" ? "rel-node-bad" : ""}`}><span className="rel-type">affected</span><span className="font-medium">{l.label}</span></Link></li>
                </ol>
              </li>
            ))}
            {conflicts.map((k) => <li key={k.tpid}><Link href={k.href} className="rel-node rel-node-bad"><span className="rel-type">recorded conflict with</span><span className="font-medium">{k.label}</span></Link></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
