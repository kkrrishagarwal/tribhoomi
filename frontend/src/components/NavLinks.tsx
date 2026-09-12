"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { useT } from "@/lib/i18n";

export default function NavLinks() {
  const s = useSession();
  const path = usePathname();
  const { t } = useT();
  const items = [
    { href: "/", label: t("nav.map") },
    { href: "/globe", label: t("nav.globe") },
    ...(s.role === "builder" ? [{ href: "/builder", label: t("nav.builder") }] : []),
    ...(s.role === "investor" ? [{ href: "/investor", label: t("nav.investor") }] : []),
    ...(s.role === "admin" ? [{ href: "/admin", label: t("nav.admin") }, { href: "/builder", label: t("nav.builders") }] : []),
    { href: "/verify", label: t("nav.verify") },
    { href: "/ulpin", label: t("nav.ulpin") },
    { href: "/ai", label: t("nav.ai") },
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/demo", label: t("nav.demo") },
  ];
  return (
    <nav className="flex flex-wrap gap-0.5 text-sm">
      {items.map((n) => (
        <Link key={n.href} href={n.href} className={`rounded-md px-2.5 py-1.5 hover:bg-navy-700 hover:text-white ${path === n.href ? "bg-navy-700 text-white" : "text-slate-200"}`}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
