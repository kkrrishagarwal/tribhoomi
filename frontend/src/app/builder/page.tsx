"use client";
import RoleGuide from "@/components/RoleGuide";
import LoadError from "@/components/LoadError";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type ProjectSummary } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import Gate from "@/components/Gate";
import ScanLoader from "@/components/ScanLoader";
import { DemoBadge } from "@/components/StatusPill";

export default function BuilderDashboard() {
  return <Gate roles={["builder", "admin"]} signin="/signin/builder"><Inner /></Gate>;
}

function Inner() {
  const s = useSession();
  const [d, setD] = useState<{ counts: Record<string, number>; projects: ProjectSummary[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.builderDashboard().then(setD).catch((e) => setErr(e.message)); }, [s]);
  if (err) return <LoadError message={err} what="your dashboard" />;
  if (!d) return <ScanLoader text="Loading builder dashboard" className="p-16" />;
  const c = d.counts;
  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="label">Builder dashboard</div><h1 className="h1">{s.name}</h1></div>
        <div className="flex items-center gap-2"><DemoBadge /><Link href="/builder/projects/new" className="btn-accent">+ Create new project</Link></div>
      </div>
      <RoleGuide on={["builder"]} />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Projects", c.projects, ""], ["Buildings", c.buildings, ""], ["Total units", c.units, ""], ["Pending approval", c.pending, "warn"], ["Validation issues", c.issues, "bad"]].map(([l, v, t]) => (
          <div key={l as string} className="card stat"><div className="label">{l}</div><div className={`n ${t}`}>{v}</div></div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between"><h2 className="h2">Projects</h2><Link href="/builder/units" className="text-sm text-accent hover:underline">All units →</Link></div>
      {d.projects.length === 0 && <div className="card mt-3 p-6 text-center text-slate-500">No projects yet. Create your first project to start registering units.</div>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {d.projects.map((p) => (
          <Link key={p.id} href={`/builder/projects/${p.id}`} className="card p-4 hover:border-accent">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-lg font-semibold">{p.name}</div><div className="text-sm text-slate-500">{p.city} · {p.locality}</div></div>
              <span className={`pill ${p.status === "Verified" ? "pill-verified" : p.status === "Under verification" ? "pill-pending" : "pill-draft"}`}>{p.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
              {[["Buildings", p.counts.buildings], ["Units", p.counts.units], ["Pending", p.counts.pending], ["Conflicts", p.counts.conflicts]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-slate-50 py-2"><div className="font-mono text-lg">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
