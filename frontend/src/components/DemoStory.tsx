"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Step = { n: number; title: string; href: string; cta: string; what: string; say: string };
type Setup = { project_id: number; building_id: number; units: Record<string, string>; change_request_id: number; stage: string };

/** Flagship scenario: one click creates the records, then every step links to the real page. */
export default function DemoStory({ steps }: { steps: Step[] }) {
  const [setup, setSetup] = useState<Setup | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { try { const s = localStorage.getItem("tribhoomi.flagship"); if (s) setSetup(JSON.parse(s)); } catch {} }, []);
  async function run(stage: "setup" | "full") {
    setBusy(true); setMsg(null);
    try { const r = await api.flagship(stage); setSetup(r); localStorage.setItem("tribhoomi.flagship", JSON.stringify(r)); setMsg(stage === "setup" ? "Scenario created up to the pending modification (steps 1–8). Continue the story yourself as Authority and Builder, or click ‘Run full story’." : "Full story created: correction requested, resubmitted, approved, new version recorded."); }
    catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
  }
  const link = (h: string) => {
    if (!setup) return h.startsWith("/") ? h : "/demo";
    const c = setup.units["3-C"];
    return h.replace("PROPERTY_3C", `/property/${c}`).replace("REVIEW_3C", `/authority/review/${c}`).replace("MODIFY_3C", `/builder/modify/${c}`).replace("PASSPORT_3C", `/passport/${c}`);
  };
  return (
    <div className="page">
      <h1 className="h1">Guided demo · Scenario: boundary modification</h1>
      <p className="lead">One coherent story that proves the whole product. Create the records with one click, then follow the steps.</p>
      <div className="card mt-4 flex flex-wrap items-center gap-2 p-4">
        <button onClick={() => run("setup")} disabled={busy} className="btn-accent">{busy ? "Creating…" : "Create scenario (steps 1–8)"}</button>
        <button onClick={() => run("full")} disabled={busy} className="btn-ghost">Run full story (steps 1–13)</button>
        {setup && <span className="text-sm text-slate-500">Current scenario: 3-C = <span className="font-mono text-accent">{setup.units["3-C"]}</span> · 3-D = <span className="font-mono">{setup.units["3-D"]}</span></span>}
      </div>
      {msg && <div className={`mt-3 rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}
      <p className="mt-3 text-xs text-slate-500">Roles are simulated: switch with the sign-in pages or the header dropdown. Everything created here is demonstration data.</p>
      <ol className="mt-4 space-y-3">
        {steps.map((st) => (
          <li key={st.n} className="card flex gap-4 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-800 font-semibold text-white">{st.n}</div>
            <div className="flex-1">
              <h2 className="font-semibold">{st.title}</h2>
              <p className="mt-1 text-sm text-slate-700"><span className="label mr-1">Do</span>{st.what}</p>
              {st.say && <p className="mt-1 text-sm text-slate-500"><span className="label mr-1">Say</span>{st.say}</p>}
              <Link href={link(st.href)} className="btn-ghost mt-2">{st.cta} →</Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
