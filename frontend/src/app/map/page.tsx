"use client";
import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLayoutTools } from "@/lib/useLayoutTools";
import { useSession } from "@/lib/useSession";
import ParcelSidebar from "@/components/ParcelSidebar";
import type { LeafletHandle } from "@/components/ParcelMap";
import { MapLegend } from "@/components/MarketInfo";

// Leaflet touches `window`, so it must only render in the browser.
const ParcelMap = dynamic(() => import("@/components/ParcelMap"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-slate-400">Loading map…</div> });

export default function MapPage() {
  const s = useSession();
  const t = useLayoutTools(false);
  const mapRef = useRef<LeafletHandle | null>(null);
  const isBuilder = s.role === "builder" || s.role === "admin";

  return (
    <div className="mx-auto grid h-[calc(100vh-7.5rem)] max-w-screen-2xl grid-cols-1 gap-4 p-4 lg:grid-cols-[400px_1fr]">
      <ParcelSidebar
        t={t} isBuilder={isBuilder} canDraw
        onSelect={(id) => t.setSelectedId(id)}
        getViewRect={() => mapRef.current?.getViewRectangle() ?? null}
        footer={<div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          Want real terrain and the surrounding buildings? <Link href="/globe" className="text-navy-700 underline">Open the Cesium globe view</Link> (needs a WebGL-capable browser/GPU).
        </div>}
      />
      <section className="card relative overflow-hidden">
        <ParcelMap
          features={t.features} selected={t.selected} onSelect={(f) => t.setSelectedId(f.id)}
          drawing={t.drawing} onDrawComplete={(r) => { t.setRing(r); t.setDrawing(false); t.setMsg(null); }}
          candidates={t.candidates} handleRef={mapRef} market={t.market}
        />
        <div className="absolute bottom-6 left-3 z-[1000]"><MapLegend /></div>
        {t.drawing && (
          <div className="glass absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
            <span>Click the plot corners…</span>
            <button onClick={() => mapRef.current?.finishDraw()} className="btn-accent !py-1">Finish polygon</button>
          </div>
        )}
      </section>
    </div>
  );
}
