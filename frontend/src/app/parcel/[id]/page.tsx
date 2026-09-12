"use client";
import { useT } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, USAGE_COLORS, type Conflict, type ParcelModel, type Unit, type UnitDetail, type ValidationResult } from "@/lib/api";
import UlpinBadge from "@/components/UlpinBadge";
import WebGLGate from "@/components/WebGLGate";
import ScanLoader from "@/components/ScanLoader";
import UlpinQR from "@/components/UlpinQR";
import { downloadCertificate } from "@/lib/certificate";

const Building3D = dynamic(() => import("@/components/Building3D"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-slate-400">Loading 3D scene…</div> });

export default function ParcelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const [model, setModel] = useState<ParcelModel | null>(null);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [explode, setExplode] = useState(0);
  const [focusFloor, setFocusFloor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.model(id).then(setModel).catch((e) => setError(String(e)));
  }, [id]);

  useEffect(() => {
    if (!selected) return setDetail(null);
    api.unit(selected.unit_ulpin).then(setDetail).catch(() => setDetail(null));
  }, [selected]);

  const conflictSet = useMemo(() => new Set(validation?.conflicting_ulpins ?? []), [validation]);
  const unitConflicts: Conflict[] = useMemo(
    () => (validation && selected ? validation.conflicts.filter((c) => c.ulpin_a === selected.unit_ulpin || c.ulpin_b === selected.unit_ulpin) : []),
    [validation, selected],
  );

  async function runValidator() {
    setValidating(true);
    try { setValidation(await api.validate(id)); } finally { setValidating(false); }
  }

  const building = model?.buildings[0];
  const totalUnits = building?.floors.reduce((n, f) => n + f.units.length, 0) ?? 0;

  if (error) return <div className="p-8 text-red-600">Could not load parcel: {error}</div>;
  if (!model || !building) return <ScanLoader text="Building 3D model" className="p-16" />;

  return (
    <div className="mx-auto grid h-[calc(100vh-7rem)] max-w-screen-2xl grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_400px]">
      <section className="card relative overflow-hidden">
        <WebGLGate>
        <Building3D
          parcelLocal={model.parcel_local}
          buildings={model.buildings}
          layers={model.layers}
          selectedUlpin={selected?.unit_ulpin ?? null}
          conflictUlpins={conflictSet}
          explode={explode}
          focusFloor={focusFloor}
          onSelectUnit={setSelected}
          onWarningClick={(u) => router.push(`/verify?ulpin=${encodeURIComponent(u.unit_ulpin)}`)}
        />
        </WebGLGate>
        {/* overlay controls */}
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <div className="glass rounded-lg p-3 text-xs">
            <div className="font-semibold">{building.name}</div>
            <div className="text-slate-500">{building.num_floors} floors · {building.num_basements} basement(s) · {totalUnits} units</div>
            <label className="mt-2 block">
              <span className="label">Explode floors</span>
              <input type="range" min={0} max={1} step={0.05} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="w-full" />
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(USAGE_COLORS).map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{k}</span>
              ))}
              <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />conflict</span>
              <span className="inline-flex items-center gap-1"><i className="grid h-3 w-3 place-items-center rounded-full bg-amber-400 text-[8px] font-bold">!</i>changed since registration</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">Drag to orbit · scroll to zoom · click a unit</div>
        </div>
        <div className="absolute bottom-3 left-3 flex max-w-[60%] flex-wrap gap-1">
          <button onClick={() => setFocusFloor(null)} className={`rounded px-2 py-0.5 font-mono text-[11px] ${focusFloor === null ? "btn-primary !py-0.5 !px-2" : "glass"}`}>All</button>
          {[...building.floors].reverse().map((f) => (
            <button key={f.id} onClick={() => setFocusFloor(f.floor_number)} className={`rounded px-2 py-0.5 font-mono text-[11px] ${focusFloor === f.floor_number ? "btn-primary !py-0.5 !px-2" : "glass"}`}>
              {f.floor_number < 0 ? `B${-f.floor_number}` : f.floor_number === 0 ? "G" : f.floor_number}
            </button>
          ))}
        </div>
      </section>

      <aside className="card flex flex-col overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <Link href="/" className="text-xs text-navy-700 hover:underline">← back to map</Link>
          <h1 className="mt-1 text-lg font-semibold">{model.parcel.name}</h1>
          <div className="label mt-2">2D ULPIN · surface parcel</div>
          <UlpinBadge ulpin={model.parcel.ulpin_2d} size="sm" />
          <div className="label mt-2">3D ULPIN · building</div>
          <UlpinBadge ulpin={building.building_ulpin} size="sm" />
          <div className="mt-3 flex gap-2">
            <button onClick={runValidator} disabled={validating} className="btn-primary flex-1 justify-center">
              {validating ? "Checking…" : t("h.validator")}
            </button>
          </div>
          {validation && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${validation.conflict_count ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
              Checked {validation.units_checked} units — {validation.conflict_count} conflict(s) {validation.conflict_count ? "highlighted in red" : "found"}.
              <ul className="mt-1 space-y-1">
                {validation.conflicts.map((c, i) => (
                  <li key={i} className="font-mono">
                    <button className="underline" onClick={() => {
                      const u = building.floors.flatMap((f) => f.units).find((u) => u.unit_ulpin === c.ulpin_a);
                      if (u) setSelected(u);
                    }}>{c.kind}</button>: {c.ulpin_a.split("-").slice(4).join("-")}{c.ulpin_b ? ` ↔ ${c.ulpin_b.split("-").slice(4).join("-")}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selected && (
            <div className="text-sm text-slate-500">
              <p>Click any unit in the 3D view to open its ownership record.</p>
              <div className="label mt-4">{t("h.layers")}</div>
              <ul className="mt-1 space-y-2">
                {model.layers.map((l) => (
                  <li key={l.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="font-medium text-slate-800">{l.name}</div>
                    <div className="text-slate-500">{l.layer_label} · {l.bottom_m} m to {l.top_m} m · {l.operator}</div>
                    <div className="mt-1"><UlpinBadge ulpin={l.layer_ulpin} size="sm" /></div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selected && (
            <div key={selected.id} className="animate-panel-in space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{selected.label}</h2>
                  <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:underline">clear</button>
                </div>
                <div className="label mt-2">{t("h.unitUlpin")}</div>
                <div className="flex flex-wrap items-start gap-3">
                  <UlpinBadge ulpin={selected.unit_ulpin} focal showLegend />
                  <UlpinQR ulpin={selected.unit_ulpin} size={96} />
                </div>
              </div>
              {selected.flags && (
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 ${selected.flags.locked ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{selected.flags.locked ? "🔒 registered · baseline locked" : "unsold · builder-editable"}</span>
                  {selected.flags.has_unapproved_change && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">changed without approval</span>}
                  {selected.flags.has_open_dispute && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">dispute open</span>}
                  {selected.flags.has_pending_request && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">change request pending</span>}
                  {selected.flags.version_count > 0 && <Link href={`/verify?ulpin=${encodeURIComponent(selected.unit_ulpin)}`} className="rounded bg-navy-800 px-1.5 py-0.5 text-white">v{selected.flags.version_count} history →</Link>}
                </div>
              )}
              {unitConflicts.length > 0 && (
                <div className="glow-danger animate-pulse-danger rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                  <div className="font-semibold">⚠ {unitConflicts[0].kind.replace("_", " ")}</div>
                  {unitConflicts.map((c, i) => <p key={i} className="mt-1">{c.reason}</p>)}
                  <p className="mt-1 font-mono">with {unitConflicts[0].ulpin_b}</p>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Usage</dt><dd className="capitalize">{selected.usage_type}</dd>
                <dt className="text-slate-500">Floor area</dt><dd>{selected.area_sqm} m²</dd>
                <dt className="text-slate-500">Elevation</dt><dd>{selected.volume.min[2]} m to {selected.volume.max[2]} m</dd>
                <dt className="text-slate-500">Bounding volume</dt>
                <dd className="font-mono">[{selected.volume.min.join(", ")}] → [{selected.volume.max.join(", ")}]</dd>
              </dl>
              <div>
                <div className="flex items-center justify-between">
                  <div className="label">{t("h.ownership")}</div>
                  {selected.ownership.length > 0 && (
                    <button
                      onClick={() => downloadCertificate({
                        ulpin: selected.unit_ulpin, ulpin_2d: model.parcel.ulpin_2d, plot_number: selected.label, building: building.name,
                        parcel_name: model.parcel.name, village_ward: model.parcel.village_ward, district: model.parcel.district, state: model.parcel.state,
                        owner_name: selected.ownership[0].owner_name, owner_email: selected.ownership[0].owner_email, ownership_type: selected.ownership[0].ownership_type,
                        registered_date: selected.ownership[0].registered_date, registration_no: selected.ownership[0].registration_no,
                        area_sqm: selected.area_sqm, usage_type: selected.usage_type, flags: selected.flags, version: selected.flags?.version_count ?? null,
                      })}
                      className="btn-ghost !py-1 text-xs"
                    >⬇ Download certificate</button>
                  )}
                </div>
                {selected.ownership.map((o, i) => (
                  <div key={i} className="mt-1 rounded-lg border border-slate-200 p-3">
                    <div className="font-medium">{o.owner_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{o.ownership_type} · {o.share_percent}% share</div>
                    <div className="text-xs text-slate-500">Registered {o.registered_date} · {o.registration_no}</div>
                  </div>
                ))}
              </div>
              {detail && (
                <div>
                  <div className="label">{t("h.trace")}</div>
                  <ol className="mt-1 space-y-1 font-mono text-[11px]">
                    <li><span className="text-slate-500">unit    </span> {detail.hierarchy.unit}</li>
                    <li><span className="text-slate-500">level   </span> {detail.hierarchy.floor}</li>
                    <li><span className="text-slate-500">building</span> {detail.hierarchy.building}</li>
                    <li><span className="text-slate-500">parcel  </span> {detail.hierarchy.parcel_2d} <span className="text-emerald-700">← 2D ULPIN by truncation</span></li>
                  </ol>
                  <div className="mt-1 text-xs text-slate-500">Layer: {detail.hierarchy.layer}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
