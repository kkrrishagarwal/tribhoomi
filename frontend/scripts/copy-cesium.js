// Cesium needs its Workers/Assets/Widgets served as static files. Copy them into public/cesium after install.
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "node_modules", "cesium", "Build", "Cesium");
const dst = path.join(__dirname, "..", "public", "cesium");
for (const dir of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  fs.cpSync(path.join(src, dir), path.join(dst, dir), { recursive: true });
}
// The self-contained IIFE build; loaded at runtime with a <script> tag (see src/lib/loadCesium.ts)
fs.copyFileSync(path.join(src, "Cesium.js"), path.join(dst, "Cesium.js"));
console.log("Cesium static assets copied to public/cesium");
