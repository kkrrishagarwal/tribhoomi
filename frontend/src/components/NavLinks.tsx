"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { useT } from "@/lib/i18n";

/** Role-specific primary navigation. Technical pages live under "Advanced". */
export default function NavLinks() {
  const s = useSession();
  const path = usePathname();
  const { t } = useT();
  const byRole: Record<string, { href: string; label: string }[]> = {
    public: [{ href: "/", label: "Home" }, { href: "/discover", label: "Verify" }, { href: "/demo", label: t("nav.demo") }],
    investor: [{ href: "/discover", label: "Discover" }, { href: "/discover?verify=1", label: "Verify" }, { href: "/saved", label: "Saved" }, { href: "/demo", label: t("nav.demo") }],
    owner: [{ href: "/owner", label: "My property" }, { href: "/discover", label: "Verify" }, { href: "/changes", label: "Changes" }, { href: "/demo", label: t("nav.demo") }],
    builder: [{ href: "/builder", label: "Dashboard" }, { href: "/builder/units", label: "Units" }, { href: "/builder/requests", label: "Modification requests" }, { href: "/builder/audit", label: "Audit" }],
    admin: [{ href: "/authority", label: "Dashboard" }, { href: "/authority/pending", label: "Pending verification" }, { href: "/authority/conflicts", label: "Conflicts" }, { href: "/authority/disputes", label: "Disputes" }, { href: "/authority/audit", label: "Audit log" }],
  };
  const items = byRole[s.role] ?? byRole.public;
  const advanced = [{ href: "/map", label: "GIS view" }, { href: "/globe", label: "Globe" }, { href: "/ulpin", label: "ID engine" }, { href: "/ai", label: "AI footprint" }, { href: "/dashboard", label: "Registry stats" }];
  return (
    <nav className="flex flex-wrap items-center gap-0.5 text-sm">
      {items.map((n) => (
        <Link key={n.href} href={n.href} className={`rounded-md px-2.5 py-1.5 hover:bg-navy-700 hover:text-white ${path === n.href.split("?")[0] ? "bg-navy-700 text-white" : "text-slate-200"}`}>{n.label}</Link>
      ))}
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-md px-2.5 py-1.5 text-slate-400 hover:bg-navy-700 hover:text-white">Advanced ▾</summary>
        <div className="glass absolute right-0 z-[1200] mt-1 flex w-44 flex-col rounded-lg p-1">
          {advanced.map((n) => <Link key={n.href} href={n.href} className="rounded px-2 py-1.5 text-slate-200 hover:bg-navy-700">{n.label}</Link>)}
        </div>
      </details>
    </nav>
  );
}
