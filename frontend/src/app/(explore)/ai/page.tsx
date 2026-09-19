"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { api, type ExtractResult } from "@/lib/api";
import ScanLoader from "@/components/ScanLoader";

const SAMPLE_M_PER_PX = 0.524;   // Esri World Imagery zoom 18 at Noida; must match backend/app/ai/extract.py

/** Area-weighted centre of an outline, so the number sits inside the building rather than on a corner. */
function centre(ring: number[][]): [number, number] {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) { const k = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; a += k; x += (ring[i][0] + ring[i + 1][0]) * k; y += (ring[i][1] + ring[i + 1][1]) * k; }
  if (Math.abs(a) < 1e-6) return [ring.reduce((t, q) => t + q[0], 0) / ring.length, ring.reduce((t, q) => t + q[1], 0) / ring.length];
  return [x / (3 * a), y / (3 * a)];
}

export default function AiPage() {
  const { t } = useT();
  const [status, setStatus] = useState<{ model_id: string; loaded: boolean; error: string | null; mode?: string; explanation?: string } | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"overlay" | "mask" | "original">("overlay");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setActive] = useState<number | null>(null);    // clicked footprint: stays highlighted on the image and in the list
  const [hovered, setHovered] = useState<number | null>(null);    // pointed-at footprint: highlighted only while the pointer is on it
  const active = hovered ?? selected;
  const [groundWidth, setGroundWidth] = useState("");             // metres the image covers left-to-right; areas depend on it
  const [usedFile, setUsedFile] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => { api.aiStatus().then(setStatus).catch(() => null); }, []);

  async function run() {
    setRunning(true); setError(null);
    try {
      const r = await api.extract(file ?? undefined);
      setResult(r); setActive(null); setUsedFile(!!file); setView("overlay");
      // only the built-in sample tile has a known scale (0.524 m per pixel); an uploaded picture could be any zoom
      setGroundWidth(file ? "" : String(Math.round(r.image_size[0] * SAMPLE_M_PER_PX)));
      api.aiStatus().then(setStatus).catch(() => null);
    }
    catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  }

  const mPerPx = result && Number(groundWidth) > 0 ? Number(groundWidth) / result.image_size[0] : null;
  const pick = (id: number, scroll = false) => { setActive((cur) => (cur === id && !scroll ? null : id)); if (scroll) listRef.current?.querySelector(`[data-fp="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };

  const src = result
    ? view === "overlay" ? `data:image/png;base64,${result.overlay_png_base64}`
      : view === "mask" ? `data:image/png;base64,${result.mask_png_base64}`
      : file ? URL.createObjectURL(file) : "/api/ai/sample"
    : file ? URL.createObjectURL(file) : "/api/ai/sample";

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 p-4">
      <div className="card flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
        <span className="label">Supporting tool</span>
        <span className="text-ink-muted">Step 1 of registering a plot: find the building outline in an aerial photo, so nobody has to type coordinates. In the real flow it runs inside the map.</span>
        <Link href="/map" className="ml-auto text-accent hover:underline">Use it on the map (Builder tools) →</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">{t("h.ai")}</h1>
        <p className="text-sm text-slate-600">
          {status?.mode === "gemini"
            ? <>The aerial image is sent to Google Gemini (<span className="font-mono">{status.model_id}</span>), which returns the outline of every building roof it finds. Tribhoomi turns those outlines into footprint polygons with areas, ready to become candidate parcels.</>
            : <>A pretrained semantic-segmentation model (<span className="font-mono">{status?.model_id ?? "…"}</span>, Hugging Face, trained on ADE20K) runs on CPU over an aerial image. Pixels classed as building / house / skyscraper are kept and vectorised into footprint polygons — the surface geometry a 3D ULPIN hangs from. No training was done; this is real inference on a real image (Esri World Imagery, Sector 18, Noida).</>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 p-2 text-xs">
            {(["original", "overlay", "mask"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} disabled={!result && v !== "original"} className={`rounded px-2 py-1 capitalize ${view === v ? "bg-navy-800 text-white" : "bg-slate-100"} disabled:opacity-40`}>{v}</button>
            ))}
            <span className="ml-auto text-slate-500">{result ? `${result.image_size[0]}×${result.image_size[1]} px` : "sample image"}</span>
          </div>
          <div className="bg-slate-900">
            {/* the wrapper shrinks to the image so the SVG overlay lines up pixel-for-pixel */}
            <div className={`relative mx-auto w-fit ${running ? "opacity-70" : ""}`}>
            {running && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 animate-scan bg-gradient-to-r from-transparent via-accent to-transparent" style={{ width: "34%" }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="aerial" className="block max-h-[70vh] w-auto" />
            {result && view !== "mask" && (
              <svg viewBox={`0 0 ${result.image_size[0]} ${result.image_size[1]}`} className="absolute inset-0 h-full w-full">
                {result.footprints.features.map((f) => {
                  const ring = f.geometry.coordinates[0]; const on = active === f.id;
                  const u = Math.max(result.image_size[0], result.image_size[1]) / 46;   // badge size follows the image, so it is readable at any resolution
                  const [cx, cy] = centre(ring);
                  return (
                    <g key={f.id} onMouseEnter={() => setHovered(f.id)} onMouseLeave={() => setHovered(null)} onClick={() => pick(f.id, true)} className="cursor-pointer">
                      <polygon points={ring.map((pt) => pt.join(",")).join(" ")} fill={on ? "rgba(34,232,200,0.35)" : "rgba(253,224,71,0.08)"} stroke={on ? "#22e8c8" : "#fde047"} strokeWidth={on ? u / 4 : u / 7} />
                      <circle cx={cx} cy={cy} r={u * 0.78} fill={on ? "#22e8c8" : "#0a0e14"} stroke={on ? "#0a0e14" : "#fde047"} strokeWidth={u / 10} />
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={on ? "#0a0e14" : "#fde047"} fontSize={u * (f.id > 9 ? 0.8 : 0.95)} fontWeight={700} fontFamily="monospace">{f.id}</text>
                    </g>
                  );
                })}
              </svg>
            )}
            </div>
          </div>
        </div>

        <div className="card space-y-3 p-4 text-sm">
          <div>
            <div className="label">Model status</div>
            <div className={`mt-1 text-xs ${status?.mode === "off" ? "text-amber-700" : status?.loaded ? "text-emerald-700" : "text-slate-500"}`}>
              {status?.error ? `Error: ${status.error}` : status?.mode === "off" ? "Disabled on this server" : status?.mode === "gemini" ? "Remote inference (Google Gemini)" : status?.mode === "remote" ? "Remote inference (Hugging Face API)" : status?.loaded ? "Loaded in memory" : "Will load on first run (a few seconds)"}
            </div>
            {status?.explanation && <div className="mt-1 text-xs text-slate-500">{status.explanation}</div>}
            {status?.mode === "off" && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">This is expected on the free hosting tier (512 MB RAM). The same model runs locally in about 3 seconds, or remotely by adding a free <span className="font-mono">GEMINI_API_KEY</span> environment variable on the host.</div>}
          </div>
          <label className="block text-xs">
            <span className="label">Optional: your own aerial image</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setActive(null); setHovered(null); setView("original"); }} className="mt-1 block w-full text-xs" />
          </label>
          <button onClick={run} disabled={running || status?.mode === "off"} className="btn-accent w-full justify-center">
            {running ? "Running segmentation…" : "Run footprint extraction"}
          </button>
          {running && <ScanLoader text={status?.mode === "gemini" ? "Gemini · finding buildings" : "SegFormer · segmenting"} className="p-1" />}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {result && (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Inference time</dt><dd>{result.inference_ms} ms{(result as any).source ? ` · ${(result as any).source}` : ""}</dd>
                <dt className="text-slate-500">Building pixels</dt><dd>{(result.building_pixel_share * 100).toFixed(1)} %</dd>
                <dt className="text-slate-500">Footprints found</dt><dd>{result.footprints_found}</dd>
              </dl>
              <div>
                <div className="label">Detected footprints</div>
                <p className="mt-1 text-xs text-ink-muted">Each number matches the badge on the image. Point at a row, or click an outline, to find it.</p>
                <label className="mt-2 block text-xs">
                  <span className="text-ink-muted">How wide is this image on the ground? (metres)</span>
                  <input type="number" min={1} inputMode="decimal" value={groundWidth} onChange={(e) => setGroundWidth(e.target.value)} placeholder="e.g. 150" className="mt-1 w-full rounded-lg border px-3 py-1.5" />
                </label>
                {usedFile && !mPerPx && <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Areas in m² need the image scale. Use the scale bar of your map app to estimate the ground width and type it above. Until then only pixel sizes are shown.</p>}
                <ul ref={listRef} className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
                  {result.footprints.features.map((f) => (
                    <li key={f.id} data-fp={f.id}>
                      <button type="button" aria-pressed={selected === f.id} onMouseEnter={() => setHovered(f.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(f.id)} onBlur={() => setHovered(null)} onClick={() => pick(f.id)}
                        className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left ${active === f.id ? "border-[var(--line-strong)] bg-[rgba(34,232,200,0.12)]" : "border-slate-200"}`}>
                        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono font-bold ${active === f.id ? "bg-accent text-navy-900" : "border border-yellow-300 text-yellow-300"}`}>{f.id}</span>
                        <span>{mPerPx ? <>{Math.round(f.properties.area_px * mPerPx * mPerPx).toLocaleString()} m² </> : null}<span className="text-slate-400">{mPerPx ? "(" : ""}{f.properties.area_px.toLocaleString()} px{mPerPx ? ")" : ""}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">Each polygon is a candidate surface parcel: in a full pipeline it would be matched to the cadastral map, given a 2D ULPIN, and then extruded with LiDAR / drone height data into floors.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
