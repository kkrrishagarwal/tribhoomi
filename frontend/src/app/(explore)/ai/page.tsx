"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { api, type ExtractResult } from "@/lib/api";
import ScanLoader from "@/components/ScanLoader";

export default function AiPage() {
  const { t } = useT();
  const [status, setStatus] = useState<{ model_id: string; loaded: boolean; error: string | null; mode?: string; explanation?: string } | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"overlay" | "mask" | "original">("overlay");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => { api.aiStatus().then(setStatus).catch(() => null); }, []);

  async function run() {
    setRunning(true); setError(null);
    try { setResult(await api.extract(file ?? undefined)); setStatus(await api.aiStatus()); }
    catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  }

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
          A pretrained semantic-segmentation model (<span className="font-mono">{status?.model_id ?? "…"}</span>, Hugging Face, trained on ADE20K) runs on CPU over an aerial image. Pixels classed as building / house / skyscraper are kept and vectorised into footprint polygons — the surface geometry a 3D ULPIN hangs from. No training was done; this is real inference on a real image (Esri World Imagery, Sector 18, Noida).
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
              <svg viewBox={`0 0 ${result.image_size[0]} ${result.image_size[1]}`} className="pointer-events-none absolute inset-0 h-full w-full">
                {result.footprints.features.map((f) => (
                  <g key={f.id}>
                    <polygon points={f.geometry.coordinates[0].map((p) => p.join(",")).join(" ")} fill="none" stroke="#fde047" strokeWidth={2} />
                    <text x={f.geometry.coordinates[0][0][0] + 4} y={f.geometry.coordinates[0][0][1] + 14} fill="#fde047" fontSize={13} fontFamily="monospace">#{f.id}</text>
                  </g>
                ))}
              </svg>
            )}
            </div>
          </div>
        </div>

        <div className="card space-y-3 p-4 text-sm">
          <div>
            <div className="label">Model status</div>
            <div className={`mt-1 text-xs ${status?.mode === "off" ? "text-amber-700" : status?.loaded ? "text-emerald-700" : "text-slate-500"}`}>
              {status?.error ? `Error: ${status.error}` : status?.mode === "off" ? "Disabled on this server" : status?.mode === "remote" ? "Remote inference (Hugging Face API)" : status?.loaded ? "Loaded in memory" : "Will load on first run (a few seconds)"}
            </div>
            {status?.explanation && <div className="mt-1 text-xs text-slate-500">{status.explanation}</div>}
            {status?.mode === "off" && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">This is expected on the free hosting tier (512 MB RAM). The same model runs locally in about 3 seconds, or remotely by adding an <span className="font-mono">HF_TOKEN</span> environment variable on the host.</div>}
          </div>
          <label className="block text-xs">
            <span className="label">Optional: your own aerial image</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setView("original"); }} className="mt-1 block w-full text-xs" />
          </label>
          <button onClick={run} disabled={running || status?.mode === "off"} className="btn-accent w-full justify-center">
            {running ? "Running segmentation…" : "Run footprint extraction"}
          </button>
          {running && <ScanLoader text="SegFormer · segmenting" className="p-1" />}
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
                <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto text-xs">
                  {result.footprints.features.map((f) => (
                    <li key={f.id} className="flex justify-between rounded border border-slate-200 px-2 py-1">
                      <span className="font-mono">#{f.id}</span>
                      <span>{f.properties.area_sqm.toLocaleString()} m² <span className="text-slate-400">({f.properties.area_px.toLocaleString()} px)</span></span>
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
