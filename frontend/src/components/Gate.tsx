"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/useSession";
import type { Role } from "@/lib/session";
import ScanLoader from "./ScanLoader";

/** Wraps a role-specific page: shows a clear sign-in prompt instead of an empty page. */
export default function Gate({ roles, children, signin }: { roles: Role[]; children: ReactNode; signin: string }) {
  const s = useSession();
  const path = usePathname();
  // The session lives in localStorage, so it is unknown until after the first client render.
  // Wait for it rather than flashing "you are viewing as public" at someone who is signed in.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <ScanLoader text="Checking your role" className="p-16" />;
  if (!roles.includes(s.role)) {
    return (
      <div className="page"><div className="card mx-auto max-w-md p-6 text-center">
        <div className="text-lg font-semibold">This area is for {roles.map((r) => (r === "admin" ? "authority" : r)).join(" / ")} users</div>
        <p className="mt-1 text-sm text-slate-500">You are currently viewing as <b>{s.role === "admin" ? "authority" : s.role}</b>.</p>
        <Link href={`/signin?role=${signin.split("/").pop()}&next=${encodeURIComponent(path)}`} className="btn-accent mt-4">Sign in (demo mode)</Link>
        <p className="mt-2 text-xs text-ink-dim">Prototype: roles are simulated, no password. You will come straight back to this page.</p>
      </div></div>
    );
  }
  return <>{children}</>;
}
