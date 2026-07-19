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
  assert.match(toml, /functions\s*=\s*"netlify\/functions"/);
});

test("frontend has runtime API base configuration loaded before app runtime", () => {
  const index = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.match(index, /<script src="runtime-config\.js"><\/script>\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>\s*<script src="common\.runtime\.js(?:\?[^\"]+)?"><\/script>/);

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

test("Supabase coach requests call the Netlify AI function with personality context", () => {
  const common = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  assert.match(common, /invokeSupabaseCoach/);
  assert.match(common, /\/\.netlify\/functions\/coach/);
  assert.match(common, /personalityContext/);
  assert.match(common, /mbti: current\.mbti/);
});

test("Supabase API test uses the same real AI function as coach", () => {
  const common = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  assert.match(common, /invokeSupabaseAiSettingsTest/);
  assert.match(common, /purpose: "settings-test"/);
  assert.doesNotMatch(common, /Supabase 模式已保存配置；正式调用会使用你填写的 API Key。/);
});

test("Netlify coach function requests AI using personality context", () => {
  const fn = fs.readFileSync(path.join(rootDir, "netlify", "functions", "coach.js"), "utf8");
  assert.match(fn, /性格特点/);
  assert.match(fn, /MBTI/);
  assert.match(fn, /chat\/completions/);
  assert.match(fn, /plan_groups/);
});

test("Netlify coach function normalizes full OpenAI-compatible endpoint URLs", () => {
  const fn = fs.readFileSync(path.join(rootDir, "netlify", "functions", "coach.js"), "utf8");
  assert.match(fn, /sanitizeBaseUrl\(value\)\.replace/);
  assert.match(fn, /chat\\\/completions/);
});

test("Netlify coach function falls back when the model returns non-JSON advice", () => {
  const fn = fs.readFileSync(path.join(rootDir, "netlify", "functions", "coach.js"), "utf8");
  assert.match(fn, /buildFallbackStructuredPlan/);
  assert.match(fn, /parsePlanOrFallback/);
  assert.match(fn, /formatWarning/);
});

test("Netlify coach function keeps DeepSeek connectivity tests lightweight", () => {
  const fn = fs.readFileSync(path.join(rootDir, "netlify", "functions", "coach.js"), "utf8");
  assert.match(fn, /isSettingsTest/);
  assert.match(fn, /max_tokens: input\.isSettingsTest \? 80 : 700/);
  assert.match(fn, /只回复一句中文短句/);
});

test("Netlify coach function fails before platform timeout with clear timeout errors", () => {
  const fn = fs.readFileSync(path.join(rootDir, "netlify", "functions", "coach.js"), "utf8");
  assert.match(fn, /AbortSignal\.timeout/);
  assert.match(fn, /AI_TIMEOUT_MS/);
  assert.match(fn, /AI 服务响应超时/);
});

test("authentication supports email confirmation and phone SMS OTP", () => {
  const index = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  const runtime = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  const chat = fs.readFileSync(path.join(rootDir, "app.chat.js"), "utf8");

  assert.match(index, /id="authPhoneOtp"/);
  assert.match(index, /autocomplete="one-time-code"/);
  assert.match(runtime, /emailRedirectTo: getAuthRedirectUrl\(\)/);
  assert.match(runtime, /auth\.signInWithOtp/);
  assert.match(runtime, /auth\.verifyOtp/);
  assert.match(chat, /requiresEmailVerification/);
  assert.match(chat, /app\.requestPhoneOtp\(phone\)/);
  assert.match(chat, /app\.verifyPhoneOtp\(phone, phoneOtp\)/);
});

test("username login delegates Supabase account lookup to a protected Edge Function", () => {
  const runtime = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  const edgeFunction = fs.readFileSync(path.join(rootDir, "supabase", "functions", "username-login", "index.ts"), "utf8");

  assert.match(runtime, /client\.functions\.invoke\("username-login"/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeFunction, /admin\.auth\.admin\.listUsers/);
  assert.match(edgeFunction, /用户名或密码错误/);
  assert.doesNotMatch(edgeFunction, /console\.log\([^\n]*(password|email)/i);
});

test("frontend scopes neutral AI timeout guidance to AI endpoints", () => {
  const common = fs.readFileSync(path.join(rootDir, "common.runtime.js"), "utf8");
  assert.match(common, /normalizeApiErrorMessage/);
  assert.match(common, /isAiApiRequest/);
  assert.match(common, /AI 服务响应较慢/);
  assert.match(common, /服务商、模型和 API Key/);
  assert.match(common, /服务响应超时，请稍后重试/);
});

test("login errors never expose AI model configuration", () => {
  const chat = fs.readFileSync(path.join(rootDir, "app.chat.js"), "utf8");
  assert.match(chat, /exposesAiConfiguration/);
  assert.match(chat, /登录服务暂时繁忙，请稍后重试/);
});

test("home AI button uses the same direct module switch pattern as MBTI", () => {
  const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  const chat = fs.readFileSync(path.join(rootDir, "app.chat.js"), "utf8");
  assert.match(html, /<button id="homeCoachBtn" class="ghost-btn hero-btn" type="button">立即使用 AI 助手<\/button>/);
  assert.match(html, /<button id="homeMbtiBtn" class="ghost-btn hero-btn" type="button">完成 MBTI 测试<\/button>/);
  assert.match(chat, /els\.homeCoachBtn\.addEventListener\("click", \(\) => switchModule\("coach"\)\)/);
  assert.match(chat, /els\.homeMbtiBtn\.addEventListener\("click", \(\) => switchModule\("mbti"\)\)/);
});

test("Supabase schema stores one private app state per authenticated user", () => {
  const sql = fs.readFileSync(path.join(rootDir, "supabase", "schema.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.app_states/);
  assert.match(sql, /alter table public\.app_states enable row level security/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
});

