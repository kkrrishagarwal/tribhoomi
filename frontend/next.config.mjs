/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* to FastAPI so the browser never deals with CORS or a second host.
  async rewrites() {
    const api = process.env.API_URL || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
  // Old per-role sign-in URLs (/signin/builder) now open the single sign-in screen with that role preselected.
  async redirects() {
    return [{ source: "/signin/:role", destination: "/signin?role=:role", permanent: false }];
  },
  // Cesium is NOT bundled by webpack: its prebuilt Cesium.js is copied to public/cesium by
  // scripts/copy-cesium.js and loaded at runtime (src/lib/loadCesium.ts).
};
export default nextConfig;
