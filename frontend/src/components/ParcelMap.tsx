"use client";
/**
 * 2D Leaflet map (OpenStreetMap). The default, dependable map view: no WebGL needed.
 * Supports parcel selection, a simple click-to-draw polygon tool for builders,
 * and AI candidate footprints.
 */
import { useEffect, useState, type MutableRefObject } from "react";
import { MapContainer, TileLayer, GeoJSON, Polygon, Polyline, CircleMarker, Tooltip, Popup, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPolygon, MarketFeature, ParcelFeature } from "@/lib/api";
import MarketInfo from "@/components/MarketInfo";

// plain neutral marker for real projects: deliberately not glowing, not teal/amber/red
const marketIcon = typeof window !== "undefined" ? L.divIcon({
  className: "", iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -8],
  html: '<div style="width:12px;height:12px;background:#64748b;border:1.5px solid #cbd5e1;border-radius:2px;opacity:0.9"></div>',
}) : undefined;
import type { ViewRect } from "@/lib/useLayoutTools";

const LAND_USE_COLOR: Record<string, string> = { residential: "#2563eb", commercial: "#d97706", mixed: "#7c3aed" };

export type LeafletHandle = { getViewRectangle: () => ViewRect | null; finishDraw: () => void };

function FitBounds({ features }: { features: ParcelFeature[] }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!features.length || done) return;
    map.fitBounds(L.geoJSON(features as any).getBounds().pad(0.6));
    setDone(true);
  }, [features, map, done]);
  return null;
}

function FlyTo({ feature }: { feature: ParcelFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!feature) return;
    map.flyToBounds(L.geoJSON(feature as any).getBounds().pad(1.2), { duration: 0.8 });
  }, [feature, map]);
  return null;
}

function Handle({ handleRef, points, onFinish }: { handleRef?: MutableRefObject<LeafletHandle | null>; points: [number, number][]; onFinish: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      getViewRectangle: () => { const b = map.getBounds(); return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; },
      finishDraw: onFinish,
    };
    return () => { handleRef.current = null; };
  }, [map, handleRef, points, onFinish]);
  return null;
}

function DrawLayer({ drawing, points, setPoints, onFinish }: { drawing: boolean; points: [number, number][]; setPoints: (p: [number, number][]) => void; onFinish: () => void }) {
  const map = useMapEvents({
    click(e) { if (drawing) setPoints([...points, [e.latlng.lat, e.latlng.lng]]); },
    dblclick() { if (drawing && points.length >= 3) onFinish(); },
  });
  useEffect(() => {
    if (drawing) { map.doubleClickZoom.disable(); map.getContainer().style.cursor = "crosshair"; }
    else { map.doubleClickZoom.enable(); map.getContainer().style.cursor = ""; }
  }, [drawing, map]);
  if (!drawing || !points.length) return null;
  return (
    <>
      {points.length >= 3 ? <Polygon positions={points} pathOptions={{ color: "#ea580c", fillColor: "#f28c28", fillOpacity: 0.35, weight: 3 }} /> : <Polyline positions={points} pathOptions={{ color: "#ea580c", weight: 3 }} />}
      {points.map((p, i) => <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: "#fff", fillColor: "#f28c28", fillOpacity: 1, weight: 2 }} />)}
    </>
  );
}

export default function ParcelMap({ features, selected, onSelect, drawing = false, onDrawComplete, candidates = [], handleRef, market = [], onAreaInsights }: {
  features: ParcelFeature[]; selected: ParcelFeature | null; onSelect: (f: ParcelFeature) => void;
  drawing?: boolean; onDrawComplete?: (ring: number[][]) => void; candidates?: GeoPolygon[]; handleRef?: MutableRefObject<LeafletHandle | null>;
  market?: MarketFeature[];
  onAreaInsights?: (area: { city: string; locality: string }) => void;
}) {
  const [points, setPoints] = useState<[number, number][]>([]);
  useEffect(() => { if (!drawing) setPoints([]); }, [drawing]);
  const finish = () => {
    if (points.length < 3) return;
    const ring = points.map(([lat, lng]) => [Number(lng.toFixed(7)), Number(lat.toFixed(7))]);
    ring.push(ring[0]);
    setPoints([]);
    onDrawComplete?.(ring);
  };
  return (
    <MapContainer center={[28.57, 77.36]} zoom={12} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {features.map((f) => {
        const isSel = selected?.id === f.id;
        const color = LAND_USE_COLOR[f.properties.land_use] ?? "#334155";
        return (
          <GeoJSON
            key={`${f.id}-${isSel ? "sel" : "n"}-${drawing ? "d" : ""}`}
            data={f as any}
            style={{ color, weight: isSel ? 4 : 2, fillColor: color, fillOpacity: isSel ? 0.45 : 0.2 }}
            eventHandlers={{ click: () => { if (!drawing) onSelect(f); } }}
            onEachFeature={(_, layer) => { layer.bindTooltip(`<b>${f.properties.name}</b><br/><span style="font-family:monospace">${f.properties.ulpin_2d}</span>`, { sticky: true }); }}
          />
        );
      })}
      {market.map((m) => (
        <Marker key={`mk${m.id}`} position={[m.geometry.coordinates[1], m.geometry.coordinates[0]]} icon={marketIcon} zIndexOffset={-100}>
          <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>{m.properties.project_name}</Tooltip>
          <Popup maxWidth={300}><MarketInfo p={m.properties} compact />{onAreaInsights && <button type="button" onClick={() => onAreaInsights({ city: m.properties.city, locality: m.properties.locality })} className="btn-ghost mt-2 w-full justify-center !py-1 text-xs">Area insights for {m.properties.locality}</button>}</Popup>
        </Marker>
      ))}
      {/* parcels are kilometres apart (Greater Noida / Noida / Ghaziabad): a labelled marker keeps each one findable when zoomed out */}
      {features.map((f) => (
        <CircleMarker key={`m${f.id}`} center={[f.properties.centroid.lat, f.properties.centroid.lng]} radius={7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: LAND_USE_COLOR[f.properties.land_use] ?? "#334155", fillOpacity: 0.95 }}
          eventHandlers={{ click: () => { if (!drawing) onSelect(f); } }}>
          <Tooltip permanent direction="top" offset={[0, -6]}>{f.properties.name}</Tooltip>
        </CircleMarker>
      ))}
      {candidates.map((c, i) => (
        <Polygon key={i} positions={c.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])} pathOptions={{ color: "#ca8a04", fillColor: "#fde047", fillOpacity: 0.4, weight: 3 }}>
          <Tooltip permanent direction="center">AI #{i + 1}</Tooltip>
        </Polygon>
      ))}
      <DrawLayer drawing={drawing} points={points} setPoints={setPoints} onFinish={finish} />
      <Handle handleRef={handleRef} points={points} onFinish={finish} />
      <FitBounds features={features} />
      <FlyTo feature={selected} />
    </MapContainer>
  );
}
