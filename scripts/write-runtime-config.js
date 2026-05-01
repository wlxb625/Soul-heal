const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "..", "runtime-config.js");
const apiBaseUrl = String(process.env.YUGE_API_BASE_URL || "").trim().replace(/\/+$/, "");

const contents = `window.YUGE_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};\n`;

fs.writeFileSync(outputPath, contents, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), outputPath)} with YUGE_API_BASE_URL=${apiBaseUrl || "(same-origin)"}`);
