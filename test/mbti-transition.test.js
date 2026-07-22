const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(rootDir, "app.chat.js"), "utf8");
const styles = fs.readFileSync(path.join(rootDir, "styles.css"), "utf8");

test("MBTI question changes use one guarded transition path", () => {
  assert.match(app, /async function transitionMbtiQuestion\(nextIndex, direction = 1\)/);
  assert.match(app, /if \(mbtiQuestionTransitioning\) return;/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /answerStage\.dataset\.mbtiQuestionDirection = direction < 0 \? "backward" : "forward"/);
  assert.match(app, /await new Promise\(\(resolve\) => window\.setTimeout\(resolve, 150\)\)/);
});

test("MBTI transition keeps the visual work finite and transform-based", () => {
  assert.match(styles, /@keyframes mbti-question-exit/);
  assert.match(styles, /@keyframes mbti-question-enter/);
  assert.match(styles, /150ms cubic-bezier/);
  assert.match(styles, /240ms cubic-bezier/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
