import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import RoleSwitcher from "@/components/RoleSwitcher";
import LangToggle from "@/components/LangToggle";
import T from "@/components/T";

export const metadata: Metadata = {
  title: "Tribhoomi — 3D ULPIN",
  description: "त्रिभूमि · 3D ULPIN generation, vertical property mapping and layout integrity (SIH26011)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-screen flex-col">
        <header className="bg-navy-900 text-white">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-saffron-500 font-bold text-white glow-warn">3D</span>
              <span className="font-semibold tracking-tight">त्रिभूमि Tribhoomi <span className="font-mono text-xs font-normal uppercase tracking-[0.2em] text-accent">· 3D ULPIN</span></span>
            </Link>
            <div className="ml-auto flex flex-wrap items-center gap-4">
              <NavLinks />
              <LangToggle />
              <RoleSwitcher />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500">
          <T k="h.footer" />
        </footer>
      </body>
    </html>
  );
}
