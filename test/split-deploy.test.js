const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  getAllowedCorsOrigins,
  getSessionCookieOptions
} = require("../deployment-config");

const rootDir = path.join(__dirname, "..");

test("Netlify publishes the static frontend only", () => {
  const toml = fs.readFileSync(path.join(rootDir, "netlify.toml"), "utf8");
  assert.match(toml, /\[build\]/);
  assert.match(toml, /command\s*=\s*"node scripts\/write-runtime-config\.js"/);
  assert.match(toml, /publish\s*=\s*"\."/);
});

test("frontend has runtime API base configuration loaded before app runtime", () => {
  const index = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.match(index, /<script src="runtime-config\.js"><\/script>\s*<script src="common\.runtime\.js"><\/script>/);

  const runtimeConfig = fs.readFileSync(path.join(rootDir, "runtime-config.js"), "utf8");
  assert.match(runtimeConfig, /window\.YUGE_API_BASE_URL/);
});

test("Netlify build can write Render backend URL into runtime config", () => {
  const script = fs.readFileSync(path.join(rootDir, "scripts", "write-runtime-config.js"), "utf8");
  assert.match(script, /process\.env\.YUGE_API_BASE_URL/);
  assert.match(script, /runtime-config\.js/);
});

test("frontend API fetch uses configured backend base URL with cross-origin credentials", () => {
  const common = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  assert.match(common, /getApiUrl/);
  assert.match(common, /credentials:\s*"include"/);
  assert.match(common, /window\.YUGE_API_BASE_URL/);
});

test("Render backend reads CORS origins from environment", () => {
  assert.deepEqual(
    getAllowedCorsOrigins("https://front.netlify.app, http://localhost:8888"),
    ["https://front.netlify.app", "http://localhost:8888"]
  );
});

test("production session cookies are valid for Netlify to Render cross-site auth", () => {
  assert.deepEqual(getSessionCookieOptions("production"), {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/"
  });
});
