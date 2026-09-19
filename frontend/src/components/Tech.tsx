import type { ReactNode } from "react";

type Box = { min: number[]; max: number[] };
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A unit's box in words: "12 m wide × 10.5 m deep". Raw coordinates belong inside <Tech>. */
export function sizeText(v: Box) { return `${r1(v.max[0] - v.min[0])} m wide × ${r1(v.max[1] - v.min[1])} m deep`; }
export function coordText(v: Box, dims = 2) { return `[${v.min.slice(0, dims).join(", ")}] → [${v.max.slice(0, dims).join(", ")}] m`; }

/** Readable first, raw on request: wraps coordinates, bounding volumes and other surveyor-level data. */
export default function Tech({ children, label = "Show technical details", className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <details className={`tech ${className}`}>
      <summary>{label}</summary>
      <div className="mt-1 font-mono text-xs text-ink-muted">{children}</div>
    </details>
  );
}
