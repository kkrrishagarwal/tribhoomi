"use client";
/**
 * Load Cesium's prebuilt IIFE bundle from /public/cesium at runtime and return the global.
 * We deliberately keep Cesium out of the webpack bundle: its ESM builds trip over
 * Next.js' module resolution (zip.js subpath exports, import.meta), and a 10 MB library
 * is better cached as one static file anyway.
 */
let promise: Promise<any> | null = null;

export function loadCesium(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if ((window as any).Cesium) return Promise.resolve((window as any).Cesium);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    (window as any).CESIUM_BASE_URL = "/cesium";
    if (!document.querySelector('link[data-cesium-css]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.href = "/cesium/Widgets/widgets.css"; link.setAttribute("data-cesium-css", "1");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "/cesium/Cesium.js";
    script.async = true;
    script.onload = () => ((window as any).Cesium ? resolve((window as any).Cesium) : reject(new Error("Cesium global missing")));
    script.onerror = () => reject(new Error("failed to load /cesium/Cesium.js — run `node scripts/copy-cesium.js`"));
    document.head.appendChild(script);
  });
  return promise;
}
