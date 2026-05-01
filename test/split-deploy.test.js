const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.join(__dirname, "..");

test("Netlify publishes generated static frontend only", () => {
  const toml = fs.readFileSync(path.join(rootDir, "netlify.toml"), "utf8");
  assert.match(toml, /\[build\]/);
  assert.match(toml, /command\s*=\s*"node scripts\/build-netlify\.js"/);
  assert.match(toml, /publish\s*=\s*"dist"/);
});

test("frontend has runtime API base configuration loaded before app runtime", () => {
  const index = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.match(index, /<script src="runtime-config\.js"><\/script>\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>\s*<script src="common\.runtime\.js"><\/script>/);

  const runtimeConfig = fs.readFileSync(path.join(rootDir, "runtime-config.js"), "utf8");
  assert.match(runtimeConfig, /window\.YUGE_API_BASE_URL/);
});

test("Netlify build can write Supabase runtime config", () => {
  const script = fs.readFileSync(path.join(rootDir, "scripts", "build-netlify.js"), "utf8");
  assert.match(script, /process\.env\.YUGE_SUPABASE_URL/);
  assert.match(script, /process\.env\.YUGE_SUPABASE_ANON_KEY/);
  assert.match(script, /runtime-config\.js/);
  assert.match(script, /STATIC_FILES/);
});

test("frontend can initialize Supabase from runtime config", () => {
  const common = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  assert.match(common, /getSupabaseClient/);
  assert.match(common, /window\.YUGE_SUPABASE_URL/);
  assert.match(common, /window\.YUGE_SUPABASE_ANON_KEY/);
});

test("Supabase coach requests preserve the user's chat message", () => {
  const common = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  assert.match(common, /const userText = String\(input && input\.message \? input\.message : input && input\.goal \? input\.goal : ""\)\.trim\(\);/);
  assert.match(common, /role: "user", text: userText/);
});

test("Supabase schema stores one private app state per authenticated user", () => {
  const sql = fs.readFileSync(path.join(rootDir, "supabase", "schema.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.app_states/);
  assert.match(sql, /alter table public\.app_states enable row level security/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
});
