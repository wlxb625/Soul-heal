const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.join(__dirname, "..");
const buildCommand = process.platform === "win32"
  ? [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run build:mbti-react"]]
  : ["npm", ["run", "build:mbti-react"]];
execFileSync(buildCommand[0], buildCommand[1], { cwd: rootDir, stdio: "inherit" });
const distDir = path.join(rootDir, "dist");
const STATIC_FILES = [
  "index.html",
  "app.chat.js",
  "common.runtime.js",
  "styles.css",
  "yuge-logo.png",
  "wood-dark.png",
  "wood-light.png",
  ".nojekyll"
];
const STATIC_DIRECTORIES = ["assets"];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

STATIC_FILES.forEach((fileName) => {
  fs.copyFileSync(path.join(rootDir, fileName), path.join(distDir, fileName));
});

STATIC_DIRECTORIES.forEach((directoryName) => {
  fs.cpSync(path.join(rootDir, directoryName), path.join(distDir, directoryName), {
    recursive: true
  });
});

const apiBaseUrl = String(process.env.YUGE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const supabaseUrl = String(process.env.YUGE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabaseAnonKey = String(process.env.YUGE_SUPABASE_ANON_KEY || "").trim();
const runtimeConfig = [
  `window.YUGE_SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`,
  `window.YUGE_SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};`,
  `window.YUGE_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`
].join("\n") + "\n";
fs.writeFileSync(path.join(distDir, "runtime-config.js"), runtimeConfig, "utf8");

console.log(`Built Netlify frontend in ${path.relative(process.cwd(), distDir)}`);
console.log(`YUGE_API_BASE_URL=${apiBaseUrl || "(same-origin)"}`);
console.log(`YUGE_SUPABASE_URL=${supabaseUrl || "(not configured)"}`);
