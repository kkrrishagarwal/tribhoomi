"use client";
/**
 * Prototype identity: who is signed in right now. Stored in localStorage and sent as
 * X-Role / X-User headers with every API call.
 *
 * There are no passwords, but a session is still committed: it is created ONLY by the sign-in
 * screen and lasts until the person signs out. Nothing in the app switches role behind their
 * back, so every action is recorded against the identity they chose.
 */
export type Role = "public" | "builder" | "investor" | "owner" | "admin";
export type Session = { role: Role; user: string; name: string; signedIn: boolean };

const KEY = "tribhoomi.session";
export const SIGNED_OUT: Session = { role: "public", user: "", name: "Not signed in", signedIn: false };

export function getSession(): Session {
  if (typeof window === "undefined") return SIGNED_OUT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SIGNED_OUT;
    const saved = JSON.parse(raw);
    // sessions stored before this flag existed were created by signing in, so treat them as signed in
    return { ...SIGNED_OUT, ...saved, signedIn: saved.signedIn ?? true };
  } catch {
    return SIGNED_OUT;
  }
}

function announce() {
  window.dispatchEvent(new Event("tribhoomi-session"));
}

/** Called only by the sign-in screen. */
export function setSession(s: Omit<Session, "signedIn">) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, signedIn: true })); } catch {}
  announce();
}

export function signOut() {
  try { localStorage.removeItem(KEY); } catch {}
  announce();
}

export function sessionHeaders(): Record<string, string> {
  const s = getSession();
  return { "X-Role": s.role, "X-User": s.user };
}
