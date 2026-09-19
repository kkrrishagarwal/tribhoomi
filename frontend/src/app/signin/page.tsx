"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setSession, type Role } from "@/lib/session";

/**
 * The front door: choose a role, then an identity. There is no real authentication in the
 * prototype — this screen only sets the same session (role + user) the header dropdown sets.
 * It must render without the backend: the demo identities are an optional extra.
 */
type RoleKey = "public" | "builder" | "investor" | "owner" | "authority";
type Choice = { label: string; user: string; name: string };

const ROLES: { key: RoleKey; role: Role; title: string; can: string; home: string; nameLabel?: string; placeholder?: string }[] = [
  { key: "public", role: "public", title: "Public visitor", can: "Look up any property and check whether its record is verified.", home: "/discover" },
  { key: "builder", role: "builder", title: "Builder / Developer", can: "Create projects, draw units and submit them for verification.", home: "/builder", nameLabel: "Company name", placeholder: "e.g. ABC Developers" },
  { key: "investor", role: "investor", title: "Investor / Buyer", can: "Search, verify and save properties before you decide.", home: "/discover", nameLabel: "Your name", placeholder: "Your name" },
  { key: "owner", role: "owner", title: "Property owner", can: "See your unit's verified identity and approve or dispute changes.", home: "/owner", nameLabel: "Your name", placeholder: "Your name" },
  { key: "authority", role: "admin", title: "Government authority", can: "Review registrations, approve or reject, and resolve disputes.", home: "/authority" },
];
// Old links and guesses (/signin/admin, ?role=government) all mean the authority card.
const ALIASES: Record<string, RoleKey> = { admin: "authority", government: "authority", govt: "authority", buyer: "investor", visitor: "public" };

const ICONS: Record<RoleKey, string> = {
  public: "M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
  builder: "M3 21V9l6-4v4l6-4v16H3Zm2-2h2v-2H5v2Zm0-4h2v-2H5v2Zm4 4h2v-2H9v2Zm0-4h2v-2H9v2Zm8 6V11h4v10h-4Z",
  investor: "M4 19h16v2H4v-2Zm1-3 4-6 4 3 5-8 1.7 1-6 10-4-3-3 4.2L5 16Z",
  owner: "M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3Zm0 2.6 7 5.8V19h-2v-6H7v6H5v-7.6l7-5.8Z",
  authority: "M12 2 3 7v2h18V7l-9-5Zm-7 9v7H3v3h18v-3h-2v-7h-2v7h-3v-7h-2v7H9v-7H5Zm7-6.7L16.4 7H7.6L12 4.3Z",
};

function Skyline() {
  // Towers, two cranes and a survey baseline — decorative only.
  return (
    <svg aria-hidden viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full sm:h-56">
      <g fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.22">
        <path d="M0 219.5h1440" />
        <path d="M40 220v-70h50v70M110 220V96h64v124M126 96V70h32v26M200 220v-52h44v52M270 220V120h70v100M360 220v-84h40v84" />
        <path d="M470 220V40h150M470 40h-46v22h46M470 40l-23-16 173 16M590 40v34M440 220h60M470 70l70-30" />
        <path d="M680 220V110h56v110M760 220V64h80v156M776 64V44h48v20M870 220v-96h48v96M940 220v-60h60v60" />
        <path d="M1090 220V58H960M1090 58h40v20h-40M1090 58l20-14-150 14M990 58v28M1062 220h56M1090 86l-60-28" />
        <path d="M1160 220V130h50v90M1230 220V88h70v132M1320 220v-74h44v74M1384 220v-48h56" />
      </g>
      <g stroke="var(--accent)" strokeWidth="1" opacity="0.12">
        {[120, 142, 164, 186].map((y) => <path key={y} d={`M110 ${y}h64M760 ${y - 30}h80M1230 ${y - 8}h70`} />)}
      </g>
    </svg>
  );
}

export default function SignIn() {
  const router = useRouter();
  const [open, setOpen] = useState<RoleKey | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ids, setIds] = useState<Awaited<ReturnType<typeof api.identities>> | null>(null);
  const [going, setGoing] = useState(false);
  const [next, setNext] = useState<string | null>(null);   // page that sent the visitor here (internal paths only)

  // ?role=builder preselects a card. Read from window so the page never waits on a Suspense boundary.
  useEffect(() => {
    const q = (new URLSearchParams(window.location.search).get("role") || "").toLowerCase();
    const key = (ALIASES[q] ?? q) as RoleKey;
    if (ROLES.some((r) => r.key === key)) setOpen(key);
    const n = new URLSearchParams(window.location.search).get("next") || "";
    if (/^\/(?!\/)/.test(n)) setNext(n);
  }, []);

  // Demo identities are optional. On a sleeping free host this can take a minute, so keep retrying quietly.
  useEffect(() => {
    if (ids) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => api.identities().then((d) => { if (!stop) setIds(d); }).catch(() => { if (!stop) timer = setTimeout(load, 5000); });
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [ids]);

  const go = (r: (typeof ROLES)[number], user: string, display: string) => {
    if (going) return;
    setGoing(true);
    setSession({ role: r.role, user, name: display });
    router.push(next ?? r.home);
  };

  const choicesFor = (key: RoleKey): Choice[] | null => {
    if (key === "public") return [];
    if (key === "investor") return [{ label: "Demo Buyer · buyer@example.in", user: "buyer@example.in", name: "Demo Buyer" }];
    if (key === "authority") return [{ label: ids?.admin.name ?? "Land records authority", user: ids?.admin.user ?? "admin", name: ids?.admin.name ?? "Authority" }];
    if (!ids) return null; // builder / owner identities live in the registry
    if (key === "builder") return ids.builders.map((b) => ({ label: b, user: b, name: b }));
    return ids.investors.map((i) => ({ label: `${i.name} · ${i.email}`, user: i.email, name: i.name }));
  };

  return (
    <div className="blueprint relative isolate min-h-[calc(100vh-7rem)] overflow-hidden">
      <Skyline />
      <div className="page relative grid w-full grid-cols-[minmax(0,1fr)] items-start gap-6 py-4 lg:gap-10 lg:py-10 lg:grid-cols-[1fr_minmax(0,30rem)]">
        <section className="order-2 min-w-0 lg:order-1 lg:pt-10">
          <div className="hidden items-center gap-3 lg:flex">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-saffron-500 text-lg font-bold text-navy-900 glow-warn">3D</span>
            <div>
              <div className="text-2xl font-bold tracking-tight">त्रिभूमि Tribhoomi</div>
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">3D land records for India</div>
            </div>
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl lg:mt-8">Vertical land records,<br /><span className="text-accent">verified.</span></h1>
          <p className="lead mt-4 max-w-md">Every parcel, building, floor and flat gets its own identity. Builders register, an authority reviews, and anyone can check whether a boundary was changed without approval.</p>
          <div className="mt-8 max-w-md border-l border-[var(--line-strong)] pl-3 font-mono text-sm">
            <div className="label">Example ID of one flat</div>
            <div className="mt-1 flex flex-wrap text-ink">
              {[["09-141-0031-00045", "parcel"], ["B01", "building"], ["F04", "floor"], ["U03-A", "unit"]].map(([v, k], i) => (
                <span key={k} className="whitespace-nowrap">{i > 0 && <span className="text-ink-dim">-</span>}<span title={k} className={i === 3 ? "text-accent" : ""}>{v}</span></span>
              ))}
            </div>
            <div className="mt-1 text-xs text-ink-dim">plot number → building → floor → flat</div>
          </div>
        </section>

        <section className="glass order-1 min-w-0 rounded-xl p-4 sm:p-6 lg:order-2" aria-labelledby="signin-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="signin-title" className="h2">Choose your role</h2>
            <span className="demo-badge">Demo mode</span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Select a role to continue. No password is needed.</p>

          <ul className="mt-4 space-y-2">
            {ROLES.map((r) => {
              const isOpen = open === r.key;
              const choices = isOpen ? choicesFor(r.key) : [];
              return (
                <li key={r.key} className={`rounded-lg border transition ${isOpen ? "border-[var(--line-strong)] bg-[rgba(34,232,200,0.06)]" : "border-[rgba(159,176,195,0.2)] hover:border-[var(--line-strong)]"}`}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${isOpen ? "border-[var(--line-strong)] text-accent" : "border-[rgba(159,176,195,0.25)] text-ink-muted"}`}>
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d={ICONS[r.key]} /></svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.title}</span>
                      <span className="block text-sm text-ink-muted">{r.can}</span>
                    </span>
                    <span aria-hidden className={`text-ink-dim transition ${isOpen ? "rotate-90 text-accent" : ""}`}>›</span>
                  </button>

                  {isOpen && (
                    <div className="animate-panel-in space-y-3 border-t border-[rgba(159,176,195,0.14)] p-3">
                      {r.key === "public" && <button type="button" disabled={going} onClick={() => go(r, "", "Public visitor")} className="btn-accent w-full justify-center">Continue as a visitor</button>}

                      {choices === null && <p className="text-sm text-ink-muted"><span className="animate-pulse text-accent">●</span> Fetching demo identities from the registry. If the server was asleep this takes up to a minute — you can also continue with your own name below.</p>}
                      {choices && choices.length > 0 && (
                        <div>
                          <div className="label">Demo identity with existing data</div>
                          <div className="mt-2 flex max-h-52 flex-col gap-1.5 overflow-y-auto pr-1">
                            {choices.map((c) => <button type="button" key={c.user} disabled={going} onClick={() => go(r, c.user, c.name)} className="btn-ghost justify-between text-left"><span className="min-w-0 truncate" title={c.label}>{c.label}</span><span aria-hidden className="text-accent">→</span></button>)}
                          </div>
                        </div>
                      )}

                      {r.nameLabel && (
                        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); go(r, r.key === "builder" ? (name.trim() || "Demo Builders Pvt Ltd") : (email.trim().toLowerCase() || "demo@example.in"), name.trim() || "Demo user"); }}>
                          <div className="label">Or start fresh</div>
                          <input aria-label={r.nameLabel} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full rounded-lg border px-3 py-2" placeholder={r.placeholder} />
                          {r.key !== "builder" && <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} className="w-full rounded-lg border px-3 py-2 font-mono text-sm" placeholder="you@example.in" />}
                          <button type="submit" disabled={going} className="btn-primary w-full justify-center">Continue as {r.title.toLowerCase()}</button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs text-ink-dim">Roles are simulated for the prototype: nothing you type leaves this browser, and the server still enforces what each role may do. <Link href="/" className="text-accent hover:underline">About Tribhoomi</Link></p>
        </section>
      </div>
    </div>
  );
}
