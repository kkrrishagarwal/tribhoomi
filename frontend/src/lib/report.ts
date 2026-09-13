"use client";
/** Tribhoomi Property Integrity Report (PDF, generated in the browser). Clearly a demo document, not a certificate. */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Analysis, PropertyPage, VerifyResultV2 } from "@/lib/api";
import { publicOrigin } from "@/lib/publicUrl";

export async function downloadReport(p: PropertyPage, v: VerifyResultV2 | null, an: Analysis | null = null): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const W = 210;
  const qr = await QRCode.toDataURL(`${publicOrigin()}/passport/${encodeURIComponent(p.tpid)}`, { margin: 1, width: 300 });
  doc.setFillColor(18, 22, 31); doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Tribhoomi Evidence Package · Demonstration / Analytical Report", 14, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(200, 210, 220);
  doc.text(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · DEMONSTRATION DATASET · not an official government document`, 14, 21);
  doc.addImage(qr, "PNG", W - 14 - 30, 36, 30, 30); doc.setFontSize(7); doc.setTextColor(90, 90, 90); doc.text("Scan for the public passport", W - 14 - 30, 70, { maxWidth: 30 });
  doc.setTextColor(20, 20, 20); doc.setFont("courier", "bold"); doc.setFontSize(16); doc.text(p.tpid, 14, 44);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text("Tribhoomi Property ID · links project, building, floor and unit", 14, 50);
  const rows: [string, string][] = [
    ["Property", `${p.building.name} — Unit ${p.label} · ${p.unit_type}`], ["Project", `${p.project.name}, ${p.project.locality}, ${p.project.city}`], ["Developer", p.project.developer],
    ["Floor", p.floor_label], ["Area", `${p.area_sqft.toLocaleString()} sq ft (${p.area_sqm} m²)`], ["Verification status", `${p.status_label}${p.verification_id ? ` · ${p.verification_id}` : ""}${p.verified_at ? ` · ${p.verified_at.slice(0, 10)}` : ""}`],
    ["Tribhoomi Integrity Score", `${p.integrity.score} / 100  (${Object.entries(p.integrity.parts).map(([k, v]) => `${k} ${v}`).join(" · ")})`],
    ["Technical land-record ID", `${p.land_record_id} (ULPIN-format prototype identifier, not an official ULPIN)`],
    ["Record versions", String(p.version_count)], ["Open disputes", String(p.disputes_open)],
  ];
  let y = 60; doc.setFontSize(10);
  for (const [k, val] of rows) { doc.setTextColor(110, 110, 110); doc.text(k, 14, y); doc.setTextColor(20, 20, 20); const lines = doc.splitTextToSize(val, 110); doc.text(lines, 62, y); y += 6 * lines.length + 2; doc.setDrawColor(230, 230, 230); doc.line(14, y - 2, W - 14 - 34, y - 2); }
  if (v) {
    y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text(`Verify Before You Invest: ${v.result}`, 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    for (const c of v.checks) { doc.setTextColor(c.ok ? 21 : 185, c.ok ? 128 : 28, c.ok ? 61 : 28); doc.text(`${c.ok ? "✓" : "✗"} ${c.text} — ${c.detail}`, 16, y, { maxWidth: W - 32 }); y += 5; }
  }
  if (p.change) {
    y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text("Change detected between registered baseline and current record", 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text(`Previous: ${p.change.previous_sqft.toLocaleString()} sq ft (${p.change.previous_label})   Current: ${p.change.current_sqft.toLocaleString()} sq ft (${p.change.current_label})   Difference: ${p.change.difference_sqm} m²   Moved: ${p.change.moved_m} m   Approved by owner: ${p.change.approved ? "yes" : "NO"}`, 14, y, { maxWidth: W - 28 }); y += 10;
    // before/after diagram (unit rectangles in local metres, scaled)
    const bb = p.versions[0].bounding_volume, ab = p.versions[p.versions.length - 1].bounding_volume;
    const minx = Math.min(bb.min[0], ab.min[0]) - 2, maxx = Math.max(bb.max[0], ab.max[0]) + 2, miny = Math.min(bb.min[1], ab.min[1]) - 2, maxy = Math.max(bb.max[1], ab.max[1]) + 2;
    const sc = Math.min(80 / (maxx - minx), 40 / (maxy - miny)); const ox = 14, oy = y;
    const rect = (b: { min: number[]; max: number[] }) => [ox + (b.min[0] - minx) * sc, oy + (maxy - b.max[1]) * sc, (b.max[0] - b.min[0]) * sc, (b.max[1] - b.min[1]) * sc] as const;
    doc.setDrawColor(120, 120, 120); doc.setLineDashPattern([1.5, 1], 0); const r0 = rect(bb); doc.rect(r0[0], r0[1], r0[2], r0[3]);
    doc.setLineDashPattern([], 0); doc.setDrawColor(234, 88, 12); doc.setFillColor(254, 215, 170); const r1 = rect(ab); doc.rect(r1[0], r1[1], r1[2], r1[3], "FD");
    doc.setFontSize(8); doc.setTextColor(90, 90, 90); doc.text("dashed = registered baseline · orange = current record", ox, oy + 44); y = oy + 50;
  }
  if (an) {
    y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text(`Tribhoomi analysis · trust: ${an.trust.overall} · review priority: ${an.priority.level.toUpperCase()} (${an.priority.score}/100)`, 14, y, { maxWidth: W - 28 }); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    for (const f of an.priority.factors) { doc.text(`+${f.points}  ${f.reason}`, 16, y); y += 4.5; }
    if (an.change) {
      doc.text(`Change analysis (${an.change.mode.replace(/_/g, " ")}): ${an.change.area_before_sqft.toLocaleString()} → ${an.change.area_after_sqft.toLocaleString()} sq ft (${an.change.area_pct >= 0 ? "+" : ""}${an.change.area_pct}%); ${an.change.edge_moves.map((m) => m.text).join("; ") || "no edge moved"}; new conflicts: ${an.change.new_conflicts.map((c) => `${c.label} ${c.overlap_pct}%`).join(", ") || "none"}.`, 16, y, { maxWidth: W - 32 }); y += 10;
    }
    if (an.decisions.length) { doc.text("Authority decisions: " + an.decisions.map((d) => `${d.at.slice(0, 10)} ${d.label}${d.category ? ` [${d.category}]` : ""}${d.note ? ` — ${d.note}` : ""}`).join(" · "), 16, y, { maxWidth: W - 32 }); y += 10; }
    doc.text("Risk timeline: " + an.timeline.map((e) => `${e.at.slice(0, 10)} ${e.event} (${e.risk})`).join(" · "), 16, y, { maxWidth: W - 32 }); y += 12;
    doc.text(`Data completeness ${an.completeness.available}/${an.completeness.total}. Insight: ${an.insight}`, 16, y, { maxWidth: W - 32 }); y += 12;
  }
  y = Math.max(y + 6, 200); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text("Property history", 14, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
  for (const h of p.history.slice(-12)) { if (y > 280) break; doc.text(`${h.at.slice(0, 16).replace("T", " ")}  ${h.text}`, 14, y, { maxWidth: W - 28 }); y += 5; }
  doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
  doc.text("Tribhoomi is a prototype (SIH26011). Properties, builders and owners are a demonstration dataset. The Tribhoomi Integrity Score and TPID are internal to Tribhoomi and not official government values.", 14, 289, { maxWidth: W - 28 });
  doc.save(`tribhoomi-evidence-${p.tpid}.pdf`);
}
