"use client";
/**
 * Simple 2D floor editor. Shows the building footprint and the floor's existing units in
 * building-local metres; the builder draws or adjusts ONE rectangle by dragging its
 * corners/edges or moving it. No coordinates are ever typed. Live area is shown.
 */
import { useEffect, useMemo, useRef, useState } from "react";

export type Box = { min: [number, number]; max: [number, number] };
type Neighbour = { label: string; volume: { min: number[]; max: number[] }; status?: string; conflict?: boolean };

const SQFT = 10.7639;

export default function BoundaryEditor({ footprint, parcel, neighbours, value, onChange, height = 420, readOnly = false, before }: {
  footprint: number[][]; parcel?: number[][]; neighbours: Neighbour[]; value: Box | null; onChange: (b: Box) => void; height?: number; readOnly?: boolean;
  before?: Box | null;   // optional previous boundary for before/after overlays
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ mode: string; start: [number, number]; orig: Box } | null>(null);
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);

  // view box: footprint (or parcel) bounds + margin, y flipped so north is up
  const bounds = useMemo(() => {
    const pts = [...footprint, ...(parcel ?? [])];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const m = 4;
    return { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, y0: Math.min(...ys) - m, y1: Math.max(...ys) + m };
  }, [footprint, parcel]);
  const W = bounds.x1 - bounds.x0, H = bounds.y1 - bounds.y0;
  const toSvg = (x: number, y: number) => [x - bounds.x0, bounds.y1 - y] as [number, number];
  const fromEvent = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current!; const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W + bounds.x0;
    const sy = bounds.y1 - ((e.clientY - r.top) / r.height) * H;
    return [Math.round(sx * 10) / 10, Math.round(sy * 10) / 10];
  };
  const ring = (pts: number[][]) => pts.map(([x, y]) => toSvg(x, y).join(",")).join(" ");
  const rect = (b: Box) => { const [x, y] = toSvg(b.min[0], b.max[1]); return { x, y, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1] }; };

  const startDrag = (mode: string) => (e: React.PointerEvent) => {
    if (readOnly || !value) return;
    e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ mode, start: fromEvent(e), orig: { min: [...value.min] as [number, number], max: [...value.max] as [number, number] } });
  };
  const onMove = (e: React.PointerEvent) => {
    if (drawStart) { const p = fromEvent(e); onChange(norm({ min: drawStart, max: p })); return; }
    if (!drag) return;
    const p = fromEvent(e); const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1]; const o = drag.orig;
    let b: Box = { min: [...o.min] as [number, number], max: [...o.max] as [number, number] };
    if (drag.mode === "move") b = { min: [o.min[0] + dx, o.min[1] + dy], max: [o.max[0] + dx, o.max[1] + dy] };
    if (drag.mode.includes("w")) b.min[0] = o.min[0] + dx; if (drag.mode.includes("e")) b.max[0] = o.max[0] + dx;
    if (drag.mode.includes("s")) b.min[1] = o.min[1] + dy; if (drag.mode.includes("n")) b.max[1] = o.max[1] + dy;
    onChange(norm(b));
  };
  const endDrag = () => { setDrag(null); setDrawStart(null); };
  const onDownEmpty = (e: React.PointerEvent) => { if (readOnly) return; if (!value) { setDrawStart(fromEvent(e)); (e.target as Element).setPointerCapture(e.pointerId); } };

  const area = value ? (value.max[0] - value.min[0]) * (value.max[1] - value.min[1]) : 0;
  const hs = 1.2; // handle size in metres
  const r = value ? rect(value) : null;
  const rb = before ? rect(before) : null;

  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, touchAction: "none", background: "#0d1219", borderRadius: 12, border: "1px solid rgba(159,176,195,0.2)" }}
           onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag} onPointerDown={onDownEmpty}>
        <defs><pattern id="g" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="rgba(34,232,200,0.08)" strokeWidth="0.15" /></pattern></defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#g)" />
        {parcel && <polygon points={ring(parcel)} fill="rgba(18,59,54,0.5)" stroke="#1f5e58" strokeWidth="0.3" />}
        <polygon points={ring(footprint)} fill="rgba(28,35,49,0.9)" stroke="#9fb0c3" strokeWidth="0.35" strokeDasharray="1 0.6" />
        {neighbours.filter((n) => n.volume && n.volume.min && n.volume.max).map((n) => { const b: Box = { min: [n.volume.min[0], n.volume.min[1]], max: [n.volume.max[0], n.volume.max[1]] }; const q = rect(b); return (
          <g key={n.label}>
            <rect x={q.x} y={q.y} width={q.w} height={q.h} fill={n.conflict ? "rgba(248,113,113,0.35)" : "rgba(59,130,246,0.25)"} stroke={n.conflict ? "#fca5a5" : "#60a5fa"} strokeWidth="0.25" />
            <text x={q.x + q.w / 2} y={q.y + q.h / 2} fontSize="1.8" fill="#cbd5e1" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-mono)" }}>{n.label}</text>
          </g>); })}
        {rb && <rect x={rb.x} y={rb.y} width={rb.w} height={rb.h} fill="none" stroke="#9fb0c3" strokeWidth="0.35" strokeDasharray="1 0.8" />}
        {r && (
          <g>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(242,140,40,0.35)" stroke="#f6a24f" strokeWidth="0.4" style={{ cursor: readOnly ? "default" : "move" }} onPointerDown={startDrag("move")} />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize="2" fill="#fff" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-mono)", pointerEvents: "none" }}>{area.toFixed(0)} m²</text>
            {!readOnly && [["nw", r.x, r.y], ["ne", r.x + r.w, r.y], ["sw", r.x, r.y + r.h], ["se", r.x + r.w, r.y + r.h]].map(([m, x, y]) => (
              <rect key={m as string} x={(x as number) - hs / 2} y={(y as number) - hs / 2} width={hs} height={hs} fill="#fff" stroke="#f28c28" strokeWidth="0.2" style={{ cursor: `${m}-resize` }} onPointerDown={startDrag(m as string)} />
            ))}
            {!readOnly && [["n", r.x + r.w / 2, r.y], ["s", r.x + r.w / 2, r.y + r.h], ["w", r.x, r.y + r.h / 2], ["e", r.x + r.w, r.y + r.h / 2]].map(([m, x, y]) => (
              <circle key={m as string} cx={x as number} cy={y as number} r={hs / 2.2} fill="#f28c28" stroke="#fff" strokeWidth="0.15" style={{ cursor: `${m}-resize` }} onPointerDown={startDrag(m as string)} />
            ))}
          </g>
        )}
        {!value && !readOnly && <text x={W / 2} y={H / 2} fontSize="2.2" fill="#9fb0c3" textAnchor="middle">Click and drag inside the building outline to draw the unit</text>}
      </svg>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>Drag the orange box to move it. Drag a corner or edge to resize.</span>
          {value && <span className="ml-auto font-mono text-slate-200">{area.toFixed(1)} m² · {Math.round(area * SQFT).toLocaleString()} sq ft</span>}
          {value && <button onClick={() => onChange(null as unknown as Box)} className="btn-ghost !py-1">Clear</button>}
        </div>
      )}
    </div>
  );
}

function norm(b: Box): Box {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { min: [r(Math.min(b.min[0], b.max[0])), r(Math.min(b.min[1], b.max[1]))], max: [r(Math.max(b.min[0], b.max[0])), r(Math.max(b.min[1], b.max[1]))] };
}
