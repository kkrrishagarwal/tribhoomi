"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Step = { n: number; title: string; href: string; cta: string; what: string; say: string; act?: string; needsScenario?: boolean };
type More = { href: string; title: string; text: string };
type Setup = { project_id: number; building_id: number; units: Record<string, string>; change_request_id: number; stage: string };

/** Flagship scenario: one click creates the records, then every step links to the real page. */
export default function DemoStory({ core, full, more }: { core: Step[]; full: Step[]; more: More[] }) {
  const [setup, setSetup] = useState<Setup | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { try { const s = localStorage.getItem("tribhoomi.flagship"); if (s) setSetup(JSON.parse(s)); } catch {} }, []);
  const running = useRef(false);   // state updates are async, so a fast double-click needs a synchronous guard
  async function run(stage: "setup" | "full") {
    if (running.current) return;
    running.current = true;
    setBusy(true); setMsg(null);
    try { const r = await api.flagship(stage); setSetup(r); localStorage.setItem("tribhoomi.flagship", JSON.stringify(r)); setMsg(stage === "setup" ? "Scenario ready: flat 3-C is verified and the builder has proposed moving its wall. Follow the steps below." : "Full story created: correction requested, resubmitted, approved, new version recorded."); }
    catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); running.current = false; }
  }
  const link = (h: string) => {
    if (!setup) return h.startsWith("/") ? h : "/demo";
    const c = setup.units["3-C"];
    return h.replace("PROPERTY_3C", `/property/${c}`).replace("REVIEW_3C", `/authority/review/${c}`).replace("MODIFY_3C", `/builder/modify/${c}`).replace("PASSPORT_3C", `/passport/${c}`);
  };
  const stepCard = (st: Step) => {   // plain render helper, not a component: nothing to remount
    const locked = !setup && !st.href.startsWith("/");
    return (
      <li key={st.n} className="card flex gap-4 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] font-mono font-semibold text-accent">{st.n}</div>
        <div className="flex-1">
          <h3 className="font-semibold">{st.title}</h3>
          <p className="mt-1 text-sm text-ink">{st.what}</p>
          {st.say && <p className="mt-1 text-sm text-ink-muted"><span className="label mr-1">Say</span>{st.say}</p>}
          {locked ? <span className="mt-2 inline-block text-sm text-ink-dim">Create the scenario above to open this step.</span> : <Link href={link(st.href)} className="btn-ghost mt-2">{st.cta} →</Link>}
        </div>
      </li>
    );
  };
  const acts = [...new Set(core.map((c) => c.act))];
  return (
    <div className="page">
      <h1 className="h1">Guided demo</h1>
      <p className="lead max-w-3xl">India&apos;s land records are 2D, so they cannot say who owns the 7th floor. Tribhoomi extends the national land ID upwards, then uses it to stop a builder quietly redrawing a flat after it is sold. Seven steps, about four minutes.</p>
      <div className="card mt-4 flex flex-wrap items-center gap-2 p-4">
        <button onClick={() => run("setup")} disabled={busy} className={setup ? "btn-ghost" : "btn-accent"}>{busy ? "Creating…" : setup ? "Reset the scenario" : "Create the demo scenario"}</button>
        {setup && <Link href={link(core[0].href)} className="btn-accent">Start at step 1 →</Link>}
        <span className="text-sm text-ink-muted">{setup ? <>Ready · flat 3-C is <span className="font-mono text-accent">{setup.units["3-C"]}</span></> : "One click creates the records that steps 3, 4, 5 and 7 open. Everything is demonstration data."}</span>
      </div>
      {msg && <div role="status" className={`mt-3 rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}

      {acts.map((act) => (
        <section key={act} className="mt-6">
          <h2 className="label">{act}</h2>
          <ol className="mt-2 space-y-3">{core.filter((c) => c.act === act).map(stepCard)}</ol>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="label">Explore further (optional)</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((m) => <Link key={m.href + m.title} href={m.href} className="card p-4 hover:border-accent"><div className="font-semibold">{m.title}</div><p className="mt-1 text-sm text-ink-muted">{m.text}</p></Link>)}
        </div>
      </section>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-ink-muted">The full builder ↔ authority workflow, step by step ({full.length} steps)</summary>
        <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => run("full")} disabled={busy} className="btn-ghost">Run the whole workflow automatically</button><span className="text-xs text-ink-dim">Creates the correction, resubmission, approval and new version in one go.</span></div>
        <ol className="mt-3 space-y-3">{full.map(stepCard)}</ol>
      </details>
      <p className="mt-6 text-xs text-ink-dim">Roles are simulated: switch from the sign-in page or the header. Steps that need a role say so.</p>
    </div>
  );
}
