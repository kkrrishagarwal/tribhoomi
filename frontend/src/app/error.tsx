"use client";
import { useEffect } from "react";
import Link from "next/link";

/** Any crash while rendering a page lands here instead of Next's bare "Application error" screen. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="page">
      <div role="alert" className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <div className="label">Something broke on this screen</div>
        <h1 className="h1 mt-2">We could not show this page</h1>
        <p className="lead mt-2">Your data is safe: nothing was changed. Try again, or go back to a page that works.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
        <details className="mt-5 text-left text-xs text-ink-dim"><summary className="cursor-pointer">Technical details</summary><pre className="mt-2 whitespace-pre-wrap break-words">{error.message}{error.digest ? `\n(ref ${error.digest})` : ""}</pre></details>
      </div>
    </div>
  );
}
