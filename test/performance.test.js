const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "app.chat.js"), "utf8");

test("heavy visual libraries stay out of the initial page load", () => {
  assert.doesNotMatch(index, /chart\.umd\.min\.js/);
  assert.doesNotMatch(index, /mbti-navigator\.iife\.js/);
  assert.match(app, /function ensureChartJs\(\)/);
  assert.match(app, /function ensureReactMbtiNavigator\(\)/);
  assert.match(app, /script\.async = true/);
});

test("full renders update only the active module", () => {
  const renderAllBody = app.match(/function renderAll\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(renderAllBody, /activeModule === "home"/);
  assert.match(renderAllBody, /activeModule === "progress"/);
  assert.doesNotMatch(renderAllBody, /\n\s*renderHome\(\);/);
});

test("cursor animation sleeps when idle and progress handlers are idempotent", () => {
  assert.equal((app.match(/requestAnimationFrame\(updatePositions\)/g) || []).length, 1);
  assert.match(app, /ringDistance > 0\.35 \|\| glowDistance > 0\.35/);
  assert.match(app, /document\.hidden/);
  assert.match(app, /btn\.dataset\.progressBound === "true"/);
});
