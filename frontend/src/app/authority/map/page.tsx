"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
const StatusMap = dynamic(() => import("@/components/analysis/StatusMap"), { ssr: false });
type Data = Awaited<ReturnType<typeof api.authorityMap>>;
export default function MapPage() { return <Gate roles={["admin"]} signin="/signin/authority"><Inner /></Gate>; }
function Inner() {
  const [d, setD] = useState<Data | null>(null); const [f, setF] = useState("");
  useEffect(() => { api.authorityMap().then(setD).catch(() => null); }, []);
  if (!d) return <ScanLoader text="Loading stored unit footprints" className="p-16" />;
  const counts: Record<string, number> = {}; d.features.forEach((x) => { counts[x.properties.status] = (counts[x.properties.status] || 0) + 1; });
  return (
    <div className="page">
      <h1 className="h1">Spatial conflict map</h1><p className="lead">Every stored unit footprint, coloured by its stored status. Thick outlines carry a review priority. {d.method}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{["", "verified", "pending", "conflict", "modification", "disputed", "draft"].map((s) => <button key={s} onClick={() => setF(s)} className={`rounded-lg px-3 py-1.5 text-sm ${f === s ? "btn-primary" : "btn-ghost"}`}>{s || "All"}{s && counts[s] ? ` (${counts[s]})` : ""}</button>)}</div>
      <div className="card mt-3 h-[70vh] overflow-hidden"><StatusMap feats={d.features} filter={f} /></div>
    </div>
  );
}
