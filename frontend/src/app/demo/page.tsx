import DemoStory from "@/components/DemoStory";

const STEPS = [
  { n: 1, title: "Builder registers Unit 3-C", href: "/builder", cta: "Builder desk → Aravalli Heights (flagship demo) → Tower → Floor 3", what: "Units 3-B, 3-C and 3-D were registered with the boundary editor.", say: "No coordinates typed; the builder draws." },
  { n: 2, title: "Tribhoomi validates the geometry", href: "/builder", cta: "Open a unit → validation panel", what: "Checklist: unique number, valid shape, inside building, inside parcel, no overlap, area, info.", say: "Bad submissions are stopped before they reach the authority." },
  { n: 3, title: "Authority verifies the property", href: "/authority/audit", cta: "Audit log", what: "Each unit was verified with a verification ID and a baseline version 1.", say: "A builder cannot verify their own unit." },
  { n: 4, title: "Property Passport is generated", href: "PROPERTY_3C", cta: "Open 3-C", what: "TPID, passport, QR, trust summary, integrity score.", say: "This is the identity the buyer will later scan." },
  { n: 5, title: "Builder submits a boundary modification", href: "PROPERTY_3C", cta: "See the pending proposal on 3-C", what: "The builder proposed extending 3-C's eastern wall by 1.5 m.", say: "The verified geometry is not overwritten; it is a proposal." },
  { n: 6, title: "Tribhoomi compares old vs new geometry", href: "PROPERTY_3C", cta: "‘What changed?’ card", what: "Area +13.6%, east boundary moved outward 1.5 m, changed region shown on the floor plan.", say: "Geometry change intelligence, not just two numbers." },
  { n: 7, title: "Tribhoomi identifies an overlap with 3-D", href: "PROPERTY_3C", cta: "Neighbours affected", what: "The proposal overlaps 3-D by about 1 m × 10.5 m. Risk: high.", say: "Potential conflict — analytical language, no accusation." },
  { n: 8, title: "Authority sees 3-C move to HIGH priority", href: "/authority", cta: "Command center → Review priority", what: "The queue ranks 3-C with ‘Why this priority?’ listing the exact factors.", say: "Transparent heuristic, not a black box." },
  { n: 9, title: "Authority opens ‘What Changed?’", href: "REVIEW_3C", cta: "Review 3-C", what: "Before/after/overlay with impacted neighbours, plus ‘Simulate modification’ (never saved).", say: "Decision support, not just a viewer." },
  { n: 10, title: "Authority requests a correction", href: "REVIEW_3C", cta: "Reason: Neighbour conflict → Request changes", what: "The decision is stored with a category and note in the permanent audit trail.", say: "Structured, explainable decisions." },
  { n: 11, title: "Builder resubmits", href: "MODIFY_3C", cta: "Request modification with a 0.4 m extension", what: "Validation passes: no overlap.", say: "The builder fixes it in the same editor." },
  { n: 12, title: "Authority approves", href: "REVIEW_3C", cta: "Approve modification", what: "Reason: Boundary correction.", say: "" },
  { n: 13, title: "New version is permanently recorded", href: "PROPERTY_3C", cta: "Version history: v1 baseline, v2 approved", what: "The risk timeline shows when the property needed attention and when it was resolved.", say: "Append-only history." },
  { n: 14, title: "Buyer scans the QR", href: "PASSPORT_3C", cta: "Public passport", what: "Registered? Yes. Verified? Yes. Conflict? No conflict.", say: "Three answers in three seconds, with no private data." },
];

export default function DemoPage() {
  return <DemoStory steps={STEPS} />;
}
