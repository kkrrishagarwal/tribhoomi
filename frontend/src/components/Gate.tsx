"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "@/lib/useSession";
import type { Role } from "@/lib/session";

/** Wraps a role-specific page: shows a clear sign-in prompt instead of an empty page. */
export default function Gate({ roles, children, signin }: { roles: Role[]; children: ReactNode; signin: string }) {
  const s = useSession();
  if (!roles.includes(s.role)) {
    return (
      <div className="page"><div className="card mx-auto max-w-md p-6 text-center">
        <div className="text-lg font-semibold">This area is for {roles.map((r) => (r === "admin" ? "authority" : r)).join(" / ")} users</div>
        <p className="mt-1 text-sm text-slate-500">You are currently viewing as <b>{s.role === "admin" ? "authority" : s.role}</b>.</p>
        <Link href={signin} className="btn-accent mt-4">Sign in (demo mode)</Link>
      </div></div>
    );
  }
  return <>{children}</>;
}
