"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type PropertyPage, type VerifyResultV2 } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import StatusPill, { DemoBadge } from "@/components/StatusPill";
import ScanLoader from "@/components/ScanLoader";
import HistoryTimeline from "@/components/HistoryTimeline";
import UlpinQR from "@/components/UlpinQR";
import { downloadReport } from "@/lib/report";
import { verifyUrl } from "@/lib/publicUrl";

const DiffMap = dynamic(() => import("@/components/DiffMap"), { ssr: false });
const BoundaryEditor = dynamic(() => import("@/components/BoundaryEditor"), { ssr: false });

export default function PropertyPageView() {
  const { id } = useParams<{ id: string }>(); const s = useSession();
  const [p, setP] = useState<PropertyPage | null>(null); const [v, setV] = useState<VerifyResultV2 | null>(null);
  const [err, setErr] = useState<string | null>(null); const [checking, setChecking] = useState(false);
  const [dispute, setDispute] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const load = () => api.property(id).then((d) => { setP(d); try { setSaved((JSON.parse(localStorage.getItem("tribhoomi.saved") || "[]") as string[]).includes(d.tpid)); } catch {} }).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id, s]);
  async function verify() { setChecking(true); try { setV(await api.propertyVerify(id)); } finally { setChecking(false); } }
  function toggleSave() { try { const l = new Set(JSON.parse(localStorage.getItem("tribhoomi.saved") || "[]") as string[]); if (!p) return; l.has(p.tpid) ? l.delete(p.tpid) : l.add(p.tpid); localStorage.setItem("tribhoomi.saved", JSON.stringify([...l])); setSaved(l.has(p.tpid)); } catch {} }
  async function fileDispute() { if (!p || !dispute) return; try { const r = await api.fileDispute({ unit_ulpin: p.land_record_id, description: dispute, raised_by: s.user || "anonymous" }); setMsg(r.message); setDispute(null); load(); } catch (e: any) { setMsg(`Error: ${e.message}`); } }
  if (err) return <div className="page"><div className="card mx-auto max-w-lg p-6"><div className="text-lg font-semibold">Property not found</div><p className="mt-1 text-sm text-slate-500">{err}</p><Link href="/discover" className="btn-primary mt-4">Search properties</Link></div></div>;
  if (!p) return <ScanLoader text="Loading property" className="p-16" />;
  const tone = p.verification_status === "verified" ? "ok" : p.verification_status === "pending" ? "warn" : "bad";
  const isBuilder = s.role === "builder" || s.role === "admin";
  return (
    <div className="page">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href="/discover" className="hover:underline">← Search</Link><span>·</span><span>{p.project.name}</span><span>·</span><span>{p.building.name}</span></div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="h1">{p.building.name} — Unit {p.label}</h1><div className="text-lg text-slate-500">{p.unit_type} · {p.area_sqft.toLocaleString()} sq ft · {p.floor_label}</div><div className="text-sm text-slate-500">{p.project.name}, {p.project.locality}, {p.project.city} · {p.project.developer}</div></div>
        <div className="flex flex-col items-end gap-2"><StatusPill status={p.verification_status} /><DemoBadge text="Demonstration dataset" /></div>
      </div>

      {(p.flags.has_unapproved_change || p.disputes_open > 0 || p.verification_status === "conflict") && (
        <div className="mt-4 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-red-900"><div className="font-bold">⚠ This property needs attention</div><ul className="mt-1 list-disc pl-5 text-sm">
          {p.flags.has_unapproved_change && <li>The record was changed without the owner's approval.</li>}{p.disputes_open > 0 && <li>{p.disputes_open} dispute(s) are open on this record.</li>}{p.verification_status === "conflict" && <li>Its boundary overlaps a neighbouring unit.</li>}</ul></div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Property integrity</div><div className="font-mono text-2xl"><span className={tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-red-300"}>{p.integrity.score}</span> <span className="text-sm text-slate-500">/ 100 · Tribhoomi Integrity Score</span></div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">{Object.entries(p.integrity.parts).map(([k, val]) => <div key={k} className="rounded-lg bg-slate-50 p-2 text-center"><div className="font-mono text-lg">{val}</div><div className="text-xs text-slate-500">{k}</div></div>)}</div>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <li>✓ Unit identity: <span className="font-mono">{p.tpid}</span></li><li>{p.flags.has_open_dispute || p.verification_status === "conflict" ? "⚠" : "✓"} Boundary validated</li>
              <li>{p.verification_status === "verified" ? "✓" : "○"} Authority verified{p.verification_id && <span className="font-mono text-xs text-slate-500"> · {p.verification_id}</span>}</li><li>{p.flags.has_unapproved_change ? "⚠" : "✓"} Modification history {p.flags.has_unapproved_change ? "contains an unapproved change" : "consistent"}</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={verify} disabled={checking} className="btn-accent text-base">🛡️ Verify before you invest</button>
              <button onClick={() => downloadReport(p, v)} className="btn-ghost">Generate integrity report (PDF)</button>
              {s.role === "investor" && <button onClick={toggleSave} className="btn-ghost">{saved ? "★ Saved" : "☆ Save"}</button>}
            </div>
            {checking && <ScanLoader text="Checking identity, status, boundaries, history, disputes" />}
            {v && !checking && (
              <div className={`mt-4 rounded-xl border p-4 ${v.tone === "ok" ? "border-emerald-400 bg-emerald-50" : v.tone === "warn" ? "border-amber-400 bg-amber-50" : "border-red-400 bg-red-50"}`}>
                <div className="text-lg font-bold">{v.tone === "ok" ? "🟢" : v.tone === "warn" ? "⚠" : "🔴"} {v.result}</div>
                <ul className="mt-2 space-y-1 text-sm">{v.checks.map((c) => <li key={c.text}>{c.ok ? "✓" : "✗"} {c.text} <span className="text-slate-500">— {c.detail}</span></li>)}</ul>
              </div>
            )}
          </div>

          {p.change && (
            <div className="card p-4">
              <div className="font-semibold">⚠ Change detected</div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Previous</div><div className="font-mono text-lg">{p.change.previous_sqft.toLocaleString()} sq ft</div><div className="text-xs">{p.change.previous_label}</div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Current</div><div className="font-mono text-lg">{p.change.current_sqft.toLocaleString()} sq ft</div><div className="text-xs">{p.change.current_label}</div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Difference</div><div className="font-mono text-lg">{p.change.difference_sqm >= 0 ? "+" : ""}{Math.round(p.change.difference_sqm * 10.7639)} sq ft</div><div className="text-xs">moved {p.change.moved_m} m · {p.change.approved ? "approved" : "NOT approved"}</div></div>
              </div>
              <details className="mt-3"><summary className="cursor-pointer text-sm text-accent">View before &amp; after</summary>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div><div className="label mb-1">Before / after / overlay (map)</div><DiffMap before={p.change.before} after={p.change.after} labels={["Registered boundary (v1)", `Current record (v${p.version_count})`]} height={220} /></div>
                  <div><div className="label mb-1">Floor plan overlay</div><BoundaryEditor footprint={[]} readOnly height={220} value={{ min: [p.versions[p.versions.length - 1].bounding_volume.min[0], p.versions[p.versions.length - 1].bounding_volume.min[1]], max: [p.versions[p.versions.length - 1].bounding_volume.max[0], p.versions[p.versions.length - 1].bounding_volume.max[1]] }} onChange={() => {}} before={{ min: [p.versions[0].bounding_volume.min[0] - 6, p.versions[0].bounding_volume.min[1] - 6], max: [p.versions[0].bounding_volume.max[0] + 6, p.versions[0].bounding_volume.max[1] + 6] }} neighbours={[{ label: "registered v1", volume: p.versions[0].bounding_volume }]} /></div>
                </div></details>
            </div>
          )}

          <div className="card p-4"><div className="font-semibold">Property history</div><div className="mt-3"><HistoryTimeline items={p.history} /></div>
            {p.versions.length > 1 && <details className="mt-3"><summary className="cursor-pointer text-sm text-accent">Version history ({p.versions.length})</summary><ul className="mt-2 text-sm">{[...p.versions].reverse().map((ver) => <li key={ver.version_number} className="border-t py-1">v{ver.version_number}{ver.version_number === p.versions.length ? " (current)" : ""} · {ver.created_at.slice(0, 10)} · {ver.plot_number} · {Math.round(ver.area_sqm * 10.7639).toLocaleString()} sq ft · <span className={ver.approval_status === "unapproved" ? "text-red-300" : "text-emerald-300"}>{ver.approval_status}</span></li>)}</ul></details>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="label">Tribhoomi Property Passport</div>
            <div className="mt-1 font-mono text-xl text-accent">{p.tpid}</div>
            <div className="text-xs text-slate-500">Tribhoomi's internal identity linking project, building, floor and unit.</div>
            <dl className="mt-3 grid grid-cols-[90px_1fr] gap-y-1 text-sm"><dt className="text-slate-500">Property</dt><dd>{p.building.name} — {p.label}</dd><dt className="text-slate-500">Floor</dt><dd>{p.floor_label}</dd><dt className="text-slate-500">Area</dt><dd>{p.area_sqft.toLocaleString()} sq ft</dd><dt className="text-slate-500">Status</dt><dd>{p.status_label}</dd><dt className="text-slate-500">Verified</dt><dd>{p.verified_at ? p.verified_at.slice(0, 10) : "—"}</dd></dl>
            <div className="mt-3 flex items-center gap-3"><PassportQR tpid={p.tpid} /><div className="text-xs text-slate-500">Scan to open the public passport. It shows verification status only, never owner details.</div></div>
            <Link href={`/passport/${p.tpid}`} className="btn-ghost mt-3 w-full justify-center">Open public passport</Link>
          </div>
          {p.owner && <div className="card p-4"><div className="label">Registered owner (visible to you only)</div><div className="mt-1 font-medium">{p.owner.name}</div><div className="text-sm text-slate-500">since {p.owner.registered_on}{p.owner.registration_no ? ` · ${p.owner.registration_no}` : ""}</div></div>}
          <div className="card p-4 text-sm">
            <div className="font-semibold">Actions</div>
            <div className="mt-2 flex flex-col gap-2">
              {isBuilder && p.verification_status !== "pending" && <Link href={`/builder/modify/${p.tpid}`} className="btn-ghost justify-center">Request modification</Link>}
              {(s.role === "owner" || s.role === "investor" || s.role === "public") && !dispute && <button onClick={() => setDispute("")} className="btn-ghost justify-center text-red-300">Report a problem</button>}
              <Link href={`/parcel/${p.project.id}`} className="btn-ghost justify-center">View in 3D</Link>
            </div>
            {dispute !== null && <div className="mt-2"><textarea value={dispute} onChange={(e) => setDispute(e.target.value)} rows={3} className="w-full rounded-lg border px-2 py-1" placeholder="What is wrong with this record?" /><div className="mt-2 flex gap-2"><button onClick={fileDispute} disabled={dispute.trim().length < 5} className="btn-accent !py-1">File dispute</button><button onClick={() => setDispute(null)} className="btn-ghost !py-1">Cancel</button></div></div>}
            {msg && <div className={`mt-2 rounded-lg p-2 ${msg.startsWith("Error") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
          </div>
          <details className="card p-4 text-xs"><summary className="cursor-pointer text-sm text-slate-500">Advanced technical details</summary>
            <dl className="mt-2 space-y-1"><dt className="text-slate-500">Land-record ID (ULPIN-format, prototype)</dt><dd className="font-mono">{p.land_record_id}</dd><dt className="text-slate-500">Parcel</dt><dd className="font-mono">{p.project.land_record_id}</dd><dt className="text-slate-500">Bounding volume (m)</dt><dd className="font-mono">{JSON.stringify(p.volume)}</dd></dl>
            <div className="mt-2 flex gap-2"><Link href="/map" className="text-accent hover:underline">Advanced GIS view</Link><Link href={`/verify?ulpin=${p.land_record_id}`} className="text-accent hover:underline">Technical verify page</Link></div></details>
        </div>
      </div>
    </div>
  );
}

function PassportQR({ tpid }: { tpid: string }) {
  // reuse the QR component but point it at the public passport page
  return <UlpinQR ulpin={tpid} size={96} caption={false} passport />;
}
