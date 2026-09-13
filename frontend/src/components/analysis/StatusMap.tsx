"use client";
/** Authority spatial map: stored unit footprints coloured by stored status. No synthetic density layer. */
import { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

const COLOR: Record<string, string> = { verified: "#22c55e", pending: "#f59e0b", conflict: "#ef4444", modification: "#f97316", disputed: "#dc2626", draft: "#94a3b8", rejected: "#64748b" };
type F = { geometry: { coordinates: number[][][] }; properties: { tpid: string; label: string; building: string; project: string; floor: number; status: string; priority: string | null; score: number | null } };

function Fit({ feats }: { feats: F[] }) {
  const map = useMap();
  useEffect(() => { const pts = feats.flatMap((f) => f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])); if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.1)); }, [feats, map]);
  return null;
}

export default function StatusMap({ feats, filter }: { feats: F[]; filter: string }) {
  const shown = feats.filter((f) => !filter || f.properties.status === filter);
  return (
    <MapContainer center={[28.57, 77.36]} zoom={11} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {shown.map((f) => (
        <Polygon key={f.properties.tpid} positions={f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])} pathOptions={{ color: COLOR[f.properties.status] ?? "#94a3b8", weight: f.properties.priority ? 3 : 1, fillOpacity: 0.5 }}>
          <Popup><div className="text-sm"><div className="font-mono text-xs">{f.properties.tpid}</div><div className="font-semibold">{f.properties.building} — {f.properties.label}</div><div>{f.properties.project} · floor {f.properties.floor}</div><div>Status: <b>{f.properties.status}</b>{f.properties.priority && <> · Priority: <b>{f.properties.priority}</b> ({f.properties.score})</>}</div><Link href={`/authority/review/${f.properties.tpid}`} className="text-accent underline">Open review</Link></div></Popup>
        </Polygon>
      ))}
      <Fit feats={shown} />
    </MapContainer>
  );
}
