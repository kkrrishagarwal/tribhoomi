"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { useT } from "@/lib/i18n";

/**
 * Four task-based sections at most. Every other page lives one level down, as a tab inside its
 * section (see SubTabs and the section layouts), so a first-time visitor has few decisions to make.
 */
const EXPLORE = ["/map", "/parcel", "/discover", "/property", "/verify", "/dashboard", "/ulpin", "/ai", "/globe"];
const MINE: Record<string, { href: string; under: string[] }> = {
  builder: { href: "/builder", under: ["/builder"] },
  owner: { href: "/owner", under: ["/owner", "/changes", "/saved"] },
  investor: { href: "/saved", under: ["/saved"] },
};

export default function NavLinks() {
  const s = useSession();
  const path = usePathname();
  const { t } = useT();
  const under = (roots: string[]) => roots.some((r) => path === r || path.startsWith(r + "/"));
  const mine = MINE[s.role];
  const items: { href: string; label: string; on: boolean }[] = [
    { href: "/map", label: t("nav.explore"), on: under(EXPLORE) },
    ...(mine ? [{ href: mine.href, label: t("nav.investor"), on: under(mine.under) }] : []),
    ...(s.role === "admin" ? [{ href: "/authority", label: t("nav.adminShort"), on: under(["/authority"]) }] : []),
    { href: "/demo", label: t("nav.demo"), on: under(["/demo"]) },
    ...(!s.signedIn ? [{ href: "/signin", label: t("nav.signin"), on: under(["/signin"]) }] : []),
  ];
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-0.5 text-sm">
      {items.map((n) => <Link key={n.href} href={n.href} aria-current={n.on ? "page" : undefined} className="navlink">{n.label}</Link>)}
    </nav>
  );
}
