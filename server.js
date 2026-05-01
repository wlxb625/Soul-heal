const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const {
  validateRegistrationCredentials,
  validateLoginCredentials,
  validateModelName
} = require("./auth-validation");
const {
  getAllowedCorsOrigins,
  getSessionCookieOptions
} = require("./deployment-config");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "personality-improvement.db");
const COOKIE_NAME = "pi_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOTAL_QUESTIONS = 56;
const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
const SCENARIOS = ["团队会议", "冲突处理", "决策时刻", "压力管理", "自我表达"];
const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_AI_PROVIDER = "openai_compatible";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_AI_PROMPT = [
  "# 角色定义",
  "你是【愈格】软件的专属AI性格成长助手，核心使命是基于用户性格特征（如MBTI）和具体场景，生成分梯度、多方式的性格改进方案，帮助用户循序渐进优化性格。",
  "",
  "# 核心能力强化",
  "1. 场景化分析：精准识别用户的具体场景，结合其性格特征定位核心问题。",
  "2. 梯度方案设计：针对每个场景，优先生成缓慢改善、中等改善、快速改善三类方案。",
  "3. 多解决方式：每类方案下提供3到4种具体、可落地的解决方式，并说明操作步骤和预期效果。",
  "4. 个性化适配：结合用户MBTI和性格特点调整建议强度，避免给高敏感或内向用户过重压力。",
  "5. 激励引导：在结尾给出选择建议，帮助用户根据接受度选择下一步。",
  "",
  "# 行为准则",
  "1. 所有建议都要具体、能执行，避免空泛表达。",
  "2. 三类方案的难度、执行成本、见效速度要明显区分。",
  "3. 不否定用户当前状态，只提供不同路径的改进可能。",
  "4. 全程使用简洁、温和、无评判的中文。",
  "",
  "# 输出规则",
  "如果用户明确希望得到系统方案，请优先按以下结构输出：核心问题分析 -> 缓慢改善 -> 中等改善 -> 快速改善 -> 选择建议。",
  "如果用户是在继续聊天、追问、倾诉或复盘，就自然承接上下文回答，不要每次都强行套固定模板。",
  "如果用户只想要一个可立刻执行的动作，就直接给出最小可执行的一步。",
  "回复中不要使用 emoji、彩色符号、花哨装饰或代码块围栏。",
  "如果需要列点，请只使用普通中文段落或 1. 2. 3. 这种简洁序号。"
].join("\n");

const STRUCTURED_PLAN_PROMPT = [
  "你是一个性格改进方案设计师。",
  "用户会告诉你他想改进的性格方面，请你为他生成一套可执行的改进计划。",
  "你必须只输出一个 JSON 对象，不要输出任何解释文字、Markdown、代码块或额外注释。",
  "JSON 结构必须是：{\"plan_groups\":[{\"group_name\":string,\"group_description\":string,\"plans\":[{\"plan_name\":string,\"plan_description\":string,\"estimated_days\":number,\"completion_threshold\":number,\"tasks\":[{\"task_description\":string}]}]}]}",
  "计划分组 2 到 4 组，每组 2 到 3 个计划，每个计划 3 到 6 个任务。",
  "所有字段名必须使用英文；所有值必须使用中文。",
  "任务必须具体、简洁、可勾选，适合放入用户的计划簿。",
  "completion_threshold 必须是 0 到 1 之间的小数。",
  "不要输出任何 schema 说明或额外字段。"
].join("\n");

const STRUCTURED_PLAN_REPAIR_PROMPT = [
  "你是一个 JSON 修复器。",
  "请把用户提供的内容修复为一个合法的 JSON 对象。",
  "只输出 JSON 对象本身，不要输出任何解释、Markdown 或额外文字。",
  "字段结构必须严格为 plan_groups -> group_name/group_description/plans -> plan_name/plan_description/estimated_days/completion_threshold/tasks -> task_description。",
  "所有字段名必须是英文，值必须是中文。"
].join("\n");

const APP_BUILD = process.env.APP_BUILD || `local-${new Date(fs.statSync(__filename).mtimeMs).toISOString()}`;
const BACKEND_CAPABILITIES = Object.freeze({
  structuredPlan: true,
  planBook: true
});
const ALLOWED_CORS_ORIGINS = getAllowedCorsOrigins(process.env.CORS_ORIGINS);
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
initializeDatabase();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(applyCors);
app.use(loadSession);
app.use(express.static(PUBLIC_DIR));

function applyCors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_CORS_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}

function initializeDatabase() {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY,
      current_question INTEGER NOT NULL DEFAULT 0,
      answers_json TEXT NOT NULL,
      mbti_type TEXT,
      mbti_source TEXT NOT NULL DEFAULT 'none',
      reliability INTEGER NOT NULL DEFAULT 0,
      match_score INTEGER NOT NULL DEFAULT 0,
      radar_json TEXT NOT NULL,
      selected_scenario TEXT NOT NULL DEFAULT '团队会议',
      active_ai_conversation_id TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      imported_from_local INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT,
      scenario TEXT NOT NULL,
      goal TEXT NOT NULL,
      details TEXT,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scenario TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      user_id TEXT PRIMARY KEY,
      api_key TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
      provider TEXT NOT NULL DEFAULT 'openai_compatible',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_book_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_history_id TEXT NOT NULL,
      conversation_id TEXT,
      source_group_index INTEGER NOT NULL,
      source_plan_index INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      group_description TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      plan_description TEXT NOT NULL,
      estimated_days INTEGER NOT NULL,
      completion_threshold REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      achieved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_book_tasks (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      task_description TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(entry_id) REFERENCES plan_book_entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON ai_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_message_at ON ai_conversations(last_message_at);
    CREATE INDEX IF NOT EXISTS idx_plan_book_entries_user_id ON plan_book_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_plan_book_entries_source_plan ON plan_book_entries(user_id, source_history_id, source_group_index, source_plan_index);
    CREATE INDEX IF NOT EXISTS idx_plan_book_tasks_entry_id ON plan_book_tasks(entry_id);
  `);

  ensureTableColumn("ai_settings", "provider", `TEXT NOT NULL DEFAULT '${DEFAULT_AI_PROVIDER}'`);
  ensureTableColumn("users", "email", "TEXT");
  ensureTableColumn("user_state", "mbti_source", "TEXT NOT NULL DEFAULT 'none'");
  ensureTableColumn("user_state", "active_ai_conversation_id", "TEXT");
  ensureTableColumn("ai_history", "conversation_id", "TEXT");

  db.exec(`
    DROP INDEX IF EXISTS idx_plan_book_entries_source_plan;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email)) WHERE email IS NOT NULL AND trim(email) <> '';
    CREATE INDEX IF NOT EXISTS idx_plan_book_entries_source_plan ON plan_book_entries(user_id, source_history_id, source_group_index, source_plan_index);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_book_entries_active_source_plan
      ON plan_book_entries(user_id, source_history_id, source_group_index, source_plan_index)
      WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_message_at ON ai_conversations(last_message_at);
  `);

  db.exec(`
    UPDATE user_state
    SET mbti_source = 'test'
    WHERE (mbti_source IS NULL OR mbti_source = '' OR mbti_source = 'none')
      AND mbti_type IS NOT NULL
      AND trim(mbti_type) <> ''
  `);

  migrateLegacyAiHistoryConversations();
}

function ensureTableColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return crypto.randomUUID();
}

function parseCookies(rawHeader) {
  const cookies = {};
  if (!rawHeader) return cookies;

  rawHeader.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;
    const key = decodeURIComponent(trimmed.slice(0, equalsIndex));
    const value = decodeURIComponent(trimmed.slice(equalsIndex + 1));
    cookies[key] = value;
  });

  return cookies;
}

function sessionCookieBaseOptions() {
  return getSessionCookieOptions(process.env.NODE_ENV);
}

function createSession(res, userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(sessionId, userId, expiresAt, createdAt);

  res.cookie(COOKIE_NAME, sessionId, {
    ...sessionCookieBaseOptions(),
    expires: new Date(Date.now() + SESSION_TTL_MS)
  });
}

function clearSession(res, sessionId) {
  if (sessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  res.clearCookie(COOKIE_NAME, sessionCookieBaseOptions());
}

function loadSession(req, res, next) {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());

  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) {
    next();
    return;
  }

  const row = db.prepare(
    `SELECT sessions.id AS session_id, users.id AS user_id, users.username, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`
  ).get(sessionId, nowIso());

  if (!row) {
    clearSession(res, sessionId);
    next();
    return;
  }

  req.sessionId = row.session_id;
  req.user = {
    id: row.user_id,
    username: row.username,
    email: row.email || ""
  };

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ message: "未登录或登录已失效" });
    return;
  }
  next();
}

function defaultCoreState() {
  return {
    currentQuestion: 0,
    answers: new Array(TOTAL_QUESTIONS).fill(null),
    mbti: null,
    mbtiSource: "none",
    reliability: 0,
    match: 0,
    radar: [],
    selectedScenario: SCENARIOS[0],
    activeAiConversationId: null,
    theme: "light",
    onboardingCompleted: false,
    importedFromLocal: false
  };
}

function sanitizeAnswers(candidate) {
  if (!Array.isArray(candidate) || candidate.length !== TOTAL_QUESTIONS) {
    return new Array(TOTAL_QUESTIONS).fill(null);
  }

  return candidate.map((value) => {
    if (value === null) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  });
}

function sanitizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function sanitizeMbtiType(value) {
  const raw = String(value || "").trim().toUpperCase();
  return MBTI_TYPES.includes(raw) ? raw : null;
}

function sanitizeMbtiSource(value) {
  return value === "manual" || value === "test" ? value : "none";
}

function sanitizeScenario(scenario) {
  return SCENARIOS.includes(scenario) ? scenario : SCENARIOS[0];
}

function sanitizeConversationId(value) {
  const raw = String(value || "").trim();
  return raw ? raw : null;
}

function sanitizeRadar(radar) {
  if (!Array.isArray(radar)) return [];
  return radar
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .slice(0, 8);
}

function sanitizeCoreState(candidate) {
  const base = defaultCoreState();
  const source = candidate || {};
  const mbti = sanitizeMbtiType(source.mbti);
  const mbtiSource = mbti ? sanitizeMbtiSource(source.mbtiSource) : "none";

  return {
    currentQuestion: Math.min(TOTAL_QUESTIONS - 1, Math.max(0, Number(source.currentQuestion) || 0)),
    answers: sanitizeAnswers(source.answers),
    mbti,
    mbtiSource,
    reliability: mbtiSource === "test" ? Math.max(0, Math.min(100, Number(source.reliability) || 0)) : 0,
    match: mbtiSource === "test" ? Math.max(0, Math.min(100, Number(source.match) || 0)) : 0,
    radar: mbti ? sanitizeRadar(source.radar) : [],
    selectedScenario: sanitizeScenario(source.selectedScenario || base.selectedScenario),
    activeAiConversationId: sanitizeConversationId(source.activeAiConversationId),
    theme: sanitizeTheme(source.theme || base.theme),
    onboardingCompleted: Boolean(source.onboardingCompleted),
    importedFromLocal: Boolean(source.importedFromLocal)
  };
}

function parseJsonOrFallback(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function sanitizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return "";
  return raw.replace(/\/+$/, "");
}

function sanitizeAiModel(value) {
  return validateModelName(value, DEFAULT_AI_MODEL);
}

function sanitizeAiProvider(value) {
  const raw = String(value || "").trim();
  return raw === "gemini_native" ? "gemini_native" : DEFAULT_AI_PROVIDER;
}

function normalizeProviderBaseUrl(provider, value) {
  const raw = sanitizeBaseUrl(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (
      sanitizeAiProvider(provider) === DEFAULT_AI_PROVIDER &&
      url.hostname === "api.openai.com" &&
      (!url.pathname || url.pathname === "/")
    ) {
      url.pathname = "/v1";
    }
    return url.toString().replace(/\/+$/, "");
  } catch (error) {
    return raw;
  }
}

function maskApiKey(apiKey) {
  const raw = String(apiKey || "").trim();
  if (!raw) return "";
  return raw.length <= 8 ? "已保存" : `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

function ensureUserState(userId) {
  const existing = db.prepare("SELECT user_id FROM user_state WHERE user_id = ?").get(userId);
  if (existing) return;

  const defaults = defaultCoreState();
  db.prepare(
    `INSERT INTO user_state (
      user_id,
      current_question,
      answers_json,
      mbti_type,
      mbti_source,
      reliability,
      match_score,
      radar_json,
      selected_scenario,
      theme,
      onboarding_completed,
      imported_from_local,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    defaults.currentQuestion,
    JSON.stringify(defaults.answers),
    defaults.mbti,
    defaults.mbtiSource,
    defaults.reliability,
    defaults.match,
    JSON.stringify(defaults.radar),
    defaults.selectedScenario,
    defaults.theme,
    defaults.onboardingCompleted ? 1 : 0,
    defaults.importedFromLocal ? 1 : 0,
    nowIso()
  );
}

function ensureAiSettings(userId) {
  const existing = db.prepare("SELECT user_id FROM ai_settings WHERE user_id = ?").get(userId);
  if (existing) return;

  db.prepare(
    `INSERT INTO ai_settings (user_id, api_key, base_url, model, provider, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, "", "", DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER, nowIso());
}

function getStoredAiSettings(userId) {
  ensureAiSettings(userId);
  const row = db.prepare("SELECT * FROM ai_settings WHERE user_id = ?").get(userId);
  const provider = sanitizeAiProvider(row.provider);
  return {
    apiKey: String(row.api_key || "").trim(),
    baseUrl: normalizeProviderBaseUrl(provider, row.base_url),
    model: sanitizeAiModel(row.model),
    provider
  };
}

function getPublicAiSettings(userId) {
  const settings = getStoredAiSettings(userId);
  return {
    baseUrl: settings.baseUrl,
    model: settings.model,
    provider: settings.provider,
    hasApiKey: Boolean(settings.apiKey),
    apiKeyMasked: maskApiKey(settings.apiKey)
  };
}

function writeAiSettings(userId, candidate) {
  const current = getStoredAiSettings(userId);
  const nextProvider = candidate.provider !== undefined ? sanitizeAiProvider(candidate.provider) : current.provider;
  const nextApiKey = String(candidate.apiKey || "").trim() || current.apiKey;
  const nextBaseUrl = candidate.baseUrl !== undefined
    ? normalizeProviderBaseUrl(nextProvider, candidate.baseUrl)
    : normalizeProviderBaseUrl(nextProvider, current.baseUrl);
  const nextModel = candidate.model !== undefined ? sanitizeAiModel(candidate.model) : current.model;

  db.prepare(
    `UPDATE ai_settings
     SET api_key = ?,
         base_url = ?,
         model = ?,
         provider = ?,
         updated_at = ?
     WHERE user_id = ?`
  ).run(nextApiKey, nextBaseUrl, nextModel, nextProvider, nowIso(), userId);

  return getPublicAiSettings(userId);
}

function getCoreState(userId) {
  ensureUserState(userId);
  const row = db.prepare("SELECT * FROM user_state WHERE user_id = ?").get(userId);

  return sanitizeCoreState({
    currentQuestion: row.current_question,
    answers: parseJsonOrFallback(row.answers_json, new Array(TOTAL_QUESTIONS).fill(null)),
    mbti: row.mbti_type,
    mbtiSource: row.mbti_source || (row.mbti_type ? "test" : "none"),
    reliability: row.reliability,
    match: row.match_score,
    radar: parseJsonOrFallback(row.radar_json, []),
    selectedScenario: row.selected_scenario,
    activeAiConversationId: row.active_ai_conversation_id,
    theme: row.theme,
    onboardingCompleted: row.onboarding_completed === 1,
    importedFromLocal: row.imported_from_local === 1
  });
}

function writeCoreState(userId, candidate) {
  const state = sanitizeCoreState(candidate);

  db.prepare(
    `UPDATE user_state
     SET current_question = ?,
         answers_json = ?,
         mbti_type = ?,
         mbti_source = ?,
         reliability = ?,
         match_score = ?,
         radar_json = ?,
         selected_scenario = ?,
         active_ai_conversation_id = ?,
         theme = ?,
         onboarding_completed = ?,
         imported_from_local = ?,
         updated_at = ?
     WHERE user_id = ?`
  ).run(
    state.currentQuestion,
    JSON.stringify(state.answers),
    state.mbti,
    state.mbtiSource,
    state.reliability,
    state.match,
    JSON.stringify(state.radar),
    state.selectedScenario,
    state.activeAiConversationId,
    state.theme,
    state.onboardingCompleted ? 1 : 0,
    state.importedFromLocal ? 1 : 0,
    nowIso(),
    userId
  );

  return state;
}

function formatActivityRow(row) {
  return `${new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })} - ${row.text}`;
}

function getUserSummary(userId) {
  const user = db.prepare("SELECT id, username, email, created_at FROM users WHERE id = ?").get(userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email || "",
    createdAt: user.created_at
  };
}

function buildConversationTitle(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "新的对话";
  return normalized.length > 26 ? `${normalized.slice(0, 26)}...` : normalized;
}

function getConversationRow(userId, conversationId) {
  const safeConversationId = sanitizeConversationId(conversationId);
  if (!safeConversationId) return null;

  return db.prepare(
    `SELECT id, user_id, title, scenario, created_at, updated_at, last_message_at
     FROM ai_conversations
     WHERE id = ? AND user_id = ?`
  ).get(safeConversationId, userId) || null;
}

function getLatestConversationId(userId) {
  const row = db.prepare(
    `SELECT id
     FROM ai_conversations
     WHERE user_id = ?
     ORDER BY last_message_at DESC, created_at DESC
     LIMIT 1`
  ).get(userId);

  return row ? row.id : null;
}

function setActiveConversation(userId, conversationId) {
  const current = getCoreState(userId);
  writeCoreState(userId, {
    ...current,
    activeAiConversationId: sanitizeConversationId(conversationId)
  });
}

function createConversationRecord(userId, scenario, firstMessage, timestamp = nowIso()) {
  const conversationId = generateId();
  const safeScenario = sanitizeScenario(scenario);
  const title = buildConversationTitle(firstMessage);

  db.prepare(
    `INSERT INTO ai_conversations (id, user_id, title, scenario, created_at, updated_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(conversationId, userId, title, safeScenario, timestamp, timestamp, timestamp);

  return getConversationRow(userId, conversationId);
}

function updateConversationAfterReply(userId, conversationId, scenario, timestamp = nowIso()) {
  db.prepare(
    `UPDATE ai_conversations
     SET scenario = ?, updated_at = ?, last_message_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(sanitizeScenario(scenario), timestamp, timestamp, conversationId, userId);
}

function syncConversationAfterTurnDeletion(userId, conversationId) {
  const safeConversationId = sanitizeConversationId(conversationId);
  if (!safeConversationId) return;

  const latestTurn = db.prepare(
    `SELECT scenario, created_at
     FROM ai_history
     WHERE user_id = ? AND conversation_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`
  ).get(userId, safeConversationId);

  if (!latestTurn) {
    db.prepare("DELETE FROM ai_conversations WHERE id = ? AND user_id = ?").run(safeConversationId, userId);
    const core = getCoreState(userId);
    if (core.activeAiConversationId === safeConversationId) {
      setActiveConversation(userId, getLatestConversationId(userId));
    }
    return;
  }

  db.prepare(
    `UPDATE ai_conversations
     SET scenario = ?, updated_at = ?, last_message_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(sanitizeScenario(latestTurn.scenario), nowIso(), latestTurn.created_at, safeConversationId, userId);
}

function getConversationSummaries(userId) {
  const rows = db.prepare(
    `SELECT c.id, c.title, c.scenario, c.created_at, c.updated_at, c.last_message_at,
            (SELECT COUNT(*) FROM ai_history h WHERE h.conversation_id = c.id) AS turn_count,
            (SELECT response_json FROM ai_history h WHERE h.conversation_id = c.id ORDER BY h.created_at DESC, h.id DESC LIMIT 1) AS latest_response_json
     FROM ai_conversations c
     WHERE c.user_id = ?
     ORDER BY c.last_message_at DESC, c.created_at DESC`
  ).all(userId);

  return rows.map((row) => {
    const latestResponse = sanitizeStoredCoachResponse(parseJsonOrFallback(row.latest_response_json, null));
    const previewText = extractReplyText(latestResponse) || row.title;
    return {
      id: row.id,
      title: row.title,
      scenario: row.scenario,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      preview: previewText.length > 90 ? `${previewText.slice(0, 90)}...` : previewText,
      turnCount: Number(row.turn_count) || 0
    };
  });
}

function getConversationMessages(userId, conversationId) {
  const conversation = getConversationRow(userId, conversationId);
  if (!conversation) return [];

  const turns = db.prepare(
    `SELECT id, goal, details, response_json, created_at
     FROM ai_history
     WHERE user_id = ? AND conversation_id = ?
     ORDER BY created_at ASC, id ASC`
  ).all(userId, conversation.id);

  const messages = [];
  turns.forEach((row) => {
    const response = sanitizeStoredCoachResponse(parseJsonOrFallback(row.response_json, null));

    messages.push({
      id: `${row.id}:user`,
      turnId: row.id,
      historyId: row.id,
      role: "user",
      text: row.goal,
      details: String(row.details || ""),
      createdAt: row.created_at
    });

    messages.push({
      id: `${row.id}:assistant`,
      turnId: row.id,
      historyId: row.id,
      role: "assistant",
      text: extractReplyText(response) || "我已经收到你的消息。",
      structuredPlan: response && response.structuredPlan ? response.structuredPlan : null,
      createdAt: row.created_at
    });
  });

  return messages;
}
function getPlanBookEntries(userId) {
  const entryRows = db.prepare(
    `SELECT id, user_id, source_history_id, conversation_id, source_group_index, source_plan_index,
            group_name, group_description, plan_name, plan_description, estimated_days, completion_threshold,
            status, achieved_at, created_at, updated_at
     FROM plan_book_entries
     WHERE user_id = ?
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC, created_at DESC`
  ).all(userId);

  const taskRows = db.prepare(
    `SELECT t.id, t.entry_id, t.task_description, t.done, t.sort_order, t.completed_at, t.created_at, t.updated_at
     FROM plan_book_tasks t
     JOIN plan_book_entries e ON e.id = t.entry_id
     WHERE e.user_id = ?
     ORDER BY t.sort_order ASC, t.created_at ASC`
  ).all(userId);

  const tasksByEntry = new Map();
  taskRows.forEach((row) => {
    const list = tasksByEntry.get(row.entry_id) || [];
    list.push({
      id: row.id,
      taskDescription: row.task_description,
      done: row.done === 1,
      sortOrder: Number(row.sort_order) || 0,
      completedAt: row.completed_at || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    });
    tasksByEntry.set(row.entry_id, list);
  });

  return entryRows.map((row) => {
    const tasks = tasksByEntry.get(row.id) || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.done).length;
    const completionThreshold = Math.max(0, Math.min(1, Number(row.completion_threshold) || 0.75));
    const completionRatio = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;
    const status = totalTasks > 0 && completionRatio >= completionThreshold ? "achieved" : "active";

    return {
      id: row.id,
      sourceHistoryId: row.source_history_id,
      conversationId: row.conversation_id || null,
      sourceGroupIndex: Number(row.source_group_index) || 0,
      sourcePlanIndex: Number(row.source_plan_index) || 0,
      groupName: row.group_name,
      groupDescription: row.group_description,
      planName: row.plan_name,
      planDescription: row.plan_description,
      estimatedDays: Math.max(1, Number(row.estimated_days) || 14),
      completionThreshold,
      status,
      achievedAt: status === "achieved" ? String(row.achieved_at || "") : "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      totalTasks,
      completedTasks,
      completionRatio,
      tasks
    };
  });
}

function getPlanBookStats(entries) {
  const items = Array.isArray(entries) ? entries : [];
  const activeEntries = items.filter((entry) => entry.status !== "achieved");
  const achievedEntries = items.filter((entry) => entry.status === "achieved");
  const totalTaskCount = items.reduce((sum, entry) => sum + (Number(entry.totalTasks) || 0), 0);
  const completedTaskCount = items.reduce((sum, entry) => sum + (Number(entry.completedTasks) || 0), 0);
  const overallCompletionRatio = totalTaskCount ? Number((completedTaskCount / totalTaskCount).toFixed(4)) : 0;
  const currentPlanProgress = activeEntries[0]
    ? {
        entryId: activeEntries[0].id,
        planName: activeEntries[0].planName,
        completionRatio: activeEntries[0].completionRatio,
        completionThreshold: activeEntries[0].completionThreshold,
        completedTasks: activeEntries[0].completedTasks,
        totalTasks: activeEntries[0].totalTasks,
        estimatedDays: activeEntries[0].estimatedDays
      }
    : null;
  const recentAchieved = achievedEntries.length
    ? achievedEntries
        .slice()
        .sort((a, b) => new Date(b.achievedAt || b.updatedAt || 0).getTime() - new Date(a.achievedAt || a.updatedAt || 0).getTime())[0]
    : null;

  return {
    activeCount: activeEntries.length,
    achievedCount: achievedEntries.length,
    totalTaskCount,
    completedTaskCount,
    overallCompletionRatio,
    overallProgressPercent: Math.round(overallCompletionRatio * 100),
    currentPlanProgress,
    recentAchieved: recentAchieved
      ? {
          entryId: recentAchieved.id,
          planName: recentAchieved.planName,
          achievedAt: recentAchieved.achievedAt || recentAchieved.updatedAt || ""
        }
      : null
  };
}

function recalculatePlanBookEntryStatus(entryId) {
  const entry = db.prepare(
    `SELECT id, user_id, plan_name, completion_threshold, status, achieved_at
     FROM plan_book_entries
     WHERE id = ?`
  ).get(entryId);

  if (!entry) return null;

  const counts = db.prepare(
    `SELECT COUNT(*) AS total_tasks, COALESCE(SUM(done), 0) AS completed_tasks
     FROM plan_book_tasks
     WHERE entry_id = ?`
  ).get(entryId);

  const totalTasks = Number(counts.total_tasks) || 0;
  const completedTasks = Number(counts.completed_tasks) || 0;
  const completionRatio = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;
  const completionThreshold = Math.max(0, Math.min(1, Number(entry.completion_threshold) || 0.75));
  const nextStatus = totalTasks > 0 && completionRatio >= completionThreshold ? "achieved" : "active";
  const achievedAt = nextStatus === "achieved" ? (entry.achieved_at || nowIso()) : null;

  db.prepare(
    `UPDATE plan_book_entries
     SET status = ?, achieved_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(nextStatus, achievedAt, nowIso(), entryId);

  return {
    ...entry,
    totalTasks,
    completedTasks,
    completionRatio,
    completionThreshold,
    status: nextStatus,
    achievedAt,
    statusChanged: entry.status !== nextStatus
  };
}

function getStructuredPlanFromHistory(userId, sourceHistoryId) {
  const history = db.prepare(
    `SELECT id, conversation_id, response_json
     FROM ai_history
     WHERE id = ? AND user_id = ?`
  ).get(sourceHistoryId, userId);

  if (!history) return null;

  const response = sanitizeStoredCoachResponse(parseJsonOrFallback(history.response_json, null));
  const structuredPlan = response && response.structuredPlan ? response.structuredPlan : null;
  if (!structuredPlan) return null;

  return { history, response, structuredPlan };
}

function migrateLegacyAiHistoryConversations() {
  const legacyRows = db.prepare(
    `SELECT id, user_id, scenario, goal, created_at
     FROM ai_history
     WHERE conversation_id IS NULL OR trim(conversation_id) = ''
     ORDER BY created_at ASC, id ASC`
  ).all();

  if (!legacyRows.length) return;

  const insertConversation = db.prepare(
    `INSERT OR IGNORE INTO ai_conversations (id, user_id, title, scenario, created_at, updated_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const updateHistory = db.prepare("UPDATE ai_history SET conversation_id = ? WHERE id = ?");

  legacyRows.forEach((row) => {
    const timestamp = row.created_at || nowIso();
    const conversationId = generateId();
    insertConversation.run(
      conversationId,
      row.user_id,
      buildConversationTitle(row.goal),
      sanitizeScenario(row.scenario),
      timestamp,
      timestamp,
      timestamp
    );
    updateHistory.run(conversationId, row.id);
  });
}

function getAppState(userId) {
  let core = getCoreState(userId);
  const normalizedActiveConversationId = core.activeAiConversationId
    ? (getConversationRow(userId, core.activeAiConversationId) ? core.activeAiConversationId : getLatestConversationId(userId))
    : null;

  if (normalizedActiveConversationId !== core.activeAiConversationId) {
    core = writeCoreState(userId, {
      ...core,
      activeAiConversationId: normalizedActiveConversationId
    });
  }

  const todos = db.prepare(
    `SELECT id, text, done, created_at, updated_at
     FROM todos
     WHERE user_id = ?
     ORDER BY created_at DESC`
  ).all(userId).map((row) => ({
    id: row.id,
    text: row.text,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  const activities = db.prepare(
    `SELECT id, kind, text, created_at
     FROM activities
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 12`
  ).all(userId).map(formatActivityRow);

  const aiConversations = getConversationSummaries(userId);
  const activeConversationMessages = normalizedActiveConversationId
    ? getConversationMessages(userId, normalizedActiveConversationId)
    : [];
  const planBookEntries = getPlanBookEntries(userId);
  const planBookStats = getPlanBookStats(planBookEntries);

  return {
    ...core,
    ...getBackendDescriptor(),
    todos,
    activities,
    aiConversations,
    activeAiConversationId: normalizedActiveConversationId,
    activeConversationMessages,
    planBookEntries,
    planBookStats,
    aiSettings: getPublicAiSettings(userId)
  };
}

function getBackendDescriptor() {
  return {
    backendBuild: APP_BUILD,
    backendCapabilities: {
      ...BACKEND_CAPABILITIES
    }
  };
}

function buildAppPayload(userId) {
  return {
    user: getUserSummary(userId),
    state: getAppState(userId),
    ...getBackendDescriptor()
  };
}

function hashPassword(password, saltHex) {
  return crypto.scryptSync(password, saltHex, 64);
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt).toString("hex");
  return {
    salt,
    hash
  };
}

function verifyPassword(password, saltHex, storedHashHex) {
  const actual = hashPassword(password, saltHex);
  const expected = Buffer.from(storedHashHex, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function buildFallbackPlan({ scenario, goal }) {
  const displayScenario = scenario || "通用成长场景";
  const displayGoal = goal || "提升表达与行动一致性";
  return {
    summary: `这是一个适用于“${displayScenario}”的温和改进行动方案。`,
    steps: [
      `先写下1句你希望达成的结果：${displayGoal}`,
      "把它拆成一个5分钟内可执行的小动作，并马上开始。",
      "完成后记录1条反馈：哪里做得好、下一步想微调什么。"
    ],
    reflectionQuestion: "你觉得这三个步骤里，哪一步最容易从今天开始？",
    taskSuggestion: `${displayScenario}：完成一次小步骤实践`
  };
}

function buildFallbackChatReply({ scenario, message, details }) {
  const displayScenario = scenario || "当前场景";
  const displayMessage = String(message || "").trim() || "想更好地理解自己";
  const extra = String(details || "").trim();

  return [
    `我理解你在“${displayScenario}”里的困扰：${displayMessage}。`,
    extra ? `你补充的是：${extra}。` : "",
    "我们先不用一下子解决全部问题，可以先把它拆成今天能做的一步。",
    "1. 先说出这次最想改善的一件事。",
    "2. 把目标缩小到今天十分钟内能完成的动作。",
    "3. 做完后把感受告诉我，我再陪你继续往下拆。"
  ].filter(Boolean).join("\n");
}

function extractErrorMessage(error) {
  if (!error) return "未知错误";

  const direct = String(
    error?.error?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "未知错误"
  ).trim();

  return direct.replace(/\s+/g, " ").slice(0, 220);
}

function sanitizeAiReplyText(rawText) {
  const normalized = String(rawText || "")
    .replace(/\r\n?/g, "\n")
    .replace(/```+/g, "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[★☆◆◇■□●○◎◉•▪▫▶▷▸▹▻►➤➥➔→←↑↓※]/g, "")
    .replace(/【([^】]+)】/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/[^\S\n]+/g, " ")
    .trim();

  const lines = normalized.split("\n");
  const cleanedLines = [];
  let listIndex = 0;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      listIndex = 0;
      if (cleanedLines[cleanedLines.length - 1] !== "") {
        cleanedLines.push("");
      }
      continue;
    }

    line = line.replace(/^#{1,6}\s*/, "");
    line = line.replace(/^>+\s*/, "");

    const numberedMatch = line.match(/^\d+[\.)]\s*(.+)$/);
    const bulletMatch = line.match(/^[-*+•·]\s*(.+)$/);

    if (numberedMatch || bulletMatch) {
      listIndex += 1;
      const content = (numberedMatch ? numberedMatch[1] : bulletMatch[1]).trim();
      cleanedLines.push(`${listIndex}. ${content}`);
      continue;
    }

    listIndex = 0;
    cleanedLines.push(line);
  }

  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeStoredCoachResponse(response) {
  if (!response || typeof response !== "object") {
    return response;
  }

  return {
    ...response,
    reply: response.reply !== undefined ? sanitizeAiReplyText(response.reply) : response.reply,
    summary: response.summary !== undefined ? sanitizeAiReplyText(response.summary) : response.summary,
    steps: Array.isArray(response.steps) ? response.steps.map((item) => sanitizeAiReplyText(item)).filter(Boolean) : response.steps,
    reflectionQuestion:
      response.reflectionQuestion !== undefined ? sanitizeAiReplyText(response.reflectionQuestion) : response.reflectionQuestion,
    taskSuggestion: response.taskSuggestion !== undefined ? sanitizeAiReplyText(response.taskSuggestion) : response.taskSuggestion,
    structuredPlan: response.structuredPlan ? normalizeStructuredPlan(response.structuredPlan, null) : null
  };
}

function extractReplyText(response) {
  if (!response || typeof response !== "object") return "";

  if (response.reply) {
    return sanitizeAiReplyText(response.reply);
  }

  if (response.structuredPlan) {
    return buildStructuredPlanReply(response.structuredPlan);
  }

  if (response.summary || Array.isArray(response.steps)) {
    const steps = Array.isArray(response.steps)
      ? response.steps.map((item, index) => `${index + 1}. ${sanitizeAiReplyText(String(item || "").trim())}`).filter(Boolean)
      : [];

    return [
      sanitizeAiReplyText(String(response.summary || "").trim()),
      steps.join("\n"),
      sanitizeAiReplyText(String(response.reflectionQuestion || "").trim())
    ].filter(Boolean).join("\n");
  }

  return "";
}

function buildAiConversationContext(userId, username, conversationId, scenario, message, details) {
  const safeConversationId = sanitizeConversationId(conversationId);
  const recentHistory = safeConversationId
    ? db.prepare(
        `SELECT goal, details, response_json
         FROM ai_history
         WHERE user_id = ? AND conversation_id = ?
         ORDER BY created_at DESC
         LIMIT 12`
      ).all(userId, safeConversationId).reverse()
    : [];

  const historyMessages = recentHistory.flatMap((row) => {
    const assistantText = extractReplyText(parseJsonOrFallback(row.response_json, null));
    const userText = row.details ? `${row.goal}

补充背景：${row.details}` : row.goal;
    const pair = [];

    if (userText) {
      pair.push({ role: "user", content: userText.slice(0, 3000) });
    }

    if (assistantText) {
      pair.push({ role: "assistant", content: assistantText.slice(0, 3000) });
    }

    return pair;
  });

  return {
    systemContext: `用户名称：${username}
当前场景：${scenario}
MBTI：${getCoreState(userId).mbti || "未完成测试"}`,
    historyMessages,
    userMessage: details ? `${message}

补充背景：${details}` : message
  };
}

async function readJsonResponseSafe(response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return {
      message: rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    };
  }
}

function extractOpenAiCompatibleReply(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      return part && typeof part.text === "string" ? part.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiReply(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function requestOpenAiCompatibleChat({ apiKey, baseUrl, model, systemPrompt, systemContext, historyMessages, userMessage }) {
  const resolvedBaseUrl = normalizeProviderBaseUrl(DEFAULT_AI_PROVIDER, baseUrl) || "https://api.openai.com/v1";
  const response = await fetch(`${resolvedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...(systemContext ? [{ role: "system", content: systemContext }] : []),
        ...historyMessages,
        { role: "user", content: userMessage }
      ]
    })
  });

  const payload = await readJsonResponseSafe(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }

  const rawReply = extractOpenAiCompatibleReply(payload);
  const reply = sanitizeAiReplyText(rawReply);
  if (!reply) {
    throw new Error("AI 没有返回可用内容");
  }

  return {
    rawReply,
    reply,
    resolvedBaseUrl
  };
}

async function requestGeminiNativeChat({ apiKey, baseUrl, model, systemPrompt, systemContext, historyMessages, userMessage }) {
  const resolvedBaseUrl = normalizeProviderBaseUrl("gemini_native", baseUrl) || DEFAULT_GEMINI_BASE_URL;
  const response = await fetch(
    `${resolvedBaseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: [systemPrompt, systemContext].filter(Boolean).join("\n\n")
            }
          ]
        },
        contents: [
          ...historyMessages.map((item) => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: String(item.content || "").slice(0, 3000) }]
          })),
          {
            role: "user",
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.7
        }
      })
    }
  );

  const payload = await readJsonResponseSafe(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }

  const rawReply = extractGeminiReply(payload);
  const reply = sanitizeAiReplyText(rawReply);
  if (!reply) {
    throw new Error("AI 没有返回可用内容");
  }

  return {
    rawReply,
    reply,
    resolvedBaseUrl
  };
}

async function requestAiChat(options) {
  const provider = sanitizeAiProvider(options.provider);
  if (provider === "gemini_native") {
    return requestGeminiNativeChat({ ...options, provider });
  }

  return requestOpenAiCompatibleChat({ ...options, provider });
}

function parseCoachJson(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    throw new Error("Empty AI response");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw error;
    }
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }
}

function normalizeCoachResponse(candidate, fallbackInput) {
  const fallback = buildFallbackPlan(fallbackInput);
  if (!candidate || typeof candidate !== "object") return fallback;

  const steps = Array.isArray(candidate.steps)
    ? candidate.steps.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
    : [];

  if (steps.length < 3) {
    return fallback;
  }

  return {
    summary: String(candidate.summary || fallback.summary),
    steps,
    reflectionQuestion: String(candidate.reflectionQuestion || fallback.reflectionQuestion),
    taskSuggestion: String(candidate.taskSuggestion || fallback.taskSuggestion)
  };
}
function clampInteger(value, fallback, min, max) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function clampThreshold(value, fallback = 0.75) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0.3, Math.min(1, Number(numeric.toFixed(2))));
}

function cleanPlanText(value, fallback = "") {
  const cleaned = sanitizeAiReplyText(String(value || "").replace(/\s+/g, " ").trim());
  return cleaned || fallback;
}

function buildFallbackStructuredPlan({ scenario, goal }) {
  const displayScenario = cleanPlanText(scenario || "通用成长场景", "通用成长场景");
  const displayGoal = cleanPlanText(goal || "提升表达与行动一致性", "提升表达与行动一致性");

  return {
    plan_groups: [
      {
        group_name: "认知准备",
        group_description: `先降低在“${displayScenario}”里的心理阻力。`,
        plans: [
          {
            plan_name: "目标拆小计划",
            plan_description: `把“${displayGoal}”拆成今天就能开始的小动作。`,
            estimated_days: 7,
            completion_threshold: 0.67,
            tasks: [
              { task_description: `写下这次最想改善的 1 个具体场景：${displayScenario}` },
              { task_description: "把目标缩小成 10 分钟内能完成的一步" },
              { task_description: "今天就完成这一步，并记录感受" }
            ]
          },
          {
            plan_name: "心理预演计划",
            plan_description: "先在低压力环境里做预演，减少真正行动时的卡顿。",
            estimated_days: 7,
            completion_threshold: 0.67,
            tasks: [
              { task_description: "每天花 3 分钟想象自己完成目标的样子" },
              { task_description: "提前写下 1 句想说的话或想做的动作" },
              { task_description: "练习后记录哪里最容易卡住" }
            ]
          }
        ]
      },
      {
        group_name: "行动练习",
        group_description: "用一组可勾选的小任务逐步建立新的行为习惯。",
        plans: [
          {
            plan_name: "低压试水计划",
            plan_description: "先在压力较低的情境里完成几次小尝试。",
            estimated_days: 14,
            completion_threshold: 0.75,
            tasks: [
              { task_description: "本周挑 1 次低压力场景主动表达 1 句话" },
              { task_description: "每次行动前先做 1 次深呼吸" },
              { task_description: "行动后用 1 句话记录结果" },
              { task_description: "把下一次尝试时间写进日程" }
            ]
          },
          {
            plan_name: "固定频率计划",
            plan_description: "用稳定频率重复练习，避免只靠一时冲劲。",
            estimated_days: 14,
            completion_threshold: 0.75,
            tasks: [
              { task_description: "每周至少完成 3 次同类练习" },
              { task_description: "每次练习只设定 1 个最小成功标准" },
              { task_description: "练习后记录 1 个做得好的地方" },
              { task_description: "连续两周保持固定频率" }
            ]
          }
        ]
      },
      {
        group_name: "复盘巩固",
        group_description: "把零散的练习沉淀成稳定可持续的改变。",
        plans: [
          {
            plan_name: "每周复盘计划",
            plan_description: "通过复盘找出最有效的动作，减少无效消耗。",
            estimated_days: 14,
            completion_threshold: 0.67,
            tasks: [
              { task_description: "每周固定 1 次复盘本周完成情况" },
              { task_description: "写下 1 个最有效的动作和 1 个阻碍点" },
              { task_description: "为下一周保留 1 个继续执行的动作" }
            ]
          },
          {
            plan_name: "稳定维持计划",
            plan_description: "在已经有进步后，继续维持新的行为节奏。",
            estimated_days: 21,
            completion_threshold: 0.67,
            tasks: [
              { task_description: "把最有效的 2 个动作保留下来" },
              { task_description: "连续 3 周每周至少执行 1 次" },
              { task_description: "每周记录一次自己变化最明显的地方" }
            ]
          }
        ]
      }
    ]
  };
}

function normalizeStructuredPlan(candidate, fallbackInput = null) {
  const fallback = fallbackInput ? buildFallbackStructuredPlan(fallbackInput) : null;
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.plan_groups)) {
    return fallback;
  }

  const groups = candidate.plan_groups
    .slice(0, 4)
    .map((group, groupIndex) => {
      const groupName = cleanPlanText(group && group.group_name, `计划分组 ${groupIndex + 1}`);
      const groupDescription = cleanPlanText(group && group.group_description, `${groupName} 的执行说明。`);
      const plans = Array.isArray(group && group.plans)
        ? group.plans
            .slice(0, 3)
            .map((plan, planIndex) => {
              const tasks = Array.isArray(plan && plan.tasks)
                ? plan.tasks
                    .slice(0, 6)
                    .map((task, taskIndex) => ({
                      task_description: cleanPlanText(task && task.task_description, `完成第 ${taskIndex + 1} 个练习动作`)
                    }))
                    .filter((task) => task.task_description)
                : [];

              if (tasks.length < 3) return null;

              return {
                plan_name: cleanPlanText(plan && plan.plan_name, `${groupName}计划 ${planIndex + 1}`),
                plan_description: cleanPlanText(plan && plan.plan_description, `围绕 ${groupName} 展开的一组可执行动作。`),
                estimated_days: clampInteger(plan && plan.estimated_days, 14, 3, 60),
                completion_threshold: clampThreshold(plan && plan.completion_threshold, 0.75),
                tasks
              };
            })
            .filter(Boolean)
        : [];

      if (plans.length < 2) return null;

      return {
        group_name: groupName,
        group_description: groupDescription,
        plans
      };
    })
    .filter(Boolean);

  if (groups.length < 2) {
    return fallback;
  }

  return { plan_groups: groups };
}

function buildStructuredPlanReply(structuredPlan) {
  const plan = normalizeStructuredPlan(structuredPlan, null);
  if (!plan) {
    return "我已经为你整理出一套可执行计划，你可以先选择一个计划加入计划簿。";
  }

  const groupNames = plan.plan_groups.map((group) => group.group_name).slice(0, 3).join(" / ");
  const firstPlan = plan.plan_groups[0] && plan.plan_groups[0].plans[0] ? plan.plan_groups[0].plans[0].plan_name : "第一步计划";
  return `我已经把你的目标拆成 ${plan.plan_groups.length} 组计划：${groupNames}。你可以先从“${firstPlan}”开始，加入计划簿后按任务逐项打钩推进。`;
}

async function requestStructuredPlanFromAi({ provider, apiKey, baseUrl, model, systemContext, historyMessages, userMessage, fallbackInput }) {
  const parseStructuredPlanFromText = (rawText) => {
    const parsed = parseCoachJson(rawText);
    const structuredPlan = normalizeStructuredPlan(parsed, null);
    if (!structuredPlan) {
      throw new Error("invalid structured plan");
    }
    return structuredPlan;
  };

  const primaryResult = await requestAiChat({
    provider,
    apiKey,
    baseUrl,
    model,
    systemPrompt: STRUCTURED_PLAN_PROMPT,
    systemContext,
    historyMessages,
    userMessage
  });

  try {
    return {
      structuredPlan: parseStructuredPlanFromText(primaryResult.rawReply || primaryResult.reply),
      result: primaryResult
    };
  } catch (primaryParseError) {
    const rawToRepair = String(primaryResult.rawReply || primaryResult.reply || "").trim();
    if (!rawToRepair) {
      const fallbackPlan = buildFallbackStructuredPlan(fallbackInput);
      return {
        structuredPlan: fallbackPlan,
        result: {
          rawReply: "",
          reply: buildStructuredPlanReply(fallbackPlan),
          resolvedBaseUrl: primaryResult.resolvedBaseUrl || normalizeProviderBaseUrl(provider, baseUrl) || ""
        }
      };
    }

    try {
      const repairResult = await requestAiChat({
        provider,
        apiKey,
        baseUrl,
        model,
        systemPrompt: STRUCTURED_PLAN_REPAIR_PROMPT,
        systemContext: "",
        historyMessages: [],
        userMessage: `请把下面内容修复为合法 JSON 对象，并且不要输出任何额外文字：\n${rawToRepair}`
      });

      return {
        structuredPlan: parseStructuredPlanFromText(repairResult.rawReply || repairResult.reply),
        result: repairResult
      };
    } catch (repairError) {
      const fallbackPlan = buildFallbackStructuredPlan(fallbackInput);
      return {
        structuredPlan: fallbackPlan,
        result: {
          rawReply: "",
          reply: buildStructuredPlanReply(fallbackPlan),
          resolvedBaseUrl: primaryResult.resolvedBaseUrl || normalizeProviderBaseUrl(provider, baseUrl) || ""
        }
      };
    }
  }
}

function recordActivity(userId, kind, text, createdAt = nowIso()) {
  db.prepare(
    `INSERT INTO activities (id, user_id, kind, text, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(generateId(), userId, kind, text, createdAt);
}

function getImportedActivityText(item) {
  const raw = String(item || "").trim();
  if (!raw) return "";
  const marker = raw.indexOf(" - ");
  return marker >= 0 ? raw.slice(marker + 3).trim() : raw;
}

function getProgressSummary(text) {
  const raw = String(text || "").trim();
  return raw.length > 18 ? `${raw.slice(0, 18)}...` : raw;
}

const questionBank = buildQuestions();

function computeMbtiFromAnswers(answers) {
  const safeAnswers = sanitizeAnswers(answers);
  if (safeAnswers.some((value) => value === null)) {
    return null;
  }

  const scores = { IE: 0, NS: 0, FT: 0, PJ: 0 };
  questionBank.forEach((question, idx) => {
    scores[question.dimension] += safeAnswers[idx];
  });

  const mbti = [
    scores.IE >= 0 ? "E" : "I",
    scores.NS >= 0 ? "S" : "N",
    scores.FT >= 0 ? "T" : "F",
    scores.PJ >= 0 ? "J" : "P"
  ].join("");

  const avgAbs = safeAnswers.reduce((sum, value) => sum + Math.abs(value), 0) / TOTAL_QUESTIONS;
  const balance = (Math.abs(scores.IE) + Math.abs(scores.NS) + Math.abs(scores.FT) + Math.abs(scores.PJ)) / 4;

  return {
    mbti,
    reliability: Math.round(72 + Math.min(25, avgAbs * 12)),
    match: Math.round(65 + Math.min(30, balance * 2)),
    radar: buildRadarValues(mbti, scores),
    scores
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "愈格", now: nowIso(), build: APP_BUILD, capabilities: { ...BACKEND_CAPABILITIES } });
});

app.get("/api/auth/session", (req, res) => {
  if (!req.user) {
    res.json({ authenticated: false, user: null, ...getBackendDescriptor() });
    return;
  }

  res.json({
    authenticated: true,
    user: getUserSummary(req.user.id),
    ...getBackendDescriptor()
  });
});

app.post("/api/auth/register", (req, res) => {
  const validation = validateRegistrationCredentials({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  });
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE lower(username) = lower(?)").get(validation.username);
  if (existing) {
    res.status(400).json({ message: "该用户名已被注册" });
    return;
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(validation.email);
  if (existingEmail) {
    res.status(400).json({ message: "该邮箱已被注册" });
    return;
  }

  const userId = generateId();
  const timestamp = nowIso();
  const passwordRecord = createPasswordRecord(validation.password);

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, validation.username, validation.email, passwordRecord.hash, passwordRecord.salt, timestamp, timestamp);

  ensureUserState(userId);
  createSession(res, userId);

  res.status(201).json({
    ok: true,
    ...buildAppPayload(userId)
  });
});

app.post("/api/auth/login", (req, res) => {
  const validation = validateLoginCredentials({
    account: req.body.account,
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  });
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }

  const user = db.prepare(
    "SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)"
  ).get(validation.account, validation.account);
  if (!user || !verifyPassword(validation.password, user.password_salt, user.password_hash)) {
    res.status(401).json({ message: "账号或密码错误" });
    return;
  }

  ensureUserState(user.id);
  createSession(res, user.id);

  res.json({
    ok: true,
    ...buildAppPayload(user.id)
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearSession(res, req.sessionId);
  res.json({ ok: true });
});

app.get("/api/app-state", requireAuth, (req, res) => {
  res.json(buildAppPayload(req.user.id));
});

app.post("/api/app-state/import-local", requireAuth, (req, res) => {
  const current = getCoreState(req.user.id);
  if (current.importedFromLocal) {
    res.json({ imported: false, ...buildAppPayload(req.user.id) });
    return;
  }

  const sourceState = req.body && typeof req.body.state === "object" ? req.body.state : {};
  const nextState = sanitizeCoreState({
    ...current,
    currentQuestion: sourceState.currentQuestion,
    answers: sourceState.answers,
    mbti: sourceState.mbti,
    mbtiSource: sourceState.mbti ? "test" : current.mbtiSource,
    reliability: sourceState.reliability,
    match: sourceState.match,
    radar: sourceState.radar,
    selectedScenario: sourceState.selectedScenario,
    theme: sourceState.theme,
    onboardingCompleted: Boolean(req.body.onboardingCompleted || sourceState.onboardingCompleted || current.onboardingCompleted),
    importedFromLocal: true
  });

  writeCoreState(req.user.id, nextState);

  const existingTodoCount = db.prepare("SELECT COUNT(*) AS count FROM todos WHERE user_id = ?").get(req.user.id).count;
  if (existingTodoCount === 0 && Array.isArray(sourceState.todos)) {
    const insertTodo = db.prepare(
      `INSERT INTO todos (id, user_id, text, done, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    sourceState.todos.forEach((todo) => {
      const text = String(todo && todo.text ? todo.text : "").trim();
      if (!text) return;
      const timestamp = nowIso();
      insertTodo.run(generateId(), req.user.id, text, todo && todo.done ? 1 : 0, timestamp, timestamp);
    });
  }

  const existingActivityCount = db.prepare("SELECT COUNT(*) AS count FROM activities WHERE user_id = ?").get(req.user.id).count;
  if (existingActivityCount === 0 && Array.isArray(sourceState.activities)) {
    sourceState.activities
      .slice()
      .reverse()
      .forEach((activityText) => {
        const text = getImportedActivityText(activityText);
        if (!text) return;
        recordActivity(req.user.id, "imported", text);
      });
  }

  recordActivity(req.user.id, "system", "已导入本地历史数据");
  res.json({ imported: true, ...buildAppPayload(req.user.id) });
});

app.put("/api/preferences", requireAuth, (req, res) => {
  const current = getCoreState(req.user.id);
  const next = {
    ...current,
    theme: req.body.theme !== undefined ? req.body.theme : current.theme,
    selectedScenario: req.body.selectedScenario !== undefined ? req.body.selectedScenario : current.selectedScenario,
    onboardingCompleted:
      req.body.onboardingCompleted !== undefined ? Boolean(req.body.onboardingCompleted) : current.onboardingCompleted,
    importedFromLocal: current.importedFromLocal
  };

  writeCoreState(req.user.id, next);
  res.json(buildAppPayload(req.user.id));
});

app.put("/api/mbti/manual-select", requireAuth, (req, res) => {
  const mbti = sanitizeMbtiType(req.body.mbti);
  if (!mbti) {
    res.status(400).json({ message: "请选择合法的 MBTI 类型" });
    return;
  }

  const current = getCoreState(req.user.id);
  const next = {
    ...current,
    mbti,
    mbtiSource: "manual",
    reliability: 0,
    match: 0,
    radar: buildManualRadarValues(mbti),
    importedFromLocal: current.importedFromLocal
  };

  writeCoreState(req.user.id, next);
  recordActivity(req.user.id, "mbti_manual", `手动选择MBTI：${mbti}`);
  res.json(buildAppPayload(req.user.id));
});

app.put("/api/mbti/progress", requireAuth, (req, res) => {
  const current = getCoreState(req.user.id);
  const next = {
    ...current,
    currentQuestion: req.body.currentQuestion,
    answers: req.body.answers,
    importedFromLocal: current.importedFromLocal
  };

  writeCoreState(req.user.id, next);
  res.json(buildAppPayload(req.user.id));
});

app.post("/api/mbti/reset", requireAuth, (req, res) => {
  const current = getCoreState(req.user.id);
  const next = {
    ...current,
    currentQuestion: 0,
    answers: new Array(TOTAL_QUESTIONS).fill(null),
    mbti: null,
    mbtiSource: "none",
    reliability: 0,
    match: 0,
    radar: [],
    importedFromLocal: current.importedFromLocal
  };

  writeCoreState(req.user.id, next);
  recordActivity(req.user.id, "mbti_reset", "重新开始MBTI测试");
  res.json(buildAppPayload(req.user.id));
});

app.post("/api/mbti/complete", requireAuth, (req, res) => {
  const current = getCoreState(req.user.id);
  const answers = req.body.answers !== undefined ? req.body.answers : current.answers;
  const result = computeMbtiFromAnswers(answers);

  if (!result) {
    res.status(400).json({ message: "还有未完成题目，请先答完56题" });
    return;
  }

  const next = {
    ...current,
    currentQuestion: TOTAL_QUESTIONS - 1,
    answers,
    mbti: result.mbti,
    mbtiSource: "test",
    reliability: result.reliability,
    match: result.match,
    radar: result.radar,
    importedFromLocal: current.importedFromLocal
  };

  writeCoreState(req.user.id, next);
  recordActivity(req.user.id, "mbti_complete", "完成MBTI测试");

  res.json({
    result: {
      mbti: result.mbti,
      reliability: result.reliability,
      match: result.match,
      radar: result.radar
    },
    ...buildAppPayload(req.user.id)
  });
});

app.put("/api/ai-settings", requireAuth, (req, res) => {
  const rawBaseUrl = String(req.body.baseUrl || "").trim();
  if (rawBaseUrl && !sanitizeBaseUrl(rawBaseUrl)) {
    res.status(400).json({ message: "Base URL 必须以 http:// 或 https:// 开头" });
    return;
  }

  writeAiSettings(req.user.id, req.body || {});
  recordActivity(req.user.id, "ai_settings", "更新 AI 接口设置");
  res.json(buildAppPayload(req.user.id));
});

app.post("/api/ai-settings/test", requireAuth, async (req, res) => {
  const current = getStoredAiSettings(req.user.id);
  const provider = req.body.provider !== undefined ? sanitizeAiProvider(req.body.provider) : current.provider;
  const rawBaseUrl = req.body.baseUrl !== undefined ? String(req.body.baseUrl || "").trim() : current.baseUrl;
  const apiKey = String(req.body.apiKey || "").trim() || current.apiKey;
  const model = req.body.model !== undefined ? sanitizeAiModel(req.body.model) : current.model;

  if (rawBaseUrl && !sanitizeBaseUrl(rawBaseUrl)) {
    res.status(400).json({ message: "Base URL 必须以 http:// 或 https:// 开头" });
    return;
  }

  if (!apiKey) {
    res.status(400).json({ message: "请先填写 API Key，再测试接口连通性" });
    return;
  }

  try {
    const result = await requestAiChat({
      provider,
      apiKey,
      baseUrl: rawBaseUrl,
      model,
      systemPrompt: DEFAULT_AI_PROMPT,
      systemContext: `用户名称：${req.user.username}\n当前场景：AI 接口测试\nMBTI：${getCoreState(req.user.id).mbti || "未完成测试"}`,
      historyMessages: [],
      userMessage: "请用一句自然、简短的中文回复：连接测试成功，可以开始聊天了。"
    });

    res.json({
      ok: true,
      provider,
      baseUrl: result.resolvedBaseUrl,
      model,
      replyPreview: result.reply.slice(0, 160)
    });
  } catch (error) {
    res.status(502).json({ message: `AI 接口测试失败：${extractErrorMessage(error)}` });
  }
});

app.delete("/api/ai-history/:id", requireAuth, (req, res) => {
  const history = db.prepare(
    `SELECT id, conversation_id FROM ai_history WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);

  if (!history) {
    res.status(404).json({ message: "聊天记录不存在" });
    return;
  }

  db.prepare("DELETE FROM ai_history WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  syncConversationAfterTurnDeletion(req.user.id, history.conversation_id);
  res.json(buildAppPayload(req.user.id));
});

app.delete("/api/ai-history", requireAuth, (req, res) => {
  if (String(req.query.scope || "") !== "all") {
    res.status(400).json({ message: "仅支持 scope=all 的清空操作" });
    return;
  }

  db.prepare("DELETE FROM ai_history WHERE user_id = ?").run(req.user.id);
  db.prepare("DELETE FROM ai_conversations WHERE user_id = ?").run(req.user.id);
  setActiveConversation(req.user.id, null);
  res.json(buildAppPayload(req.user.id));
});

app.get("/api/ai-conversations/:id/messages", requireAuth, (req, res) => {
  const conversation = getConversationRow(req.user.id, req.params.id);
  if (!conversation) {
    res.status(404).json({ message: "会话不存在" });
    return;
  }

  res.json({
    conversation: getConversationSummaries(req.user.id).find((item) => item.id === conversation.id) || null,
    messages: getConversationMessages(req.user.id, conversation.id)
  });
});

app.post("/api/ai-conversations/active", requireAuth, (req, res) => {
  const conversationId = sanitizeConversationId(req.body.conversationId);
  if (conversationId && !getConversationRow(req.user.id, conversationId)) {
    res.status(404).json({ message: "会话不存在" });
    return;
  }

  setActiveConversation(req.user.id, conversationId);
  res.json(buildAppPayload(req.user.id));
});

app.patch("/api/ai-conversations/:id", requireAuth, (req, res) => {
  const conversation = getConversationRow(req.user.id, req.params.id);
  if (!conversation) {
    res.status(404).json({ message: "会话不存在" });
    return;
  }

  const nextScenario = req.body.scenario !== undefined ? sanitizeScenario(req.body.scenario) : conversation.scenario;
  db.prepare(
    `UPDATE ai_conversations
     SET scenario = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(nextScenario, nowIso(), conversation.id, req.user.id);

  const current = getCoreState(req.user.id);
  writeCoreState(req.user.id, {
    ...current,
    selectedScenario: nextScenario,
    activeAiConversationId: current.activeAiConversationId
  });

  res.json(buildAppPayload(req.user.id));
});

app.delete("/api/ai-conversations/:id", requireAuth, (req, res) => {
  const conversation = getConversationRow(req.user.id, req.params.id);
  if (!conversation) {
    res.status(404).json({ message: "会话不存在" });
    return;
  }

  db.prepare("DELETE FROM ai_history WHERE user_id = ? AND conversation_id = ?").run(req.user.id, conversation.id);
  db.prepare("DELETE FROM ai_conversations WHERE id = ? AND user_id = ?").run(conversation.id, req.user.id);

  const current = getCoreState(req.user.id);
  if (current.activeAiConversationId === conversation.id) {
    setActiveConversation(req.user.id, getLatestConversationId(req.user.id));
  }

  res.json(buildAppPayload(req.user.id));
});
app.post("/api/plan-book", requireAuth, (req, res) => {
  const sourceHistoryId = String(req.body.sourceHistoryId || "").trim();
  const groupIndex = Math.max(0, Math.floor(Number(req.body.groupIndex) || 0));
  const planIndex = Math.max(0, Math.floor(Number(req.body.planIndex) || 0));

  if (!sourceHistoryId) {
    res.status(400).json({ message: "缺少计划来源记录" });
    return;
  }

  const source = getStructuredPlanFromHistory(req.user.id, sourceHistoryId);
  if (!source || !source.structuredPlan || !Array.isArray(source.structuredPlan.plan_groups)) {
    res.status(404).json({ message: "这条 AI 回复里没有可加入的计划" });
    return;
  }

  const group = source.structuredPlan.plan_groups[groupIndex];
  const plan = group && Array.isArray(group.plans) ? group.plans[planIndex] : null;
  if (!group || !plan) {
    res.status(400).json({ message: "计划索引无效，请刷新后重试" });
    return;
  }

  const existing = db.prepare(
    `SELECT id
     FROM plan_book_entries
     WHERE user_id = ? AND source_history_id = ? AND source_group_index = ? AND source_plan_index = ?
       AND status = 'active'`
  ).get(req.user.id, sourceHistoryId, groupIndex, planIndex);

  if (existing) {
    res.status(409).json({ message: "这个计划已经在进行中了；完成后可以重新开始一轮" });
    return;
  }

  const timestamp = nowIso();
  const entryId = generateId();
  db.prepare(
    `INSERT INTO plan_book_entries (
      id, user_id, source_history_id, conversation_id, source_group_index, source_plan_index,
      group_name, group_description, plan_name, plan_description, estimated_days, completion_threshold,
      status, achieved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`
  ).run(
    entryId,
    req.user.id,
    sourceHistoryId,
    source.history.conversation_id || null,
    groupIndex,
    planIndex,
    cleanPlanText(group.group_name, `计划分组 ${groupIndex + 1}`),
    cleanPlanText(group.group_description, ""),
    cleanPlanText(plan.plan_name, `计划 ${planIndex + 1}`),
    cleanPlanText(plan.plan_description, ""),
    clampInteger(plan.estimated_days, 14, 3, 60),
    clampThreshold(plan.completion_threshold, 0.75),
    timestamp,
    timestamp
  );

  const insertTask = db.prepare(
    `INSERT INTO plan_book_tasks (id, entry_id, task_description, done, sort_order, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, NULL, ?, ?)`
  );

  (Array.isArray(plan.tasks) ? plan.tasks : []).forEach((task, index) => {
    insertTask.run(
      generateId(),
      entryId,
      cleanPlanText(task && task.task_description, `完成任务 ${index + 1}`),
      index,
      timestamp,
      timestamp
    );
  });

  recalculatePlanBookEntryStatus(entryId);
  recordActivity(req.user.id, "plan_book_added", `加入计划：${getProgressSummary(plan.plan_name)}`, timestamp);

  res.status(201).json({
    entryId,
    ...buildAppPayload(req.user.id)
  });
});

app.post("/api/plan-book/:entryId/restart", requireAuth, (req, res) => {
  const entry = db.prepare(
    `SELECT id, user_id, source_history_id, conversation_id, source_group_index, source_plan_index,
            group_name, group_description, plan_name, plan_description, estimated_days, completion_threshold, status
     FROM plan_book_entries
     WHERE id = ? AND user_id = ?`
  ).get(req.params.entryId, req.user.id);

  if (!entry) {
    res.status(404).json({ message: "计划不存在" });
    return;
  }

  const normalizedEntry = getPlanBookEntries(req.user.id).find((item) => item.id === entry.id);
  if (!normalizedEntry || normalizedEntry.status !== "achieved") {
    res.status(400).json({ message: "只有已完成计划才能重新开始" });
    return;
  }

  const activeDuplicate = db.prepare(
    `SELECT id
     FROM plan_book_entries
     WHERE user_id = ? AND source_history_id = ? AND source_group_index = ? AND source_plan_index = ?
       AND status = 'active' AND id <> ?`
  ).get(req.user.id, entry.source_history_id, entry.source_group_index, entry.source_plan_index, entry.id);

  if (activeDuplicate) {
    res.status(409).json({ message: "这个计划已经有一条进行中的副本，请先完成或删除当前副本" });
    return;
  }

  const tasks = db.prepare(
    `SELECT task_description, sort_order
     FROM plan_book_tasks
     WHERE entry_id = ?
     ORDER BY sort_order ASC, created_at ASC`
  ).all(entry.id);

  const timestamp = nowIso();
  const nextEntryId = generateId();
  db.prepare(
    `INSERT INTO plan_book_entries (
      id, user_id, source_history_id, conversation_id, source_group_index, source_plan_index,
      group_name, group_description, plan_name, plan_description, estimated_days, completion_threshold,
      status, achieved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`
  ).run(
    nextEntryId,
    req.user.id,
    entry.source_history_id,
    entry.conversation_id || null,
    entry.source_group_index,
    entry.source_plan_index,
    entry.group_name,
    entry.group_description,
    entry.plan_name,
    entry.plan_description,
    Math.max(1, Number(entry.estimated_days) || 14),
    clampThreshold(entry.completion_threshold, 0.75),
    timestamp,
    timestamp
  );

  const insertTask = db.prepare(
    `INSERT INTO plan_book_tasks (id, entry_id, task_description, done, sort_order, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, NULL, ?, ?)`
  );

  tasks.forEach((task, index) => {
    insertTask.run(
      generateId(),
      nextEntryId,
      cleanPlanText(task && task.task_description, `完成任务 ${index + 1}`),
      Number(task && task.sort_order) || index,
      timestamp,
      timestamp
    );
  });

  recalculatePlanBookEntryStatus(nextEntryId);
  recordActivity(req.user.id, "plan_book_restarted", `重新开始计划：${getProgressSummary(entry.plan_name)}`, timestamp);

  res.status(201).json({
    entryId: nextEntryId,
    ...buildAppPayload(req.user.id)
  });
});

app.delete("/api/plan-book/:entryId", requireAuth, (req, res) => {
  const entry = db.prepare(
    `SELECT id, plan_name
     FROM plan_book_entries
     WHERE id = ? AND user_id = ?`
  ).get(req.params.entryId, req.user.id);

  if (!entry) {
    res.status(404).json({ message: "计划不存在" });
    return;
  }

  db.prepare("DELETE FROM plan_book_entries WHERE id = ? AND user_id = ?").run(entry.id, req.user.id);
  recordActivity(req.user.id, "plan_book_removed", `移出计划簿：${getProgressSummary(entry.plan_name)}`);
  res.json(buildAppPayload(req.user.id));
});

app.patch("/api/plan-book/:entryId/tasks/:taskId", requireAuth, (req, res) => {
  const entry = db.prepare(
    `SELECT id, plan_name, status, source_history_id, source_group_index, source_plan_index, completion_threshold
     FROM plan_book_entries
     WHERE id = ? AND user_id = ?`
  ).get(req.params.entryId, req.user.id);

  if (!entry) {
    res.status(404).json({ message: "计划不存在" });
    return;
  }

  const task = db.prepare(
    `SELECT id, task_description, done
     FROM plan_book_tasks
     WHERE id = ? AND entry_id = ?`
  ).get(req.params.taskId, entry.id);

  if (!task) {
    res.status(404).json({ message: "计划任务不存在" });
    return;
  }

  const done = Boolean(req.body.done);

  if (entry.status === "achieved" && task.done === 1 && !done) {
    const counts = db.prepare(
      `SELECT COUNT(*) AS total_tasks, COALESCE(SUM(done), 0) AS completed_tasks
       FROM plan_book_tasks
       WHERE entry_id = ?`
    ).get(entry.id);

    const totalTasks = Number(counts.total_tasks) || 0;
    const completedTasks = Math.max(0, (Number(counts.completed_tasks) || 0) - 1);
    const completionRatio = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;
    const completionThreshold = Math.max(0, Math.min(1, Number(entry.completion_threshold) || 0.75));

    if (totalTasks > 0 && completionRatio < completionThreshold) {
      const activeDuplicate = db.prepare(
        `SELECT id
         FROM plan_book_entries
         WHERE user_id = ? AND source_history_id = ? AND source_group_index = ? AND source_plan_index = ?
           AND status = 'active' AND id <> ?`
      ).get(req.user.id, entry.source_history_id, entry.source_group_index, entry.source_plan_index, entry.id);

      if (activeDuplicate) {
        res.status(409).json({ message: "同一方案已经有一条进行中的计划，请先删除或完成当前副本后再回退旧记录" });
        return;
      }
    }
  }

  const timestamp = nowIso();
  db.prepare(
    `UPDATE plan_book_tasks
     SET done = ?, completed_at = ?, updated_at = ?
     WHERE id = ? AND entry_id = ?`
  ).run(done ? 1 : 0, done ? timestamp : null, timestamp, task.id, entry.id);

  const recalculated = recalculatePlanBookEntryStatus(entry.id);
  if (!task.done && done) {
    recordActivity(req.user.id, "plan_task_completed", `完成计划任务：${getProgressSummary(task.task_description)}`, timestamp);
  }

  if (recalculated && recalculated.status === "achieved" && recalculated.statusChanged) {
    recordActivity(req.user.id, "plan_achieved", `达成计划：${getProgressSummary(entry.plan_name)}`, timestamp);
  }

  res.json(buildAppPayload(req.user.id));
});
app.post("/api/todos", requireAuth, (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) {
    res.status(400).json({ message: "任务内容不能为空" });
    return;
  }

  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO todos (id, user_id, text, done, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(generateId(), req.user.id, text, 0, timestamp, timestamp);

  recordActivity(req.user.id, "todo_created", `添加任务：${getProgressSummary(text)}`);
  res.status(201).json(buildAppPayload(req.user.id));
});

app.patch("/api/todos/:id", requireAuth, (req, res) => {
  const todo = db.prepare(
    `SELECT id, text, done FROM todos WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);

  if (!todo) {
    res.status(404).json({ message: "任务不存在" });
    return;
  }

  const done = Boolean(req.body.done);
  db.prepare(
    `UPDATE todos SET done = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  ).run(done ? 1 : 0, nowIso(), req.params.id, req.user.id);

  if (!todo.done && done) {
    recordActivity(req.user.id, "todo_completed", `完成任务：${getProgressSummary(todo.text)}`);
  }

  res.json(buildAppPayload(req.user.id));
});

app.post("/api/coach", requireAuth, async (req, res) => {
  const requestedConversationId = sanitizeConversationId(req.body.conversationId);
  const existingConversation = requestedConversationId ? getConversationRow(req.user.id, requestedConversationId) : null;
  if (requestedConversationId && !existingConversation) {
    res.status(404).json({ message: "会话不存在" });
    return;
  }

  const scenario = sanitizeScenario(req.body.scenario || existingConversation?.scenario || getCoreState(req.user.id).selectedScenario || SCENARIOS[0]);
  const message = String(req.body.message || req.body.goal || "").trim();
  const details = String(req.body.details || "").trim();

  if (!message) {
    res.status(400).json({ message: "请先输入你想对助手说的话" });
    return;
  }

  const aiSettings = getStoredAiSettings(req.user.id);
  const effectiveProvider = aiSettings.provider || DEFAULT_AI_PROVIDER;
  const effectiveApiKey = aiSettings.apiKey;
  const effectiveBaseUrl = aiSettings.baseUrl || "";
  const effectiveModel = aiSettings.model || DEFAULT_AI_MODEL;
  const fallbackInput = { scenario, goal: message };
  let coachResponse;

  if (!effectiveApiKey) {
    res.status(400).json({ message: "请先到“设置”里填写你自己的 API Key，保存后再使用 AI 助手。" });
    return;
  }

  try {
    const conversation = buildAiConversationContext(req.user.id, req.user.username, existingConversation?.id || null, scenario, message, details);
    const planResult = await requestStructuredPlanFromAi({
      provider: effectiveProvider,
      apiKey: effectiveApiKey,
      baseUrl: effectiveBaseUrl,
      model: effectiveModel,
      systemContext: conversation.systemContext,
      historyMessages: conversation.historyMessages,
      userMessage: conversation.userMessage,
      fallbackInput
    });

    coachResponse = {
      source: "custom-api",
      mode: "structured-plan",
      provider: effectiveProvider,
      model: effectiveModel,
      reply: buildStructuredPlanReply(planResult.structuredPlan),
      structuredPlan: planResult.structuredPlan,
      baseUrl: planResult.result && planResult.result.resolvedBaseUrl ? planResult.result.resolvedBaseUrl : ""
    };
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    res.status(502).json({ message: `你的 AI 接口请求失败：${errorMessage}` });
    return;
  }
  if (!coachResponse || coachResponse.mode !== "structured-plan" || !coachResponse.structuredPlan || !Array.isArray(coachResponse.structuredPlan.plan_groups) || !coachResponse.structuredPlan.plan_groups.length) {
    res.status(502).json({ message: "当前服务没有返回可执行计划方案，请重启最新版愈格服务后再试。" });
    return;
  }

  const createdAt = nowIso();
  const conversation = existingConversation || createConversationRecord(req.user.id, scenario, message, createdAt);
  const historyId = generateId();

  db.prepare(
    `INSERT INTO ai_history (id, user_id, conversation_id, scenario, goal, details, response_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    historyId,
    req.user.id,
    conversation.id,
    scenario,
    message,
    details,
    JSON.stringify(coachResponse),
    createdAt
  );

  updateConversationAfterReply(req.user.id, conversation.id, scenario, createdAt);

  const current = getCoreState(req.user.id);
  writeCoreState(req.user.id, {
    ...current,
    selectedScenario: scenario,
    activeAiConversationId: conversation.id
  });

  recordActivity(req.user.id, "ai_coach", `生成计划：${scenario}`, createdAt);

  res.json({
    ...coachResponse,
    historyId,
    conversationId: conversation.id,
    ...buildAppPayload(req.user.id)
  });
});
const pageRoutes = {
  "/": "index.html",
  "/mbti": "index.html",
  "/analysis": "index.html",
  "/coach": "index.html",
  "/progress": "index.html",
  "/settings": "index.html"
};

Object.entries(pageRoutes).forEach(([routePath, fileName]) => {
  app.get(routePath, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, fileName));
  });
});

const server = app.listen(PORT, () => {
  console.log(`愈格 running on http://localhost:${PORT}`);
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用。请先关闭占用该端口的进程，或使用 npm run start:3001 改用 3001 端口启动。`);
    process.exit(1);
  }

  throw error;
});

function buildQuestions() {
  const templates = {
    IE: [
      "参加活动时，我更愿意主动认识新朋友。",
      "结束一天后，我通常需要独处来恢复精力。",
      "遇到新团队时，我会先观察再发言。",
      "在公开场合表达观点对我来说比较自然。",
      "我更喜欢少量深度交流而不是多人社交。",
      "我会主动把想法说出来让大家知道。",
      "我更享受安静思考而不是热闹互动。",
      "我常常在讨论中扮演带动气氛的角色。",
      "相比外出活动，我更喜欢在熟悉环境里放松。",
      "我倾向于先开口再慢慢整理观点。",
      "当需要充电时，我会选择一个人待着。",
      "我在陌生社交场合通常不会紧张。",
      "我更容易在一对一聊天中表达真实想法。",
      "我愿意在群体中快速分享个人观点。"
    ],
    NS: [
      "面对任务时，我更关注现实细节。",
      "我经常会联想到未来可能性。",
      "我做决定时更依赖已验证经验。",
      "我喜欢讨论抽象概念与长期愿景。",
      "阅读信息时，我会优先记住关键事实。",
      "我常从一个点发散出很多新想法。",
      "我更重视可落地的步骤而非创意方向。",
      "我对模式和趋势变化很敏感。",
      "工作中我偏好明确流程与标准。",
      "我常思考“如果换种方式会怎样”。",
      "我通常先看眼前资源再行动。",
      "我容易被新点子激发行动动力。",
      "我习惯根据当前事实做判断。",
      "我喜欢把经验提炼成更大的图景。"
    ],
    FT: [
      "评估方案时，我更先看客观逻辑。",
      "我会优先照顾他人的感受。",
      "在冲突里，我倾向于直接讨论事实。",
      "做决定时，我会考虑关系和氛围。",
      "我能在压力下保持理性分析。",
      "我经常从共情角度理解别人。",
      "我愿意指出问题，即使听起来不够温和。",
      "我会尽量避免让别人感到被否定。",
      "我更信赖数据和证据。",
      "我会把价值观和意义放在重要位置。",
      "我在争论中更关注结论是否合理。",
      "我会优先考虑彼此是否都舒服。",
      "我更容易接受直接反馈。",
      "我擅长察觉情绪并做出回应。"
    ],
    PJ: [
      "我喜欢提前规划并按计划推进。",
      "我更喜欢保持灵活，临场调整。",
      "我会较早确定截止前的安排。",
      "面对不确定情况，我倾向于边做边看。",
      "我更喜欢明确的任务边界。",
      "我愿意探索多种可能后再决定。",
      "我通常会列清单并逐项完成。",
      "突发变化对我来说是可接受的节奏。",
      "我喜欢把事情尽早收尾。",
      "我对开放结局有较高容忍度。",
      "我倾向于提前准备而不是临近冲刺。",
      "我觉得计划太满会限制创造性。",
      "我偏好稳定可预测的流程。",
      "我喜欢保留选择空间到最后。"
    ]
  };

  const questions = [];
  ["IE", "NS", "FT", "PJ"].forEach((dimension) => {
    templates[dimension].forEach((text, idx) => {
      const reverse = idx % 2 === 1;
      questions.push({
        dimension,
        text,
        options: [
          { label: "非常同意", value: reverse ? 2 : -2 },
          { label: "比较同意", value: reverse ? 1 : -1 },
          { label: "中立", value: 0 },
          { label: "比较不同意", value: reverse ? -1 : 1 },
          { label: "非常不同意", value: reverse ? -2 : 2 }
        ]
      });
    });
  });

  return questions;
}

function buildRadarValues(type, scores) {
  const t = type.split("");
  const clamp = (value) => Math.max(35, Math.min(92, value));

  return [
    clamp(t[0] === "I" ? 78 : 46),
    clamp(t[1] === "N" ? 80 : 48),
    clamp(t[2] === "F" ? 82 : 50),
    clamp(t[3] === "P" ? 79 : 47),
    clamp(68 - Math.abs(scores.FT) * 0.8),
    clamp(65 + Math.abs(scores.PJ) * 0.8),
    clamp(60 + Math.abs(scores.IE) * 0.5),
    clamp(58 + Math.abs(scores.NS) * 0.5)
  ];
}

function buildManualRadarValues(type) {
  const t = String(type || "INFP").trim().toUpperCase().slice(0, 4).split("");
  const clamp = (value) => Math.max(36, Math.min(92, Math.round(value)));

  return [
    clamp(t[0] === "I" ? 82 : 48),
    clamp(t[1] === "N" ? 84 : 50),
    clamp(t[2] === "F" ? 80 : 54),
    clamp(t[3] === "P" ? 78 : 58),
    clamp((t[2] === "F" ? 79 : 63) + (t[0] === "I" ? 4 : -4)),
    clamp((t[3] === "J" ? 84 : 62) + (t[1] === "S" ? 3 : -2)),
    clamp((t[3] === "J" ? 74 : 62) + (t[0] === "I" ? 3 : -3) + (t[2] === "T" ? 3 : -2)),
    clamp((t[0] === "E" ? 82 : 60) + (t[2] === "F" ? 4 : -4))
  ];
}















































