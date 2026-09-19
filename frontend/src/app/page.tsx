import Link from "next/link";
import { DemoBadge } from "@/components/StatusPill";

const ROLES = [
  { href: "/signin?role=builder", icon: "🏗️", title: "Builder / Developer", text: "Create projects, buildings and property units. Submit them for verification." },
  { href: "/signin?role=investor", icon: "💰", title: "Investor / Buyer", text: "Search a property and verify it before you decide." },
  { href: "/signin?role=owner", icon: "🏠", title: "Property Owner", text: "See your property's verified identity and get alerted to any change." },
  { href: "/signin?role=authority", icon: "🏛️", title: "Authority", text: "Review registrations, approve or reject, and handle disputes." },
];

export default function Landing() {
  return (
    <div className="page">
      <div className="mx-auto max-w-3xl pt-8 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">3D land records · plot → building → floor → flat</div>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">A land ID for every flat,<br />not just the plot.</h1>
        <p className="lead mx-auto mt-4 max-w-2xl">India&apos;s land records stop at the ground, so they cannot say who owns the 7th floor. Tribhoomi extends India&apos;s national land parcel number (called ULPIN) to every building, floor and flat, and keeps a tamper-evident history so a boundary can never be changed behind the owner&apos;s back.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/demo" className="btn-accent text-base">Start the 4-minute guided demo</Link>
          <Link href="/discover" className="btn-ghost text-base">Verify a property</Link>
        </div>
        <div className="mt-4"><DemoBadge /></div>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="label mb-3 text-center">Or sign in with a role</div>
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
