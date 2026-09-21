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

// ---------------- who can sign in (prototype identities)
export type DemoIdentity = { user: string; name: string; shows: string };
export type Identities = {
  builders: string[];
  investors: { email: string; name: string }[];
  admin: { name: string; user: string };
  /** one ready-made identity per role, chosen from the seeded data by the backend */
  demo?: Partial<Record<"public" | "builder" | "investor" | "owner" | "admin", DemoIdentity | null>>;
};

// ---------------- area insights: sourced facts only, never a score or a verdict
export type InfraItem = { name: string; locality: string; city: string; project_type: "metro" | "expressway" | "expansion" | "other"; description: string; announced_status: "planned" | "under_construction" | "completed"; expected_completion: string; data_source: string; data_date: string };
export type AreaRef = { city: string; locality: string; known_projects: number };
export type AreaInsight = {
  city: string; locality: string; disclaimer: string;
  price_per_sqft: { value: number | null; text: string; note: string };
  inventory: { known_projects: number; known_units: number | null; projects_with_unit_count: number; unsold_units: { value: number | null; text: string }; projects: { project_name: string; builder_name: string; total_units: string; status: string; confidence: string }[]; sources: string[] };
  infrastructure: InfraItem[];
};

// ---------------- property lifecycle (builder -> validation -> authority -> passport)
export type VerificationStatus = "draft" | "pending" | "verified" | "rejected" | "conflict";
export type Check = { key: string; ok: boolean; text: string; why?: string; severity?: "error" | "warning" };
export type Validation = { valid: boolean; score: number; checks: Check[]; conflicts: { with_unit: string; with_tpid: string; overlap_sqm: number; with_volume: { min: number[]; max: number[] } }[]; drawn_area_sqm: number; technical: string[] };
export type Integrity = { score: number; parts: Record<string, number> };
export type PropertyUnit = {
  id?: number; tpid: string; land_record_id: string; label: string; unit_type: string; usage_type: string; area_sqm: number; area_sqft: number;
  floor_number: number; floor_label: string; building: { id: number; name: string; num_floors: number };
  project: { id: number; name: string; city: string; locality: string; developer: string; land_record_id: string; is_demo: boolean };
  verification_status: VerificationStatus; status_label: string; verification_id: string; verified_at: string | null; sale_status: string; has_owner: boolean;
  flags: UnitFlags; integrity: Integrity; version_count: number; volume?: { min: number[]; max: number[] }; footprint?: GeoPolygon;
  owner?: { name: string; email?: string; registered_on: string; registration_no?: string } | null;
};
export type HistoryItem = { at: string; kind: string; text: string; tone: "ok" | "warn" | "bad" | "neutral"; version?: number; approval_status?: string };
export type PropertyPage = PropertyUnit & {
  history: HistoryItem[]; versions: { version_number: number; created_at: string; approval_status: string; plot_number: string; geometry: GeoPolygon; bounding_volume: { min: number[]; max: number[] }; area_sqm: number; changed_by: string; reason: string }[];
  change: { previous_sqm: number; current_sqm: number; difference_sqm: number; previous_sqft: number; current_sqft: number; moved_m: number; previous_label: string; current_label: string; before: GeoPolygon; after: GeoPolygon; approved: boolean } | null;
  pending_modification: ChangeRequest | null; disputes_open: number; demo_dataset: boolean;
};
export type VerifyCheck = { text: string; ok: boolean; detail: string };
export type VerifyResultV2 = { tpid: string; result: string; tone: "ok" | "warn" | "bad"; checks: VerifyCheck[]; integrity: Integrity; explanation: string; demo_dataset: boolean };
export type ProjectSummary = { id: number; name: string; developer: string; city: string; locality: string; address: string; project_type: string; land_record_id: string; is_demo: boolean; status: string; counts: Record<string, number>; centroid: { lat: number; lng: number } };
export type ProjectDashboard = ProjectSummary & { buildings: { id: number; name: string; num_floors: number; num_basements: number; land_record_id: string; units: number; pending: number; verified: number; conflicts: number }[]; parcel_local: number[][] };
export type BuildingDetail = { id: number; name: string; num_floors: number; num_basements: number; land_record_id: string; project: ProjectSummary; footprint_local: number[][]; parcel_local: number[][]; floors: { floor_number: number; label: string; base_elevation_m: number; height_m: number; units: PropertyUnit[] }[] };
export type AuditRow = { id: number; at: string; actor: string; role: string; action: string; label: string; subject: string; previous_value: string; new_value: string; status: string; note: string; category?: string; unit_id: number | null; parcel_id: number | null };

// ---------------- analysis / decision support
export type EdgeMove = { edge: string; metres: number; outward: boolean; text: string };
export type ChangeAnalysis = {
  kind: string; mode: "registered_vs_proposed" | "baseline_vs_current"; before: { min: number[]; max: number[] }; after: { min: number[]; max: number[] };
  area_before_sqm: number; area_after_sqm: number; area_before_sqft: number; area_after_sqft: number; area_diff_sqm: number; area_diff_sqft: number; area_pct: number;
  edge_moves: EdgeMove[]; centroid_shift_m: number; direction: string; changed_region_sqm: number;
  new_conflicts: { tpid: string; label: string; overlap_sqm: number; overlap_pct: number }[]; persisting_conflicts: string[];
  containment: Record<string, number>; leaves_building: boolean; risk: "low" | "medium" | "high"; why_it_matters: string;
  impacted: Impacted[]; proposal_id: number | null; proposed_by: string | null; approved: boolean | null;
};
export type Impacted = { tpid: string; label: string; kind: "overlap" | "adjacent"; overlap_sqm: number; overlap_pct: number; distance_m: number; reason: string };
export type RiskEvent = { at: string; event: string; version: number | null; area_change_pct: number | null; movement_m: number | null; conflict: string | null; risk: "low" | "medium" | "high" | "critical"; actor_role: string; source: string };
export type Priority = { level: "critical" | "high" | "medium" | "low"; score: number; factors: { points: number; reason: string }[]; action: string; method: string };
export type Completeness = { available: number; total: number; percent: number; missing: string[]; note: string };
export type Trust = { verification: { label: string; ok: boolean; id: string | null; at: string | null }; geometry: { label: string; ok: boolean }; history: { label: string; count: number }; changes: { label: string; count: number; pending: number; unapproved_versions: boolean }; disputes: { label: string; count: number; ok: boolean }; completeness: { label: string; percent: number }; overall: string; tone: "ok" | "warn" | "bad"; note: string };
export type Analysis = { labels: Record<string, string>; change: ChangeAnalysis | null; impacted: Impacted[]; timeline: RiskEvent[]; priority: Priority; completeness: Completeness; trust: Trust; insight: string; graph: { nodes: { id: string; type: string; label: string; href: string }[]; conflicts: { tpid: string; label: string; href: string }[] }; decision_categories: string[]; decisions: AuditRow[] };
export type Simulation = { simulation: true; saved: false; badge: string; tpid: string; validation: Validation; change: ChangeAnalysis; impacted: Impacted[]; priority_before: Priority; priority_after: { level: string; score: number; factors: { points: number; reason: string }[] }; recommendation: string };
export type QueueRow = PropertyUnit & { priority: Priority; pending_modification: boolean };
export type Checklist = { tpid: string; ready: boolean; items: { key: string; text: string; ok: boolean; fix: string }[]; score: number };
export type Health = { project: string; units: number; verified: number; pending: number; needs_changes: number; conflicts: number; disputes: number; modification_requests: number; readiness_percent: number; method: string };
export type Alert = { at: string; tpid: string; label: string; building: string; event: string; status: string; pending_modification: boolean; area: { before_sqft: number; after_sqft: number } | null };

/**
 * One request path for the whole app.
 *  - Every request has a timeout, so nothing waits forever.
 *  - Reads (GET) are retried while the server is unreachable: a free host that went to sleep needs
 *    ~1 minute to wake, and the ServerStatus banner explains the wait. Writes are never auto-retried.
 *  - Every failure becomes an ApiError whose message a person can read.
 */
export type ServerState = "ok" | "waking" | "down";
export const SERVER_EVENT = "tribhoomi-server";
let serverState: ServerState = "ok";
function announce(state: ServerState) {
  if (state === serverState || typeof window === "undefined") return;
  serverState = state;
  window.dispatchEvent(new CustomEvent(SERVER_EVENT, { detail: state }));
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public kind: "network" | "timeout" | "server" | "client") { super(message); }
}

const WAKE_BUDGET_MS = 100_000;   // keep retrying reads for this long before giving up
const SLOW_MS = 8_000;            // a read still pending after this shows the wake-up banner (kept above normal slow responses)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(path, { ...init, signal: ctl.signal });
  } catch (e) {
    if (ctl.signal.aborted) throw new ApiError("The server took too long to answer. Please try again.", 0, "timeout");
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0, "network");
  } finally { clearTimeout(timer); }
}

/**
 * A proxy in front of a dead or sleeping backend answers 500/502/503/504 WITHOUT our JSON body.
 * Our own API also uses 503 (e.g. "AI is not available: quota used up") and always sends a `detail`:
 * that is an answer to show, not a server that is down.
 */
async function unreachable(r: Response): Promise<boolean> {
  if (![500, 502, 503, 504].includes(r.status)) return false;
  try { const j = await r.clone().json(); return typeof j?.detail === "undefined"; } catch { return true; }
}

async function request(path: string, init: RequestInit, opts: { retry: boolean; timeoutMs: number }): Promise<Response> {
  const started = Date.now();
  const slow = opts.retry ? setTimeout(() => announce("waking"), SLOW_MS) : undefined;
  try {
    for (let n = 0; ; n++) {
      let r: Response | null = null;
      let failure: ApiError | null = null;
      try { r = await attempt(path, init, opts.timeoutMs); } catch (e) { failure = e as ApiError; }
      if (r && !(await unreachable(r))) {
        announce("ok");
        if (!r.ok) throw new ApiError(await errText(r), r.status, r.status >= 500 ? "server" : "client");
        return r;
      }
      failure ??= new ApiError("The server is not responding right now. Please try again in a minute.", r ? r.status : 0, "server");
      if (!opts.retry || Date.now() - started > WAKE_BUDGET_MS) { if (opts.retry) announce("down"); throw failure; }
      announce("waking");
      await sleep(Math.min(2000 + n * 1000, 6000));
    }
  } finally { clearTimeout(slow); }
}

async function get<T>(path: string): Promise<T> {
  const r = await request(path, { cache: "no-store", headers: sessionHeaders() }, { retry: true, timeoutMs: 30_000 });
  return r.json();
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await request(path, { method, headers: { "content-type": "application/json", ...sessionHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) }, { retry: false, timeoutMs: 60_000 });
  return r.json();
}

async function upload<T>(path: string, body: FormData | undefined, timeoutMs: number): Promise<T> {
  const r = await request(path, { method: "POST", body, headers: sessionHeaders() }, { retry: false, timeoutMs });
  return r.json();
}

const STATUS_TEXT: Record<number, string> = { 401: "Please sign in to do this.", 403: "Your current role is not allowed to do this.", 404: "That record was not found.", 409: "This conflicts with the current record. Reload and try again.", 413: "That file is too large.", 423: "This record is locked and cannot be edited directly.", 429: "Too many requests. Please wait a moment." };

async function errText(r: Response) {
  try {
    const j = await r.json();
    if (typeof j.detail === "string" && j.detail) return j.detail;
    // FastAPI validation list (older servers): name the fields instead of dumping JSON
    if (Array.isArray(j.detail)) return j.detail.slice(0, 4).map((e: any) => `${String((e.loc ?? []).filter((x: any) => x !== "body").join(" ")).replace(/_/g, " ")}: ${e.msg}`).join(". ") + ".";
  } catch {}
  return STATUS_TEXT[r.status] ?? (r.status >= 500 ? "The server hit a problem. Please try again." : `The request could not be completed (code ${r.status}).`);
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
  areas: () => get<{ areas: AreaRef[]; disclaimer: string }>("/api/area-insights"),
  areaInsight: (city: string, locality: string) => get<AreaInsight>(`/api/area-insights?city=${encodeURIComponent(city)}&locality=${encodeURIComponent(locality)}`),
  parse: (ulpin: string) => get<any>(`/api/ulpin/parse?ulpin=${encodeURIComponent(ulpin)}`),
  generate: (body: Record<string, number>) => send<any>("POST", "/api/ulpin/generate", body),
  identities: () => get<Identities>("/api/identities"),
  // builder
  builderOverview: () => get<{ builder: string; parcels: any[]; editable: UnitRow[]; locked: UnitRow[]; change_requests: ChangeRequest[]; notifications: Notice[] }>("/api/builder/overview"),
  assign: (ulpin: string, body: { owner_name: string; owner_email: string; ownership_type: string }) => send<{ ok: boolean; message: string; unit: UnitRow }>("POST", `/api/builder/units/${ulpin}/assign`, body),
  editUnit: (ulpin: string, body: { plot_number?: string; dx?: number; dy?: number; dw?: number; dd?: number }) => send<{ ok: boolean; unit: UnitRow }>("PATCH", `/api/builder/units/${ulpin}`, body),
  previewChange: (ulpin: string, body: { plot_number?: string; dx?: number; dy?: number; dw?: number; dd?: number }) => send<Diff>("POST", `/api/builder/units/${ulpin}/preview`, body),
  requestChange: (ulpin: string, body: { plot_number?: string; dx?: number; dy?: number; dw?: number; dd?: number; reason: string }) => send<{ ok: boolean; message: string; change_request: ChangeRequest }>("POST", `/api/builder/units/${ulpin}/change-requests`, body),
  createLayout: (body: any) => send<{ ok: boolean; message: string; parcel: ParcelFeature }>("POST", "/api/layouts", body),
  uploadLayout: (file: File, opts: { name?: string; num_floors?: number; units_per_floor?: number; land_use?: string } = {}) => {
    const fd = new FormData(); fd.append("file", file);
    const q = new URLSearchParams(Object.entries(opts).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return upload<{ ok: boolean; message: string; parcels: ParcelFeature[] }>(`/api/layouts/upload?${q}`, fd, 60_000);
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
  // lifecycle
  builderDashboard: () => get<{ builder: string; demo: boolean; counts: Record<string, number>; projects: ProjectSummary[] }>("/api/builder/dashboard"),
  createProject: (body: Record<string, unknown>) => send<{ ok: boolean; message: string; project: ProjectSummary }>("POST", "/api/builder/projects", body),
  project: (id: number | string) => get<ProjectDashboard>(`/api/projects/${id}`),
  addBuilding: (projectId: number | string, body: Record<string, unknown>) => send<{ ok: boolean; message: string; building_id: number }>("POST", `/api/builder/projects/${projectId}/buildings`, body),
  building: (id: number | string) => get<BuildingDetail>(`/api/buildings/${id}`),
  validateUnit: (body: Record<string, unknown>) => send<Validation>("POST", "/api/builder/units/validate", body),
  createUnit: (body: Record<string, unknown>) => send<{ ok: boolean; unit: PropertyUnit; validation: Validation; message: string }>("POST", "/api/builder/units", body),
  submitUnit: (ident: string) => send<{ ok: boolean; message: string; unit: PropertyUnit; validation: Validation }>("POST", `/api/builder/units/${encodeURIComponent(ident)}/submit`),
  builderUnits: () => get<{ units: PropertyUnit[] }>("/api/builder/units"),
  audit: (q: { unit?: string; project_id?: number } = {}) => get<AuditRow[]>(`/api/audit?${new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`),
  authorityDashboard: () => get<{ authority: string; counts: Record<string, number>; pending: PropertyUnit[]; conflicts: PropertyUnit[] }>("/api/authority/dashboard"),
  authorityReview: (ident: string) => get<{ unit: PropertyUnit; validation: Validation; building: { id: number; name: string; footprint_local: number[][]; num_floors: number }; parcel: { id: number; name: string; local: number[][]; land_record_id: string; is_demo: boolean }; neighbours: { label: string; tpid: string; volume: { min: number[]; max: number[] }; status: string }[]; versions: PlotVersion[]; change_requests: ChangeRequest[]; disputes: Dispute[]; audit: AuditRow[] }>(`/api/authority/review/${encodeURIComponent(ident)}`),
  authorityDecide: (ident: string, decision: "approve" | "reject" | "changes", note = "") => send<{ ok: boolean; message: string; unit: PropertyUnit }>("POST", `/api/authority/units/${encodeURIComponent(ident)}/decide`, { decision, note }),
  discover: (q: string, status = "") => get<{ count: number; results: PropertyUnit[]; projects: { id: number; name: string; city: string }[] }>(`/api/discover?q=${encodeURIComponent(q)}&status=${status}`),
  property: (ident: string) => get<PropertyPage>(`/api/property/${encodeURIComponent(ident)}`),
  propertyVerify: (ident: string) => get<VerifyResultV2>(`/api/property/${encodeURIComponent(ident)}/verify`),
  ownerProperties: () => get<{ owner: string; properties: PropertyPage[] }>("/api/owner/properties"),
  // analysis / decision support
  analysis: (ident: string) => get<Analysis>(`/api/property/${encodeURIComponent(ident)}/analysis`),
  simulate: (ident: string, volume: { min: number[]; max: number[] }) => send<Simulation>("POST", `/api/authority/simulate/${encodeURIComponent(ident)}`, { volume }),
  authorityQueue: () => get<{ queue: QueueRow[]; method: string }>("/api/authority/queue"),
  authorityMap: () => get<{ type: "FeatureCollection"; features: { type: "Feature"; geometry: GeoPolygon; properties: { tpid: string; label: string; building: string; project: string; floor: number; status: string; priority: string | null; score: number | null } }[]; method: string }>("/api/authority/map"),
  checklist: (ident: string) => get<Checklist>(`/api/builder/units/${encodeURIComponent(ident)}/checklist`),
  projectHealth: (id: number | string) => get<Health>(`/api/projects/${id}/health`),
  watch: (ident: string) => send<{ watching: boolean; tpid: string }>("POST", `/api/watch/${encodeURIComponent(ident)}`),
  alerts: () => get<{ alerts: Alert[]; watching: string[] }>("/api/alerts"),
  flagship: (stage: "setup" | "full" = "setup") => send<{ project_id: number; building_id: number; units: Record<string, string>; change_request_id: number; stage: string }>("POST", `/api/demo/flagship?stage=${stage}`),
  authorityDecideV2: (ident: string, decision: "approve" | "reject" | "changes", note = "", category = "") => send<{ ok: boolean; message: string; unit: PropertyUnit }>("POST", `/api/authority/units/${encodeURIComponent(ident)}/decide`, { decision, note, category }),
  decideV2: (id: number, decision: "approve" | "reject" | "changes", note = "", category = "") => send<{ ok: boolean; change_request: ChangeRequest; unit: UnitRow }>("POST", `/api/change-requests/${id}/decide`, { decision, note, category }),
  aiStatus: () => get<{ model_id: string; loaded: boolean; error: string | null; mode?: string; explanation?: string }>("/api/ai/status"),
  // the hosted model can need ~20 s to warm up, local CPU inference a few seconds
  extract: (file?: File) => { const fd = new FormData(); if (file) fd.append("file", file); return upload<ExtractResult>("/api/ai/extract", file ? fd : undefined, 120_000); },
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
