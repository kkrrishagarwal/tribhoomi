import SubTabs from "@/components/SubTabs";

// Everything a visitor can look at without owning anything. URLs are unchanged: (explore) is a route group.
const TABS = [
  { href: "/map", label: "Map", also: ["/parcel"] },
  { href: "/discover", label: "Verify a property", also: ["/property", "/verify"] },
  { href: "/dashboard", label: "Registry stats" },
  { href: "/ulpin", label: "ID engine", minor: true },
  { href: "/ai", label: "AI footprint", minor: true },
  { href: "/globe", label: "3D globe", minor: true },
];

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <><SubTabs label="Explore" tabs={TABS} />{children}</>;
}
