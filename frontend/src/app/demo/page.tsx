import Link from "next/link";
import T from "@/components/T";

const STEPS = [
  { n: 1, title: "Find a property", href: "/discover?q=Aravalli", cta: "Search “Aravalli”",
    what: "Type a project name. Every unit shows its status: Verified, Pending, or Conflict.",
    say: "Tribhoomi gives each flat its own identity, not just the land parcel." },
  { n: 2, title: "See its building / floor / unit identity", href: "/property/TRB-AR46-F03-U01", cta: "Open Aravalli Residency Floor 3-A",
    what: "The property page shows the Tribhoomi Property ID (TPID), integrity score, passport and history.",
    say: "The TPID links project → building → floor → unit. The official land-record ID sits under Advanced details." },
  { n: 3, title: "Verify the property", href: "/property/TRB-AR46-F03-U01", cta: "Click ‘Verify before you invest’",
    what: "Seven checks run: identity, authority verification, existence, overlap, unapproved changes, disputes, pending modifications.",
    say: "An investor gets a plain answer: consistent, review recommended, or conflict." },
  { n: 4, title: "Simulate a boundary change", href: "/signin/builder", cta: "Sign in as Tribhoomi Developers → Units → any verified unit → Request modification",
    what: "Drag the orange box in the floor editor. Area and validation update live. Submit the modification.",
    say: "Builders never type coordinates and never overwrite verified geometry; the original stays as version 1." },
  { n: 5, title: "Tribhoomi detects a conflict", href: "/property/TRB-AR46-F03-U03", cta: "Open Aravalli Floor 3-D",
    what: "This flat was silently changed from 3-C to 3-D and moved 1.8 m. The page shows a red banner, an unapproved version, and an overlap with the neighbour.",
    say: "Because history is append-only, a silent change cannot hide." },
  { n: 6, title: "Compare before and after", href: "/property/TRB-AR46-F03-U03", cta: "Expand ‘View before & after’",
    what: "Registered boundary (grey dashed) versus current record (orange), on the map and on the floor plan, with the area and movement difference.",
    say: "This is the evidence an official or a court needs." },
  { n: 7, title: "Authority reviews", href: "/signin/authority", cta: "Sign in as Authority → Pending verification → Review",
    what: "Open a pending unit: geometry with neighbours, validation score, versions, audit history. Approve, request changes or reject. Every decision is logged.",
    say: "A builder cannot verify their own unit. Only the authority issues a verification ID." },
  { n: 8, title: "Generate the Property Integrity Report", href: "/property/TRB-AR46-F03-U01", cta: "Click ‘Generate integrity report’",
    what: "A PDF with the TPID, verification status, integrity score breakdown, before/after diagram, history and a QR to the public passport.",
    say: "Everything is labelled as a demonstration dataset. Nothing here pretends to be a government certificate." },
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="h1">Guided demo · the property lifecycle</h1>
        <p className="text-sm text-slate-600">Eight steps, about 90 seconds of clicking. Each card says what to click and what to say. Roles are simulated: use the sign-in pages or the header dropdown.</p>
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
