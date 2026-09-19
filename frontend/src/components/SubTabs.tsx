"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/useSession";
import type { Role } from "@/lib/session";

export type Tab = { href: string; label: string; also?: string[]; minor?: boolean };

/**
 * Second-level navigation inside one of the main sections (Explore, My plots, Admin).
 * `also` lists other path prefixes that belong to the tab (e.g. the 3D viewer belongs to Map).
 * `minor` tabs are supporting tools: same row, quieter, pushed to the right.
 */
export default function SubTabs({ label, tabs, roles }: { label: string; tabs: Tab[]; roles?: Role[] }) {
  const path = usePathname();
  const s = useSession();
  const active = (t: Tab) => [t.href, ...(t.also ?? [])].some((p) => path === p || path.startsWith(p + "/"));
  // the most specific match wins, so "/builder" does not light up on "/builder/units"
  const best = tabs.filter(active).sort((a, b) => b.href.length - a.href.length)[0];
  const item = (t: Tab) => (
    <Link key={t.href} href={t.href} aria-current={best === t ? "page" : undefined} className={`subtab ${t.minor ? "subtab-minor" : ""}`}>{t.label}</Link>
  );
  const minor = tabs.filter((t) => t.minor);
  if (roles && !roles.includes(s.role)) return null;   // a gated section shows its sign-in prompt, not its tabs
  return (
    <nav aria-label={label} className="subtabs">
      <div className="subtabs-inner">
        <span className="label mr-2 hidden sm:inline">{label}</span>
        {tabs.filter((t) => !t.minor).map(item)}
        {minor.length > 0 && <span className="ml-auto flex items-center gap-1"><span className="label mr-1 hidden lg:inline">Supporting tools</span>{minor.map(item)}</span>}
      </div>
    </nav>
  );
}
