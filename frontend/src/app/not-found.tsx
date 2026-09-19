import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <div className="font-mono text-sm uppercase tracking-[0.2em] text-accent">404 · no such record</div>
        <h1 className="h1 mt-2">This page does not exist</h1>
        <p className="lead mt-2">The link may be old or mistyped. Nothing is wrong with the registry.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/discover" className="btn-primary">Find a property</Link>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
