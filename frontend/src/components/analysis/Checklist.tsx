"use client";
import type { Checklist as C } from "@/lib/api";
export default function Checklist({ c, onFix }: { c: C; onFix?: (fix: string) => void }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${c.ready ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50"}`}>
      <div className="font-semibold">{c.ready ? "✓ Ready for submission" : "Fix before submission"}</div>
      <ul className="mt-1 space-y-0.5">{c.items.map((i) => <li key={i.key} className="flex items-center gap-2"><span className={i.ok ? "text-emerald-300" : "text-red-300"}>{i.ok ? "✓" : "✗"}</span><span>{i.text}</span>{!i.ok && onFix && <button onClick={() => onFix(i.fix)} className="text-xs text-accent underline">fix</button>}</li>)}</ul>
    </div>
  );
}
