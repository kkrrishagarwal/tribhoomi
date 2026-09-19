"use client";
import Tech, { coordText, sizeText } from "@/components/Tech";
import { useT } from "@/lib/i18n";
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type VerifyResult } from "@/lib/api";
import UlpinBadge from "@/components/UlpinBadge";
import ScanLoader from "@/components/ScanLoader";
import UlpinQR from "@/components/UlpinQR";
import { downloadCertificate } from "@/lib/certificate";

const DiffMap = dynamic(() => import("@/components/DiffMap"), { ssr: false });

const STATUS_STYLE: Record<VerifyResult["status"], string> = {
  VERIFIED: "bg-emerald-600 glow-ok", "PENDING CHANGE": "bg-amber-500 glow-warn", DISPUTED: "bg-red-600 glow-danger animate-pulse-danger",
  TAMPERED: "bg-red-700 glow-danger animate-pulse-danger", UNREGISTERED: "bg-slate-500",
};
const STATUS_ICON: Record<VerifyResult["status"], string> = { VERIFIED: "✔", "PENDING CHANGE": "⏳", DISPUTED: "⚑", TAMPERED: "⚠", UNREGISTERED: "○" };

function VerifyInner() {
  const params = useSearchParams();
  const { t } = useT();
  const [ulpin, setUlpin] = useState(params.get("ulpin") ?? "09-141-0018-00046-B01-F04-U03-A");
  const [r, setR] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ text: string; by: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function lookup(u = ulpin) {
    setBusy(true); setErr(null); setMsg(null);
    try { setR(await api.verify(u.trim())); } catch (e: any) { setR(null); setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { if (params.get("ulpin")) lookup(params.get("ulpin")!); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [params]);

  async function fileReport() {
    if (!r || !report) return;
    try { const res = await api.fileDispute({ unit_ulpin: r.unit.unit_ulpin, description: report.text, raised_by: report.by || "anonymous" }); setMsg(res.message); setReport(null); lookup(r.unit.unit_ulpin); }
    catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{t("h.verify")}</h1>
        <p className="text-sm text-slate-600">{t("h.verify.sub")}</p>
      </div>
      <div className="card flex gap-2 p-3">
        <input value={ulpin} onChange={(e) => setUlpin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="e.g. 09-141-0018-00046-B01-F04-U03-A" />
        <button onClick={() => lookup()} disabled={busy} className="btn-primary">{busy ? "Checking…" : "Verify"}</button>
      </div>
      {busy && <ScanLoader text="Reading version history" className="p-2" />}
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}

      {r && (
        <>
          {r.warnings.length > 0 && (
            <div className="glow-danger animate-pulse-danger animate-panel-in rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900">
              <div className="text-base font-bold">⚠ {t("h.warning")}</div>
              <ul className="mt-1 list-disc pl-5 text-sm">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <div className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{r.unit.label} <span className="font-normal text-slate-500">· {r.parcel.name}</span></div>
                <div className="mt-2"><UlpinBadge ulpin={r.unit.unit_ulpin} focal showLegend /></div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-white ${STATUS_STYLE[r.status]}`}>{STATUS_ICON[r.status]} {r.status}</span>
                <UlpinQR ulpin={r.unit.unit_ulpin} size={104} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-500">Registered owner</dt><dd>{r.owner ? `${r.owner.name} · registered on ${r.owner.registered_on} · ${r.owner.registration_no}` : "not registered yet"}</dd>
              <dt className="text-slate-500">Builder</dt><dd>{r.parcel.builder}</dd>
              <dt className="text-slate-500">Surface parcel</dt><dd className="font-mono">{r.parcel.ulpin_2d} <Link href={`/parcel/${r.parcel.id}`} className="ml-2 font-sans text-navy-700 hover:underline">3D view →</Link></dd>
              <dt className="text-slate-500">Current record</dt><dd>plot no. <b>{r.unit.label}</b> · {r.unit.area_sqm} m² · {r.unit.usage_type} · version {r.current?.version_number ?? "-"}</dd>
            </dl>
          </div>

          {r.baseline && (
            <div className="card p-4">
              <div className="text-sm font-semibold">Registered boundary (v1, grey dashed) vs current record (v{r.current?.version_number}, orange)</div>
              <p className="text-xs text-slate-500">{r.boundary_changed ? "The boundary differs from what was registered." : "Boundary unchanged since registration."}</p>
              <div className="mt-2"><DiffMap before={r.baseline.geometry} after={r.current?.geometry ?? null} labels={[`v1 registered boundary`, `v${r.current?.version_number} current boundary`]} height={260} /></div>
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center justify-between"><div className="text-sm font-semibold">{t("h.history")}</div><div className="label">audit trail · append-only</div></div>
            <ol className="relative mt-3 space-y-4 pl-6" style={{ borderLeft: "2px solid rgba(34,232,200,0.35)", boxShadow: "-1px 0 8px rgba(34,232,200,0.15)" }}>
              {r.versions.map((v) => {
                const tone = v.approval_status === "baseline" ? "bg-emerald-600 glow-ok" : v.approval_status === "approved" ? "bg-emerald-600 glow-ok" : "bg-red-600 glow-danger animate-pulse-danger";
                return (
                  <li key={v.id} className="relative animate-panel-in">
                    <span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-white ${tone}`} />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-accent">v{v.version_number}</span>
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white ${tone}`}>{v.approval_status === "baseline" ? "registered baseline" : v.approval_status === "approved" ? "owner-approved change" : "NOT approved by owner"}</span>
                      <span className="font-mono text-xs text-slate-500">{v.created_at.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-700">Plot no. <b>{v.plot_number}</b> · {sizeText(v.bounding_volume as { min: number[]; max: number[] })} · by {v.changed_by}</div>
                    <Tech>Boundary corners (x, y in metres)<br />{coordText(v.bounding_volume as { min: number[]; max: number[] })}</Tech>
                    {v.change_reason && <div className="text-xs text-slate-500">“{v.change_reason}”{v.change_request_id ? ` · change request #${v.change_request_id}` : ""}</div>}
                  </li>
                );
              })}
              {!r.versions.length && <li className="text-xs text-slate-500">No versions yet: this unit is unsold, so it has no locked baseline.</li>}
            </ol>
          </div>

          {(r.change_requests.length > 0 || r.disputes.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-4 text-xs"><div className="text-sm font-semibold">Change requests</div>
                <ul className="mt-2 space-y-1">{r.change_requests.map((c) => <li key={c.id} className="rounded bg-slate-50 px-2 py-1">#{c.id} · <b>{c.status}</b> · {c.reason} <span className="text-slate-400">({c.created_at.slice(0, 10)})</span></li>)}{!r.change_requests.length && <li className="text-slate-500">None.</li>}</ul></div>
              <div className="card p-4 text-xs"><div className="text-sm font-semibold">Disputes</div>
                <ul className="mt-2 space-y-1">{r.disputes.map((d) => <li key={d.id} className="rounded bg-red-50 px-2 py-1 text-red-900">#{d.id} · <b>{d.status}</b> · {d.description} <span className="text-red-400">({d.created_at.slice(0, 10)})</span></li>)}{!r.disputes.length && <li className="text-slate-500">None.</li>}</ul></div>
            </div>
          )}

          <div className="card flex flex-wrap items-center gap-2 p-4 text-xs">
            {r.owner && !report && (
              <button
                onClick={async () => { const pf = await api.parcel(r.parcel.id).catch(() => null); const pp = pf?.properties; downloadCertificate({
                  ulpin: r.unit.unit_ulpin, ulpin_2d: r.parcel.ulpin_2d, plot_number: r.unit.label, building: r.unit.building_name,
                  parcel_name: r.parcel.name, village_ward: pp?.village_ward ?? "", district: pp?.district ?? "", state: pp?.state ?? "",
                  owner_name: r.owner!.name, owner_email: r.unit.ownership?.[0]?.owner_email, ownership_type: r.unit.ownership?.[0]?.ownership_type,
                  registered_date: r.owner!.registered_on, registration_no: r.owner!.registration_no,
                  area_sqm: r.unit.area_sqm, usage_type: r.unit.usage_type, flags: r.flags, version: r.current?.version_number ?? null,
                }); }}
                className="btn-primary"
              >⬇ Download ownership certificate (PDF)</button>
            )}
            {!report ? <button onClick={() => setReport({ text: "", by: "" })} className="btn-ghost text-red-700">🚩 Report a problem with this record</button> : (
              <div>
                <div className="text-sm font-semibold text-red-800">Report a problem · linked to {r.unit.unit_ulpin} v{r.current?.version_number ?? "-"}</div>
                <input value={report.by} onChange={(e) => setReport({ ...report, by: e.target.value })} placeholder="Your name or email" className="mt-2 w-full rounded border border-slate-300 px-2 py-1" />
                <textarea value={report.text} onChange={(e) => setReport({ ...report, text: e.target.value })} rows={3} placeholder="What is wrong?" className="mt-2 w-full rounded border border-slate-300 px-2 py-1" />
                <div className="mt-2 flex gap-2"><button onClick={fileReport} disabled={report.text.trim().length < 5} className="btn-primary">File dispute</button><button onClick={() => setReport(null)} className="btn-ghost">Cancel</button></div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={<div className="p-8 text-slate-500">Loading…</div>}><VerifyInner /></Suspense>;
}
