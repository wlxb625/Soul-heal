const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  validateRegistrationCredentials,
  validateLoginCredentials,
  validateModelName
} = require("../auth-validation");

const rootDir = path.join(__dirname, "..");

test("registration requires a valid email address", () => {
  assert.equal(
    validateRegistrationCredentials({ username: "tester", email: "bad-email", password: "Strong123" }).ok,
    false
  );

  const result = validateRegistrationCredentials({
    username: "tester",
    email: "tester@example.com",
    password: "Strong123"
  });
  assert.equal(result.ok, true);
  assert.equal(result.email, "tester@example.com");
});

test("registration password requires length, letters, and numbers", () => {
  assert.equal(
    validateRegistrationCredentials({ username: "tester", email: "tester@example.com", password: "abcdefg" }).ok,
    false
  );
  assert.equal(
    validateRegistrationCredentials({ username: "tester", email: "tester@example.com", password: "12345678" }).ok,
    false
  );
  assert.equal(
    validateRegistrationCredentials({ username: "tester", email: "tester@example.com", password: "abc12345" }).ok,
    true
  );
});

test("login accepts username or email as account identifier", () => {
  assert.deepEqual(validateLoginCredentials({ account: "tester@example.com", password: "abc12345" }), {
    ok: true,
    account: "tester@example.com",
    password: "abc12345"
  });
});

test("model name is validated as a free text value", () => {
  assert.equal(validateModelName("claude-sonnet-4.5"), "claude-sonnet-4.5");
  assert.equal(validateModelName("   "), "gpt-4.1-mini");
});

test("settings page uses text input for custom model names", () => {
  const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.match(html, /<input[^>]+id="apiModelInput"/);
  assert.doesNotMatch(html, /<select[^>]+id="apiModelSelect"/);
});
