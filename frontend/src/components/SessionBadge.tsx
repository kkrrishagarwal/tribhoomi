"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/session";
import { useSession } from "@/lib/useSession";

/**
 * Shows who is signed in, and lets them sign out. There is deliberately NO role picker here:
 * the sign-in screen is the only way in, so an identity holds until it is given up.
 */
const TITLE: Record<string, string> = { public: "Public visitor", builder: "Builder", investor: "Investor", owner: "Property owner", admin: "Authority" };
const BADGE: Record<string, string> = { public: "bg-slate-500", builder: "bg-saffron-500", investor: "bg-emerald-600", owner: "bg-emerald-600", admin: "bg-indigo-600" };

export default function SessionBadge() {
  const s = useSession();
  const router = useRouter();
  if (!s.signedIn) return <span className="demo-badge !hidden sm:!inline-flex">Prototype · demo mode</span>;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="demo-badge !hidden lg:!inline-flex">Demo mode</span>
      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase text-white ${BADGE[s.role]}`}>{TITLE[s.role]}</span>
      <span className="hidden max-w-[170px] truncate text-slate-200 sm:inline" title={s.name}>{s.name}</span>
      <button type="button" onClick={() => { signOut(); router.push("/signin"); }} className="btn-ghost !px-2 !py-1">Sign out</button>
    </div>
  );
}
