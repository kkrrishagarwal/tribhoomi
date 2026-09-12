"use client";
/**
 * Small Leaflet map showing a unit's registered boundary (grey, dashed) against a
 * changed / proposed boundary (orange). Used in change-request previews, the
 * verify page timeline and the government audit view.
 */
import { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPolygon } from "@/lib/api";

const toLatLng = (g: GeoPolygon) => g.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);

function Fit({ polys }: { polys: [number, number][][] }) {
  const map = useMap();
  useEffect(() => {
    const all = polys.flat();
    try { if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.8), { animate: false }); } catch {}
    const t = setTimeout(() => { try { if ((map as any)._container) map.invalidateSize(); } catch {} }, 50);
    return () => clearTimeout(t);
  }, [polys, map]);
  return null;
}

export default function DiffMap({ before, after, labels, height = 180 }: {
  before: GeoPolygon | null; after?: GeoPolygon | null; labels?: [string, string]; height?: number;
}) {
  const b = before ? toLatLng(before) : null;
  const a = after ? toLatLng(after) : null;
  const same = b && a && JSON.stringify(b) === JSON.stringify(a);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      <MapContainer center={[28.57, 77.33]} zoom={19} maxZoom={22} zoomControl={false} attributionControl={false} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={22} />
        {b && (
          <Polygon positions={b} pathOptions={{ color: "#475569", dashArray: "5 5", weight: 2, fillOpacity: 0.15 }}>
            <Tooltip sticky>{labels?.[0] ?? "Registered boundary"}</Tooltip>
          </Polygon>
        )}
        {a && !same && (
          <Polygon positions={a} pathOptions={{ color: "#ea580c", weight: 3, fillColor: "#f97316", fillOpacity: 0.35 }}>
            <Tooltip sticky>{labels?.[1] ?? "Changed boundary"}</Tooltip>
          </Polygon>
        )}
        <Fit polys={[b ?? [], a ?? []]} />
      </MapContainer>
    </div>
  );
}
