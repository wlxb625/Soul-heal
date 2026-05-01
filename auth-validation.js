const DEFAULT_AI_MODEL = "gpt-4.1-mini";

function cleanText(value) {
  return String(value || "").trim();
}

function cleanPassword(value) {
  return String(value || "");
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateUsername(username) {
  const cleanUsername = cleanText(username);
  if (cleanUsername.length < 2 || cleanUsername.length > 20) {
    return { ok: false, message: "用户名长度需在2到20个字符之间" };
  }
  return { ok: true, username: cleanUsername };
}

function validatePasswordStrength(password) {
  const clean = cleanPassword(password);
  if (clean.length < 8 || clean.length > 64) {
    return { ok: false, message: "密码长度需在8到64个字符之间" };
  }
  if (!/[A-Za-z]/.test(clean) || !/[0-9]/.test(clean)) {
    return { ok: false, message: "密码需同时包含字母和数字" };
  }
  return { ok: true, password: clean };
}

function validateRegistrationCredentials({ username, email, password }) {
  const usernameResult = validateUsername(username);
  if (!usernameResult.ok) return usernameResult;

  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail) || cleanEmail.length > 120) {
    return { ok: false, message: "请输入有效的邮箱地址" };
  }

  const passwordResult = validatePasswordStrength(password);
  if (!passwordResult.ok) return passwordResult;

  return {
    ok: true,
    username: usernameResult.username,
    email: cleanEmail,
    password: passwordResult.password
  };
}

function validateLoginCredentials({ account, username, email, password }) {
  const cleanAccount = cleanText(account || email || username);
  const clean = cleanPassword(password);

  if (cleanAccount.length < 2 || cleanAccount.length > 120) {
    return { ok: false, message: "请输入用户名或邮箱" };
  }

  if (clean.length < 1 || clean.length > 64) {
    return { ok: false, message: "请输入密码" };
  }

  return { ok: true, account: cleanAccount, password: clean };
}

function validateModelName(value, defaultModel = DEFAULT_AI_MODEL) {
  const raw = cleanText(value);
  return raw ? raw.slice(0, 120) : defaultModel;
}

module.exports = {
  DEFAULT_AI_MODEL,
  validateRegistrationCredentials,
  validateLoginCredentials,
  validateModelName
};
