"use client";
import { useEffect, useState } from "react";
import { getSession, SIGNED_OUT, type Session } from "./session";

export function useSession(): Session {
  const [s, setS] = useState<Session>(SIGNED_OUT);
  useEffect(() => {
    // keep the same object while the identity is unchanged: several pages use the session as an
    // effect dependency, and a fresh object on every sync made them refetch (and flash a loader)
    const sync = () => setS((prev) => {
      const next = getSession();
      const same = prev.role === next.role && prev.user === next.user && prev.name === next.name && prev.signedIn === next.signedIn;
      return same ? prev : next;
    });
    sync();
    window.addEventListener("tribhoomi-session", sync);
    window.addEventListener("storage", sync);   // sign out in one tab signs out the others
    return () => { window.removeEventListener("tribhoomi-session", sync); window.removeEventListener("storage", sync); };
  }, []);
  return s;
}
