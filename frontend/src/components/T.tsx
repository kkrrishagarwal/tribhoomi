"use client";
import { useT } from "@/lib/i18n";

/** Inline translated label: <T k="h.parcels" /> — used inside server components too. */
export default function T({ k, fallback }: { k: string; fallback?: string }) {
  const { t } = useT();
  return <>{t(k, fallback)}</>;
}
