import Link from "next/link";
import { DemoBadge } from "@/components/StatusPill";

const ROLES = [
  { href: "/signin/builder", icon: "🏗️", title: "Builder / Developer", text: "Create projects, buildings and property units. Submit them for verification." },
  { href: "/signin/investor", icon: "💰", title: "Investor / Buyer", text: "Search a property and verify it before you decide." },
  { href: "/signin/owner", icon: "🏠", title: "Property Owner", text: "See your property's verified identity and get alerted to any change." },
  { href: "/signin/authority", icon: "🏛️", title: "Authority", text: "Review registrations, approve or reject, and handle disputes." },
];

export default function Landing() {
  return (
    <div className="page">
      <div className="mx-auto max-w-3xl pt-8 text-center">
        <DemoBadge />
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">Verify your property.<br />Detect changes.<br />Protect ownership.</h1>
        <p className="lead mx-auto mt-4 max-w-xl">Tribhoomi gives every land parcel, building, floor and individual unit a digital identity, checks it for conflicts, and keeps a tamper-evident history that anyone can verify.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/discover" className="btn-accent text-base">Verify a property</Link>
          <Link href="/demo" className="btn-ghost text-base">Explore the guided demo</Link>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="label mb-3 text-center">Choose how you want to use Tribhoomi</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="card p-5 transition hover:border-accent">
              <div className="text-3xl">{r.icon}</div>
              <div className="mt-2 text-lg font-semibold">{r.title}</div>
              <p className="mt-1 text-sm text-slate-500">{r.text}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="label mb-3 text-center">How it works</div>
        <ol className="grid gap-3 sm:grid-cols-5">
          {[["🏗️", "Builder creates a property"], ["🛡️", "Tribhoomi validates it"], ["🏛️", "Authority verifies"], ["🪪", "Property gets an identity"], ["🔍", "Anyone can verify it"]].map(([i, t], n) => (
            <li key={t} className="card p-4 text-center text-sm"><div className="text-2xl">{i}</div><div className="mt-1 font-medium">{n + 1}. {t}</div></li>
          ))}
        </ol>
        <p className="mt-6 text-center text-xs text-slate-500">Prototype for SIH26011. All properties, builders and owners shown are a <b>demonstration dataset</b>, not government records. Roles are simulated; there is no real login.</p>
      </div>
    </div>
  );
}
