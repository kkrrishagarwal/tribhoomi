"use client";
import { setLang, useT } from "@/lib/i18n";

export default function LangToggle() {
  const { lang } = useT();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "hi" : "en")}
      title={lang === "en" ? "हिन्दी में देखें" : "Switch to English"}
      className="rounded-md border border-navy-700 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-slate-200 hover:text-white"
    >
      <span className={lang === "en" ? "text-accent" : ""}>EN</span>
      <span className="mx-1 text-slate-500">|</span>
      <span className={lang === "hi" ? "text-accent" : ""}>हिं</span>
    </button>
  );
}
