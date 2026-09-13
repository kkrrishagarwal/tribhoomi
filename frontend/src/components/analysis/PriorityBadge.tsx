"use client";
import { useState } from "react";
import type { Priority } from "@/lib/api";
const CLS: Record<string, string> = { critical: "pill-conflict", high: "pill-conflict", medium: "pill-pending", low: "pill-verified" };
export default function PriorityBadge({ p, showWhy = true }: { p: Priority; showWhy?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="flex items-center gap-2"><span className={`pill ${CLS[p.level]}`}>{p.level.toUpperCase()} · {p.action}</span>{showWhy && <button onClick={() => setOpen(!open)} className="text-xs text-accent underline">Why this priority?</button>}</span>
      {open && (
        <span className="rounded-lg border p-2 text-xs" style={{ borderColor: "rgba(159,176,195,0.25)" }}>
          <ul className="space-y-0.5">{p.factors.length ? p.factors.map((f, i) => <li key={i}><span className="font-mono">+{f.points}</span> {f.reason}</li>) : <li>No risk factors found.</li>}</ul>
          <div className="mt-1 text-slate-500">Score {p.score}/100 · {p.method}</div>
        </span>
      )}
    </span>
  );
}
