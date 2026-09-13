"use client";
import Link from "next/link";
import type { Analysis } from "@/lib/api";
/** Parcel → Project → Building → Floor → Unit → Version, with conflict links. Kept deliberately simple. */
export default function DependencyGraph({ g }: { g: Analysis["graph"] }) {
  return (
    <div className="card p-4">
      <div className="label">Property hierarchy</div>
      <ol className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
        {g.nodes.map((n, i) => (
          <li key={n.id} className="flex items-center gap-1">
            <Link href={n.href} className={`rounded-lg border px-3 py-1.5 text-sm hover:border-accent ${n.id === "unit" ? "border-accent" : ""}`} style={{ borderColor: n.id === "unit" ? undefined : "rgba(159,176,195,0.25)" }}>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{n.type}</div><div className="font-medium">{n.label}</div>
            </Link>
            {i < g.nodes.length - 1 && <span className="hidden text-slate-500 sm:inline">→</span>}
          </li>
        ))}
      </ol>
      {g.conflicts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-red-300">⚠ conflict ↔</span>{g.conflicts.map((c) => <Link key={c.tpid} href={c.href} className="rounded-lg border border-red-400 px-3 py-1.5 hover:bg-red-50">{c.label} · {c.tpid}</Link>)}</div>
      )}
    </div>
  );
}
