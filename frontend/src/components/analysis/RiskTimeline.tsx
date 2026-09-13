"use client";
import type { RiskEvent } from "@/lib/api";
const DOT: Record<string, string> = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-red-500", critical: "bg-red-700 ring-4 ring-red-500/30" };
const TXT: Record<string, string> = { low: "text-emerald-300", medium: "text-amber-300", high: "text-red-300", critical: "text-red-300 font-bold" };
/** When did this property start needing attention? Vertical on every screen size. */
export default function RiskTimeline({ events }: { events: RiskEvent[] }) {
  if (!events.length) return <div className="text-sm text-slate-500">No recorded events.</div>;
  const first = events.find((e) => e.risk === "high" || e.risk === "critical");
  return (
    <div>
      {first && <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">First needed attention on <b>{first.at.slice(0, 10)}</b>: {first.event.toLowerCase()}.</div>}
      <ol className="relative space-y-4 pl-6" style={{ borderLeft: "2px solid rgba(159,176,195,0.25)" }}>
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${DOT[e.risk]}`} />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-mono text-xs text-slate-500">{e.at.slice(0, 10)}</span>
              <span className="font-medium">{e.event}</span>
              <span className={`text-xs uppercase tracking-wider ${TXT[e.risk]}`}>risk: {e.risk}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
              {e.version != null && <span>version {e.version}</span>}{e.area_change_pct != null && <span>area {e.area_change_pct >= 0 ? "+" : ""}{e.area_change_pct}%</span>}
              {e.movement_m != null && e.movement_m > 0 && <span>moved {e.movement_m} m</span>}{e.conflict && <span className="text-red-300">conflict: {e.conflict}</span>}
              <span>by {e.actor_role}</span><span className="text-slate-600">· {e.source === "analysis" ? "Tribhoomi analysis" : "stored record"}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
