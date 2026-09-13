"use client";
/**
 * Prototype identity: who is using the app right now. Stored in localStorage and
 * sent as X-Role / X-User headers with every API call. No passwords — the demo
 * switches roles from the header bar.
 */
export type Role = "public" | "builder" | "investor" | "owner" | "admin";
export type Session = { role: Role; user: string; name: string };

const KEY = "tribhoomi.session";
const DEFAULT: Session = { role: "public", user: "", name: "Public visitor" };

export function getSession(): Session {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function setSession(s: Session) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  window.dispatchEvent(new Event("tribhoomi-session"));
}

export function sessionHeaders(): Record<string, string> {
  const s = getSession();
  return { "X-Role": s.role, "X-User": s.user };
}
