"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setSession, type Role } from "@/lib/session";
import { DemoBadge } from "@/components/StatusPill";

const META: Record<string, { role: Role; title: string; icon: string; blurb: string; home: string; nameLabel: string }> = {
  builder: { role: "builder", title: "Builder / Developer", icon: "🏗️", blurb: "Create and manage property units.", home: "/builder", nameLabel: "Name / Company" },
  investor: { role: "investor", title: "Investor / Buyer", icon: "💰", blurb: "Verify and explore properties.", home: "/discover", nameLabel: "Name" },
  owner: { role: "owner", title: "Property Owner", icon: "🏠", blurb: "Verify your property and monitor changes.", home: "/owner", nameLabel: "Name" },
  authority: { role: "admin", title: "Authority", icon: "🏛️", blurb: "Review property registrations and disputes.", home: "/authority", nameLabel: "Officer name" },
};

export default function SignIn() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  const m = META[role] ?? META.investor;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [demoChoices, setDemoChoices] = useState<{ label: string; user: string; name: string }[]>([]);

  useEffect(() => {
    api.identities().then((ids) => {
      if (m.role === "builder") setDemoChoices(ids.builders.map((b) => ({ label: b, user: b, name: b })));
      else if (m.role === "owner") setDemoChoices(ids.investors.map((i) => ({ label: `${i.name} · ${i.email}`, user: i.email, name: i.name })));
      else if (m.role === "admin") setDemoChoices([{ label: ids.admin.name, user: "admin", name: ids.admin.name }]);
      else setDemoChoices([{ label: "Demo Buyer · buyer@example.in", user: "buyer@example.in", name: "Demo Buyer" }]);
    }).catch(() => null);
  }, [m.role]);

  const go = (user: string, display: string) => { setSession({ role: m.role, user, name: display }); router.push(m.home); };

  return (
    <div className="page">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-slate-500 hover:underline">← All roles</Link>
        <div className="card mt-3 p-6">
          <div className="flex items-center justify-between"><div className="text-3xl">{m.icon}</div><DemoBadge /></div>
          <h1 className="mt-2 text-2xl font-bold">{m.title} sign in</h1>
          <p className="mt-1 text-sm text-slate-500">{m.blurb}</p>

          <div className="mt-5 space-y-3">
            <label className="block text-sm"><span className="text-slate-500">{m.nameLabel}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder={m.role === "builder" ? "e.g. ABC Developers" : "Your name"} /></label>
            <label className="block text-sm"><span className="text-slate-500">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="you@example.in" /></label>
            <label className="block text-sm"><span className="text-slate-500">Password</span>
              <input type="password" disabled className="mt-1 w-full rounded-lg border px-3 py-2 opacity-50" placeholder="Not used in demo mode" /></label>
            <button onClick={() => go(m.role === "builder" ? (name.trim() || "Demo Builders Pvt Ltd") : (email.trim().toLowerCase() || "demo@example.in"), name.trim() || "Demo user")} className="btn-accent w-full justify-center text-base">
              Continue in Demo Mode
            </button>
            <p className="text-xs text-slate-500">Demo mode: no password is checked and nothing you enter is stored beyond this browser. The server still enforces what each role may do.</p>
          </div>

          {demoChoices.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <div className="label">Or pick a demo identity with existing data</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {demoChoices.map((c) => <button key={c.user} onClick={() => go(c.user, c.name)} className="btn-ghost justify-start text-sm">{c.label}</button>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
