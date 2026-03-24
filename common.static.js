(() => {
  const base = window.PersonalityApp;
  const STORAGE_KEY = "yuge_github_pages_static_v1";
  const TOTAL_QUESTIONS = base.TOTAL_QUESTIONS;
  const MBTI_TYPES = base.MBTI_TYPES;
  const SCENARIOS = base.SCENARIOS;
  const QUESTION_BANK = base.questionBank;
  const DEFAULT_MODEL = "gpt-4.1-mini";
  const DEFAULT_PROVIDER = "openai_compatible";
  const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
  const BUILD = "github-pages-static";

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

  let currentUser = null;
  let state = createDefaultState();
  let persistent = createPersistentState();
  let conversations = [];
  let aiSecrets = createDefaultSecrets();

  function createDefaultSecrets() {
    return { provider: DEFAULT_PROVIDER, baseUrl: "", model: DEFAULT_MODEL, apiKey: "" };
  }

  function createPersistentState() {
    return {
      currentQuestion: 0,
      answers: new Array(TOTAL_QUESTIONS).fill(null),
      mbti: null,
      mbtiSource: "none",
      reliability: 0,
      match: 0,
      radar: [],
      selectedScenario: SCENARIOS[0],
      draftScenario: SCENARIOS[0],
      activeAiConversationId: null,
      theme: "light",
      onboardingCompleted: false,
      importedFromLocal: false,
      todos: [],
      activities: [],
      aiHistory: [],
      planBookEntries: []
    };
  }

  function emptyPlanStats() {
    return {
      activeCount: 0,
      achievedCount: 0,
      totalTaskCount: 0,
      completedTaskCount: 0,
      overallCompletionRatio: 0,
      overallProgressPercent: 0,
      currentPlanProgress: null,
      recentAchieved: null
    };
  }

  function createDefaultState() {
    return {
      ...createPersistentState(),
      aiConversations: [],
      activeConversationMessages: [],
      backendBuild: BUILD,
      backendCapabilities: { structuredPlan: true, planBook: true },
      planBookStats: emptyPlanStats(),
      aiSettings: summarizeAiSettings(createDefaultSecrets())
    };
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function loadStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        users: parsed && parsed.users && typeof parsed.users === "object" ? parsed.users : {},
        sessionUserId: String(parsed && parsed.sessionUserId ? parsed.sessionUserId : "").trim() || null
      };
    } catch (error) {
      return { users: {}, sessionUserId: null };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function sanitizeTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function sanitizeScenario(value) {
    return SCENARIOS.includes(value) ? value : SCENARIOS[0];
  }

  function sanitizeMbtiType(value) {
    const raw = String(value || "").trim().toUpperCase();
    return MBTI_TYPES.includes(raw) ? raw : null;
  }

  function sanitizeMbtiSource(value) {
    return value === "manual" || value === "test" ? value : "none";
  }

  function sanitizeAnswers(candidate) {
    if (!Array.isArray(candidate) || candidate.length !== TOTAL_QUESTIONS) return new Array(TOTAL_QUESTIONS).fill(null);
    return candidate.map((item) => item === null ? null : (Number.isFinite(Number(item)) ? Number(item) : null));
  }

  function sanitizeRadar(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item) => Number(item)).filter((item) => Number.isFinite(item)).slice(0, 8);
  }

  function sanitizeConversationId(value) {
    const raw = String(value || "").trim();
    return raw || null;
  }

  function sanitizeProvider(value) {
    return String(value || "").trim() === "gemini_native" ? "gemini_native" : DEFAULT_PROVIDER;
  }

  function normalizeBaseUrl(provider, value) {
    const raw = String(value || "").trim().replace(/\/+$/, "");
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (sanitizeProvider(provider) === DEFAULT_PROVIDER && url.hostname === "api.openai.com" && (!url.pathname || url.pathname === "/")) {
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
    if (raw.length <= 7) return `${raw.slice(0, 2)}***`;
    return `${raw.slice(0, 5)}...${raw.slice(-4)}`;
  }

  function summarizeAiSettings(source) {
    return {
      baseUrl: String(source && source.baseUrl ? source.baseUrl : "").trim(),
      model: String(source && source.model ? source.model : DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      provider: sanitizeProvider(source && source.provider),
      hasApiKey: Boolean(source && source.apiKey),
      apiKeyMasked: maskApiKey(source && source.apiKey)
    };
  }

  function normalizeTodos(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item) => ({
      id: String(item && item.id ? item.id : generateId()),
      text: String(item && item.text ? item.text : "").trim(),
      done: Boolean(item && item.done),
      createdAt: String(item && item.createdAt ? item.createdAt : nowIso()),
      updatedAt: String(item && item.updatedAt ? item.updatedAt : nowIso())
    })).filter((item) => item.text);
  }

  function normalizeActivities(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 30);
  }

  function normalizeAiHistory(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item) => ({
      id: String(item && item.id ? item.id : generateId()),
      conversationId: sanitizeConversationId(item && item.conversationId),
      scenario: sanitizeScenario(item && item.scenario),
      goal: String(item && item.goal ? item.goal : "").trim(),
      details: String(item && item.details ? item.details : "").trim(),
      response: item && typeof item.response === "object" ? {
        mode: item.response.mode === "structured-plan" ? "structured-plan" : "chat",
        reply: String(item.response.reply || "").trim(),
        structuredPlan: normalizeStructuredPlan(item.response.structuredPlan, null)
      } : null,
      createdAt: String(item && item.createdAt ? item.createdAt : nowIso())
    })).filter((item) => item.goal);
  }

  function normalizeMessages(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item) => ({
      id: String(item && item.id ? item.id : generateId()),
      turnId: String(item && item.turnId ? item.turnId : ""),
      historyId: String(item && item.historyId ? item.historyId : item && item.turnId ? item.turnId : ""),
      role: String(item && item.role ? item.role : "assistant") === "user" ? "user" : "assistant",
      text: String(item && item.text ? item.text : "").trim(),
      details: String(item && item.details ? item.details : "").trim(),
      structuredPlan: normalizeStructuredPlan(item && item.structuredPlan, null),
      createdAt: String(item && item.createdAt ? item.createdAt : nowIso())
    })).filter((item) => item.text || item.structuredPlan);
  }

  function normalizeConversations(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((item) => ({
      id: String(item && item.id ? item.id : generateId()),
      title: String(item && item.title ? item.title : "新的对话").trim() || "新的对话",
      scenario: sanitizeScenario(item && item.scenario),
      createdAt: String(item && item.createdAt ? item.createdAt : nowIso()),
      updatedAt: String(item && item.updatedAt ? item.updatedAt : nowIso()),
      lastMessageAt: String(item && item.lastMessageAt ? item.lastMessageAt : item && item.updatedAt ? item.updatedAt : nowIso()),
      preview: String(item && item.preview ? item.preview : "").trim(),
      turnCount: Math.max(0, Number(item && item.turnCount) || 0),
      messages: normalizeMessages(item && item.messages)
    }));
  }
  function normalizePlanEntries(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.map((entry) => {
      const tasks = Array.isArray(entry && entry.tasks)
        ? entry.tasks.map((task, index) => ({
            id: String(task && task.id ? task.id : generateId()),
            taskDescription: String(task && (task.taskDescription || task.task_description) ? (task.taskDescription || task.task_description) : `任务 ${index + 1}`).trim(),
            done: Boolean(task && task.done),
            sortOrder: Math.max(0, Number(task && (task.sortOrder !== undefined ? task.sortOrder : task.sort_order)) || index),
            completedAt: String(task && (task.completedAt || task.completed_at) ? (task.completedAt || task.completed_at) : ""),
            createdAt: String(task && (task.createdAt || task.created_at) ? (task.createdAt || task.created_at) : nowIso()),
            updatedAt: String(task && (task.updatedAt || task.updated_at) ? (task.updatedAt || task.updated_at) : nowIso())
          })).filter((task) => task.taskDescription)
        : [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((task) => task.done).length;
      const completionThreshold = Math.max(0, Math.min(1, Number(entry && (entry.completionThreshold !== undefined ? entry.completionThreshold : entry.completion_threshold)) || 0.75));
      const completionRatio = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;
      const status = completionRatio >= completionThreshold || String(entry && entry.status ? entry.status : "") === "achieved" ? "achieved" : "active";
      return {
        id: String(entry && entry.id ? entry.id : generateId()),
        sourceHistoryId: String(entry && (entry.sourceHistoryId || entry.source_history_id) ? (entry.sourceHistoryId || entry.source_history_id) : ""),
        conversationId: sanitizeConversationId(entry && (entry.conversationId || entry.conversation_id)),
        sourceGroupIndex: Math.max(0, Number(entry && (entry.sourceGroupIndex !== undefined ? entry.sourceGroupIndex : entry.source_group_index)) || 0),
        sourcePlanIndex: Math.max(0, Number(entry && (entry.sourcePlanIndex !== undefined ? entry.sourcePlanIndex : entry.source_plan_index)) || 0),
        groupName: String(entry && (entry.groupName || entry.group_name) ? (entry.groupName || entry.group_name) : "未命名分组").trim(),
        groupDescription: String(entry && (entry.groupDescription || entry.group_description) ? (entry.groupDescription || entry.group_description) : "").trim(),
        planName: String(entry && (entry.planName || entry.plan_name) ? (entry.planName || entry.plan_name) : "未命名计划").trim(),
        planDescription: String(entry && (entry.planDescription || entry.plan_description) ? (entry.planDescription || entry.plan_description) : "").trim(),
        estimatedDays: Math.max(1, Number(entry && (entry.estimatedDays !== undefined ? entry.estimatedDays : entry.estimated_days)) || 14),
        completionThreshold,
        status,
        achievedAt: status === "achieved" ? String(entry && (entry.achievedAt || entry.achieved_at) ? (entry.achievedAt || entry.achieved_at) : "") : "",
        createdAt: String(entry && (entry.createdAt || entry.created_at) ? (entry.createdAt || entry.created_at) : nowIso()),
        updatedAt: String(entry && (entry.updatedAt || entry.updated_at) ? (entry.updatedAt || entry.updated_at) : nowIso()),
        totalTasks,
        completedTasks,
        completionRatio,
        tasks
      };
    });
  }

  function computePlanStats(entries) {
    const list = normalizePlanEntries(entries);
    const active = list.filter((entry) => entry.status !== "achieved").sort((a, b) => getPlanTime(b) - getPlanTime(a));
    const achieved = list.filter((entry) => entry.status === "achieved").sort((a, b) => getPlanTime(b) - getPlanTime(a));
    const totalTaskCount = list.reduce((sum, item) => sum + item.totalTasks, 0);
    const completedTaskCount = list.reduce((sum, item) => sum + item.completedTasks, 0);
    const ratio = totalTaskCount ? Number((completedTaskCount / totalTaskCount).toFixed(4)) : 0;
    return {
      activeCount: active.length,
      achievedCount: achieved.length,
      totalTaskCount,
      completedTaskCount,
      overallCompletionRatio: ratio,
      overallProgressPercent: Math.round(ratio * 100),
      currentPlanProgress: active[0] ? {
        entryId: active[0].id,
        planName: active[0].planName,
        completionRatio: active[0].completionRatio,
        completionThreshold: active[0].completionThreshold,
        completedTasks: active[0].completedTasks,
        totalTasks: active[0].totalTasks,
        estimatedDays: active[0].estimatedDays
      } : null,
      recentAchieved: achieved[0] ? {
        entryId: achieved[0].id,
        planName: achieved[0].planName,
        achievedAt: achieved[0].achievedAt || achieved[0].updatedAt || achieved[0].createdAt || ""
      } : null
    };
  }

  function getPlanTime(entry) {
    return new Date(entry.achievedAt || entry.updatedAt || entry.createdAt || 0).getTime() || 0;
  }

  function getConversationTime(entry) {
    return new Date(entry.lastMessageAt || entry.updatedAt || entry.createdAt || 0).getTime() || 0;
  }

  function buildPublicState() {
    const summaries = conversations.slice().sort((a, b) => getConversationTime(b) - getConversationTime(a)).map((item) => ({
      id: item.id,
      title: item.title,
      scenario: item.scenario,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastMessageAt: item.lastMessageAt,
      preview: item.preview,
      turnCount: item.turnCount
    }));
    const activeConversation = conversations.find((item) => item.id === persistent.activeAiConversationId) || null;
    const planBookEntries = normalizePlanEntries(persistent.planBookEntries);
    const stats = computePlanStats(planBookEntries);
    return {
      currentQuestion: Math.min(TOTAL_QUESTIONS - 1, Math.max(0, Number(persistent.currentQuestion) || 0)),
      answers: sanitizeAnswers(persistent.answers),
      mbti: sanitizeMbtiType(persistent.mbti),
      mbtiSource: sanitizeMbtiSource(persistent.mbtiSource),
      reliability: Math.max(0, Math.min(100, Number(persistent.reliability) || 0)),
      match: Math.max(0, Math.min(100, Number(persistent.match) || 0)),
      radar: sanitizeRadar(persistent.radar),
      selectedScenario: sanitizeScenario(persistent.selectedScenario),
      draftScenario: sanitizeScenario(persistent.draftScenario || persistent.selectedScenario),
      activeAiConversationId: sanitizeConversationId(persistent.activeAiConversationId),
      theme: sanitizeTheme(persistent.theme),
      onboardingCompleted: Boolean(persistent.onboardingCompleted),
      importedFromLocal: Boolean(persistent.importedFromLocal),
      todos: normalizeTodos(persistent.todos),
      activities: normalizeActivities(persistent.activities),
      aiHistory: normalizeAiHistory(persistent.aiHistory),
      aiConversations: summaries,
      activeConversationMessages: activeConversation ? normalizeMessages(activeConversation.messages) : [],
      backendBuild: BUILD,
      backendCapabilities: { structuredPlan: true, planBook: true },
      planBookEntries,
      planBookStats: stats,
      aiSettings: summarizeAiSettings(aiSecrets)
    };
  }

  function syncState() {
    state = buildPublicState();
    document.documentElement.setAttribute("data-theme", state.theme);
    return state;
  }

  function persistCurrentUser() {
    if (!currentUser) return;
    syncState();
    const store = loadStore();
    const record = store.users[currentUser.id] || { id: currentUser.id, username: currentUser.username, password: "", createdAt: nowIso(), updatedAt: nowIso() };
    record.username = currentUser.username;
    record.updatedAt = nowIso();
    record.state = {
      currentQuestion: state.currentQuestion,
      answers: state.answers,
      mbti: state.mbti,
      mbtiSource: state.mbtiSource,
      reliability: state.reliability,
      match: state.match,
      radar: state.radar,
      selectedScenario: state.selectedScenario,
      draftScenario: state.draftScenario,
      activeAiConversationId: state.activeAiConversationId,
      theme: state.theme,
      onboardingCompleted: state.onboardingCompleted,
      importedFromLocal: state.importedFromLocal,
      todos: state.todos,
      activities: state.activities,
      aiHistory: state.aiHistory,
      planBookEntries: state.planBookEntries
    };
    record.conversations = conversations;
    record.secrets = aiSecrets;
    store.users[currentUser.id] = record;
    store.sessionUserId = currentUser.id;
    saveStore(store);
  }

  function prependActivity(text) {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    persistent.activities = [`${stamp} - ${text}`, ...normalizeActivities(persistent.activities)].slice(0, 20);
  }

  function validateUsernameAndPassword(username, password) {
    const nextUsername = String(username || "").trim();
    const nextPassword = String(password || "");
    if (!nextUsername || nextUsername.length < 2) return { ok: false, message: "用户名至少需要 2 个字符" };
    if (!nextPassword || nextPassword.length < 4) return { ok: false, message: "密码至少需要 4 个字符" };
    return { ok: true, username: nextUsername, password: nextPassword };
  }

  function findUserByUsername(store, username) {
    const lower = String(username || "").trim().toLowerCase();
    return Object.values(store.users).find((item) => String(item.username || "").trim().toLowerCase() === lower) || null;
  }

  function resetAuthState() {
    currentUser = null;
    persistent = createPersistentState();
    conversations = [];
    aiSecrets = createDefaultSecrets();
    state = createDefaultState();
    document.documentElement.setAttribute("data-theme", state.theme);
  }

  function setCurrentRecord(record) {
    currentUser = { id: record.id, username: record.username };
    persistent = { ...createPersistentState(), ...(record.state || {}) };
    conversations = normalizeConversations(record.conversations);
    aiSecrets = { ...createDefaultSecrets(), ...(record.secrets || {}) };
    syncState();
  }

  async function initialize() {
    const store = loadStore();
    const record = store.sessionUserId ? store.users[store.sessionUserId] : null;
    if (!record) {
      resetAuthState();
      return { authenticated: false, user: null };
    }
    setCurrentRecord(record);
    return { authenticated: true, user: currentUser };
  }

  async function fetchAppState() {
    if (!currentUser) throw new Error("当前未登录");
    syncState();
    return { user: currentUser, state };
  }

  async function register(username, password) {
    const validation = validateUsernameAndPassword(username, password);
    if (!validation.ok) throw new Error(validation.message);
    const store = loadStore();
    if (findUserByUsername(store, validation.username)) throw new Error("该用户名已被注册");
    const id = generateId();
    const record = { id, username: validation.username, password: validation.password, createdAt: nowIso(), updatedAt: nowIso(), state: createPersistentState(), conversations: [], secrets: createDefaultSecrets() };
    store.users[id] = record;
    store.sessionUserId = id;
    saveStore(store);
    setCurrentRecord(record);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function login(username, password) {
    const validation = validateUsernameAndPassword(username, password);
    if (!validation.ok) throw new Error(validation.message);
    const store = loadStore();
    const record = findUserByUsername(store, validation.username);
    if (!record || String(record.password || "") !== validation.password) throw new Error("用户名或密码错误");
    store.sessionUserId = record.id;
    saveStore(store);
    setCurrentRecord(record);
    return { user: currentUser, state };
  }

  async function logout() {
    const store = loadStore();
    store.sessionUserId = null;
    saveStore(store);
    resetAuthState();
    return { ok: true };
  }

  function getState() { return state; }
  function getUser() { return currentUser; }
  function isAuthenticated() { return Boolean(currentUser); }

  async function updatePreferences(updates = {}) {
    persistent.theme = updates.theme !== undefined ? sanitizeTheme(updates.theme) : persistent.theme;
    if (updates.selectedScenario !== undefined) {
      persistent.selectedScenario = sanitizeScenario(updates.selectedScenario);
      persistent.draftScenario = sanitizeScenario(updates.selectedScenario);
    }
    if (updates.onboardingCompleted !== undefined) persistent.onboardingCompleted = Boolean(updates.onboardingCompleted);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function toggleTheme() { return updatePreferences({ theme: state.theme === "dark" ? "light" : "dark" }); }
  async function closeOnboarding() { return updatePreferences({ onboardingCompleted: true }); }
  async function setSelectedScenario(value) {
    persistent.selectedScenario = sanitizeScenario(value);
    persistent.draftScenario = sanitizeScenario(value);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function setCurrentQuestion(index) {
    persistent.currentQuestion = Math.min(TOTAL_QUESTIONS - 1, Math.max(0, Number(index) || 0));
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function answerQuestion(index, value) {
    const answers = sanitizeAnswers(persistent.answers);
    if (index < 0 || index >= TOTAL_QUESTIONS) return null;
    answers[index] = Number(value);
    persistent.answers = answers;
    persistCurrentUser();
    return { user: currentUser, state };
  }

  function getNextUnansweredIndex() {
    const index = sanitizeAnswers(persistent.answers).findIndex((item) => item === null);
    return index === -1 ? 0 : index;
  }
  function computeMbtiFromAnswers(answers) {
    const safeAnswers = sanitizeAnswers(answers);
    if (safeAnswers.some((item) => item === null)) return null;
    const scores = { IE: 0, NS: 0, FT: 0, PJ: 0 };
    QUESTION_BANK.forEach((question, idx) => { scores[question.dimension] += safeAnswers[idx]; });
    const mbti = [scores.IE >= 0 ? "E" : "I", scores.NS >= 0 ? "S" : "N", scores.FT >= 0 ? "T" : "F", scores.PJ >= 0 ? "J" : "P"].join("");
    const avgAbs = safeAnswers.reduce((sum, value) => sum + Math.abs(value), 0) / TOTAL_QUESTIONS;
    const balance = (Math.abs(scores.IE) + Math.abs(scores.NS) + Math.abs(scores.FT) + Math.abs(scores.PJ)) / 4;
    return { mbti, reliability: Math.round(72 + Math.min(25, avgAbs * 12)), match: Math.round(65 + Math.min(30, balance * 2)), radar: buildRadarValues(mbti, scores), scores };
  }

  async function completeMBTI() {
    const result = computeMbtiFromAnswers(persistent.answers);
    if (!result) return { ok: false, message: "还有未完成题目，请先答完56题" };
    persistent.mbti = result.mbti;
    persistent.mbtiSource = "test";
    persistent.reliability = result.reliability;
    persistent.match = result.match;
    persistent.radar = result.radar;
    persistent.currentQuestion = TOTAL_QUESTIONS - 1;
    prependActivity(`完成 MBTI 测试，当前类型为 ${result.mbti}`);
    persistCurrentUser();
    return { ok: true, type: result.mbti, result };
  }

  async function manualSelectMbti(mbti) {
    const next = sanitizeMbtiType(mbti);
    if (!next) throw new Error("请选择有效的 MBTI 类型");
    persistent.mbti = next;
    persistent.mbtiSource = "manual";
    persistent.reliability = 0;
    persistent.match = 0;
    persistent.radar = base.getTypeProfile(next).radar || [];
    prependActivity(`手动设置 MBTI 为 ${next}`);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function resetMBTI() {
    persistent.currentQuestion = 0;
    persistent.answers = new Array(TOTAL_QUESTIONS).fill(null);
    persistent.mbti = null;
    persistent.mbtiSource = "none";
    persistent.reliability = 0;
    persistent.match = 0;
    persistent.radar = [];
    prependActivity("已重置 MBTI 测试");
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function addTodo(text) {
    const value = String(text || "").trim();
    if (!value) throw new Error("请输入任务内容");
    const timestamp = nowIso();
    persistent.todos = [{ id: generateId(), text: value, done: false, createdAt: timestamp, updatedAt: timestamp }, ...normalizeTodos(persistent.todos)];
    prependActivity(`新增待办：${value}`);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function toggleTodoDone(id, done) {
    persistent.todos = normalizeTodos(persistent.todos).map((item) => item.id === id ? { ...item, done: Boolean(done), updatedAt: nowIso() } : item);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  function sanitizeReplyText(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/```+/g, "")
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/[★☆◆◇■□●○◎◉•▪▫▶▷▸▹▻►➤➥➔→←↑↓※]/g, "")
      .trim();
  }

  function parseJsonFromText(rawText) {
    const text = String(rawText || "").trim();
    if (!text) throw new Error("Empty AI response");
    try { return JSON.parse(text); } catch (error) {
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first === -1 || last === -1 || first >= last) throw error;
      return JSON.parse(text.slice(first, last + 1));
    }
  }

  function clampInteger(value, fallback, min, max) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function clampThreshold(value, fallback = 0.75) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0.3, Math.min(1, Number(n.toFixed(2))));
  }

  function cleanPlanText(value, fallback = "") {
    const cleaned = sanitizeReplyText(String(value || "").replace(/\s+/g, " ").trim());
    return cleaned || fallback;
  }

  function buildFallbackPlan(input) {
    const scenario = cleanPlanText(input && input.scenario ? input.scenario : "通用成长场景", "通用成长场景");
    const goal = cleanPlanText(input && input.goal ? input.goal : "提升表达与行动一致性", "提升表达与行动一致性");
    return {
      plan_groups: [
        {
          group_name: "认知准备",
          group_description: `先降低在“${scenario}”里的心理阻力。`,
          plans: [
            { plan_name: "目标拆小计划", plan_description: `把“${goal}”拆成今天就能开始的小动作。`, estimated_days: 7, completion_threshold: 0.67, tasks: [
              { task_description: `写下这次最想改善的 1 个具体场景：${scenario}` },
              { task_description: "把目标缩小成 10 分钟内能完成的一步" },
              { task_description: "今天就完成这一步，并记录感受" }
            ] },
            { plan_name: "心理预演计划", plan_description: "先在低压力环境里做预演，减少真正行动时的卡顿。", estimated_days: 7, completion_threshold: 0.67, tasks: [
              { task_description: "每天花 3 分钟想象自己完成目标的样子" },
              { task_description: "提前写下 1 句想说的话或想做的动作" },
              { task_description: "练习后记录哪里最容易卡住" }
            ] }
          ]
        },
        {
          group_name: "行动练习",
          group_description: "用一组可勾选的小任务逐步建立新的行为习惯。",
          plans: [
            { plan_name: "低压试水计划", plan_description: "先在压力较低的情境里完成几次小尝试。", estimated_days: 14, completion_threshold: 0.75, tasks: [
              { task_description: "本周挑 1 次低压力场景主动表达 1 句话" },
              { task_description: "每次行动前先做 1 次深呼吸" },
              { task_description: "行动后用 1 句话记录结果" },
              { task_description: "把下一次尝试时间写进日程" }
            ] },
            { plan_name: "固定频率计划", plan_description: "用稳定频率重复练习，避免只靠一时冲劲。", estimated_days: 14, completion_threshold: 0.75, tasks: [
              { task_description: "每周至少完成 3 次同类练习" },
              { task_description: "每次练习只设定 1 个最小成功标准" },
              { task_description: "练习后记录 1 个做得好的地方" },
              { task_description: "连续两周保持固定频率" }
            ] }
          ]
        }
      ]
    };
  }

  function normalizeStructuredPlan(candidate, fallbackInput = null) {
    const fallback = fallbackInput ? buildFallbackPlan(fallbackInput) : null;
    if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.plan_groups)) return fallback;
    const groups = candidate.plan_groups.slice(0, 4).map((group, groupIndex) => {
      const plans = Array.isArray(group && group.plans)
        ? group.plans.slice(0, 3).map((plan, planIndex) => {
            const tasks = Array.isArray(plan && plan.tasks)
              ? plan.tasks.slice(0, 6).map((task, taskIndex) => ({ task_description: cleanPlanText(task && task.task_description, `完成第 ${taskIndex + 1} 个练习动作`) })).filter((task) => task.task_description)
              : [];
            if (tasks.length < 3) return null;
            return {
              plan_name: cleanPlanText(plan && plan.plan_name, `计划 ${planIndex + 1}`),
              plan_description: cleanPlanText(plan && plan.plan_description, "一组可执行的计划动作。"),
              estimated_days: clampInteger(plan && plan.estimated_days, 14, 3, 60),
              completion_threshold: clampThreshold(plan && plan.completion_threshold, 0.75),
              tasks
            };
          }).filter(Boolean)
        : [];
      if (plans.length < 2) return null;
      return {
        group_name: cleanPlanText(group && group.group_name, `计划分组 ${groupIndex + 1}`),
        group_description: cleanPlanText(group && group.group_description, "这一组计划的执行说明。"),
        plans
      };
    }).filter(Boolean);
    return groups.length >= 2 ? { plan_groups: groups } : fallback;
  }

  function buildStructuredPlanReply(structuredPlan) {
    const plan = normalizeStructuredPlan(structuredPlan, null);
    if (!plan) return "我已经为你整理出一套可执行计划，你可以先选择一个计划加入计划簿。";
    const groupNames = plan.plan_groups.map((group) => group.group_name).slice(0, 3).join(" / ");
    const firstPlan = plan.plan_groups[0] && plan.plan_groups[0].plans[0] ? plan.plan_groups[0].plans[0].plan_name : "第一步计划";
    return `我已经把你的目标拆成 ${plan.plan_groups.length} 组计划：${groupNames}。你可以先从“${firstPlan}”开始，加入计划簿后按任务逐项打钩推进。`;
  }

  function buildSystemContext(scenario) {
    const lines = [`当前场景：${scenario}`];
    if (persistent.mbti) lines.push(`当前 MBTI：${persistent.mbti}`);
    if (persistent.mbtiSource === "manual") lines.push("当前 MBTI 来源：手动选择");
    if (persistent.mbtiSource === "test") lines.push(`当前 MBTI 来源：正式测试（信度 ${persistent.reliability}% / 匹配度 ${persistent.match}%）`);
    return lines.join("\n");
  }

  function extractOpenAiReply(payload) {
    return payload && Array.isArray(payload.choices) && payload.choices[0] && payload.choices[0].message ? String(payload.choices[0].message.content || "") : "";
  }

  function extractGeminiReply(payload) {
    const parts = payload && payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts;
    return Array.isArray(parts) ? parts.map((item) => String(item && item.text ? item.text : "").trim()).filter(Boolean).join("\n") : "";
  }

  function extractErrorMessage(payload) {
    return String((payload && payload.error && payload.error.message) || (payload && payload.message) || "未知错误").trim().replace(/\s+/g, " ").slice(0, 220);
  }

  async function readJsonResponseSafe(response) {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; } catch (error) { return { message: text || "" }; }
  }
  async function requestAiChat(options) {
    const provider = sanitizeProvider(options.provider);
    if (provider === "gemini_native") {
      const baseUrl = normalizeBaseUrl(provider, options.baseUrl) || DEFAULT_GEMINI_BASE_URL;
      const response = await fetch(`${baseUrl}/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: [options.systemPrompt, options.systemContext].filter(Boolean).join("\n\n") }] },
          contents: [
            ...(options.historyMessages || []).map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: String(item.content || "") }] })),
            { role: "user", parts: [{ text: options.userMessage }] }
          ],
          generationConfig: { temperature: 0.7 }
        })
      });
      const payload = await readJsonResponseSafe(response);
      if (!response.ok) throw new Error(extractErrorMessage(payload));
      const rawReply = extractGeminiReply(payload);
      const reply = sanitizeReplyText(rawReply);
      if (!reply) throw new Error("AI 没有返回可用内容");
      return { rawReply, reply };
    }

    const baseUrl = normalizeBaseUrl(provider, options.baseUrl) || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.7,
        messages: [
          { role: "system", content: options.systemPrompt },
          ...(options.systemContext ? [{ role: "system", content: options.systemContext }] : []),
          ...(options.historyMessages || []),
          { role: "user", content: options.userMessage }
        ]
      })
    });
    const payload = await readJsonResponseSafe(response);
    if (!response.ok) throw new Error(extractErrorMessage(payload));
    const rawReply = extractOpenAiReply(payload);
    const reply = sanitizeReplyText(rawReply);
    if (!reply) throw new Error("AI 没有返回可用内容");
    return { rawReply, reply };
  }

  async function requestStructuredPlanFromAi({ scenario, goal, historyMessages }) {
    const primary = await requestAiChat({
      provider: aiSecrets.provider,
      apiKey: aiSecrets.apiKey,
      baseUrl: aiSecrets.baseUrl,
      model: aiSecrets.model,
      systemPrompt: STRUCTURED_PLAN_PROMPT,
      systemContext: buildSystemContext(scenario),
      historyMessages,
      userMessage: `用户的目标是：${goal}`
    });

    try {
      const structuredPlan = normalizeStructuredPlan(parseJsonFromText(primary.rawReply || primary.reply), null);
      if (!structuredPlan) throw new Error("invalid structured plan");
      return structuredPlan;
    } catch (error) {
      try {
        const repair = await requestAiChat({
          provider: aiSecrets.provider,
          apiKey: aiSecrets.apiKey,
          baseUrl: aiSecrets.baseUrl,
          model: aiSecrets.model,
          systemPrompt: STRUCTURED_PLAN_REPAIR_PROMPT,
          systemContext: "",
          historyMessages: [],
          userMessage: `请把下面内容修复为合法 JSON 对象，并且不要输出任何额外文字：\n${primary.rawReply || primary.reply}`
        });
        const structuredPlan = normalizeStructuredPlan(parseJsonFromText(repair.rawReply || repair.reply), null);
        if (!structuredPlan) throw new Error("invalid structured plan");
        return structuredPlan;
      } catch (repairError) {
        return buildFallbackPlan({ scenario, goal });
      }
    }
  }

  function ensureApiKey() {
    if (!String(aiSecrets.apiKey || "").trim()) throw new Error("当前静态版不会提供服务器默认 Key，请先到设置中填写你自己的 API Key");
  }

  function buildConversationTitle(text) {
    const raw = String(text || "").trim();
    if (!raw) return "新的对话";
    return raw.length > 18 ? `${raw.slice(0, 18)}...` : raw;
  }

  function findConversation(id) { return conversations.find((item) => item.id === id) || null; }
  function upsertConversation(conversation) { const idx = conversations.findIndex((item) => item.id === conversation.id); if (idx >= 0) conversations.splice(idx, 1); conversations.unshift(conversation); }

  function getPlanSource(sourceHistoryId, groupIndex, planIndex) {
    const history = normalizeAiHistory(persistent.aiHistory).find((item) => item.id === String(sourceHistoryId));
    if (!history || !history.response || !history.response.structuredPlan || !Array.isArray(history.response.structuredPlan.plan_groups)) return null;
    const group = history.response.structuredPlan.plan_groups[groupIndex];
    const plan = group && Array.isArray(group.plans) ? group.plans[planIndex] : null;
    if (!group || !plan) return null;
    return { history, group, plan };
  }

  function findActivePlanDuplicate(sourceHistoryId, groupIndex, planIndex, excludeId = "") {
    return normalizePlanEntries(persistent.planBookEntries).find((entry) => entry.status !== "achieved" && entry.sourceHistoryId === String(sourceHistoryId) && entry.sourceGroupIndex === Number(groupIndex) && entry.sourcePlanIndex === Number(planIndex) && entry.id !== excludeId) || null;
  }

  function createPlanEntry(sourceHistoryId, groupIndex, planIndex, conversationId, group, plan) {
    const timestamp = nowIso();
    return {
      id: generateId(),
      sourceHistoryId: String(sourceHistoryId),
      conversationId: sanitizeConversationId(conversationId),
      sourceGroupIndex: Number(groupIndex) || 0,
      sourcePlanIndex: Number(planIndex) || 0,
      groupName: group.group_name,
      groupDescription: group.group_description,
      planName: plan.plan_name,
      planDescription: plan.plan_description,
      estimatedDays: Math.max(1, Number(plan.estimated_days) || 14),
      completionThreshold: Math.max(0, Math.min(1, Number(plan.completion_threshold) || 0.75)),
      status: "active",
      achievedAt: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      tasks: plan.tasks.map((task, index) => ({ id: generateId(), taskDescription: String(task.task_description || `任务 ${index + 1}`).trim(), done: false, sortOrder: index, completedAt: "", createdAt: timestamp, updatedAt: timestamp }))
    };
  }

  async function requestCoach(input) {
    ensureApiKey();
    const scenario = sanitizeScenario(input && input.scenario ? input.scenario : persistent.selectedScenario);
    const message = String(input && input.message ? input.message : input && input.goal ? input.goal : "").trim();
    if (!message) throw new Error("请先输入你想对助手说的话");
    let conversation = sanitizeConversationId(input && input.conversationId) ? findConversation(input.conversationId) : null;
    if (!conversation) {
      const timestamp = nowIso();
      conversation = { id: generateId(), title: buildConversationTitle(message), scenario, createdAt: timestamp, updatedAt: timestamp, lastMessageAt: timestamp, preview: "", turnCount: 0, messages: [] };
    }
    const historyMessages = normalizeMessages(conversation.messages).slice(-12).map((item) => ({ role: item.role, content: item.text }));
    const structuredPlan = await requestStructuredPlanFromAi({ scenario, goal: message, historyMessages });
    const turnId = generateId();
    const userCreatedAt = nowIso();
    const reply = buildStructuredPlanReply(structuredPlan);
    const userMessage = { id: generateId(), turnId, historyId: turnId, role: "user", text: message, details: String(input && input.details ? input.details : ""), structuredPlan: null, createdAt: userCreatedAt };
    const assistantMessage = { id: generateId(), turnId, historyId: turnId, role: "assistant", text: reply, details: "", structuredPlan, createdAt: nowIso() };
    conversation.scenario = scenario;
    conversation.messages = [...conversation.messages, userMessage, assistantMessage];
    conversation.turnCount = Number(conversation.turnCount || 0) + 1;
    conversation.preview = reply;
    conversation.updatedAt = assistantMessage.createdAt;
    conversation.lastMessageAt = assistantMessage.createdAt;
    upsertConversation(conversation);
    persistent.selectedScenario = scenario;
    persistent.draftScenario = scenario;
    persistent.activeAiConversationId = conversation.id;
    persistent.aiHistory = [{ id: turnId, conversationId: conversation.id, scenario, goal: message, details: String(input && input.details ? input.details : ""), response: { mode: "structured-plan", reply, structuredPlan }, createdAt: userCreatedAt }, ...normalizeAiHistory(persistent.aiHistory)].slice(0, 80);
    prependActivity(`AI 生成了新的计划方案：${conversation.title}`);
    persistCurrentUser();
    return { user: currentUser, state, mode: "structured-plan", reply, structuredPlan, conversationId: conversation.id };
  }

  async function setActiveAiConversation(conversationId) { persistent.activeAiConversationId = sanitizeConversationId(conversationId); persistCurrentUser(); return { user: currentUser, state }; }
  async function loadAiConversationMessages(conversationId) { const conversation = findConversation(conversationId); return { messages: conversation ? normalizeMessages(conversation.messages) : [] }; }

  async function updateAiConversation(conversationId, updates = {}) {
    const conversation = findConversation(conversationId);
    if (!conversation) throw new Error("会话不存在");
    if (updates.scenario !== undefined) {
      conversation.scenario = sanitizeScenario(updates.scenario);
      persistent.selectedScenario = conversation.scenario;
      persistent.draftScenario = conversation.scenario;
      persistent.aiHistory = normalizeAiHistory(persistent.aiHistory).map((item) => item.conversationId === conversationId ? { ...item, scenario: conversation.scenario } : item);
    }
    conversation.updatedAt = nowIso();
    upsertConversation(conversation);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function deleteAiConversation(conversationId) {
    conversations = conversations.filter((item) => item.id !== conversationId);
    persistent.aiHistory = normalizeAiHistory(persistent.aiHistory).filter((item) => item.conversationId !== conversationId);
    if (persistent.activeAiConversationId === conversationId) persistent.activeAiConversationId = null;
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function addPlanBookEntry(sourceHistoryId, groupIndex, planIndex) {
    const source = getPlanSource(sourceHistoryId, groupIndex, planIndex);
    if (!source) throw new Error("没有找到对应的计划来源，请重新生成方案后再试");
    if (findActivePlanDuplicate(sourceHistoryId, groupIndex, planIndex)) throw new Error("这个计划已经在进行中了；完成后可以重新开始一轮");
    const entry = createPlanEntry(sourceHistoryId, groupIndex, planIndex, source.history.conversationId, source.group, source.plan);
    persistent.planBookEntries = [entry, ...normalizePlanEntries(persistent.planBookEntries)];
    prependActivity(`已将计划“${entry.planName}”加入计划簿`);
    persistCurrentUser();
    return { user: currentUser, state, entry };
  }

  async function removePlanBookEntry(entryId) {
    const currentEntries = normalizePlanEntries(persistent.planBookEntries);
    const target = currentEntries.find((item) => item.id === entryId);
    persistent.planBookEntries = currentEntries.filter((item) => item.id !== entryId);
    if (target) prependActivity(`已从计划簿移除“${target.planName}”`);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function restartPlanBookEntry(entryId) {
    const entries = normalizePlanEntries(persistent.planBookEntries);
    const target = entries.find((item) => item.id === entryId);
    if (!target) throw new Error("计划不存在");
    if (findActivePlanDuplicate(target.sourceHistoryId, target.sourceGroupIndex, target.sourcePlanIndex, target.id)) throw new Error("同一计划已经有进行中的副本，请先完成或删除当前副本");
    const source = getPlanSource(target.sourceHistoryId, target.sourceGroupIndex, target.sourcePlanIndex);
    const next = source ? createPlanEntry(target.sourceHistoryId, target.sourceGroupIndex, target.sourcePlanIndex, target.conversationId, source.group, source.plan) : { ...target, id: generateId(), status: "active", achievedAt: "", createdAt: nowIso(), updatedAt: nowIso(), tasks: target.tasks.map((task, index) => ({ ...task, id: generateId(), done: false, sortOrder: index, completedAt: "", createdAt: nowIso(), updatedAt: nowIso() })) };
    persistent.planBookEntries = [next, ...entries];
    prependActivity(`重新开始计划“${next.planName}”`);
    persistCurrentUser();
    return { user: currentUser, state, entry: next };
  }

  async function togglePlanBookTask(entryId, taskId, done) {
    const entries = normalizePlanEntries(persistent.planBookEntries);
    const target = entries.find((item) => item.id === entryId);
    if (!target) throw new Error("计划不存在");
    const tasks = target.tasks.map((task) => task.id === taskId ? { ...task, done: Boolean(done), completedAt: done ? nowIso() : "", updatedAt: nowIso() } : task);
    const completedTasks = tasks.filter((task) => task.done).length;
    const totalTasks = tasks.length;
    const ratio = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;
    const nextStatus = ratio >= target.completionThreshold ? "achieved" : "active";
    if (target.status === "achieved" && nextStatus === "active" && findActivePlanDuplicate(target.sourceHistoryId, target.sourceGroupIndex, target.sourcePlanIndex, target.id)) {
      throw new Error("同一方案已经有一条进行中的计划，请先删除或完成当前副本后再回退旧记录");
    }
    const updated = { ...target, tasks, status: nextStatus, achievedAt: nextStatus === "achieved" ? (target.achievedAt || nowIso()) : "", updatedAt: nowIso() };
    persistent.planBookEntries = entries.map((item) => item.id === entryId ? updated : item);
    if (nextStatus === "achieved" && target.status !== "achieved") prependActivity(`计划“${target.planName}”达到完成阈值`);
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function saveAiSettings(updates = {}) {
    aiSecrets = { provider: sanitizeProvider(updates.provider !== undefined ? updates.provider : aiSecrets.provider), baseUrl: normalizeBaseUrl(updates.provider !== undefined ? updates.provider : aiSecrets.provider, updates.baseUrl !== undefined ? updates.baseUrl : aiSecrets.baseUrl), model: String(updates.model !== undefined ? updates.model : aiSecrets.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL, apiKey: String(updates.apiKey !== undefined ? updates.apiKey : "").trim() || aiSecrets.apiKey };
    persistCurrentUser();
    return { user: currentUser, state };
  }

  async function testAiSettings(updates = {}, options = {}) {
    const previewSecrets = { provider: sanitizeProvider(updates.provider !== undefined ? updates.provider : aiSecrets.provider), baseUrl: normalizeBaseUrl(updates.provider !== undefined ? updates.provider : aiSecrets.provider, updates.baseUrl !== undefined ? updates.baseUrl : aiSecrets.baseUrl), model: String(updates.model !== undefined ? updates.model : aiSecrets.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL, apiKey: String(updates.apiKey !== undefined ? updates.apiKey : aiSecrets.apiKey || "").trim() };
    if (!previewSecrets.apiKey) throw new Error("请先填写 API Key 再测试");
    const result = await requestAiChat({ provider: previewSecrets.provider, apiKey: previewSecrets.apiKey, baseUrl: previewSecrets.baseUrl, model: previewSecrets.model, systemPrompt: "你是一个接口连通性测试助手。", systemContext: "只回复一句简短中文，例如：连接成功。", historyMessages: [], userMessage: "请只回复：连接成功" });
    if (options.signal && options.signal.aborted) throw new DOMException("Aborted", "AbortError");
    return { provider: previewSecrets.provider, model: previewSecrets.model, replyPreview: result.reply.slice(0, 60) };
  }

  async function deleteAiHistory(id) { persistent.aiHistory = normalizeAiHistory(persistent.aiHistory).filter((item) => item.id !== String(id)); conversations = normalizeConversations(conversations).map((conversation) => ({ ...conversation, messages: conversation.messages.filter((item) => String(item.historyId || "") !== String(id)) })); persistCurrentUser(); return { user: currentUser, state }; }
  async function clearAiHistory() { conversations = []; persistent.aiHistory = []; persistent.activeAiConversationId = null; persistCurrentUser(); return { user: currentUser, state }; }
  function hasStructuredPlanCapability() { return true; }

  function getProgressMetrics() {
    const stats = state.planBookStats || emptyPlanStats();
    const hasPlanBook = Array.isArray(state.planBookEntries) && state.planBookEntries.length > 0;
    const completedTasks = Math.max(0, Number(stats.completedTaskCount) || 0);
    const achievedCount = Math.max(0, Number(stats.achievedCount) || 0);
    const activeCount = Math.max(0, Number(stats.activeCount) || 0);
    const badges = [];
    if (state.mbti) badges.push({ title: "自我觉察者", description: "你已经完成 MBTI 识别，开始用更清晰的视角理解自己的行为模式。" });
    if (hasPlanBook && activeCount > 0) badges.push({ title: "计划启动者", description: `你已经把 ${activeCount} 个计划放进计划簿，开始把想法变成持续行动。` });
    if (completedTasks >= 3) badges.push({ title: "行动推进者", description: `你已经完成 ${completedTasks} 个计划任务，说明改变不只停留在想法里。` });
    if (completedTasks >= 8) badges.push({ title: "稳定练习者", description: "你已经形成连续执行的节奏，性格改善开始进入可积累阶段。" });
    if (achievedCount >= 1) badges.push({ title: "阶段达成者", description: `你已经达成 ${achievedCount} 个完整计划，说明你的改变开始跨过关键阈值。` });
    if (achievedCount >= 3) badges.push({ title: "持续进化者", description: "你已经连续完成多个计划，说明新的行为模式正在逐步稳定下来。" });
    const percent = hasPlanBook ? Math.max(0, Math.min(100, Math.round((state.mbti ? 10 : 0) + (Number(stats.overallProgressPercent) || 0) * 0.9))) : Math.max(0, Math.min(100, state.mbti ? 12 : 0));
    const nextMilestone = stats.currentPlanProgress ? Math.max(0, (Number(stats.currentPlanProgress.totalTasks) || 0) - (Number(stats.currentPlanProgress.completedTasks) || 0)) : Math.max(0, 1 - achievedCount);
    return { completedTasks, totalTasks: Math.max(0, Number(stats.totalTaskCount) || 0), achievedCount, activeCount, badges, percent, nextMilestone, usesPlanBook: hasPlanBook, planBookStats: stats };
  }

  function shouldShowOnboarding() { return Boolean(isAuthenticated() && !state.onboardingCompleted); }

  Object.assign(window.PersonalityApp, {
    initialize, fetchAppState, register, login, logout, getState, getUser, isAuthenticated,
    updatePreferences, toggleTheme, closeOnboarding, setSelectedScenario, setCurrentQuestion,
    answerQuestion, getNextUnansweredIndex, completeMBTI, manualSelectMbti, resetMBTI,
    addTodo, toggleTodoDone, requestCoach, setActiveAiConversation, loadAiConversationMessages,
    addPlanBookEntry, removePlanBookEntry, restartPlanBookEntry, togglePlanBookTask,
    updateAiConversation, deleteAiConversation, saveAiSettings, testAiSettings,
    deleteAiHistory, clearAiHistory, getProgressMetrics, hasStructuredPlanCapability,
    shouldShowOnboarding
  });
})();
