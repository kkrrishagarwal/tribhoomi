"use client";
/** A scanning bar with a status line — used instead of a spinner while data or the AI model is running. */
export default function ScanLoader({ text = "Processing…", className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`grid place-items-center p-6 ${className}`}>
      <div className="w-64 max-w-full">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          <span>{text}</span><span className="animate-pulse">●</span>
        </div>
        <div className="scan" />
      </div>
    </div>
  );
}
