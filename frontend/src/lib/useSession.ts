"use client";
import { useEffect, useState } from "react";
import { getSession, type Session } from "./session";

export function useSession(): Session {
  const [s, setS] = useState<Session>({ role: "public", user: "", name: "Public visitor" });
  useEffect(() => {
    const sync = () => setS(getSession());
    sync();
    window.addEventListener("tribhoomi-session", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("tribhoomi-session", sync); window.removeEventListener("storage", sync); };
  }, []);
  return s;
}
