---
title: Tribhoomi 3D ULPIN
emoji: 🏗️
colorFrom: gray
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# त्रिभूमि Tribhoomi — property identity & integrity platform

Prototype for **SIH26011** (Ministry of Rural Development, Dept. of Land Resources).

**The product story:** a builder creates a property → Tribhoomi validates its identity →
an authority verifies it → the property receives a persistent digital identity (a
**Tribhoomi Property ID**, e.g. `TRB-TA1-F08-U03`) → owners and investors can independently
verify its integrity → every later change is recorded and traceable.

```
🏗️ BUILDER   create project → add building → add unit → draw boundary → automatic validation → submit
🏛️ AUTHORITY review evidence → approve / request changes / reject   (every decision is audited)
🪪 IDENTITY  Tribhoomi Property ID · Property Passport · QR · integrity score
💰 INVESTOR  search → verify before you invest → history → before/after → integrity report
🏠 OWNER     my property → change detection → approve/reject modifications → disputes
```

Roles are **simulated** (Demo Mode); the server still enforces what each role may do: a
builder cannot verify their own unit, an investor cannot edit, and verified geometry is never
overwritten — a modification becomes a new version only after approval.

**Positioning.** The TPID is Tribhoomi's own identifier. The underlying engine also produces
ULPIN-*format* technical land-record IDs for parcels, buildings, levels and units; these are
shown only under "Advanced technical details" and are not official ULPINs. All data is a
demonstration dataset.

## Run it

Requirements: Node 18+, Python 3.11+. Nothing else (SQLite is the default database).

```bash
cp frontend/.env.example frontend/.env.local   # then paste your Cesium ion token into NEXT_PUBLIC_CESIUM_TOKEN
./dev.sh            # first run installs everything, then starts both servers
# backend  -> http://localhost:8000/docs   (FastAPI, auto-seeds the DB on first start)
# frontend -> http://localhost:3000
```

The default map page is 2D Leaflet and needs no GPU. The **Globe** page (Cesium ion world
terrain + OSM Buildings) is optional: it needs a WebGL-capable GPU/driver, falls back to
simpler settings if a shader fails, and otherwise tells you to use the 2D map. Without a token
it uses OpenStreetMap imagery.

Or by hand:

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu   # CPU-only, ~200 MB
.venv/bin/python -m pytest              # 26 tests: ULPIN engine, topology validator, lock rule
.venv/bin/python -m seed.seed           # (re)create and seed tribhoomi.db
.venv/bin/uvicorn app.main:app --reload --port 8000

cd ../frontend
npm install && npm run dev
```

The first click on **AI Footprint → Run** downloads `nvidia/segformer-b0-finetuned-ade-512-512`
(~15 MB) from Hugging Face and caches it; later runs take a few seconds on CPU.

## Decision support (what makes Tribhoomi different)

All of this is computed deterministically from stored records in `backend/app/services/analysis.py`
and served by `/api/property/<TPID>/analysis`. Every output is labelled Tribhoomi analysis, shows
its method, and uses "potential conflict / unusual change / requires review" language.

- **Geometry change intelligence**: area before/after and %, per-edge displacement ("east boundary
  moved outward 1.5 m"), centroid shift and direction, changed region, containment change, and
  **new** overlaps introduced by the change with the neighbours affected.
- **What changed?** on the authority review page: registered vs proposed (or baseline vs current)
  with before/after/overlay on the floor plan.
- **Impacted neighbours**: overlap or proximity (< 0.5 m) with a read-only compare link.
- **Review priority queue**: transparent point-based heuristic (overlap severity, area change,
  disputes, unapproved versions, recent modifications, validation failures, waiting time) with
  "Why this priority?" listing every factor. Not an official risk score.
- **Property risk timeline**: when the property started needing attention, from versions,
  proposals, disputes and audit events only (no invented events).
- **Trust summary** and **data completeness** on every property page and the public passport
  (three questions: registered? verified? current conflict?).
- **Simulate modification** (authority): drag a boundary, see area/overlap/validation/priority
  change; nothing is saved (`SIMULATION — NOT SAVED`).
- **Spatial conflict map** of stored unit footprints coloured by stored status.
- **Structured decisions**: reason category + note stored in the immutable audit trail.
- **Watch this property** alerts (application notifications), builder **pre-submission checklist**,
  **project health**, **evidence package** PDF, and a one-click **flagship scenario**
  (`POST /api/demo/flagship`) that creates the boundary-modification story on a demo project.

## Pages by role

| Role | Pages |
|---|---|
| Public / Investor | `/` landing · `/discover` search · `/property/<TPID>` (passport, verify before you invest, history, before/after, report) · `/passport/<TPID>` public QR page |
| Owner | `/owner` my property · `/changes` approve/reject modifications, disputes |
| Builder | `/builder` dashboard · `/builder/projects/new` · project → building → floor → **boundary editor** → validation → submit · `/builder/modify/<TPID>` · units · audit |
| Authority | `/authority` command center · pending · `/authority/review/<TPID>` evidence + decision · conflicts · disputes · audit log |
| Advanced | `/map` GIS view · `/globe` Cesium · `/parcel/<id>` 3D · `/ulpin` ID engine · `/ai` · `/dashboard` |

## Roles

No passwords, but one committed session. `/signin` is the only way in: it stores a role +
identity that holds until the person signs out from the header, and nothing else in the app
changes identity. `/signin?role=<role>&next=<path>` preselects a role and returns to `next`
afterwards, which is how role-gated pages and the guided demo send people through sign-in.
Every API call carries `X-Role` / `X-User` headers that the backend checks (`app/auth.py`), so
swapping that dependency for real auth later needs no endpoint changes.

| Role | Page | Can |
|---|---|---|
| Public | `/verify` | look up any ULPIN's full version history, file a dispute |
| Builder | `/builder`, map tools on `/` | draw/upload layouts, edit **unsold** units, assign units to investors, submit change requests on sold units |
| Investor | `/investor` | see current registered records, approve/reject change requests, file disputes |
| Government | `/admin` | audit all open disputes and pending requests with before/after diffs |

## The integrity rule

**Registration locks the baseline.** When a builder assigns a unit to an investor (name + email),
the current plot number, boundary and ULPIN are snapshotted as `plot_versions` v1. From then on
the builder cannot edit the unit; they can only file a `change_request`, the affected owner is
notified, and a new version is appended **only if the owner approves**. Versions are never
updated or deleted, so a silent change (seeded on Aravalli Residency Floor 3-C → "3-D") shows up
as an unapproved version with a warning banner on the public verify page.

## Demo flow (≈6 minutes) — see the **Guided Demo** page

1. **Map** — search `09141003100045` or click a parcel on the map; see the 2D ULPIN. Builders can draw or upload a plot here.
2. **3D view** — floors extruded from the footprint; every unit carries a 3D ULPIN. Use the *Explode* slider.
3. Click a unit → ownership record, area, usage, bounding volume, parent chain back to the 2D ULPIN.
4. **Run topology validator** → units 7-B / 7-C turn red (surveyed volumes overlap by 2.5 m).
5. Parcel 2 (Aravalli Residency) → basement 2 clashes with the DMRC underground corridor; Floor 3-C/3-D overlap caused by the tampering.
6. **Builder desk** (role: Builder · Tribhoomi Developers) → assign an unsold unit, watch it lock; try to edit it, get refused; request a change with a before/after map.
7. **My plots** (role: Investor · Rajesh Kumar) → approve or reject the pending request on Floor 5-A.
8. **Verify my plot** (public) → `09-141-0018-00046-B01-F04-U03-A` shows TAMPERED with v1 vs v2 overlaid.
9. **Government audit** (role: Government) → disputes and pending requests with diffs.
10. **AI Footprint** — real SegFormer inference on an aerial tile of Noida Sector 18, vectorised to polygons.
11. **Dashboard** — parcels, buildings, ULPINs generated, conflicts, locked units, versions, disputes.

## Layout

```
backend/
  app/ulpin/engine.py      ← the core: pure functions, no I/O (build/parse/truncate/parent)
  app/topology.py          ← pure overlap / clash / encroachment / duplicate checks
  app/models.py            ← SQLAlchemy tables: parcels, buildings, floors, units, ownership, underground_layers
  app/services/            ← model3d (DB → JSON for viewers), validate, layout (polygon → parcel/floors/units),
                             integrity (baseline lock, versions, change requests, disputes)
  app/auth.py              ← X-Role / X-User header check
  app/routers/             ← /api/parcels, /api/units, /api/ulpin, /api/validate, /api/dashboard, /api/ai,
                             /api/builder/*, /api/investor/*, /api/change-requests, /api/disputes, /api/verify, /api/admin, /api/layouts
  app/ai/extract.py        ← SegFormer inference + mask vectorisation
  seed/parcels.geojson     ← 10 hand-crafted NCR parcels: Noida, Greater Noida, Gurugram, Delhi (residential,
                             commercial and mixed; one deliberate overlap, one metro clash, one tampering story)
  seed/seed.py             ← generates floors/units/volumes/ULPINs from the GeoJSON spec
  tests/                   ← pytest
  schema_postgis.sql       ← reference DDL with native PostGIS geometry columns
frontend/src/
  app/page.tsx             ← Leaflet 2D map (default) + parcel search + builder draw/upload/AI tools
  app/globe/page.tsx       ← optional Cesium globe (terrain + OSM Buildings), same sidebar and tools
  app/parcel/[id]/page.tsx ← Three.js unit viewer + ownership panel + validator + change warnings
  app/builder, app/investor, app/verify, app/admin   ← integrity module UIs
  app/ulpin, app/ai, app/dashboard, app/demo
  components/ParcelMap.tsx (Leaflet + drawing), CesiumMap.tsx, Building3D.tsx, DiffMap.tsx, ParcelSidebar.tsx, ChangeRequestForm.tsx, SessionBadge.tsx
  lib/useLayoutTools.ts    ← shared parcel/search/draw/upload state for both map pages
  lib/api.ts               ← typed API client
docker-compose.yml         ← optional PostGIS
```

## Key decisions (and why)

- **SQLite by default, PostGIS optional.** No Docker/Postgres was available on the build machine.
  Geometry is stored as GeoJSON text and spatial maths is done with Shapely, so the same code runs
  anywhere. `schema_postgis.sql` + `docker-compose.yml` show the production shape; switch with `DATABASE_URL`.
- **ULPIN engine is a pure module with tests** before any API or UI touched it — IDs must be
  deterministic and re-derivable, so they never depend on DB auto-increment.
- **Bounding volumes, not meshes, for conflicts.** Each unit stores a min/max box in
  building-local metres; overlap = box intersection. Simple, fast, and honest about what a
  survey actually records.
- **Layers are first-class.** Metro tunnels, utility ducts and skywalks get parcel-level IDs
  (`B00-L01-U01-G`, `B00-F01-U01-R`) so cross-layer clashes can be detected.
- **One real AI pass.** SegFormer-B0 (ADE20K) is a general model, not a satellite specialist,
  but it detects buildings well enough on 0.5 m/px imagery to make the point without training.
- **Leaflet by default, Cesium as an option.** Old Intel/Mesa GPU drivers reject some Cesium
  shaders, so the demo never depends on the globe: everything works on the 2D map, and the
  Globe page adds real terrain and neighbouring buildings when the hardware allows.
- **Seed spans the NCR.** Ten parcels in Noida, Greater Noida (UP 09/141), Gurugram (Haryana
  06/086) and Delhi (07/094, 097, 098) so the ID scheme is visibly not tied to one place; ~340
  units, ~490 ULPINs. The three original parcels still carry the demo stories. Per-unit
  interactions (click, explode, validator, warning icons) stay in the lighter Three.js viewer.
- **Boundaries are proposed as metres, not redrawn.** A builder shifts/resizes a unit by dx/dy/
  width/depth and sees the diff; the backend turns that into both a bounding volume (for the
  validator) and a lon/lat polygon (for maps and the version record).
- **Image upload georeferencing is simulated.** AI-detected footprints from an uploaded image are
  placed over the current camera view; a real pipeline would use the image's GeoTIFF bounds.

## Extras

- **QR code** beside every unit ULPIN (3D unit panel, Verify page) encodes that unit's public
  verify URL. For phones to resolve it, open the app via your LAN IP
  (e.g. `http://192.168.1.20:3000`) or set `NEXT_PUBLIC_PUBLIC_URL` in `frontend/.env.local`.
- **PDF ownership certificate** ("Download certificate" on the unit panel and Verify page):
  ULPIN, owner, tenure, registration, area, usage, record version, QR, and a CLEAN/TAMPERED/
  DISPUTED status stamp. Generated in the browser with jsPDF from the same API data.
- **EN | हिं toggle** in the header switches navigation and section headers via the dictionary in
  `frontend/src/lib/i18n.ts`. Data values are never translated.

## Market-context layer (real projects, informational only)

`backend/seed/market_context.csv` → table `market_context_projects` → `GET /api/market-context`.
Real NCR projects (real builders, RERA IDs, coordinates) appear as plain grey markers on the map
and globe and as a table on the dashboard, with a per-row **confidence** label: `verified`
(RERA filing), `listing_based` (aggregator sites; RERA IDs and coordinates may be approximate)
or `unknown`. Any figure that could not be confirmed is stored as `unknown`, never guessed; rows
without confident coordinates are listed but not mapped. The table has **no foreign key** to
parcels or units and nothing in the ULPIN engine, ownership or integrity code reads it, so the
demo can never imply a real company had a dispute. The fictional demo buildings are placed near
these real localities (e.g. Tribhoomi Tower beside Coco County, Greater Noida Sector 10) purely
for context. A map legend separates "Live demo buildings (interactive, synthetic)" from
"Regional context (informational, real RERA data)".

## Theme

Dark "command-center" styling lives entirely in `frontend/src/app/globals.css` and
`tailwind.config.ts`: tokens (near-black base, glass panels, teal accent, amber = pending,
red = tampered/disputed, green = approved), Space Grotesk for UI text and JetBrains Mono for
every ID and coordinate, and a *dark remap* section that restyles the light Tailwind classes
the pages were written with, so no page logic had to change. Glow and pulse effects are
reserved for selected units, flagged records and live numbers. All text/background pairs
were checked at >= 4.5:1 contrast (body text 15:1) so it stays readable when projected.

## Out of scope (simulated)

LiDAR / GNSS / drone capture, real cadastral data, real authentication, email/SMS
notifications (in-app inbox only), shapefile parsing (convert to GeoJSON), and DILRMP
integration. All seed data is synthetic; owner names and emails are fictional.
