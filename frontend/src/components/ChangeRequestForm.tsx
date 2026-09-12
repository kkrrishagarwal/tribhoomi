"use client";
/**
 * Builder form used for BOTH direct edits (unsold unit) and change requests (sold unit).
 * The boundary is proposed as metres of shift/resize, and the preview shows old vs new.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, type Diff, type UnitRow } from "@/lib/api";

const DiffMap = dynamic(() => import("@/components/DiffMap"), { ssr: false });

export default function ChangeRequestForm({ unit, mode, onDone, onCancel }: { unit: UnitRow; mode: "edit" | "request"; onDone: (msg: string) => void; onCancel: () => void }) {
  const [f, setF] = useState({ plot_number: unit.label, dx: 0, dy: 0, dw: 0, dd: 0, reason: "" });
  const [diff, setDiff] = useState<Diff | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => api.previewChange(unit.unit_ulpin, f).then(setDiff).catch(() => null), 250);
    return () => clearTimeout(t);
  }, [f, unit.unit_ulpin]);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (mode === "edit") { await api.editUnit(unit.unit_ulpin, f); onDone(`${unit.label} updated directly (unsold, no approval needed).`); }
      else { const r = await api.requestChange(unit.unit_ulpin, f); onDone(r.message); }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const num = (k: "dx" | "dy" | "dw" | "dd", label: string) => (
    <label className="flex flex-col"><span className="text-slate-500">{label}</span>
      <input type="number" step={0.1} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 font-mono" /></label>
  );

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 text-xs shadow-lg">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{mode === "edit" ? "Edit unsold unit" : "Request change on registered unit"} · {unit.label}</div>
        <button onClick={onCancel} className="text-slate-500 hover:underline">close</button>
      </div>
      <div className="mt-1 font-mono text-slate-500">{unit.unit_ulpin}</div>
      {mode === "request" && unit.ownership[0] && <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-amber-800">🔒 Registered to {unit.ownership[0].owner_name} on {unit.ownership[0].registered_date}. They must approve this change before it takes effect.</div>}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <label className="flex flex-col md:col-span-1"><span className="text-slate-500">Plot number</span><input value={f.plot_number} onChange={(e) => setF({ ...f, plot_number: e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></label>
        {num("dx", "Shift east (m)")}{num("dy", "Shift north (m)")}{num("dw", "Widen (m)")}{num("dd", "Deepen (m)")}
      </div>
      {mode === "request" && (
        <label className="mt-2 flex flex-col"><span className="text-slate-500">Reason (required, shown to the owner and the registry)</span>
          <textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} className="rounded border border-slate-300 px-2 py-1" placeholder="e.g. Align eastern wall with as-built survey" /></label>
      )}
      {diff && (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_260px]">
          <DiffMap before={diff.before.geometry} after={diff.after.geometry} labels={["Current registered boundary", "Proposed boundary"]} height={200} />
          <table className="self-start text-[11px]">
            <thead><tr className="text-slate-500"><th></th><th className="text-left">Before</th><th className="text-left">After</th></tr></thead>
            <tbody>
              <tr><td className="pr-2 text-slate-500">Plot no.</td><td>{diff.before.plot_number}</td><td className={diff.before.plot_number !== diff.after.plot_number ? "font-semibold text-orange-700" : ""}>{diff.after.plot_number}</td></tr>
              <tr><td className="pr-2 text-slate-500">Min (x,y)</td><td className="font-mono">{diff.before.bounding_volume.min.slice(0, 2).join(", ")}</td><td className="font-mono">{diff.after.bounding_volume.min.slice(0, 2).join(", ")}</td></tr>
              <tr><td className="pr-2 text-slate-500">Max (x,y)</td><td className="font-mono">{diff.before.bounding_volume.max.slice(0, 2).join(", ")}</td><td className="font-mono">{diff.after.bounding_volume.max.slice(0, 2).join(", ")}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {err && <div className="mt-2 text-red-600">{err}</div>}
      <div className="mt-3 flex gap-2">
        <button onClick={submit} disabled={busy || (mode === "request" && f.reason.trim().length < 5)} className={mode === "edit" ? "btn-primary" : "btn-accent"}>
          {busy ? "Saving…" : mode === "edit" ? "Save directly" : "Submit change request to owner"}
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}
