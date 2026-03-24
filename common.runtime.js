const LEGACY_STORAGE_KEY = "personality_app_state_v1";
const LEGACY_ONBOARDING_KEY = "personality_app_onboarded";
const TOTAL_QUESTIONS = 56;
const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
const SCENARIOS = ["团队会议", "冲突处理", "决策时刻", "压力管理", "自我表达"];

const questionBank = buildQuestions();
let currentUser = null;
let state = cloneDefaultState();

function cloneDefaultState() {
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
    aiConversations: [],
    activeConversationMessages: [],
    backendBuild: "unknown",
    backendCapabilities: {
      structuredPlan: false,
      planBook: false
    },
    planBookEntries: [],
    planBookStats: {
      activeCount: 0,
      achievedCount: 0,
      totalTaskCount: 0,
      completedTaskCount: 0,
      overallCompletionRatio: 0,
      overallProgressPercent: 0,
      currentPlanProgress: null,
      recentAchieved: null
    },
    aiSettings: {
      baseUrl: "",
      model: "gpt-4.1-mini",
      provider: "openai_compatible",
      hasApiKey: false,
      apiKeyMasked: ""
    }
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

function sanitizeScenario(value) {
  return SCENARIOS.includes(value) ? value : SCENARIOS[0];
}

function sanitizeConversationId(value) {
  const raw = String(value || "").trim();
  return raw ? raw : null;
}

function sanitizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function sanitizeMbtiType(value) {
  const raw = String(value || "").trim().toUpperCase();
  return MBTI_TYPES.includes(raw) ? raw : null;
}

function sanitizeMbtiSource(value) {
  return value === "manual" || value === "test" ? value : "none";
}

function sanitizeRadar(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .slice(0, 8);
}

function sanitizeTodos(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => ({
      id: String(item && item.id ? item.id : ""),
      text: String(item && item.text ? item.text : "").trim(),
      done: Boolean(item && item.done),
      createdAt: item && item.createdAt ? String(item.createdAt) : "",
      updatedAt: item && item.updatedAt ? String(item.updatedAt) : ""
    }))
    .filter((item) => item.id && item.text);
}

function sanitizeActivities(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
}

function sanitizeAiHistory(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate.map((item) => ({
    id: String(item && item.id ? item.id : cryptoRandomId()),
    scenario: String(item && item.scenario ? item.scenario : ""),
    goal: String(item && item.goal ? item.goal : ""),
    details: String(item && item.details ? item.details : ""),
    response: item && typeof item.response === "object" ? item.response : null,
    createdAt: String(item && item.createdAt ? item.createdAt : "")
  }));
}

function sanitizeAiConversations(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => ({
      id: sanitizeConversationId(item && item.id),
      title: String(item && item.title ? item.title : "新的对话").trim() || "新的对话",
      scenario: sanitizeScenario(item && item.scenario),
      createdAt: item && item.createdAt ? String(item.createdAt) : "",
      updatedAt: item && item.updatedAt ? String(item.updatedAt) : "",
      lastMessageAt: item && item.lastMessageAt ? String(item.lastMessageAt) : item && item.updatedAt ? String(item.updatedAt) : "",
      preview: String(item && item.preview ? item.preview : "").trim(),
      turnCount: Math.max(0, Number(item && item.turnCount) || 0)
    }))
    .filter((item) => item.id);
}

function sanitizeStructuredPlan(candidate) {
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.plan_groups)) {
    return null;
  }

  const planGroups = candidate.plan_groups
    .slice(0, 4)
    .map((group, groupIndex) => {
      const plans = Array.isArray(group && group.plans)
        ? group.plans
            .slice(0, 3)
            .map((plan, planIndex) => {
              const tasks = Array.isArray(plan && plan.tasks)
                ? plan.tasks
                    .slice(0, 6)
                    .map((task, taskIndex) => ({
                      task_description: String(task && task.task_description ? task.task_description : `任务 ${taskIndex + 1}`).trim()
                    }))
                    .filter((task) => task.task_description)
                : [];

              if (tasks.length < 1) return null;

              return {
                plan_name: String(plan && plan.plan_name ? plan.plan_name : `计划 ${planIndex + 1}`).trim(),
                plan_description: String(plan && plan.plan_description ? plan.plan_description : "").trim(),
                estimated_days: Math.max(1, Number(plan && plan.estimated_days) || 14),
                completion_threshold: Math.max(0, Math.min(1, Number(plan && plan.completion_threshold) || 0.75)),
                tasks
              };
            })
            .filter(Boolean)
        : [];

      if (!plans.length) return null;

      return {
        group_name: String(group && group.group_name ? group.group_name : `计划分组 ${groupIndex + 1}`).trim(),
        group_description: String(group && group.group_description ? group.group_description : "").trim(),
        plans
      };
    })
    .filter(Boolean);

  return planGroups.length ? { plan_groups: planGroups } : null;
}

function sanitizePlanBookEntries(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((entry) => {
      const tasks = Array.isArray(entry && entry.tasks)
        ? entry.tasks
            .map((task, index) => ({
              id: String(task && task.id ? task.id : cryptoRandomId()),
              taskDescription: String(task && task.taskDescription ? task.taskDescription : task && task.task_description ? task.task_description : `任务 ${index + 1}`).trim(),
              done: Boolean(task && task.done),
              sortOrder: Math.max(0, Number(task && task.sortOrder !== undefined ? task.sortOrder : task && task.sort_order) || index),
              completedAt: task && task.completedAt ? String(task.completedAt) : task && task.completed_at ? String(task.completed_at) : "",
              createdAt: task && task.createdAt ? String(task.createdAt) : task && task.created_at ? String(task.created_at) : "",
              updatedAt: task && task.updatedAt ? String(task.updatedAt) : task && task.updated_at ? String(task.updated_at) : ""
            }))
            .filter((task) => task.taskDescription)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [];

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((task) => task.done).length;
      const completionThreshold = Math.max(0, Math.min(1, Number(entry && entry.completionThreshold !== undefined ? entry.completionThreshold : entry && entry.completion_threshold) || 0.75));
      const completionRatio = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;
      const status = String(entry && entry.status ? entry.status : "active") === "achieved" || (totalTasks > 0 && completionRatio >= completionThreshold) ? "achieved" : "active";

      return {
        id: String(entry && entry.id ? entry.id : ""),
        sourceHistoryId: String(entry && entry.sourceHistoryId ? entry.sourceHistoryId : entry && entry.source_history_id ? entry.source_history_id : ""),
        conversationId: sanitizeConversationId(entry && entry.conversationId ? entry.conversationId : entry && entry.conversation_id),
        sourceGroupIndex: Math.max(0, Number(entry && entry.sourceGroupIndex !== undefined ? entry.sourceGroupIndex : entry && entry.source_group_index) || 0),
        sourcePlanIndex: Math.max(0, Number(entry && entry.sourcePlanIndex !== undefined ? entry.sourcePlanIndex : entry && entry.source_plan_index) || 0),
        groupName: String(entry && entry.groupName ? entry.groupName : entry && entry.group_name ? entry.group_name : "未命名分组").trim(),
        groupDescription: String(entry && entry.groupDescription ? entry.groupDescription : entry && entry.group_description ? entry.group_description : "").trim(),
        planName: String(entry && entry.planName ? entry.planName : entry && entry.plan_name ? entry.plan_name : "未命名计划").trim(),
        planDescription: String(entry && entry.planDescription ? entry.planDescription : entry && entry.plan_description ? entry.plan_description : "").trim(),
        estimatedDays: Math.max(1, Number(entry && entry.estimatedDays !== undefined ? entry.estimatedDays : entry && entry.estimated_days) || 14),
        completionThreshold,
        status,
        achievedAt: status === "achieved" ? String(entry && (entry.achievedAt || entry.achieved_at) ? (entry.achievedAt || entry.achieved_at) : "") : "",
        createdAt: entry && entry.createdAt ? String(entry.createdAt) : entry && entry.created_at ? String(entry.created_at) : "",
        updatedAt: entry && entry.updatedAt ? String(entry.updatedAt) : entry && entry.updated_at ? String(entry.updated_at) : "",
        totalTasks,
        completedTasks,
        completionRatio,
        tasks
      };
    })
    .filter((entry) => entry.id && entry.planName);
}

function sanitizePlanBookStats(candidate, entries) {
  const source = candidate || {};
  const list = Array.isArray(entries) ? entries : [];
  const activeEntries = list.filter((entry) => entry.status !== "achieved");
  const achievedEntries = list.filter((entry) => entry.status === "achieved");
  const totalTaskCount = list.reduce((sum, entry) => sum + (Number(entry.totalTasks) || 0), 0);
  const completedTaskCount = list.reduce((sum, entry) => sum + (Number(entry.completedTasks) || 0), 0);
  const overallCompletionRatio = totalTaskCount ? Number((completedTaskCount / totalTaskCount).toFixed(4)) : 0;
  const currentPlan = source.currentPlanProgress || (activeEntries[0] ? {
    entryId: activeEntries[0].id,
    planName: activeEntries[0].planName,
    completionRatio: activeEntries[0].completionRatio,
    completionThreshold: activeEntries[0].completionThreshold,
    completedTasks: activeEntries[0].completedTasks,
    totalTasks: activeEntries[0].totalTasks,
    estimatedDays: activeEntries[0].estimatedDays
  } : null);
  const recentAchieved = source.recentAchieved || (achievedEntries[0] ? {
    entryId: achievedEntries[0].id,
    planName: achievedEntries[0].planName,
    achievedAt: achievedEntries[0].achievedAt || achievedEntries[0].updatedAt || ""
  } : null);

  return {
    activeCount: Math.max(0, Number(source.activeCount) || activeEntries.length),
    achievedCount: Math.max(0, Number(source.achievedCount) || achievedEntries.length),
    totalTaskCount,
    completedTaskCount,
    overallCompletionRatio,
    overallProgressPercent: Math.max(0, Math.min(100, Number(source.overallProgressPercent) || Math.round(overallCompletionRatio * 100))),
    currentPlanProgress: currentPlan ? {
      entryId: String(currentPlan.entryId || ""),
      planName: String(currentPlan.planName || "").trim(),
      completionRatio: Math.max(0, Math.min(1, Number(currentPlan.completionRatio) || 0)),
      completionThreshold: Math.max(0, Math.min(1, Number(currentPlan.completionThreshold) || 0.75)),
      completedTasks: Math.max(0, Number(currentPlan.completedTasks) || 0),
      totalTasks: Math.max(0, Number(currentPlan.totalTasks) || 0),
      estimatedDays: Math.max(1, Number(currentPlan.estimatedDays) || 14)
    } : null,
    recentAchieved: recentAchieved ? {
      entryId: String(recentAchieved.entryId || ""),
      planName: String(recentAchieved.planName || "").trim(),
      achievedAt: String(recentAchieved.achievedAt || "")
    } : null
  };
}
function sanitizeAiMessages(candidate) {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => ({
      id: String(item && item.id ? item.id : cryptoRandomId()),
      turnId: String(item && item.turnId ? item.turnId : ""),
      historyId: String(item && item.historyId ? item.historyId : item && item.turnId ? item.turnId : ""),
      role: String(item && item.role ? item.role : "assistant") === "user" ? "user" : "assistant",
      text: String(item && item.text ? item.text : "").trim(),
      details: String(item && item.details ? item.details : ""),
      structuredPlan: sanitizeStructuredPlan(item && item.structuredPlan),
      createdAt: item && item.createdAt ? String(item.createdAt) : ""
    }))
    .filter((item) => item.text || item.structuredPlan);
}

function sanitizeAiSettings(candidate) {
  const source = candidate || {};
  return {
    baseUrl: String(source.baseUrl || "").trim(),
    model: String(source.model || "gpt-4.1-mini").trim() || "gpt-4.1-mini",
    provider: String(source.provider || "openai_compatible").trim() === "gemini_native" ? "gemini_native" : "openai_compatible",
    hasApiKey: Boolean(source.hasApiKey),
    apiKeyMasked: String(source.apiKeyMasked || "")
  };
}function sanitizeBackendCapabilities(candidate) {
  const source = candidate || {};
  return {
    structuredPlan: Boolean(source.structuredPlan),
    planBook: Boolean(source.planBook)
  };
}

function sanitizeBackendBuild(value) {
  const raw = String(value || "").trim();
  return raw || "unknown";
}

function hasStructuredPlanCapability(source) {
  const capabilities = sanitizeBackendCapabilities(source && source.backendCapabilities);
  return capabilities.structuredPlan && capabilities.planBook;
}

function isValidStructuredPlanPayload(payload) {
  const groups = payload && payload.structuredPlan && Array.isArray(payload.structuredPlan.plan_groups)
    ? payload.structuredPlan.plan_groups
    : [];
  return payload && payload.mode === "structured-plan" && groups.length > 0;
}


function sanitizeState(candidate) {
  const source = candidate || {};
  const mbti = sanitizeMbtiType(source.mbti);
  const mbtiSource = mbti ? sanitizeMbtiSource(source.mbtiSource) : "none";
  const selectedScenario = sanitizeScenario(source.selectedScenario);
  const planBookEntries = sanitizePlanBookEntries(source.planBookEntries);

  return {
    currentQuestion: Math.min(TOTAL_QUESTIONS - 1, Math.max(0, Number(source.currentQuestion) || 0)),
    answers: sanitizeAnswers(source.answers),
    mbti,
    mbtiSource,
    reliability: mbtiSource === "test" ? Math.max(0, Math.min(100, Number(source.reliability) || 0)) : 0,
    match: mbtiSource === "test" ? Math.max(0, Math.min(100, Number(source.match) || 0)) : 0,
    radar: mbti ? sanitizeRadar(source.radar) : [],
    selectedScenario,
    draftScenario: sanitizeScenario(source.draftScenario || selectedScenario),
    activeAiConversationId: sanitizeConversationId(source.activeAiConversationId),
    theme: sanitizeTheme(source.theme),
    onboardingCompleted: Boolean(source.onboardingCompleted),
    importedFromLocal: Boolean(source.importedFromLocal),
    todos: sanitizeTodos(source.todos),
    activities: sanitizeActivities(source.activities),
    aiHistory: sanitizeAiHistory(source.aiHistory),
    aiConversations: sanitizeAiConversations(source.aiConversations),
    activeConversationMessages: sanitizeAiMessages(source.activeConversationMessages),
    backendBuild: sanitizeBackendBuild(source.backendBuild),
    backendCapabilities: sanitizeBackendCapabilities(source.backendCapabilities),
    planBookEntries,
    planBookStats: sanitizePlanBookStats(source.planBookStats, planBookEntries),
    aiSettings: sanitizeAiSettings(source.aiSettings)
  };
}

function setStateFromServer(serverState) {
  state = sanitizeState(serverState);
  applyTheme();
  return state;
}

function resetAuthState() {
  currentUser = null;
  state = cloneDefaultState();
  applyTheme();
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
}

function cryptoRandomId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function dispatchAuthRequired() {
  window.dispatchEvent(new CustomEvent("app:auth-required"));
}

async function apiFetch(url, options = {}) {
  const requestInit = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    signal: options.signal
  };

  if (options.body !== undefined) {
    requestInit.headers["Content-Type"] = "application/json";
    requestInit.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, requestInit);
  } catch (cause) {
    if (cause && (cause.name === "AbortError" || cause.code === 20)) {
      throw cause;
    }
    const networkError = new Error("无法连接到服务端，请先运行 npm start 并访问 http://localhost:3000");
    networkError.cause = cause;
    throw networkError;
  }

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      const plainText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      data = plainText ? { message: plainText } : {};
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || `请求失败：${response.status}`);
    error.status = response.status;
    error.payload = data;

    if (response.status === 401 && !options.allowUnauthorized) {
      resetAuthState();
      dispatchAuthRequired();
    }

    throw error;
  }

  return data;
}

async function initialize() {
  try {
    const session = await apiFetch("/api/auth/session", { allowUnauthorized: true });
    if (session.authenticated) {
      currentUser = session.user;
      await fetchAppState();
      return { authenticated: true, user: currentUser };
    }
  } catch (error) {
    console.error("Session bootstrap failed", error);
  }

  resetAuthState();
  return { authenticated: false, user: null };
}

async function fetchAppState() {
  const payload = await apiFetch("/api/app-state");
  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

function readLegacyLocalData() {
  const rawState = localStorage.getItem(LEGACY_STORAGE_KEY);
  const rawOnboarding = localStorage.getItem(LEGACY_ONBOARDING_KEY);

  if (!rawState && rawOnboarding === null) {
    return null;
  }

  let parsedState = {};
  if (rawState) {
    try {
      parsedState = JSON.parse(rawState);
    } catch (error) {
      parsedState = {};
    }
  }

  return {
    state: parsedState,
    onboardingCompleted: rawOnboarding === "1"
  };
}

function clearLegacyLocalData() {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ONBOARDING_KEY);
}

async function maybeImportLegacyLocalData() {
  const legacy = readLegacyLocalData();
  if (!legacy) {
    return { imported: false };
  }

  const payload = await apiFetch("/api/app-state/import-local", {
    method: "POST",
    body: legacy,
    allowUnauthorized: false
  });

  if (payload.imported || (payload.state && payload.state.importedFromLocal)) {
    clearLegacyLocalData();
  }

  if (payload.state) {
    currentUser = payload.user || currentUser;
    setStateFromServer(payload.state);
  }

  return payload;
}

async function register(username, password) {
  const data = await apiFetch("/api/auth/register", {
    method: "POST",
    body: { username, password },
    allowUnauthorized: true
  });

  currentUser = data.user;
  if (data.state) {
    setStateFromServer(data.state);
  }

  try {
    await maybeImportLegacyLocalData();
    await fetchAppState();
  } catch (error) {
    console.warn("Post-register bootstrap failed", error);
    if (!data.state) {
      throw error;
    }
  }

  return data;
}

async function login(username, password) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { username, password },
    allowUnauthorized: true
  });

  currentUser = data.user;
  if (data.state) {
    setStateFromServer(data.state);
  }

  try {
    await maybeImportLegacyLocalData();
    await fetchAppState();
  } catch (error) {
    console.warn("Post-login bootstrap failed", error);
    if (!data.state) {
      throw error;
    }
  }

  return data;
}

async function logout() {
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      allowUnauthorized: true
    });
  } finally {
    resetAuthState();
  }
}

function getState() {
  return state;
}

function getUser() {
  return currentUser;
}

function isAuthenticated() {
  return Boolean(currentUser && currentUser.id);
}

async function updatePreferences(updates) {
  const payload = await apiFetch("/api/preferences", {
    method: "PUT",
    body: updates
  });
  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function toggleTheme() {
  const nextTheme = state.theme === "light" ? "dark" : "light";
  return updatePreferences({ theme: nextTheme });
}

async function closeOnboarding() {
  return updatePreferences({ onboardingCompleted: true });
}

async function setSelectedScenario(selectedScenario) {
  return updatePreferences({ selectedScenario });
}

async function persistMbtiProgress() {
  const payload = await apiFetch("/api/mbti/progress", {
    method: "PUT",
    body: {
      currentQuestion: state.currentQuestion,
      answers: state.answers
    }
  });
  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function setCurrentQuestion(index) {
  state = sanitizeState({ ...state, currentQuestion: index });
  return persistMbtiProgress();
}

async function answerQuestion(index, value) {
  const nextAnswers = state.answers.slice();
  if (index < 0 || index >= TOTAL_QUESTIONS) return null;
  nextAnswers[index] = Number(value);
  state = sanitizeState({ ...state, answers: nextAnswers });
  return persistMbtiProgress();
}

function getNextUnansweredIndex() {
  const index = state.answers.findIndex((item) => item === null);
  return index === -1 ? 0 : index;
}

async function completeMBTI() {
  if (state.answers.some((item) => item === null)) {
    return { ok: false, message: "还有未完成题目，请先答完56题" };
  }

  const payload = await apiFetch("/api/mbti/complete", {
    method: "POST",
    body: {
      answers: state.answers
    }
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return {
    ok: true,
    type: payload.result.mbti,
    result: payload.result
  };
}

async function manualSelectMbti(mbti) {
  const payload = await apiFetch("/api/mbti/manual-select", {
    method: "PUT",
    body: { mbti }
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function resetMBTI() {
  const payload = await apiFetch("/api/mbti/reset", {
    method: "POST"
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function addTodo(text) {
  const payload = await apiFetch("/api/todos", {
    method: "POST",
    body: { text }
  });
  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function toggleTodoDone(id, done) {
  const payload = await apiFetch(`/api/todos/${id}`, {
    method: "PATCH",
    body: { done }
  });
  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function requestCoach(input) {
  const payload = await apiFetch("/api/coach", {
    method: "POST",
    body: input
  });

  if (!isValidStructuredPlanPayload(payload)) {
    throw new Error("当前服务返回了旧版聊天结果，不支持计划方案。请重启最新版愈格服务后再试。");
  }

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function setActiveAiConversation(conversationId) {
  const payload = await apiFetch("/api/ai-conversations/active", {
    method: "POST",
    body: { conversationId: conversationId || null }
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function loadAiConversationMessages(conversationId) {
  return apiFetch(`/api/ai-conversations/${encodeURIComponent(conversationId)}/messages`);
}

async function updateAiConversation(conversationId, updates) {
  const payload = await apiFetch(`/api/ai-conversations/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: updates
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function deleteAiConversation(conversationId) {
  const payload = await apiFetch(`/api/ai-conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE"
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function addPlanBookEntry(sourceHistoryId, groupIndex, planIndex) {
  const payload = await apiFetch("/api/plan-book", {
    method: "POST",
    body: { sourceHistoryId, groupIndex, planIndex }
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function removePlanBookEntry(entryId) {
  const payload = await apiFetch(`/api/plan-book/${encodeURIComponent(entryId)}`, {
    method: "DELETE"
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function restartPlanBookEntry(entryId) {
  const payload = await apiFetch(`/api/plan-book/${encodeURIComponent(entryId)}/restart`, {
    method: "POST"
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function togglePlanBookTask(entryId, taskId, done) {
  const payload = await apiFetch(`/api/plan-book/${encodeURIComponent(entryId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: { done }
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}
async function saveAiSettings(updates) {
  const payload = await apiFetch("/api/ai-settings", {
    method: "PUT",
    body: updates
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function testAiSettings(updates, options = {}) {
  return apiFetch("/api/ai-settings/test", {
    method: "POST",
    body: updates,
    signal: options.signal
  });
}

async function deleteAiHistory(id) {
  const payload = await apiFetch(`/api/ai-history/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

async function clearAiHistory() {
  const payload = await apiFetch("/api/ai-history?scope=all", {
    method: "DELETE"
  });

  currentUser = payload.user;
  setStateFromServer(payload.state);
  return payload;
}

function getProgressMetrics() {
  const planStats = state.planBookStats || {};
  const hasPlanBook = Array.isArray(state.planBookEntries) && state.planBookEntries.length > 0;
  const completedTasks = Math.max(0, Number(planStats.completedTaskCount) || 0);
  const totalTasks = Math.max(0, Number(planStats.totalTaskCount) || 0);
  const achievedCount = Math.max(0, Number(planStats.achievedCount) || 0);
  const activeCount = Math.max(0, Number(planStats.activeCount) || 0);

  const badges = [];
  if (state.mbti) {
    badges.push({
      title: "自我觉察者",
      description: "你已经完成 MBTI 识别，开始用更清晰的视角理解自己的行为模式。"
    });
  }
  if (hasPlanBook && activeCount > 0) {
    badges.push({
      title: "计划启动者",
      description: `你已经把 ${activeCount} 个计划放进计划簿，开始把想法变成持续行动。`
    });
  }
  if (completedTasks >= 3) {
    badges.push({
      title: "行动推进者",
      description: `你已经完成 ${completedTasks} 个计划任务，说明改变不只停留在想法里。`
    });
  }
  if (completedTasks >= 8) {
    badges.push({
      title: "稳定练习者",
      description: "你已经形成连续执行的节奏，性格改善开始进入可积累阶段。"
    });
  }
  if (achievedCount >= 1) {
    badges.push({
      title: "阶段达成者",
      description: `你已经达成 ${achievedCount} 个完整计划，说明你的改变开始跨过关键阈值。`
    });
  }
  if (achievedCount >= 3) {
    badges.push({
      title: "持续进化者",
      description: "你已经连续完成多个计划，说明新的行为模式正在逐步稳定下来。"
    });
  }

  const percent = hasPlanBook
    ? Math.max(0, Math.min(100, Math.round((state.mbti ? 10 : 0) + (Number(planStats.overallProgressPercent) || 0) * 0.9)))
    : Math.max(0, Math.min(100, state.mbti ? 12 : 0));

  const nextMilestone = (() => {
    const currentPlan = planStats.currentPlanProgress || null;
    if (!currentPlan) return Math.max(0, 1 - achievedCount);
    return Math.max(0, (Number(currentPlan.totalTasks) || 0) - (Number(currentPlan.completedTasks) || 0));
  })();

  return {
    completedTasks,
    totalTasks,
    achievedCount,
    activeCount,
    badges,
    percent,
    nextMilestone,
    usesPlanBook: hasPlanBook,
    planBookStats: planStats
  };
}

function setRingProgress(circleEl, percent) {
  if (!circleEl) return;
  const r = 50;
  const c = 2 * Math.PI * r;
  circleEl.style.strokeDasharray = `${c}`;
  circleEl.style.strokeDashoffset = `${c * (1 - percent / 100)}`;
}

function notify(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

function shouldShowOnboarding() {
  return Boolean(isAuthenticated() && !state.onboardingCompleted);
}

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTypeRadar(type) {
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

const TYPE_PROFILE_MAP = {
  INTJ: {
    strengths: ["战略感强", "能独立拆解复杂问题", "对长期目标有耐心"],
    improvements: ["更早同步想法", "给协作者留解释空间", "别把标准压得过高"],
    interaction: "和高情感型伙伴合作时，先表达理解再给建议，推进会更顺。"
  },
  INTP: {
    strengths: ["好奇心强", "擅长抽象分析", "能提出非惯性方案"],
    improvements: ["把想法更早落成行动", "减少无限比较选项", "重要关系里别只讲逻辑"],
    interaction: "面对执行型同伴时，先给结论和下一步，再补充推理过程。"
  },
  ENTJ: {
    strengths: ["目标感鲜明", "组织推进能力强", "遇到复杂局面能快速拍板"],
    improvements: ["给团队留反馈窗口", "注意他人的接受节奏", "少把高标准变成压迫感"],
    interaction: "和内向型成员配合时，先明确期待和边界，对方会更愿意跟进。"
  },
  ENTP: {
    strengths: ["点子多", "反应快", "擅长从不同角度重组问题"],
    improvements: ["减少只开头不收尾", "讨论时别压过他人声音", "给承诺设完成节点"],
    interaction: "与稳健型同伴合作时，先把创意变成两三个可执行版本，更容易获得支持。"
  },
  INFJ: {
    strengths: ["洞察人心", "能兼顾意义与方向", "愿意长期陪伴成长"],
    improvements: ["别把太多情绪憋在心里", "适度说清自己的边界", "理想落地时多看现实约束"],
    interaction: "与直接型伙伴沟通时，先讲事实再讲感受，彼此更容易对齐。"
  },
  INFP: {
    strengths: ["同理心强", "创造力高", "价值驱动行动"],
    improvements: ["减少自我苛责", "提高决策速度", "把想法及时落地"],
    interaction: "与ESTJ相处时，直接表达需求并认可对方的组织能力。"
  },
  ENFJ: {
    strengths: ["带动氛围能力强", "擅长理解群体需要", "愿意主动扶持别人"],
    improvements: ["别为照顾所有人而透支", "学会区分帮助和包办", "做决定时保留自己的立场"],
    interaction: "和理性型成员合作时，把共情和目标拆开表达，会更有说服力。"
  },
  ENFP: {
    strengths: ["感染力强", "善于发现可能性", "愿意主动连接人和资源"],
    improvements: ["减少三分钟热度", "重要计划要设回看点", "情绪起伏时先稳住节奏"],
    interaction: "面对保守型同伴时，先给一个小试点，比一下子讲大蓝图更有效。"
  },
  ISTJ: {
    strengths: ["可靠稳定", "注重细节和秩序", "责任心持续在线"],
    improvements: ["别把变化都当风险", "适度表达情绪和需求", "尝试给创新一点试错空间"],
    interaction: "与发散型伙伴合作时，先约定底线和时点，再给对方一定自由度。"
  },
  ISFJ: {
    strengths: ["体贴周到", "执行认真", "擅长维持关系稳定"],
    improvements: ["少一点隐忍和讨好", "遇到不舒服及时说", "别只替别人负责"],
    interaction: "和强势型对象沟通时，用具体事实表达需求，比暗示更容易被看见。"
  },
  ESTJ: {
    strengths: ["执行力强", "组织清晰", "责任意识稳定"],
    improvements: ["增加倾听耐心", "放宽对流程的控制", "关注情绪信号"],
    interaction: "与INFP合作时，先确认感受再讨论执行细节。"
  },
  ESFJ: {
    strengths: ["善于协调关系", "照顾集体氛围", "推动事情落实很踏实"],
    improvements: ["别过度依赖外界认可", "拒绝时更坚定", "面对冲突时少回避"],
    interaction: "和独立型伙伴合作时，先说明你的期待，再给对方保留自主空间。"
  },
  ISTP: {
    strengths: ["冷静务实", "动手解决问题快", "在压力下能保持判断"],
    improvements: ["别总把真实感受压后", "重要关系里多一点回应", "避免拖到最后才处理"],
    interaction: "与高表达型同伴合作时，及时给一句反馈，能减少很多误解。"
  },
  ISFP: {
    strengths: ["审美和感受细腻", "有自己的价值底线", "待人真诚温和"],
    improvements: ["别长期回避冲突", "练习把内心感受说出来", "把喜欢的事做成稳定习惯"],
    interaction: "和结果导向型对象沟通时，先说你的需求和底线，别只靠对方猜。"
  },
  ESTP: {
    strengths: ["行动快", "适应变化强", "擅长现场破局"],
    improvements: ["重大决定别只看眼前", "给承诺留复盘", "冲动前先停十秒"],
    interaction: "与谨慎型伙伴合作时，先说明风险控制方案，更容易获得信任。"
  },
  ESFP: {
    strengths: ["亲和力高", "现场带动感强", "愿意把快乐和资源分享出去"],
    improvements: ["分清即时感受和长期目标", "别因怕冷场而过度迎合", "建立更稳定的节奏感"],
    interaction: "和高标准型伙伴沟通时，先把重点和结果说清楚，再展开细节会更顺。"
  }
};

function getTypeProfile(type) {
  const normalized = sanitizeMbtiType(type);
  if (!normalized) {
    return {
      strengths: ["学习意愿积极", "愿意反思", "适应性不错"],
      improvements: ["建立固定复盘", "把目标拆到最小步骤", "强化反馈记录"],
      interaction: "面对差异类型时，先确认共同目标，再分配沟通方式。",
      radar: buildTypeRadar("INFP")
    };
  }

  return {
    ...TYPE_PROFILE_MAP[normalized],
    radar: buildTypeRadar(normalized)
  };
}

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

window.PersonalityApp = {
  TOTAL_QUESTIONS,
  SCENARIOS,
  questionBank,
  MBTI_TYPES,
  initialize,
  fetchAppState,
  register,
  login,
  logout,
  getState,
  getUser,
  isAuthenticated,
  updatePreferences,
  toggleTheme,
  closeOnboarding,
  setSelectedScenario,
  setCurrentQuestion,
  answerQuestion,
  getNextUnansweredIndex,
  completeMBTI,
  manualSelectMbti,
  resetMBTI,
  addTodo,
  toggleTodoDone,
  requestCoach,
  setActiveAiConversation,
  loadAiConversationMessages,
  addPlanBookEntry,
  removePlanBookEntry,
  restartPlanBookEntry,
  togglePlanBookTask,
  updateAiConversation,
  deleteAiConversation,
  saveAiSettings,
  testAiSettings,
  deleteAiHistory,
  clearAiHistory,
  getProgressMetrics,
  hasStructuredPlanCapability,
  setRingProgress,
  shouldShowOnboarding,
  applyTheme,
  notify,
  escapeHTML,
  getTypeProfile
};


















