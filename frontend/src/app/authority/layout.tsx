import SubTabs from "@/components/SubTabs";

const TABS = [
  { href: "/authority", label: "Review queue", also: ["/authority/review"] },
  { href: "/authority/pending", label: "Pending" },
  { href: "/authority/conflicts", label: "Conflicts" },
  { href: "/authority/disputes", label: "Disputes" },
  { href: "/authority/map", label: "Conflict map" },
  { href: "/authority/audit", label: "Audit log" },
];

export default function AuthorityLayout({ children }: { children: React.ReactNode }) {
  return <><SubTabs roles={["admin"]} label="Authority review" tabs={TABS} />{children}</>;
}
