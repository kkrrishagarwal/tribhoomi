"use client";
import type { Completeness } from "@/lib/api";
export function InsightPanel({ text }: { text: string }) {
  return <div className="card p-4"><div className="label">Tribhoomi insight · generated from stored facts</div><p className="mt-1 text-sm leading-relaxed">{text}</p></div>;
}
export function CompletenessPanel({ c }: { c: Completeness }) {
  return (
    <div className="card p-4 text-sm">
      <div className="flex items-center justify-between"><div className="label">Data completeness</div><div className="font-mono">{c.available} / {c.total} · {c.percent}%</div></div>
      {c.missing.length > 0 && <div className="mt-1">Missing: {c.missing.join(", ")}</div>}
      <div className="mt-1 text-xs text-slate-500">{c.note}</div>
    </div>
  );
}
