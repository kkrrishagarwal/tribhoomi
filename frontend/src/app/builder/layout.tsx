import SubTabs from "@/components/SubTabs";

const TABS = [
  { href: "/builder", label: "Projects", also: ["/builder/projects", "/builder/buildings"] },
  { href: "/builder/units", label: "Units", also: ["/builder/modify"] },
  { href: "/builder/requests", label: "Modification requests" },
  { href: "/builder/audit", label: "Audit trail" },
];

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <><SubTabs roles={["builder", "admin"]} label="My plots" tabs={TABS} />{children}</>;
}
