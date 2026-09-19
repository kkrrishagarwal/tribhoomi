/** The product loop, shown wherever it helps a first-time viewer see where they are in it. */
export const LOOP = ["Property", "Change", "Analysis", "Impact", "Authority review", "New version"] as const;

export default function ProductLoop({ steps = LOOP as readonly string[], active, caption, className = "" }: { steps?: readonly string[]; active?: number | number[]; caption?: string; className?: string }) {
  const on = (i: number) => (Array.isArray(active) ? active.includes(i) : active === i);
  return (
    <div className={className}>
      <ol className="loop" aria-label="How Tribhoomi handles a property change">
        {steps.map((s, i) => (
          <li key={s} aria-current={on(i) ? "step" : undefined} className="loop-step"><span className="loop-n">{i + 1}</span>{s}</li>
        ))}
      </ol>
      {caption && <p className="mt-2 text-sm text-ink-muted">{caption}</p>}
    </div>
  );
}
