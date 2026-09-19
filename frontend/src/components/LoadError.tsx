"use client";
/** Shown in place of a page's content when its data could not be loaded. Never an endless loader, never a fake "empty". */
export default function LoadError({ message, onRetry, what = "this page" }: { message: string; onRetry?: () => void; what?: string }) {
  return (
    <div className="page">
      <div role="alert" className="card mx-auto max-w-lg p-6 text-center">
        <div className="label">Could not load {what}</div>
        <p className="mt-2 text-ink">{message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={onRetry ?? (() => window.location.reload())} className="btn-primary">Try again</button>
        </div>
      </div>
    </div>
  );
}
