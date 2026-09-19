import DemoStory from "@/components/DemoStory";

// The story a judge needs, in order. Steps marked `needsScenario` open records created by the button on the page.
const CORE = [
  { n: 1, act: "The problem", title: "One plot number, dozens of owners", href: "/map", cta: "Open the map and pick Aravalli Residency", what: "Today's land record (2D ULPIN) identifies the ground plot only. This one plot holds 8 floors of separately owned flats, and the record cannot tell them apart.", say: "India's land records are flat. Ownership is not." },
  { n: 2, act: "The 3D ULPIN", title: "Every flat gets its own identity", href: "/parcel/2", cta: "Open the building in 3D and click any flat", what: "The ID grows with the building: plot → building → floor → unit. Click a flat to see its ID and owner. Basements and air rights work the same way.", say: "Same national ID, extended upwards. Nothing existing is replaced." },
  { n: 3, act: "Stopping a real fraud", title: "A verified flat has a locked baseline", href: "PROPERTY_3C", cta: "Open flat 3-C", what: "Once the authority verifies a unit, its boundary becomes version 1. Nobody, including the builder, can edit it directly any more.", say: "The fraud we target: a builder quietly redrawing a flat after it is sold.", needsScenario: true },
  { n: 4, act: "Stopping a real fraud", title: "The builder tries to move a wall", href: "PROPERTY_3C", cta: "See ‘What changed?’ on 3-C", what: "The change is only a proposal. Tribhoomi measures it (east wall out 1.5 m, area +13.6%) and finds it cuts into neighbour 3-D.", say: "It is caught before it becomes the record, and the neighbour it hurts is named.", needsScenario: true },
  { n: 5, act: "Stopping a real fraud", title: "The authority sees it first, with reasons", href: "REVIEW_3C", cta: "Review 3-C as the authority", what: "3-C jumps to HIGH priority with the exact factors listed. Before / after / overlap are side by side; the decision and its reason go into a permanent audit trail.", say: "Decision support, not just a viewer. Sign in as Government authority to open this.", needsScenario: true },
  { n: 6, act: "Stopping a real fraud", title: "A change made without approval is exposed", href: "/verify?ulpin=09-141-0018-00046-B01-F04-U03-A", cta: "Verify Aravalli flat 3-C", what: "This flat was renamed and shifted 1.8 m with no owner approval. The version history shows it instantly: TAMPERED.", say: "History is append-only, so tampering cannot hide." },
  { n: 7, act: "Stopping a real fraud", title: "A buyer checks it in three seconds", href: "PASSPORT_3C", cta: "Open the public passport (what the QR opens)", what: "Registered? Verified? Any conflict? Three answers, no private data.", say: "This is the whole product from a buyer's side.", needsScenario: true },
];

// Real, working features that support the story but are not required stops.
const MORE = [
  { href: "/ai", title: "AI footprint extraction", text: "Find building outlines in an aerial photo instead of typing coordinates." },
  { href: "/map", title: "Real NCR context", text: "Switch on ‘Show real NCR context’ on the map to see RERA-listed projects nearby." },
  { href: "/globe", title: "3D globe", text: "The same buildings on real terrain (needs a capable GPU)." },
  { href: "/ulpin", title: "ID engine", text: "Generate and decode 3D ULPINs by hand." },
  { href: "/dashboard", title: "Registry statistics", text: "Counts, conflicts and ownership across the demo registry." },
];

// The complete builder ↔ authority workflow behind steps 3–5, kept for a longer walkthrough.
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
  return <DemoStory core={CORE} full={STEPS} more={MORE} />;
}
