// One command that packages the already-built webos-dist folder and pushes
// it straight onto the TV, instead of the ares-package / ares-install
// two-step dance every time something changes. Run via `npm run deploy:webos`
// (chained after package:webos, which does the ng build + assembly step).
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const appInfo = JSON.parse(fs.readFileSync(path.join(root, "webos", "appinfo.json"), "utf8"));
const ipkName = `${appInfo.id}_${appInfo.version}_all.ipk`;

// Matches the device name already registered via `ares-setup-device` for
// this TV — override with WEBOS_DEVICE if that name ever changes.
const device = process.env.WEBOS_DEVICE || "LG_TV";

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
}

run("ares-package", ["webos-dist"]);
run("ares-install", ["-d", device, ipkName]);
