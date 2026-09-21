"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import type { Role } from "@/lib/session";

/**
 * "You are signed in — here is what you can do." Signing in used to drop people on a dashboard
 * with no idea what their role is for. Every role gets its own short list of real actions, shown
 * where that role lands and again at the top of the guided demo.
 *
 * Steps without an `href` are things to do on the page the guide is already on, so the list never
 * links a person back to where they are standing.
 */
type Step = { do: string; detail: string; href?: string };
type Guide = { who: string; lead: string; steps: Step[] };

const TAMPERED = "/verify?ulpin=09-141-0018-00046-B01-F04-U03-A";   // seeded story, always present

const GUIDES: Record<Role, Guide> = {
  public: {
    who: "a visitor",
    lead: "You can check any property in the registry. Nothing here needs an account.",
    steps: [
      { do: "Search for a property", detail: "By project, building, flat number or Tribhoomi Property ID. Open one to see its identity, status and history." },
      { do: "See a record that was changed without approval", detail: "This flat was renamed and moved 1.8 m after it was verified. Its version history shows it.", href: TAMPERED },
      { do: "Look at a whole building in 3D", detail: "Every floor and flat carries its own ID, including basements and the utility corridor underneath.", href: "/parcel/2" },
    ],
  },
  investor: {
    who: "an investor or buyer",
    lead: "Check a property's record before you commit to it.",
    steps: [
      { do: "Search, then open a property", detail: "Each property page runs a spatial verification: is it registered, verified, and does its boundary conflict with a neighbour?" },
      { do: "See what a changed record looks like", detail: "Compare a clean record with one whose boundary moved after verification.", href: TAMPERED },
      { do: "Keep a shortlist", detail: "Save the properties you are considering and get told when one of them changes.", href: "/saved" },
    ],
  },
  owner: {
    who: "a property owner",
    lead: "Your property's identity, and anything anyone proposes to change about it.",
    steps: [
      { do: "Open one of your properties below", detail: "You get its Tribhoomi Property ID, boundary, full history and a public passport with a QR code." },
      { do: "Decide on a proposed change", detail: "A builder cannot change a verified boundary on their own. Approve it, or raise a dispute.", href: "/changes" },
      { do: "Check it the way a buyer would", detail: "The passport page shows only registration and verification status, never your details.", href: "/discover" },
    ],
  },
  builder: {
    who: "a builder",
    lead: "Register property, get it verified, and propose changes to what is already verified.",
    steps: [
      { do: "Create a project, then add a building", detail: "A project holds buildings; a building holds floors; a floor holds units.", href: "/builder/projects/new" },
      { do: "Draw a unit on the floor plan", detail: "Open a building below and drag its boundary. No coordinates to type, and it is checked for overlaps as you draw." },
      { do: "Submit a unit for verification", detail: "The authority verifies it and records version 1. You cannot verify your own unit.", href: "/builder/units" },
      { do: "Propose a change to a verified unit", detail: "A verified boundary is locked. Changes go through a request that the authority reviews.", href: "/builder/requests" },
      { do: "See every action on your projects", detail: "Who did what, when, and what the value was before and after.", href: "/builder/audit" },
    ],
  },
  admin: {
    who: "the authority",
    lead: "Review what builders submit, decide on changes, and keep a record of why.",
    steps: [
      { do: "Open a property from the review queue below", detail: "Each one shows what changed, which neighbours it affects, why it is flagged, and its review priority." },
      { do: "Approve, reject, or ask for a correction", detail: "A reason is recorded with every decision and kept in the audit log." },
      { do: "Look at boundary conflicts", detail: "Units whose boundaries overlap a neighbour, or that changed without approval.", href: "/authority/conflicts" },
      { do: "Handle disputes raised by owners", detail: "Track each one from open to investigating to resolved.", href: "/authority/disputes" },
      { do: "Read the audit log", detail: "Every recorded action across the registry, with its reason.", href: "/authority/audit" },
    ],
  },
};

export default function RoleGuide({ on, alwaysOpen = false }: { on: Role[]; alwaysOpen?: boolean }) {
  const s = useSession();
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(alwaysOpen);
  const key = `tribhoomi.guide.${s.role}`;

  useEffect(() => {
    if (alwaysOpen) return;
    try { setHidden(localStorage.getItem(key) === "hidden"); } catch {}
    setReady(true);
  }, [key, alwaysOpen]);

  if (!on.includes(s.role) || !ready) return null;
  const g = GUIDES[s.role];
  const hide = () => { setHidden(true); try { localStorage.setItem(key, "hidden"); } catch {} };

  if (hidden) {
    return (
      <button type="button" onClick={() => { setHidden(false); try { localStorage.removeItem(key); } catch {} }} className="mt-4 text-sm text-accent hover:underline">
        What can I do as {g.who}?
      </button>
    );
  }

  return (
    <section className="card mt-4 p-4" aria-labelledby="role-guide">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="label">{s.signedIn ? `Signed in as ${g.who}` : `Browsing as ${g.who}`}</div>
          <h2 id="role-guide" className="h2 mt-0.5">What you can do here</h2>
        </div>
        {!alwaysOpen && <button type="button" onClick={hide} className="btn-ghost !px-2 !py-1 text-xs">Hide</button>}
      </div>
      <p className="mt-1 text-sm text-ink-muted">{g.lead}</p>
      <ol className="mt-3 space-y-2">
        {g.steps.map((st, i) => (
          <li key={st.do} className="flex gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[rgba(159,176,195,0.3)] font-mono text-xs text-ink-dim">{i + 1}</span>
            <span className="min-w-0">
              {st.href ? <Link href={st.href} className="font-medium text-accent hover:underline">{st.do} →</Link> : <span className="font-medium">{st.do}</span>}
              <span className="block text-sm text-ink-muted">{st.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/demo" className="btn-primary">Watch the 2-minute guided demo</Link>
        <span className="text-xs text-ink-dim">One property, from registration to verification, change detection and authority review.</span>
      </div>
    </section>
  );
}
