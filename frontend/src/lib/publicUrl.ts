"use client";
/**
 * The address other devices should use to reach this app. On a laptop demo, open the
 * app via your LAN IP (e.g. http://192.168.1.20:3000) or set NEXT_PUBLIC_PUBLIC_URL so
 * that QR codes scanned by a judge's phone resolve — "localhost" only works on this machine.
 */
export function publicOrigin(): string {
  const env = (process.env.NEXT_PUBLIC_PUBLIC_URL || "").trim();   // dashboards often add a trailing line break
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function verifyUrl(ulpin: string): string {
  return `${publicOrigin()}/verify?ulpin=${encodeURIComponent(ulpin)}`;
}
