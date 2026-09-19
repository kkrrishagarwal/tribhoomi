"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLayoutTools } from "@/lib/useLayoutTools";
import { useSession } from "@/lib/useSession";
import ParcelSidebar from "@/components/ParcelSidebar";
import type { LeafletHandle } from "@/components/ParcelMap";
import { MapLegend } from "@/components/MarketInfo";
import AreaInsights from "@/components/AreaInsights";

// Leaflet touches `window`, so it must only render in the browser.
const ParcelMap = dynamic(() => import("@/components/ParcelMap"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-slate-400">Loading map…</div> });

export default function MapPage() {
  const s = useSession();
  const t = useLayoutTools(false);
  const mapRef = useRef<LeafletHandle | null>(null);
  const [showMarket, setShowMarket] = useState(false);   // supporting layer: off until asked for
  const [insights, setInsights] = useState<{ open: boolean; area: { city: string; locality: string } | null }>({ open: false, area: null });
  const isBuilder = s.role === "builder" || s.role === "admin";

  return (
    <div className="mx-auto grid h-[calc(100vh-10.25rem)] min-h-[520px] max-w-screen-2xl grid-cols-1 gap-4 p-4 lg:grid-cols-[400px_1fr]">
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
          candidates={t.candidates} handleRef={mapRef} market={showMarket ? t.market : []} onAreaInsights={(area) => setInsights({ open: true, area })}
        />
        <div className="absolute bottom-6 left-3 z-[1000] flex flex-col items-start gap-1">{showMarket && <MapLegend />}{showMarket && !insights.open && <button type="button" onClick={() => setInsights({ open: true, area: null })} className="glass rounded-lg px-3 py-2 text-xs hover:text-accent">Area insights (public facts) →</button>}<label className="glass flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs"><input type="checkbox" checked={showMarket} onChange={(e) => setShowMarket(e.target.checked)} /> Show real NCR context <span className="text-ink-dim">(RERA-listed projects, informational)</span></label></div>
        {showMarket && insights.open && <div className="absolute bottom-3 right-3 top-3 z-[1000] flex"><AreaInsights initial={insights.area} onClose={() => setInsights({ open: false, area: null })} /></div>}
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
