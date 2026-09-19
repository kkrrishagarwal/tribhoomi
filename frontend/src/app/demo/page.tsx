import DemoStory from "@/components/DemoStory";

// ONE property, five acts. `P:` links open flat 3-C while its change is still a proposal; `D:` links open the
// second copy of the story where the change has been corrected, approved and recorded. Both are created by one click.
const CORE = [
  { n: 1, act: "Act 1 · The property", loop: 0, title: "Flat 3-C is a verified property", href: "P:/property/3C", cta: "Open flat 3-C", what: "It has an identity (plot → building → floor → unit), a boundary the authority verified, and a passport. That verified boundary is version 1.", say: "A normal record stops here. Tribhoomi starts here." },
  { n: 2, act: "Act 2 · The change", loop: 1, title: "The builder proposes moving the east wall", href: "P:/property/3C#what-changed", cta: "Open ‘What changed?’", what: "The proposal does not overwrite anything. Tribhoomi puts before and after side by side and measures the difference.", say: "Area +13.6%, east boundary out by about 1.5 m." },
  { n: 3, act: "Act 3 · The impact", loop: 3, title: "What does the change affect?", href: "P:/property/3C#impact-title", cta: "Open ‘Property impact’", what: "The new boundary overlaps neighbour 3-D and comes close to 3-B. It stays inside the building and the parcel.", say: "The system names the neighbour that is affected, with the overlap in square metres." },
  { n: 4, act: "Act 3 · The impact", loop: 2, title: "Why is this flagged?", href: "P:/property/3C#why-flagged", cta: "Open ‘Why is this flagged?’", what: "Every reason is listed: the boundary move, the area change, the overlap, the fact it is not approved. The Tribhoomi review priority shows the rule behind it.", say: "A transparent rule, not a black box and not an official score." },
  { n: 5, act: "Act 4 · The decision", loop: 4, title: "The authority reviews it", href: "P:/authority/review/3C", cta: "Review 3-C as the authority", role: "authority", what: "The reviewer sees the same comparison and impact, can simulate a smaller change, then approves, rejects or requests a correction with a reason. The decision goes into the audit trail.", say: "Tribhoomi supports the review. The authority decides." },
  { n: 6, act: "Act 5 · The new version", loop: 5, title: "Version 2 is recorded, version 1 is kept", href: "D:/property/3C", cta: "Open 3-C after approval", what: "In this copy of the story the builder corrected the proposal (0.4 m instead of 1.5 m, no overlap) and the authority approved it. The history shows both versions and every step between them.", say: "Tribhoomi does not just record a property. It tracks how its spatial identity changes." },
  { n: 7, act: "Act 5 · The new version", loop: 5, title: "Anyone can check the current state", href: "D:/passport/3C", cta: "Open the public passport (what the QR opens)", what: "Registered? Verified? Any conflict? Three answers and no private data.", say: "The buyer's view of the whole loop." },
];

// Real, working features that support the story but are not required stops.
const MORE = [
  { href: "/parcel/2", title: "See a whole building in 3D", text: "Every floor and flat with its own ID, including basements and an underground corridor." },
  { href: "/verify?ulpin=09-141-0018-00046-B01-F04-U03-A", title: "A change that was never approved", text: "A seeded record that was renamed and shifted 1.8 m without approval. The version history exposes it." },
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
  { n: 13, title: "New version is permanently recorded", href: "PROPERTY_3C_DONE", cta: "Version history: v1 baseline, v2 approved", what: "The risk timeline shows when the property needed attention and when it was resolved.", say: "Append-only history." },
  { n: 14, title: "Buyer scans the QR", href: "PASSPORT_3C", cta: "Public passport", what: "Registered? Yes. Verified? Yes. Conflict? No conflict.", say: "Three answers in three seconds, with no private data." },
];

export default function DemoPage() {
  return <DemoStory core={CORE} full={STEPS} more={MORE} />;
}
