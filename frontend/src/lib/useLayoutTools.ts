"use client";
/**
 * Shared state for the map pages (2D Leaflet and optional Cesium globe):
 * parcel list + search + selection, and the builder's layout tools
 * (draw a plot, upload GeoJSON, place AI-detected footprints).
 */
import { useEffect, useMemo, useState } from "react";
import { api, type GeoPolygon, type MarketFeature, type ParcelFeature, type ParcelModel } from "@/lib/api";

export type LayoutForm = { name: string; num_floors: number; num_basements: number; units_per_floor: number; land_use: string };
export const DEFAULT_FORM: LayoutForm = { name: "New layout", num_floors: 4, num_basements: 0, units_per_floor: 2, land_use: "residential" };
export type ViewRect = [number, number, number, number]; // west, south, east, north (degrees)

export function useLayoutTools(withModels: boolean) {
  const [features, setFeatures] = useState<ParcelFeature[]>([]);
  const [models, setModels] = useState<Record<number, ParcelModel>>({});
  const [market, setMarket] = useState<MarketFeature[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [ring, setRing] = useState<number[][] | null>(null);
  const [form, setForm] = useState<LayoutForm>(DEFAULT_FORM);
  const [candidates, setCandidates] = useState<GeoPolygon[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const fc = await api.parcels();
    setFeatures(fc.features);
    if (withModels) {
      const entries = await Promise.all(fc.features.map(async (f) => [f.id, await api.model(f.id)] as const));
      setModels(Object.fromEntries(entries));
    }
  };
  useEffect(() => {
    load().catch((e) => setError(String(e)));
    api.marketContext().then((mc) => setMarket(mc.features)).catch(() => setMarket([]));  // background layer; failure is non-fatal
    /* eslint-disable-line react-hooks/exhaustive-deps */
  }, []);

  const selected = features.find((f) => f.id === selectedId) ?? null;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return features;
    const digits = q.replace(/-/g, "");
    return features.filter((f) => f.properties.name.toLowerCase().includes(q) || f.properties.ulpin_2d.includes(q) || (/^\d+$/.test(digits) && f.properties.ulpin_2d_compact.includes(digits)));
  }, [features, query]);

  async function registerLayout(geometry: GeoPolygon) {
    setBusy("Registering layout…"); setMsg(null);
    try {
      const r = await api.createLayout({ ...form, geometry });
      setMsg(r.message); setRing(null); setCandidates([]);
      await load(); setSelectedId(r.parcel.id);
      return r.parcel.id;
    } catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(null); }
  }
  async function uploadGeoJSON(file: File) {
    setBusy("Uploading…"); setMsg(null);
    try { const r = await api.uploadLayout(file, { name: form.name, num_floors: form.num_floors, units_per_floor: form.units_per_floor, land_use: form.land_use }); setMsg(r.message); await load(); if (r.parcels[0]) setSelectedId(r.parcels[0].id); }
    catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(null); }
  }
  async function detectFromImage(file: File, rect: ViewRect | null) {
    setBusy("Running AI footprint model…"); setMsg(null);
    try {
      if (!rect) throw new Error("map not ready");
      const r = await api.extract(file);
      const [w, sN, e, n] = rect; const [W, H] = r.image_size;
      // place the image's pixel polygons over the current view extent (a demo stand-in for georeferencing)
      const polys: GeoPolygon[] = r.footprints.features.map((f) => ({
        type: "Polygon", coordinates: [f.geometry.coordinates[0].map(([px, py]) => [w + (px / W) * (e - w), n - (py / H) * (n - sN)])],
      }));
      setCandidates(polys); setMsg(`${polys.length} footprint(s) detected and placed over the current view. Pick one to register.`);
    } catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(null); }
  }

  return {
    features, models, market, query, setQuery, selectedId, setSelectedId, selected, results, error,
    drawing, setDrawing, ring, setRing, form, setForm, candidates, setCandidates, busy, msg, setMsg,
    registerLayout, uploadGeoJSON, detectFromImage, reload: load,
  };
}
