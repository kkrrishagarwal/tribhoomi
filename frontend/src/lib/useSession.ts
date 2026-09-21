"use client";
import { useEffect, useState } from "react";
import { getSession, SIGNED_OUT, type Session } from "./session";

export function useSession(): Session {
  const [s, setS] = useState<Session>(SIGNED_OUT);
  useEffect(() => {
    const sync = () => setS(getSession());
    sync();
    window.addEventListener("tribhoomi-session", sync);
    window.addEventListener("storage", sync);   // sign out in one tab signs out the others
    return () => { window.removeEventListener("tribhoomi-session", sync); window.removeEventListener("storage", sync); };
  }, []);
  return s;
}
