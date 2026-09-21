"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import ProductLoop, { LOOP } from "@/components/ProductLoop";

type Step = { n: number; title: string; href: string; cta: string; what: string; say: string; act?: string; loop?: number; role?: string };
type More = { href: string; title: string; text: string };
type Scenario = { pending: Setup; done: Setup };
type Setup = { project_id: number; building_id: number; units: Record<string, string>; change_request_id: number; stage: string };

/** Flagship scenario: one click creates the records, then every step links to the real page. */
export default function DemoStory({ core, full, more }: { core: Step[]; full: Step[]; more: More[] }) {
  const s = useSession();
  const [setup, setSetup] = useState<Scenario | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("tribhoomi.scenario") || "null"); if (v?.pending?.units && v?.done?.units) setSetup(v); } catch {} }, []);
  const running = useRef(false);   // state updates are async, so a fast double-click needs a synchronous guard
  async function run(stage: "setup" | "full") {
    if (running.current) return;
    running.current = true;
    setBusy(true); setMsg(null);
    try {
      // two copies of the same story: one stopped at the proposal, one carried through correction and approval
      const pending = stage === "setup" ? await api.flagship("setup") : setup?.pending ?? await api.flagship("setup");
      const done = await api.flagship("full");
      const v = { pending, done }; setSetup(v); localStorage.setItem("tribhoomi.scenario", JSON.stringify(v));
      setMsg("Scenario ready: flat 3-C exists twice, once with the change still proposed and once after it was corrected and approved. Follow the acts below.");
    }
    catch (e: any) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); running.current = false; }
  }
  const needs = (h: string) => h.startsWith("P:") || h.startsWith("D:") || /_3C/.test(h);
  const link = (h: string, role?: string) => {
    if (!setup) return h;
    const which = h.startsWith("D:") ? setup.done : setup.pending;
    let url = h.replace(/^[PD]:/, "").replace("/3C", `/${which.units["3-C"]}`);
    const c = setup.pending.units["3-C"], dn = setup.done.units["3-C"];   // the long workflow list still uses the older placeholders
    url = url.replace("PROPERTY_3C_DONE", `/property/${dn}`).replace("PROPERTY_3C", `/property/${c}`).replace("REVIEW_3C", `/authority/review/${c}`).replace("MODIFY_3C", `/builder/modify/${c}`).replace("PASSPORT_3C", `/passport/${dn}`);
    // a step that needs a role sends a signed-out visitor through sign-in and straight back
    if (role === "authority" && s.role !== "admin") return `/signin?role=authority&next=${encodeURIComponent(url)}`;
    return url;
  };
  const stepCard = (st: Step) => {   // plain render helper, not a component: nothing to remount
    const locked = !setup && needs(st.href);
    return (
      <li key={st.n} className="card flex gap-4 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] font-mono font-semibold text-accent">{st.n}</div>
        <div className="flex-1">
          <h3 className="font-semibold">{st.title}{st.loop !== undefined && <span className="ml-2 align-middle font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim">{LOOP[st.loop]}</span>}</h3>
          <p className="mt-1 text-sm text-ink">{st.what}</p>
          {st.say && <p className="mt-1 text-sm text-ink-muted"><span className="label mr-1">Say</span>{st.say}</p>}
          {locked ? <span className="mt-2 inline-block text-sm text-ink-dim">Create the scenario above to open this step.</span> : <Link href={link(st.href, st.role)} className="btn-ghost mt-2">{st.cta} →</Link>}
          {!locked && st.role === "authority" && s.role !== "admin" && <span className="ml-2 text-xs text-ink-dim">You will be asked to pick the Government authority role (demo mode, no password).</span>}
        </div>
      </li>
    );
  };
  const acts = [...new Set(core.map((c) => c.act))];
  return (
    <div className="page">
      <h1 className="h1">See Tribhoomi in 2 minutes</h1>
      <p className="lead max-w-3xl">Follow one property, flat 3-C, from registration to verification, change detection and authority review.</p>
      <blockquote className="mt-3 max-w-3xl border-l-2 border-[var(--line-strong)] pl-3 text-ink">Tribhoomi does not just record a property. It tracks how its spatial identity changes.</blockquote>
      <ProductLoop className="mt-4" />
      <div className="card mt-4 flex flex-wrap items-center gap-2 p-4">
        <button onClick={() => run("setup")} disabled={busy} className={setup ? "btn-ghost" : "btn-accent"}>{busy ? "Creating…" : setup ? "Reset the scenario" : "Create the demo scenario"}</button>
        {setup && <Link href={link(core[0].href)} className="btn-accent">Start: open flat 3-C →</Link>}
        <span className="text-sm text-ink-muted">{setup ? <>Ready · flat 3-C is <span className="font-mono text-accent">{setup.pending.units["3-C"]}</span> (Tribhoomi Property ID)</> : "One click creates flat 3-C and its neighbours so every act opens a real page. Demonstration data only."}</span>
      </div>
      {msg && <div role="status" className={`mt-3 rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "border border-red-300 bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{msg}</div>}

      {acts.map((act) => (
        <section key={act} className="mt-6">
          <h2 className="label !text-accent">{act}</h2>
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
        <p className="mt-2 text-xs text-ink-dim">The same story in finer steps, for a longer walkthrough. Steps up to the review open the proposed copy of 3-C; the last steps open the approved copy.</p>
        <ol className="mt-3 space-y-3">{full.map(stepCard)}</ol>
      </details>
      <p className="mt-6 text-xs text-ink-dim">Roles are simulated, but a sign-in holds: you stay as one identity until you sign out. Steps that need a different role say so and take you through sign-in and back.</p>
    </div>
  );
}
