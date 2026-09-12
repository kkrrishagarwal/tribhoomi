/**
 * Thin typed wrapper around the FastAPI backend. All calls go through /api/*
 * which next.config.mjs proxies to http://127.0.0.1:8000.
 */

export type ParcelSummary = {
  id: number;
  ulpin_2d: string;
  ulpin_2d_compact: string;
  name: string;
  state: string;
  district: string;
  village_ward: string;
  land_use: string;
  builder: string;
  area_sqm: number;
  centroid: { lat: number; lng: number };
  buildings: { id: number; name: string; num_floors: number; num_basements: number; building_ulpin: string }[];
  underground_layers: { id: number; name: string; layer_type: string; layer_ulpin: string; top_m: number; bottom_m: number; operator: string }[];
};

export type ParcelFeature = {
  type: "Feature";
  id: number;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: ParcelSummary;
};

export type Ownership = {
  owner_name: string;
  owner_email: string;
  ownership_type: string;
  share_percent: number;
  registered_date: string;
  registration_no: string;
};

export type Unit = {
  id: number;
  unit_no: number;
  unit_ulpin: string;
  label: string;
  area_sqm: number;
  usage_type: string;
  volume: { min: [number, number, number]; max: [number, number, number] };
  ownership: Ownership[];
  flags?: UnitFlags;
};

export type UnitFlags = {
  locked: boolean;
  version_count: number;
  changed_since_registration: boolean;
  has_unapproved_change: boolean;
  has_pending_request: boolean;
  has_open_dispute: boolean;
};

export type GeoPolygon = { type: "Polygon"; coordinates: number[][][] };

export type PlotVersion = {
  id: number; version_number: number; plot_number: string; ulpin: string; geometry: GeoPolygon;
  bounding_volume: { min: number[]; max: number[] }; changed_by: string; change_reason: string;
  approval_status: "baseline" | "approved" | "unapproved"; change_request_id: number | null; created_at: string;
};

export type Diff = {
  before: { plot_number: string; geometry: GeoPolygon; bounding_volume?: any; version?: number };
  after: { plot_number: string; geometry: GeoPolygon; bounding_volume?: any; version?: number; approval_status?: string };
};

export type ChangeRequest = {
  id: number; unit_ulpin: string; unit_label: string; requested_by: string; proposed_plot_number: string; reason: string;
  status: "pending" | "approved" | "rejected"; resolution_note: string; created_at: string; resolved_at: string | null;
  affected_owner: { name: string; email: string } | null; parcel_id: number; building_name: string; diff?: Diff;
};

export type Dispute = {
  id: number; unit_ulpin: string; unit_label: string; raised_by: string; description: string;
  status: "open" | "investigating" | "resolved"; created_at: string; change_request_id: number | null;
  plot_version_id: number | null; parcel_id: number; building_name: string; owner: { name: string; email: string } | null;
  diff: { before: (Diff["before"]) | null; after: (Diff["after"]) | null }; flags: UnitFlags;
};

export type Notice = { id: number; message: string; unit_ulpin: string; change_request_id: number | null; read: boolean; created_at: string };

export type UnitRow = Unit & {
  parcel_id: number; building_name: string; floor_number: number; footprint: GeoPolygon;
  current_version: PlotVersion | null; pending_request: ChangeRequest | null; registered_on?: string; disputes?: Dispute[];
};

export type VerifyResult = {
  unit: UnitRow;
  parcel: { id: number; name: string; ulpin_2d: string; builder: string };
  owner: { name: string; registered_on: string; registration_no: string } | null;
  versions: PlotVersion[]; baseline: PlotVersion | null; current: PlotVersion | null; boundary_changed: boolean;
  change_requests: ChangeRequest[]; disputes: Dispute[]; flags: UnitFlags; warnings: string[];
  status: "TAMPERED" | "DISPUTED" | "PENDING CHANGE" | "VERIFIED" | "UNREGISTERED";
};

export type Floor = {
  id: number;
  floor_number: number;
  floor_ulpin: string;
  height_m: number;
  base_elevation_m: number;
  layer_type: string;
  layer_label: string;
  units: Unit[];
};

export type Building = {
  id: number;
  building_no: number;
  building_ulpin: string;
  name: string;
  num_floors: number;
  num_basements: number;
  floor_height_m: number;
  footprint_local: number[][];
  floors: Floor[];
};

export type Layer = {
  id: number;
  layer_no: number;
  layer_ulpin: string;
  layer_type: string;
  layer_label: string;
  name: string;
  top_m: number;
  bottom_m: number;
  operator: string;
  footprint_local: number[][];
};

export type ParcelModel = {
  parcel: ParcelSummary;
  parcel_local: number[][];
  buildings: Building[];
  layers: Layer[];
};

export type Conflict = {
  kind: string;
  severity: "error" | "warning";
  ulpin_a: string;
  ulpin_b: string | null;
  reason: string;
  overlap_volume_m3: number;
  parcel_id: number | null;
};

export type ValidationResult = {
  parcels_checked: number;
  units_checked: number;
  conflict_count: number;
  conflicts: Conflict[];
  conflicting_ulpins: string[];
};

export type UnitDetail = {
  unit: Unit;
  floor: { floor_number: number; floor_ulpin: string; height_m: number; base_elevation_m: number; layer_type: string };
  building: { id: number; name: string; building_ulpin: string; num_floors: number };
  parcel: ParcelSummary;
  hierarchy: { unit: string; floor: string; building: string; parcel_2d: string; layer: string };
};

export type Dashboard = {
  counts: Record<string, number>;
  units_by_usage: Record<string, number>;
  ownership_by_type: Record<string, number>;
  layers_by_type: Record<string, number>;
  conflicts_by_kind: Record<string, number>;
  per_parcel: { id: number; name: string; ulpin_2d: string; units: number; floors: number; conflicts: number }[];
  recent_conflicts: Conflict[];
};

export type ExtractResult = {
  model_id: string;
  inference_ms: number;
  image_size: [number, number];
  building_pixel_share: number;
  footprints_found: number;
  mask_png_base64: string;
  overlay_png_base64: string;
  footprints: { type: "FeatureCollection"; features: { id: number; geometry: { coordinates: number[][][] }; properties: { area_px: number; area_sqm: number; candidate_parcel_no: number } }[] };
};

import { sessionHeaders } from "./session";

export type MarketProject = {
  builder_name: string; project_name: string; city: string; locality: string; property_type: string;
  total_units: string; towers: string; floors: string; rera_id: string; status: string;
  data_source: string; data_date: string; confidence: "verified" | "listing_based" | "unknown"; notes: string; has_location: boolean;
};
export type MarketFeature = { type: "Feature"; id: number; geometry: { type: "Point"; coordinates: [number, number] }; properties: MarketProject };
export type MarketContext = { type: "FeatureCollection"; features: MarketFeature[]; unmapped: { id: number; properties: MarketProject }[]; summary: { projects: number; mapped: number; by_confidence: Record<string, number>; disclaimer: string } };

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store", headers: sessionHeaders() });
  if (!r.ok) throw new Error(await errText(r));
  return r.json();
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: { "content-type": "application/json", ...sessionHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(await errText(r));
  return r.json();
}

async function errText(r: Response) {
  try { const j = await r.json(); return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j); } catch { return `${r.status}`; }
}

export const api = {
  parcels: () => get<{ type: "FeatureCollection"; features: ParcelFeature[] }>("/api/parcels"),
  search: (q: string) => get<ParcelSummary[]>(`/api/parcels/search?q=${encodeURIComponent(q)}`),
  parcel: (id: number | string) => get<ParcelFeature>(`/api/parcels/${id}`),
  model: (id: number | string) => get<ParcelModel>(`/api/parcels/${id}/model`),
  unit: (ulpin: string) => get<UnitDetail>(`/api/units/${encodeURIComponent(ulpin)}`),
  validate: (parcelId?: number | string) => get<ValidationResult>(parcelId ? `/api/validate/${parcelId}` : "/api/validate"),
  dashboard: () => get<Dashboard>("/api/dashboard"),
  marketContext: () => get<MarketContext>("/api/market-context"),
  parse: (ulpin: string) => get<any>(`/api/ulpin/parse?ulpin=${encodeURIComponent(ulpin)}`),
  generate: (body: Record<string, number>) => send<any>("POST", "/api/ulpin/generate", body),
  identities: () => get<{ builders: string[]; investors: { email: string; name: string }[]; admin: { name: string; user: string } }>("/api/identities"),
  // builder
  builderOverview: () => get<{ builder: string; parcels: any[]; editable: UnitRow[]; locked: UnitRow[]; change_requests: ChangeRequest[]; notifications: Notice[] }>("/api/builder/overview"),
  assign: (ulpin: string, body: { owner_name: string; owner_email: string; ownership_type: string }) => send<{ ok: boolean; message: string; unit: UnitRow }>("POST", `/api/builder/units/${ulpin}/assign`, body),
  editUnit: (ulpin: string, body: { plot_number?: string; dx?: number; dy?: number; dw?: number; dd?: number }) => send<{ ok: boolean; unit: UnitRow }>("PATCH", `/api/builder/units/${ulpin}`, body),
  previewChange: (ulpin: string, body: { plot_number?: string; dx?: number; dy?: number; dw?: number; dd?: number }) => send<Diff>("POST", `/api/builder/units/${ulpin}/preview`, body),
  requestChange: (ulpin: string, body: { plot_number?: string; dx?: number; dy?: number; dw?: number; dd?: number; reason: string }) => send<{ ok: boolean; message: string; change_request: ChangeRequest }>("POST", `/api/builder/units/${ulpin}/change-requests`, body),
  createLayout: (body: any) => send<{ ok: boolean; message: string; parcel: ParcelFeature }>("POST", "/api/layouts", body),
  uploadLayout: async (file: File, opts: { name?: string; num_floors?: number; units_per_floor?: number; land_use?: string } = {}) => {
    const fd = new FormData(); fd.append("file", file);
    const q = new URLSearchParams(Object.entries(opts).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    const r = await fetch(`/api/layouts/upload?${q}`, { method: "POST", body: fd, headers: sessionHeaders() });
    if (!r.ok) throw new Error(await errText(r));
    return r.json() as Promise<{ ok: boolean; message: string; parcels: ParcelFeature[] }>;
  },
  // investor
  investorOverview: () => get<{ investor: string; units: UnitRow[]; pending_requests: ChangeRequest[]; past_requests: ChangeRequest[]; notifications: Notice[] }>("/api/investor/overview"),
  decide: (id: number, decision: "approve" | "reject", note = "") => send<{ ok: boolean; change_request: ChangeRequest; unit: UnitRow }>("POST", `/api/change-requests/${id}/decide`, { decision, note }),
  fileDispute: (body: { unit_ulpin: string; description: string; change_request_id?: number | null; raised_by?: string }) => send<{ ok: boolean; message: string; dispute: Dispute }>("POST", "/api/disputes", body),
  // public + admin
  verify: (ulpin: string) => get<VerifyResult>(`/api/verify/${encodeURIComponent(ulpin)}`),
  adminOverview: () => get<{ open_disputes: Dispute[]; resolved_disputes: Dispute[]; pending_requests: ChangeRequest[]; decided_requests: ChangeRequest[]; tampered_units: { unit_ulpin: string; label: string; parcel_id: number }[]; counts: Record<string, number> }>("/api/admin/overview"),
  setDisputeStatus: (id: number, status: string) => send<{ ok: boolean; dispute: Dispute }>("PATCH", `/api/admin/disputes/${id}`, { status }),
  notifications: () => get<Notice[]>("/api/notifications"),
  aiStatus: () => get<{ model_id: string; loaded: boolean; error: string | null }>("/api/ai/status"),
  extract: async (file?: File) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    const r = await fetch("/api/ai/extract", { method: "POST", body: file ? fd : undefined, headers: sessionHeaders() });
    if (!r.ok) throw new Error(await errText(r));
    return r.json() as Promise<ExtractResult>;
  },
};

export const USAGE_COLORS: Record<string, string> = {
  residential: "#3b82f6",
  commercial: "#f59e0b",
  utility: "#14b8a6",
  parking: "#94a3b8",
};

export const LAYER_COLORS: Record<string, string> = {
  utility: "#0d9488",
  metro: "#7c3aed",
  parking: "#64748b",
  air_rights: "#0ea5e9",
};
