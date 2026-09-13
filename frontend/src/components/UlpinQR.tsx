"use client";
/** QR code that opens the unit's public Verify My Plot page — scan it with any phone. */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { publicOrigin, verifyUrl } from "@/lib/publicUrl";

export default function UlpinQR({ ulpin, size = 112, caption = true, passport = false }: { ulpin: string; size?: number; caption?: boolean; passport?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = passport ? `${publicOrigin()}/passport/${encodeURIComponent(ulpin)}` : verifyUrl(ulpin);
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: size * 2, color: { dark: "#0a0e14", light: "#ffffff" } }).then(setSrc).catch(() => setSrc(null));
  }, [ulpin, size]);
  if (!src) return null;
  return (
    <div className="inline-flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code for ${ulpin}`} width={size} height={size} className="glow rounded-md bg-white p-1" style={{ boxShadow: "0 0 0 1px rgba(34,232,200,0.45), 0 0 14px rgba(34,232,200,0.3)" }} />
      {caption && <span className="max-w-[140px] text-center font-mono text-[9px] leading-tight text-slate-500" title={url}>scan to verify</span>}
    </div>
  );
}
