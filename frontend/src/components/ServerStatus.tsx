"use client";
import { useEffect, useState } from "react";
import { SERVER_EVENT, type ServerState } from "@/lib/api";

/**
 * Explains a slow first load instead of leaving people staring at a loader. Free hosting puts the
 * server to sleep when idle; lib/api.ts keeps retrying reads and reports its state through SERVER_EVENT.
 */
export default function ServerStatus() {
  const [state, setState] = useState<ServerState>("ok");
  const [secs, setSecs] = useState(0);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<ServerState>).detail;
      setState((prev) => { if (prev !== "ok" && next === "ok") { setJustBack(true); setTimeout(() => setJustBack(false), 2500); } return next; });
    };
    window.addEventListener(SERVER_EVENT, on);
    return () => window.removeEventListener(SERVER_EVENT, on);
  }, []);

  useEffect(() => {
    if (state !== "waking") { setSecs(0); return; }
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  if (state === "ok" && !justBack) return null;
  return (
    <div role="status" aria-live="polite" className="status-bar" data-state={justBack ? "back" : state}>
      {justBack && <span>Connected. Loading your data…</span>}
      {!justBack && state === "waking" && (
        <>
          <span className="animate-pulse">●</span>
          <span><b>Waking up the server.</b> This demo runs on free hosting that sleeps when idle, so the first load takes up to a minute. The page will continue by itself{secs >= 3 ? ` · ${secs}s` : ""}.</span>
        </>
      )}
      {!justBack && state === "down" && (
        <>
          <span><b>The server is not responding.</b> It may still be starting, or it may be down.</span>
          <button type="button" onClick={() => window.location.reload()} className="btn-ghost !py-1">Try again</button>
        </>
      )}
    </div>
  );
}
