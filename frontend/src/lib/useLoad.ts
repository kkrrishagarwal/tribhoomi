"use client";
import { useCallback, useEffect, useState } from "react";

/** Load data for a page: `data` is null while loading, `error` is a readable message, `reload` retries. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    fn().then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e?.message || "Something went wrong."); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
}
