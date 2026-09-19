"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { setSession, type Role, type Session } from "@/lib/session";
import { useSession } from "@/lib/useSession";

/** Header dropdown to pick "who am I" for the demo. */
export default function RoleSwitcher() {
  const s = useSession();
  const [ids, setIds] = useState<{ builders: string[]; investors: { email: string; name: string }[]; admin: { name: string; user: string } } | null>(null);
  useEffect(() => { api.identities().then(setIds).catch(() => null); }, []);

  const options: { key: string; label: string; session: Session }[] = [
    { key: "public", label: "Public visitor", session: { role: "public", user: "", name: "Public visitor" } },
    ...(ids?.builders ?? []).map((b) => ({ key: `builder:${b}`, label: `Builder · ${b}`, session: { role: "builder" as Role, user: b, name: b } })),
    { key: "investor:buyer@example.in", label: "Investor / Buyer · Demo Buyer", session: { role: "investor" as Role, user: "buyer@example.in", name: "Demo Buyer" } },
    ...(ids?.investors ?? []).map((i) => ({ key: `owner:${i.email}`, label: `Property owner · ${i.name}`, session: { role: "owner" as Role, user: i.email, name: i.name } })),
    ...(ids ? [{ key: "admin", label: `Authority · ${ids.admin.name}`, session: { role: "admin" as Role, user: ids.admin.user, name: ids.admin.name } }] : []),
  ];
  const currentKey = s.role === "public" ? "public" : s.role === "admin" ? "admin" : `${s.role}:${s.user}`;
  if (!options.some((o) => o.key === currentKey)) options.splice(1, 0, { key: currentKey, label: `${s.role === "admin" ? "Authority" : s.role.charAt(0).toUpperCase() + s.role.slice(1)} · ${s.name}`, session: s });
  const badge = { public: "bg-slate-500", builder: "bg-saffron-500", investor: "bg-emerald-600", owner: "bg-emerald-600", admin: "bg-indigo-600" }[s.role];

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="demo-badge !hidden sm:!inline-flex">Demo role</span>
      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase text-white ${badge}`}>{s.role === "admin" ? "authority" : s.role}</span>
      <select
        value={currentKey}
        onChange={(e) => { const o = options.find((x) => x.key === e.target.value); if (o) setSession(o.session); }}
        className="max-w-[170px] rounded-md border sm:max-w-[220px] border-navy-700 bg-navy-800 px-2 py-1 text-slate-100"
      >
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  );
}
