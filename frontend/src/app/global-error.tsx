"use client";
/** Last resort: the root layout itself failed, so no stylesheet can be assumed. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0e14", color: "#e6edf3", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Tribhoomi could not start</h1>
          <p style={{ color: "#9fb0c3" }}>Something went wrong while loading the app. Your data is safe.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 8, border: "1px solid #22e8c8", background: "rgba(34,232,200,0.15)", color: "#22e8c8", fontSize: 15, cursor: "pointer" }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
