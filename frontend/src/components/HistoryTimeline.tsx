"use client";
import type { HistoryItem } from "@/lib/api";
const TONE = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", neutral: "bg-slate-500" };
export default function HistoryTimeline({ items }: { items: HistoryItem[] }) {
  if (!items.length) return <div className="text-sm text-slate-500">No history yet.</div>;
  return (
    <ol className="relative space-y-3 pl-6" style={{ borderLeft: "2px solid rgba(159,176,195,0.25)" }}>
      {[...items].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${TONE[h.tone]}`} />
          <div className="text-sm">{h.tone === "ok" ? "✓ " : h.tone === "bad" ? "⚠ " : h.tone === "warn" ? "• " : ""}{h.text}</div>
          <div className="font-mono text-xs text-slate-500">{h.at.slice(0, 16).replace("T", " ")}</div>
        </li>
      ))}
    </ol>
  );
}
