"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLayoutTools } from "@/lib/useLayoutTools";
import { useSession } from "@/lib/useSession";
import ParcelSidebar from "@/components/ParcelSidebar";
import UlpinBadge from "@/components/UlpinBadge";
import type { CesiumHandle, CesiumStatus } from "@/components/CesiumMap";
import MarketInfo, { MapLegend } from "@/components/MarketInfo";
import type { MarketFeature } from "@/lib/api";

// Optional "real-world context" view: Cesium ion world terrain + OSM Buildings, our buildings drawn per floor.
const CesiumMap = dynamic(() => import("@/components/CesiumMap"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-slate-400">Loading globe…</div> });

function hasWebGL(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export default function GlobePage() {
  const s = useSession();
  const t = useLayoutTools(true);
  const mapRef = useRef<CesiumHandle | null>(null);
  const [floorNo, setFloorNo] = useState<number | null>(null);
  const [marketSel, setMarketSel] = useState<MarketFeature | null>(null);
  const [status, setStatus] = useState<CesiumStatus | null>(null);
  const [showOsm, setShowOsm] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => { setWebgl(hasWebGL()); }, []);
  const isBuilder = s.role === "builder" || s.role === "admin";
  const broken = webgl === false || !!status?.error;
  const selFloor = t.selected && floorNo !== null ? t.models[t.selected.id]?.buildings[0]?.floors.find((f) => f.floor_number === floorNo) : null;

  return (
    <div className="mx-auto grid h-[calc(100vh-7.5rem)] max-w-screen-2xl grid-cols-1 gap-4 p-4 lg:grid-cols-[400px_1fr]">
      <ParcelSidebar
        t={t} isBuilder={isBuilder} canDraw={!broken}
        onSelect={(id) => { t.setSelectedId(id); setFloorNo(null); mapRef.current?.flyToParcel(id); }}
        getViewRect={() => mapRef.current?.getViewRectangle() ?? null}
        extra={selFloor ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs">
            <div className="label">Clicked floor · {selFloor.floor_number === 0 ? "Ground" : `Floor ${selFloor.floor_number}`}</div>
            <UlpinBadge ulpin={selFloor.floor_ulpin} size="sm" />
            <div className="mt-1 text-slate-500">{selFloor.units.length} unit(s) · {selFloor.units.filter((u) => u.flags?.locked).length} registered</div>
          </div>
        ) : null}
        footer={<div className="border-t border-slate-200 p-4 text-xs text-slate-500">Cesium globe · <Link href="/" className="text-navy-700 underline">back to the 2D map</Link></div>}
      />
      <section className="card relative overflow-hidden">
        {broken ? (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-600">
            <div className="max-w-md">
              <div className="text-base font-semibold">The 3D globe can't render on this browser/GPU</div>
              <p className="mt-2">{status?.error ?? "No WebGL context available."}</p>
              <p className="mt-2">Everything in the demo also works on the <Link href="/" className="text-navy-700 underline">2D map</Link>; the globe is an optional real-world-context view. Try Chrome with hardware acceleration enabled, or another machine.</p>
            </div>
          </div>
        ) : webgl === null ? null : (
          <>
            <CesiumMap
              handleRef={mapRef}
              features={t.features} models={t.models} selectedId={t.selectedId}
              onSelect={(id, fl) => { t.setSelectedId(id); setFloorNo(fl); }}
              drawing={t.drawing}
              onDrawComplete={(r) => { t.setRing(r); t.setDrawing(false); t.setMsg(null); }}
              candidates={t.candidates} showOsmBuildings={showOsm} onStatus={setStatus}
              market={t.market} onSelectMarket={setMarketSel}
            />
            <div className="absolute bottom-3 left-3"><MapLegend /></div>
            {marketSel && (
              <div className="glass animate-panel-in absolute bottom-3 right-3 max-w-xs rounded-lg p-3">
                <button onClick={() => setMarketSel(null)} className="float-right text-xs text-slate-500 hover:underline">close</button>
                <MarketInfo p={marketSel.properties} />
              </div>
            )}
            <div className="absolute left-3 top-3 flex flex-col gap-1 text-[11px]">
              <div className="glass rounded-lg px-3 py-2">
                {status ? (
                  status.token ? <span className="text-emerald-700">Cesium ion · world terrain{status.osmBuildings ? " + OSM Buildings" : ""} loaded{status.note ? ` · ${status.note}` : ""}</span>
                  : <span className="text-amber-700">No NEXT_PUBLIC_CESIUM_TOKEN — OpenStreetMap imagery only</span>
                ) : "Starting Cesium…"}
                {status?.osmBuildings && <label className="ml-3 inline-flex items-center gap-1"><input type="checkbox" checked={showOsm} onChange={(e) => setShowOsm(e.target.checked)} /> context buildings</label>}
              </div>
              <div className="glass rounded-lg px-3 py-1.5 text-slate-600">Coloured stacks are our registered buildings (one slab per floor). Red = tampered/disputed floor, amber = change pending. Click a floor.</div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
