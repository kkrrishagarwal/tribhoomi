"use client";
/**
 * Minimal Hindi/English toggle: a key → label dictionary for navigation and section
 * headers only. Data (names, ULPINs, reasons) is never translated.
 */
import { useEffect, useState } from "react";

export type Lang = "en" | "hi";
const KEY = "tribhoomi.lang";

const DICT: Record<string, { en: string; hi: string }> = {
  // navigation
  "nav.map": { en: "Map", hi: "मानचित्र" },
  "nav.globe": { en: "Globe", hi: "ग्लोब" },
  "nav.builder": { en: "Builder desk", hi: "बिल्डर डेस्क" },
  "nav.builders": { en: "Builders", hi: "बिल्डर" },
  "nav.investor": { en: "My properties", hi: "मेरी संपत्तियाँ" },
  "nav.admin": { en: "Govt. audit", hi: "सरकारी ऑडिट" },
  "nav.verify": { en: "Verify my plot", hi: "प्लॉट सत्यापन" },
  "nav.ulpin": { en: "ULPIN engine", hi: "ULPIN इंजन" },
  "nav.ai": { en: "AI footprint", hi: "AI फुटप्रिंट" },
  "nav.dashboard": { en: "Dashboard", hi: "डैशबोर्ड" },
  "nav.explore": { en: "Explore properties", hi: "संपत्तियाँ खोजें" },
  "nav.adminShort": { en: "Authority review", hi: "प्राधिकरण समीक्षा" },
  "nav.signin": { en: "Sign in", hi: "साइन इन" },
  "nav.demo": { en: "Guided demo", hi: "गाइडेड डेमो" },
  // page and section headers
  "h.parcels": { en: "Surface parcels", hi: "भूखंड (सतह)" },
  "h.parcels.sub": { en: "Step 1 — find a parcel by name or 2D ULPIN, or click one on the map.", hi: "चरण 1 — नाम या 2D ULPIN से भूखंड खोजें, या मानचित्र पर क्लिक करें।" },
  "h.ulpin2d": { en: "2D ULPIN (surface parcel)", hi: "2D ULPIN (सतह भूखंड)" },
  "h.expand": { en: "Expand vertically → 3D", hi: "ऊर्ध्वाधर विस्तार → 3D" },
  "h.builderTool": { en: "Builder layout tool", hi: "बिल्डर लेआउट टूल" },
  "h.validator": { en: "Check this building for overlaps", hi: "ओवरलैप की जाँच करें" },
  "h.ownership": { en: "Ownership registry", hi: "स्वामित्व रजिस्ट्री" },
  "h.unitUlpin": { en: "3D ULPIN · unit", hi: "3D ULPIN · इकाई" },
  "h.trace": { en: "Traceability (parent chain)", hi: "अनुरेखण (मूल श्रृंखला)" },
  "h.layers": { en: "Sub-surface & air-rights layers", hi: "भूमिगत एवं वायु-अधिकार परतें" },
  "h.verify": { en: "Verify my plot", hi: "मेरा प्लॉट सत्यापित करें" },
  "h.verify.sub": { en: "Public, no login. Enter any 3D ULPIN to see its full registered history. Every version is kept, so a change made without approval stays visible.", hi: "सार्वजनिक, बिना लॉगिन। कोई भी 3D ULPIN दर्ज करें और उसका पूरा पंजीकृत इतिहास देखें। हर संस्करण केवल जोड़ा जाता है, इसलिए कोई गुप्त बदलाव छिप नहीं सकता।" },
  "h.history": { en: "Version history", hi: "संस्करण इतिहास" },
  "h.warning": { en: "Why is this flagged?", hi: "यह रिकॉर्ड चिह्नित क्यों है?" },
  "h.dashboard": { en: "Registry dashboard", hi: "रजिस्ट्री डैशबोर्ड" },
  "h.builder": { en: "Builder desk", hi: "बिल्डर डेस्क" },
  "h.investor": { en: "My plots", hi: "मेरे प्लॉट" },
  "h.admin": { en: "Government audit", hi: "सरकारी ऑडिट" },
  "h.editable": { en: "Editable · unsold", hi: "संपादन योग्य · अनबिके" },
  "h.locked": { en: "Locked · registered to investors", hi: "लॉक · निवेशकों के नाम पंजीकृत" },
  "h.pending": { en: "Change requests awaiting your decision", hi: "आपके निर्णय की प्रतीक्षा में परिवर्तन अनुरोध" },
  "h.openDisputes": { en: "Open disputes", hi: "खुले विवाद" },
  "h.pendingRequests": { en: "Pending change requests", hi: "लंबित परिवर्तन अनुरोध" },
  "h.notifications": { en: "Notifications", hi: "सूचनाएँ" },
  "h.ai": { en: "AI building-footprint extraction", hi: "AI भवन-फुटप्रिंट निष्कर्षण" },
  "h.demo": { en: "Guided demo · 3D ULPIN & vertical property mapping", hi: "गाइडेड डेमो · 3D ULPIN एवं ऊर्ध्वाधर संपत्ति मानचित्रण" },
  "h.engine": { en: "3D ULPIN engine", hi: "3D ULPIN इंजन" },
  "h.footer": { en: "Prototype for SIH26011 · not connected to government land records · IDs follow the ULPIN format but are not official · roles are simulated", hi: "SIH26011 के लिए प्रोटोटाइप · सरकारी भू-अभिलेखों से जुड़ा नहीं · ID केवल ULPIN प्रारूप में हैं, आधिकारिक नहीं · भूमिकाएँ सिम्युलेटेड हैं" },
};

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  try { return (localStorage.getItem(KEY) as Lang) || "en"; } catch { return "en"; }
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch {}
  window.dispatchEvent(new Event("tribhoomi-lang"));
}

/** Returns t(key) for the current language; re-renders when the toggle changes. */
export function useT() {
  const [lang, setL] = useState<Lang>("en");
  useEffect(() => {
    const sync = () => setL(getLang());
    sync();
    window.addEventListener("tribhoomi-lang", sync);
    return () => window.removeEventListener("tribhoomi-lang", sync);
  }, []);
  const t = (key: string, fallback?: string) => DICT[key]?.[lang] ?? fallback ?? DICT[key]?.en ?? key;
  return { t, lang };
}
