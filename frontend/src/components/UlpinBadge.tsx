"use client";
/**
 * Renders a ULPIN with each segment coloured so the hierarchy is visible:
 * state · district · village/ward · parcel  |  building · level · unit · layer
 */
const SEGMENT_META = [
  { name: "State", cls: "bg-emerald-100 text-emerald-900" },
  { name: "District", cls: "bg-emerald-100 text-emerald-900" },
  { name: "Village/Ward", cls: "bg-emerald-100 text-emerald-900" },
  { name: "Parcel", cls: "bg-emerald-200 text-emerald-900" },
  { name: "Building", cls: "bg-sky-100 text-sky-900" },
  { name: "Level", cls: "bg-indigo-100 text-indigo-900" },
  { name: "Unit", cls: "bg-violet-100 text-violet-900" },
  { name: "Layer", cls: "bg-amber-100 text-amber-900" },
];

/** `focal` renders the ID large and glowing — used where the ULPIN is the point of the panel. */
export default function UlpinBadge({ ulpin, size = "md", showLegend = false, focal = false }: { ulpin: string; size?: "sm" | "md" | "lg"; showLegend?: boolean; focal?: boolean }) {
  const parts = ulpin.split("-");
  const text = focal ? "text-lg font-semibold" : size === "lg" ? "text-base" : size === "sm" ? "text-[11px]" : "text-sm";
  return (
    <div className={`inline-flex flex-col gap-1 ${focal ? "glow rounded-lg bg-navy-900 px-3 py-2 animate-panel-in" : ""}`}>
      <div className={`inline-flex flex-wrap items-center gap-0.5 font-mono ${text}`}>
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            <span title={SEGMENT_META[i]?.name} className={`rounded px-1.5 py-0.5 ${SEGMENT_META[i]?.cls ?? "bg-slate-100"}`} style={focal ? { textShadow: "0 0 10px rgba(34,232,200,0.35)" } : undefined}>{p}</span>
            {i < parts.length - 1 && <span className="text-slate-400">-</span>}
          </span>
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-500">
          {parts.map((_, i) => (
            <span key={i}>{SEGMENT_META[i]?.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
