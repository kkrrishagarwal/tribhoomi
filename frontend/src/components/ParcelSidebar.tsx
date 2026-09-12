"use client";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";
import type { GeoPolygon } from "@/lib/api";
import type { ViewRect, useLayoutTools } from "@/lib/useLayoutTools";
import UlpinBadge from "@/components/UlpinBadge";

type Tools = ReturnType<typeof useLayoutTools>;

export default function ParcelSidebar({ t, isBuilder, onSelect, getViewRect, canDraw, extra, footer }: {
  t: Tools; isBuilder: boolean; onSelect: (id: number) => void; getViewRect: () => ViewRect | null; canDraw: boolean; extra?: ReactNode; footer?: ReactNode;
}) {
  const sel = t.selected;
  const { t: tr } = useT();
  return (
    <aside className="card flex flex-col overflow-hidden">
      <div className="border-b border-slate-200 p-4">
        <h1 className="text-lg font-semibold">{tr("h.parcels")}</h1>
        <p className="text-xs text-slate-500">{tr("h.parcels.sub")}</p>
        <input value={t.query} onChange={(e) => t.setQuery(e.target.value)} placeholder="Search e.g. 09141003100045 or Aravalli" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy-700 focus:outline-none" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {t.error && <li className="p-4 text-sm text-red-600">Backend not reachable: {t.error}</li>}
          {t.results.map((f) => (
            <li key={f.id}>
              <button onClick={() => onSelect(f.id)} className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 ${t.selectedId === f.id ? "bg-amber-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.properties.name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">{f.properties.land_use}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-600">{f.properties.ulpin_2d}</div>
              </button>
            </li>
          ))}
          {!t.results.length && !t.error && <li className="p-4 text-sm text-slate-500">No parcel matches “{t.query}”.</li>}
        </ul>
        {sel && (
          <div className="border-t border-slate-200 bg-slate-50 p-4">
            <div className="label">{tr("h.ulpin2d")}</div>
            <div className="mt-1"><UlpinBadge ulpin={sel.properties.ulpin_2d} showLegend /></div>
            <div className="mt-1 font-mono text-xs text-slate-500">compact: {sel.properties.ulpin_2d_compact}</div>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">Village / Ward</dt><dd>{sel.properties.village_ward}</dd>
              <dt className="text-slate-500">District</dt><dd>{sel.properties.district}, {sel.properties.state}</dd>
              <dt className="text-slate-500">Builder</dt><dd>{sel.properties.builder || "—"}</dd>
              <dt className="text-slate-500">Area</dt><dd>{sel.properties.area_sqm.toLocaleString()} m²</dd>
              <dt className="text-slate-500">Building</dt><dd>{sel.properties.buildings.map((b) => `${b.name} (${b.num_floors}F + ${b.num_basements}B)`).join(", ")}</dd>
              <dt className="text-slate-500">Sub-surface</dt><dd>{sel.properties.underground_layers.length} layer(s)</dd>
            </dl>
            {extra}
            <Link href={`/parcel/${sel.id}`} className="btn-accent mt-3 w-full justify-center">{tr("h.expand")}</Link>
          </div>
        )}
        {isBuilder && (
          <div className="border-t border-slate-200 p-4 text-xs">
            <div className="label">{tr("h.builderTool")}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="col-span-2 flex flex-col"><span className="text-slate-500">Layout name</span><input value={t.form.name} onChange={(e) => t.setForm({ ...t.form, name: e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></label>
              <label className="flex flex-col"><span className="text-slate-500">Floors</span><input type="number" min={1} max={99} value={t.form.num_floors} onChange={(e) => t.setForm({ ...t.form, num_floors: +e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></label>
              <label className="flex flex-col"><span className="text-slate-500">Basements</span><input type="number" min={0} max={9} value={t.form.num_basements} onChange={(e) => t.setForm({ ...t.form, num_basements: +e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></label>
              <label className="flex flex-col"><span className="text-slate-500">Units / floor</span><input type="number" min={1} max={8} value={t.form.units_per_floor} onChange={(e) => t.setForm({ ...t.form, units_per_floor: +e.target.value })} className="rounded border border-slate-300 px-2 py-1" /></label>
              <label className="flex flex-col"><span className="text-slate-500">Land use</span><select value={t.form.land_use} onChange={(e) => t.setForm({ ...t.form, land_use: e.target.value })} className="rounded border border-slate-300 px-2 py-1"><option>residential</option><option>commercial</option><option>mixed</option></select></label>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!t.drawing && !t.ring && <button disabled={!canDraw} onClick={() => { t.setDrawing(true); t.setMsg("Click the plot corners on the map, then press Finish (or double-click)."); }} className="btn-primary justify-center">✏️ Draw plot on map</button>}
              {t.drawing && <button onClick={() => { t.setDrawing(false); t.setMsg(null); }} className="btn-ghost justify-center">Cancel drawing</button>}
              {t.ring && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
                  <div>Polygon with {t.ring.length - 1} corners drawn.</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => t.registerLayout({ type: "Polygon", coordinates: [t.ring!] } as GeoPolygon)} className="btn-accent flex-1 justify-center" disabled={!!t.busy}>Register layout → ULPINs</button>
                    <button onClick={() => t.setRing(null)} className="btn-ghost">Discard</button>
                  </div>
                </div>
              )}
              <label className="btn-ghost cursor-pointer justify-center">📄 Upload GeoJSON layout<input type="file" accept=".json,.geojson,application/geo+json,application/json" hidden onChange={(e) => e.target.files?.[0] && t.uploadGeoJSON(e.target.files[0])} /></label>
              <label className="btn-ghost cursor-pointer justify-center">🛰 Detect plots from aerial image (AI)<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && t.detectFromImage(e.target.files[0], getViewRect())} /></label>
              {t.candidates.length > 0 && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2">
                  <div className="font-medium">AI candidates (yellow on the map)</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.candidates.map((c, i) => <button key={i} onClick={() => t.registerLayout(c)} className="rounded bg-yellow-200 px-2 py-0.5 hover:bg-yellow-300" disabled={!!t.busy}>Register #{i + 1}</button>)}
                    <button onClick={() => t.setCandidates([])} className="rounded px-2 py-0.5 text-slate-500 underline">clear</button>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-500">Shapefiles: convert to GeoJSON first (QGIS or mapshaper.org). The drawn/uploaded polygon becomes a parcel; floors and units get ULPINs from the same engine as seeded data.</p>
            </div>
          </div>
        )}
        {(t.busy || t.msg) && <div className={`m-4 rounded-lg px-3 py-2 text-xs ${t.msg?.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{t.busy ?? t.msg}</div>}
        {footer}
      </div>
    </aside>
  );
}
