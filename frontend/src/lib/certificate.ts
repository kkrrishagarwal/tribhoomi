"use client";
/**
 * Ownership certificate PDF, generated in the browser with jsPDF.
 * Purely presentational: it prints what the API already returned for the unit.
 */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { UnitFlags } from "@/lib/api";
import { verifyUrl } from "@/lib/publicUrl";

export type CertificateData = {
  ulpin: string;
  ulpin_2d: string;
  plot_number: string;
  building: string;
  parcel_name: string;
  village_ward: string;
  district: string;
  state: string;
  owner_name?: string;
  owner_email?: string;
  ownership_type?: string;
  registered_date?: string;
  registration_no?: string;
  area_sqm: number;
  usage_type: string;
  flags?: UnitFlags;
  version?: number | null;
};

export function certificateStatus(f?: UnitFlags): { label: string; ok: boolean } {
  if (!f || !f.locked) return { label: "UNREGISTERED — no owner on record", ok: false };
  if (f.has_unapproved_change) return { label: "TAMPERED — record changed without owner approval", ok: false };
  if (f.has_open_dispute) return { label: "DISPUTED — unresolved dispute on record", ok: false };
  if (f.has_pending_request) return { label: "CLEAN — change request pending owner decision", ok: true };
  return { label: "CLEAN — record matches registered baseline", ok: true };
}

export async function downloadCertificate(d: CertificateData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const status = certificateStatus(d.flags);
  const qr = await QRCode.toDataURL(verifyUrl(d.ulpin), { margin: 1, width: 400 });

  // header band
  doc.setFillColor(10, 14, 20); doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Tribhoomi · 3D ULPIN Ownership Certificate", 14, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(200, 210, 220);
  doc.text("Department of Land Resources · Ministry of Rural Development · SIH26011 prototype", 14, 21);
  doc.text(`Issued ${new Date().toISOString().slice(0, 10)}${d.state ? ` · State of ${d.state}` : ""}`, 14, 27);

  // ULPIN block
  doc.setTextColor(20, 20, 20); doc.setFont("courier", "bold"); doc.setFontSize(18);
  doc.text(d.ulpin, 14, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  doc.text(`Unique Land Parcel Identification Number (3D) · surface parcel ${d.ulpin_2d}`, 14, 56);

  // QR
  doc.addImage(qr, "PNG", W - 14 - 38, 40, 38, 38);
  doc.setFontSize(7); doc.text("Scan to verify online", W - 14 - 38, 82, { maxWidth: 38 });

  // fields
  const rows: [string, string][] = [
    ["Plot / unit", `${d.plot_number} · ${d.building}`],
    ["Parcel", [d.parcel_name, d.village_ward].filter(Boolean).join(", ")],
    ["District / State", [d.district, d.state].filter(Boolean).join(", ")],
    ["Registered owner", d.owner_name ?? "—"],
    ["Owner contact", d.owner_email ?? "—"],
    ["Tenure", d.ownership_type ?? "—"],
    ["Registration", d.registered_date ? `${d.registered_date} · ${d.registration_no ?? ""}` : "—"],
    ["Floor area", `${d.area_sqm} m²`],
    ["Usage", d.usage_type],
    ["Record version", d.version ? `v${d.version}` : "—"],
  ];
  let y = 70;
  doc.setFontSize(10);
  for (const [k, v] of rows.filter(([, v]) => v && v !== "—")) {
    doc.setTextColor(110, 110, 110); doc.text(k, 14, y);
    doc.setTextColor(20, 20, 20); doc.text(String(v), 60, y, { maxWidth: 90 });
    doc.setDrawColor(230, 230, 230); doc.line(14, y + 2.5, W - 14 - 42, y + 2.5);
    y += 9;
  }

  // status stamp
  y += 6;
  if (status.ok) { doc.setFillColor(220, 252, 231); doc.setDrawColor(22, 163, 74); doc.setTextColor(21, 128, 61); }
  else { doc.setFillColor(254, 226, 226); doc.setDrawColor(220, 38, 38); doc.setTextColor(185, 28, 28); }
  doc.roundedRect(14, y, W - 28, 16, 2, 2, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`STATUS: ${status.label}`, 18, y + 10);

  // footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text("This certificate reproduces the registry record at the time of issue. Every change to a registered unit requires the owner's", 14, 272, { maxWidth: W - 28 });
  doc.text("approval and is kept as an append-only version; verify the live record by scanning the QR code or entering the ULPIN at /verify.", 14, 277, { maxWidth: W - 28 });
  doc.text("Prototype for Smart India Hackathon SIH26011 — not a legal document. Seed data is synthetic.", 14, 286);

  doc.save(`certificate-${d.ulpin}.pdf`);
}
