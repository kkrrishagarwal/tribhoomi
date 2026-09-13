"use client";
import { useEffect, useState } from "react";
import { api, type Simulation } from "@/lib/api";
import BoundaryEditor, { type Box } from "@/components/BoundaryEditor";
import ValidationPanel from "@/components/ValidationPanel";

/** What-if mode for the authority: adjust a boundary and see the consequences without saving. */
export default function SimulationPanel({ tpid, current, footprint, parcel, neighbours }: { tpid: string; current: Box; footprint: number[][]; parcel?: number[][]; neighbours: { label: string; tpid: string; volume: { min: number[]; max: number[] } }[] }) {
  const [box, setBox] = useState<Box>(current); const [sim, setSim] = useState<Simulation | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (JSON.stringify(box) === JSON.stringify(current)) { setSim(null); return; }
    setBusy(true); const t = setTimeout(() => api.simulate(tpid, { min: [box.min[0], box.min[1]], max: [box.max[0], box.max[1]] }).then(setSim).catch(() => setSim(null)).finally(() => setBusy(false)), 300);
    return () => clearTimeout(t);
  }, [box, tpid, current]);
  const impacted = new Set(sim?.impacted.filter((i) => i.kind === "overlap").map((i) => i.tpid));
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Simulate modification</div><span className="pill pill-pending">SIMULATION — NOT SAVED</span></div>
      <p className="mt-1 text-sm text-slate-500">Move or resize the boundary to see what would happen. The registered record is never changed.</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_360px]">
        <BoundaryEditor footprint={footprint} parcel={parcel} height={320} value={box} onChange={(b) => setBox(b ?? current)} before={current}
          neighbours={neighbours.map((n) => ({ label: n.label, volume: n.volume, conflict: impacted.has(n.tpid) }))} />
        <div className="space-y-3 text-sm">
          {!sim && <div className="text-slate-500">{busy ? "Evaluating scenario…" : "Adjust the boundary to evaluate a scenario."}</div>}
          {sim && (
            <>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="label">Proposed scenario</div>
                <div className="mt-1">{sim.change.edge_moves.map((m) => m.text).join("; ") || "No edge moved"}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><div className="text-xs text-slate-500">Area</div><div className="font-mono">{sim.change.area_pct >= 0 ? "+" : ""}{sim.change.area_pct}%</div></div>
                  <div><div className="text-xs text-slate-500">Neighbour conflict</div><div className={sim.change.new_conflicts.length ? "text-red-300" : ""}>{sim.change.new_conflicts.map((c) => c.label).join(", ") || "none"}</div></div>
                  <div><div className="text-xs text-slate-500">Validation</div><div className={sim.validation.valid && !sim.validation.conflicts.length ? "text-emerald-300" : "text-red-300"}>{sim.validation.valid && !sim.validation.conflicts.length ? "PASSED" : "FAILED"}</div></div>
                  <div><div className="text-xs text-slate-500">Priority</div><div className="font-mono">{sim.priority_before.level} → <b>{sim.priority_after.level}</b> ({sim.priority_before.score}→{sim.priority_after.score})</div></div>
                </div>
                <div className="mt-2 rounded bg-amber-50 p-2 text-amber-900"><b>Recommendation:</b> {sim.recommendation}</div>
              </div>
              <ValidationPanel v={sim.validation} compact />
            </>
          )}
          <button onClick={() => setBox(current)} className="btn-ghost !py-1">Reset to registered boundary</button>
        </div>
      </div>
    </div>
  );
}
