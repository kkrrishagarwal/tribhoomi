import Link from "next/link";
import T from "@/components/T";

const STEPS = [
  { n: 1, title: "Find the surface parcel", href: "/", cta: "Open parcel map",
    what: "Search “09141003100045” or “Tribhoomi Tower”, or click a parcel on the map. The 14-digit 2D ULPIN is shown, colour-coded by segment. Builders can draw or upload a new plot here. The optional Globe page shows the same parcels on Cesium world terrain with the real neighbouring buildings (needs a WebGL-capable GPU).",
    say: "Today every parcel already has a flat 2D ULPIN. It says nothing about what is above or below the ground." },
  { n: 2, title: "Expand vertically", href: "/parcel/1", cta: "Open Tribhoomi Tower in 3D",
    what: "Click “Expand vertically”. The footprint is extruded into 12 floors plus a basement. Every floor and unit carries its own 3D ULPIN that starts with the same 14 digits.",
    say: "The engine appends Building-Level-Unit-Layer segments. Zero means ‘whole’, so IDs nest like folders. Drag the Explode slider to see inside." },
  { n: 3, title: "Open an ownership record", href: "/parcel/1", cta: "Click any unit",
    what: "Click a blue unit. The side panel shows owner, tenure type, registration, area, bounding volume, and the parent chain back to the 2D ULPIN.",
    say: "This is the vertical property register: one title per cubic volume, not per land patch." },
  { n: 4, title: "Run the topology validator", href: "/parcel/1", cta: "Run validator on Tribhoomi Tower",
    what: "Press “Run topology validator”. Units 7-B and 7-C turn red: their surveyed volumes intersect by 2.5 m. Click the conflict to jump to it.",
    say: "Overlaps are found by 3D bounding-volume intersection. Then open Aravalli Residency (parcel 2): basement 2 clashes with the DMRC underground utility corridor — a cross-layer conflict." },
  { n: 5, title: "Check the metro clash", href: "/parcel/2", cta: "Open Aravalli Residency",
    what: "Run the validator here too. The purple tunnel volume and basement-2 parking overlap below −5 m.",
    say: "Underground layers get their own ULPINs under B00 (parcel level) with layer letter G, so utilities and metro corridors are first-class records." },
  { n: 6, title: "Builder registers a sale → baseline locks", href: "/builder", cta: "Open the builder desk (switch role to Builder · Tribhoomi Developers)",
    what: "Pick an unsold unit, click “Assign to investor”, enter a name and email. The unit moves to the Locked list with version 1 recorded. Try “Edit” on a locked unit: it is refused; only “Request change” is offered, with a before/after map.",
    say: "This is the anti-fraud rule: registration snapshots the plot number, boundary and ULPIN. After that, the builder cannot silently edit anything." },
  { n: 7, title: "Investor approves or rejects", href: "/investor", cta: "Open My plots (switch role to Investor · Rajesh Kumar)",
    what: "Rajesh has a pending request on Floor 5-A with the proposed boundary drawn over the registered one. Approve it → version 2 is created; reject it → nothing changes.",
    say: "Only the affected owner can approve. A new version exists only when they do." },
  { n: 8, title: "Catch a silent change", href: "/verify?ulpin=09-141-0018-00046-B01-F04-U03-A", cta: "Verify Anita's flat (public page, no login)",
    what: "The verify page shows TAMPERED: registered as Floor 3-C, now Floor 3-D with a boundary pushed 1.8 m into the neighbour, recorded without approval. v1 and v2 are overlaid on the map and a dispute is open. The topology validator also flags the overlap.",
    say: "Because history is append-only, the builder's change is visible forever — and anyone can check it by ULPIN." },
  { n: 9, title: "Government audit", href: "/admin", cta: "Open the audit view (switch role to Government)",
    what: "All open disputes and pending requests with before/after diffs. Start an investigation or resolve.",
    say: "An official sees exactly what changed, against which version, without touching raw tables." },
  { n: 10, title: "AI footprint extraction", href: "/ai", cta: "Run the model",
    what: "Run the pretrained SegFormer model on the Noida Sector 18 aerial image. Buildings are masked in red and vectorised to yellow footprint polygons with areas in m².",
    say: "This is how new surface parcels would be captured automatically before extrusion with LiDAR/drone height data." },
  { n: 11, title: "Dashboard", href: "/dashboard", cta: "Open dashboard",
    what: "Totals for parcels, buildings, floors, units, ULPINs generated, and conflicts flagged, plus breakdowns by usage and tenure.",
    say: "Everything on this page is computed live from the database." },
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold"><T k="h.demo" /></h1>
        <p className="text-sm text-slate-600">Eleven steps, about six minutes. Each card says what to click and what to say. Use the role dropdown in the header to switch between builder, investor and government.</p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card flex gap-4 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-800 font-semibold text-white">{s.n}</div>
            <div className="flex-1">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-slate-700"><span className="label mr-1">Do</span>{s.what}</p>
              <p className="mt-1 text-sm text-slate-500"><span className="label mr-1">Say</span>{s.say}</p>
              <Link href={s.href} className="btn-ghost mt-2">{s.cta} →</Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
