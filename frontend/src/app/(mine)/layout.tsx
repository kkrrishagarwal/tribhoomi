"use client";
import SubTabs from "@/components/SubTabs";
import { useSession } from "@/lib/useSession";

export default function MineLayout({ children }: { children: React.ReactNode }) {
  const s = useSession();
  const tabs = s.role === "investor"
    ? [{ href: "/saved", label: "Saved properties" }]
    : [{ href: "/owner", label: "My property" }, { href: "/changes", label: "Changes & approvals" }, { href: "/saved", label: "Saved" }];
  return <><SubTabs label="My properties" tabs={tabs} />{children}</>;
}
