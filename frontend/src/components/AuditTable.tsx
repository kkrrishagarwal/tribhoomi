"use client";
import type { AuditRow } from "@/lib/api";

export default function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <div className="card p-6 text-center text-slate-500">No audit events yet.</div>;
  return (
    <div className="card overflow-x-auto"><table className="tbl cards">
      <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Subject</th><th>Change</th><th>Status</th></tr></thead>
      <tbody>{rows.map((e) => (
        <tr key={e.id}><td data-l="When" className="font-mono text-xs">{e.at.slice(0, 16).replace("T", " ")}</td><td data-l="Who">{e.actor}<div className="text-xs text-slate-500">{e.role === "admin" ? "authority" : e.role}</div></td><td data-l="Action">{e.label}{e.note && <div className="text-xs text-slate-500">{e.note}</div>}</td><td data-l="Subject" className="font-mono text-xs">{e.subject}</td><td data-l="Change" className="text-xs">{e.previous_value && <span className="text-slate-500">{e.previous_value} → </span>}{e.new_value}</td><td data-l="Status"><span className={`pill pill-${["verified", "pending", "conflict", "rejected", "draft"].includes(e.status) ? e.status : "draft"}`}>{e.status || "—"}</span></td></tr>
      ))}</tbody></table></div>
  );
}
