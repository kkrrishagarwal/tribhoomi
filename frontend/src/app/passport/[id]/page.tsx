"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type PropertyPage } from "@/lib/api";
import StatusPill, { DemoBadge } from "@/components/StatusPill";
import ScanLoader from "@/components/ScanLoader";

/** Public QR landing page: verification status only. No owner information, ever. */
export default function Passport() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<PropertyPage | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.property(id).then(setP).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="page"><div className="card mx-auto max-w-md p-6 text-center"><div className="text-lg font-semibold">This passport could not be found</div><p className="mt-1 text-sm text-slate-500">The QR code may be outdated or the ID mistyped. {err}</p><Link href="/discover" className="btn-primary mt-4">Search properties</Link></div></div>;
  if (!p) return <ScanLoader text="Checking passport" className="p-16" />;
  const valid = p.verification_status === "verified" && !p.flags.has_unapproved_change && p.disputes_open === 0;
  return (
    <div className="page"><div className="card mx-auto max-w-md p-6">
      <div className="flex items-center justify-between"><div className="label">Tribhoomi Property Passport</div><DemoBadge text="Demo dataset" /></div>
      <h1 className="mt-2 text-2xl font-bold">Unit {p.label}</h1><div className="text-slate-500">{p.building.name} · {p.project.name}, {p.project.city}</div>
      <div className={`mt-4 rounded-xl border p-4 ${valid ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50"}`}>
        <div className="text-lg font-bold">{valid ? "🟢 Verification status: Valid" : p.verification_status === "verified" ? "⚠ Verified, but flagged" : `⚪ Verification status: ${p.status_label}`}</div>
        <div className="mt-1 text-sm">{p.verified_at ? `Last verified ${p.verified_at.slice(0, 10)}` : "Not yet verified by the authority"}{p.verification_id && <span className="font-mono text-xs text-slate-500"> · {p.verification_id}</span>}</div>
        {p.flags.has_unapproved_change && <div className="mt-1 text-sm text-red-800">The record was changed without the owner's approval.</div>}
        {p.disputes_open > 0 && <div className="mt-1 text-sm text-red-800">{p.disputes_open} open dispute(s).</div>}
      </div>
      <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-1 text-sm"><dt className="text-slate-500">Property ID</dt><dd className="font-mono">{p.tpid}</dd><dt className="text-slate-500">Floor</dt><dd>{p.floor_label}</dd><dt className="text-slate-500">Area</dt><dd>{p.area_sqft.toLocaleString()} sq ft</dd><dt className="text-slate-500">Integrity</dt><dd className="font-mono">{p.integrity.score} / 100</dd><dt className="text-slate-500">Record versions</dt><dd>{p.version_count}</dd></dl>
      <div className="mt-4 flex gap-2"><Link href={`/property/${p.tpid}`} className="btn-primary flex-1 justify-center">Full property page</Link></div>
      <p className="mt-3 text-xs text-slate-500">This page shows verification information only. Owner details are never shown publicly.</p>
    </div></div>
  );
}
