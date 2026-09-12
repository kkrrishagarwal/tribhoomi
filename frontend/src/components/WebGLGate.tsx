"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Renders children only when the browser can create a WebGL context; otherwise a clear notice. */
export default function WebGLGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try { const c = document.createElement("canvas"); setOk(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setOk(false); }
  }, []);
  if (ok === null) return null;
  if (!ok) return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-600">
      <div>
        <div className="text-base font-semibold">3D view needs WebGL</div>
        <p className="mt-1">This browser (for example an IDE's embedded preview) cannot create a WebGL context.</p>
        <p className="mt-1">Open <span className="font-mono">http://localhost:3000</span> in Chrome, Edge or Firefox.</p>
      </div>
    </div>
  );
  return <>{children}</>;
}
