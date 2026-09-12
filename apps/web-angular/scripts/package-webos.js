// Assembles a webOS-installable app folder from the production build:
// dist/web-angular/browser/* (the static SPA, hash-routed on purpose so it
// works with no server-side rewrites) + webos/appinfo.json + icons.
//
// Usage: npm run package:webos   (from apps/web-angular)
// Then, with LG's webOS CLI (ares-cli) installed and Dev Mode enabled on the
// TV (see requirements.md section 2 in the repo root):
//   ares-package webos-dist
//   ares-install <the .ipk> -d <device name from `ares-setup-device`>
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const browserDir = path.join(root, "dist", "web-angular", "browser");
const webosDir = path.join(root, "webos");
const outDir = path.join(root, "webos-dist");

if (!fs.existsSync(browserDir)) {
  console.error(`Build output not found at ${browserDir} — run "npm run build" first.`);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.cpSync(browserDir, outDir, { recursive: true });
for (const file of ["appinfo.json", "icon.png", "largeIcon.png"]) {
  fs.copyFileSync(path.join(webosDir, file), path.join(outDir, file));
}

console.log(`webOS app assembled at ${outDir}`);
console.log("Next: ares-package webos-dist   (requires LG's ares-cli)");
