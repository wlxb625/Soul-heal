const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const STATIC_FILES = [
  "index.html",
  "app.chat.js",
  "common.runtime.js",
  "styles.css",
  ".nojekyll"
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

STATIC_FILES.forEach((fileName) => {
  fs.copyFileSync(path.join(rootDir, fileName), path.join(distDir, fileName));
});

const apiBaseUrl = String(process.env.YUGE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const runtimeConfig = `window.YUGE_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};\n`;
fs.writeFileSync(path.join(distDir, "runtime-config.js"), runtimeConfig, "utf8");

console.log(`Built Netlify frontend in ${path.relative(process.cwd(), distDir)}`);
console.log(`YUGE_API_BASE_URL=${apiBaseUrl || "(same-origin)"}`);
