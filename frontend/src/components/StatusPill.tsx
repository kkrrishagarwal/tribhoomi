"use client";
import type { VerificationStatus } from "@/lib/api";

const LABEL: Record<string, string> = { verified: "Verified", pending: "Pending verification", conflict: "Conflict", rejected: "Rejected", draft: "Draft" };

export default function StatusPill({ status, label }: { status: VerificationStatus | string; label?: string }) {
  const cls = ["verified", "pending", "conflict", "rejected", "draft"].includes(status) ? status : "draft";
  return <span className={`pill pill-${cls}`}>{label ?? LABEL[cls] ?? status}</span>;
}

export function DemoBadge({ text = "Demo mode" }: { text?: string }) {
  return <span className="demo-badge">{text}</span>;
}
