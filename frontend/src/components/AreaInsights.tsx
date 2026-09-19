"use client";
import { useEffect, useState } from "react";
import { api, type AreaInsight, type AreaRef } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import ScanLoader from "./ScanLoader";

const STATUS: Record<string, string> = { planned: "Planned", under_construction: "Under construction", completed: "Completed" };
const TYPE: Record<string, string> = { metro: "Rail / metro", expressway: "Expressway", expansion: "Expansion", other: "Other" };
const key = (a: { city: string; locality: string }) => `${a.city}|${a.locality}`;

/**
 * Area Insights: three neutral, sourced items about a locality. By design there is no score, rating or
 * label, and gaps say "not publicly available". The disclaimer is part of the panel and cannot be dismissed.
 */
export default function AreaInsights({ initial, onClose }: { initial?: { city: string; locality: string } | null; onClose: () => void }) {
  const { data: index, error: indexError } = useLoad(() => api.areas());
  const [area, setArea] = useState<{ city: string; locality: string } | null>(initial ?? null);
  const [d, setD] = useState<AreaInsight | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (initial) setArea(initial); }, [initial]);
  useEffect(() => {
    if (!area) { setD(null); return; }
    let live = true; setD(null); setErr(null);
    api.areaInsight(area.city, area.locality).then((x) => { if (live) setD(x); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [area]);

  const label = (a: AreaRef) => (a.locality ? `${a.locality}, ${a.city}` : `${a.city} (whole city)`);
  return (
    <section aria-label="Area insights" className="glass animate-panel-in flex max-h-full w-[22rem] max-w-[calc(100vw-3rem)] flex-col rounded-lg">
      <div className="flex items-start justify-between gap-2 p-3 pb-2">
        <div><div className="label">Area insights</div><div className="text-xs text-ink-muted">Public facts about a locality. You judge what they mean.</div></div>
        <button type="button" onClick={onClose} aria-label="Close area insights" className="btn-ghost !px-2 !py-0.5">✕</button>
      </div>
      <p role="note" className="insight-disclaimer mx-3">Informational only, based on public data as noted. <b>Not investment advice.</b></p>

      <div className="overflow-y-auto p-3 pt-2 text-sm">
        <label className="block text-xs"><span className="text-ink-muted">Locality</span>
          <select value={area ? key(area) : ""} onChange={(e) => { const a = index?.areas.find((x) => key(x) === e.target.value); setArea(a ? { city: a.city, locality: a.locality } : null); }} className="mt-1 w-full rounded-lg border px-2 py-1.5">
            <option value="">{index ? "Choose a locality…" : indexError ? "Could not load localities" : "Loading…"}</option>
            {index?.areas.map((a) => <option key={key(a)} value={key(a)}>{label(a)}</option>)}
          </select>
        </label>

        {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
        {area && !d && !err && <ScanLoader text="Reading public data" className="!p-3" />}
        {d && (
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="label">1 · Price per sq ft</dt>
              <dd className="mt-1"><span className="na">{d.price_per_sqft.text}</span><div className="mt-1 text-xs text-ink-dim">{d.price_per_sqft.note}</div></dd>
            </div>
            <div>
              <dt className="label">2 · Inventory on record</dt>
              <dd className="mt-1 space-y-1">
                <div>{d.inventory.known_projects === 0 ? <span className="na">no projects on record for this area</span> : <>{d.inventory.known_projects} project{d.inventory.known_projects === 1 ? "" : "s"} on record{d.inventory.known_units !== null ? <> · {d.inventory.known_units.toLocaleString()} units known ({d.inventory.projects_with_unit_count} of {d.inventory.known_projects} projects publish a count)</> : <> · unit counts <span className="na">{d.inventory.unsold_units.text}</span></>}</>}</div>
                <div>Units currently unsold: <span className="na">{d.inventory.unsold_units.text}</span></div>
                {d.inventory.projects.length > 0 && <ul className="text-xs text-ink-muted">{d.inventory.projects.map((p) => <li key={p.project_name}>· {p.project_name} ({p.builder_name}) · {p.total_units === "unknown" ? "units unknown" : `${p.total_units} units`} · {p.confidence.replace("_", "-")}</li>)}</ul>}
                {d.inventory.sources.length > 0 && <div className="text-xs text-ink-dim">Source: {d.inventory.sources.join("; ")}</div>}
              </dd>
            </div>
            <div>
              <dt className="label">3 · Announced infrastructure in {d.city}</dt>
              <dd className="mt-1">
                {d.infrastructure.length === 0 ? <span className="na">none on record for this city</span> : (
                  <ul className="space-y-2">{d.infrastructure.map((i) => (
                    <li key={i.name} className="rounded-lg border border-[rgba(159,176,195,0.2)] p-2">
                      <div className="font-medium">{i.name}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">{TYPE[i.project_type]} · <b className="text-ink">{STATUS[i.announced_status]}</b> · {i.expected_completion}</div>
                      <div className="mt-1 text-xs text-ink-muted">{i.description}</div>
                      <div className="mt-1 text-xs text-ink-dim">Where: {i.locality} · Source: {i.data_source} · checked {i.data_date}</div>
                    </li>))}</ul>
                )}
              </dd>
            </div>
          </dl>
        )}
        {!area && <p className="mt-3 text-xs text-ink-dim">Pick a locality, or click a grey project marker on the map and choose “Area insights”.</p>}
      </div>
    </section>
  );
}
