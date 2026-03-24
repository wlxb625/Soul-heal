const app = window.PersonalityApp;
let radarChart = null;
let activeModule = "home";
let authMode = "login";
let latestCoachResponse = null;
let coachNotice = null;
let apiTestNotice = null;
let activeApiTestController = null;
let pendingCoachMessage = null;
const deletingHistoryIds = new Set();
const expandedAchievedPlanIds = new Set();
const achievedMonthVisibility = new Map();

const API_SERVICE_CONFIG = {
  openai: {
    label: "OpenAI",
    defaultProvider: "openai_compatible",
    compatible: {
      provider: "openai_compatible",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"]
    }
  },
  deepseek: {
    label: "DeepSeek",
    defaultProvider: "openai_compatible",
    compatible: {
      provider: "openai_compatible",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      models: ["deepseek-chat", "deepseek-reasoner"]
    }
  },
  gemini: {
    label: "Gemini",
    defaultProvider: "gemini_native",
    compatible: {
      provider: "openai_compatible",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-flash",
      models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]
    },
    native: {
      provider: "gemini_native",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
      models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]
    }
  }
};

const MODULE_NAMES = ["home", "mbti", "analysis", "coach", "progress", "settings"];
const MODULE_PATH_MAP = {
  "/": "home",
  "/mbti": "mbti",
  "/analysis": "analysis",
  "/coach": "coach",
  "/progress": "progress",
  "/settings": "settings"
};

const els = {
  authShell: document.getElementById("authShell"),
  siteShell: document.getElementById("siteShell"),
  authForm: document.getElementById("authForm"),
  authModeTitle: document.getElementById("authModeTitle"),
  authModeCopy: document.getElementById("authModeCopy"),
  authUsername: document.getElementById("authUsername"),
  authPassword: document.getElementById("authPassword"),
  authConfirmWrap: document.getElementById("authConfirmWrap"),
  authConfirm: document.getElementById("authConfirm"),
  authSubmit: document.getElementById("authSubmit"),
  authTogglePrompt: document.getElementById("authTogglePrompt"),
  authToggleBtn: document.getElementById("authToggleBtn"),

  moduleNav: document.getElementById("moduleNav"),
  panels: {
    home: document.getElementById("module-home"),
    mbti: document.getElementById("module-mbti"),
    analysis: document.getElementById("module-analysis"),
    coach: document.getElementById("module-coach"),
    progress: document.getElementById("module-progress"),
    settings: document.getElementById("module-settings")
  },
  userPill: document.getElementById("userPill"),
  logoutBtn: document.getElementById("logoutBtn"),
  themeToggle: document.getElementById("themeToggle"),
  continueTestBtn: document.getElementById("continueTestBtn"),
  homeCoachBtn: document.getElementById("homeCoachBtn"),
  homeMbtiBtn: document.getElementById("homeMbtiBtn"),

  homeMbti: document.getElementById("homeMbti"),
  homeTodos: document.getElementById("homeTodos"),
  homeProgress: document.getElementById("homeProgress"),
  homeMilestone: document.getElementById("homeMilestone"),
  homeAiCount: document.getElementById("homeAiCount"),
  homeCoachHeadline: document.getElementById("homeCoachHeadline"),
  homeCoachSummary: document.getElementById("homeCoachSummary"),

  questionBox: document.getElementById("questionBox"),
  optionBox: document.getElementById("optionBox"),
  questionDots: document.getElementById("questionDots"),
  mbtiResult: document.getElementById("mbtiResult"),
  manualMbtiSelect: document.getElementById("manualMbtiSelect"),
  saveManualMbtiBtn: document.getElementById("saveManualMbtiBtn"),
  manualMbtiHint: document.getElementById("manualMbtiHint"),
  prevQuestion: document.getElementById("prevQuestion"),
  nextQuestion: document.getElementById("nextQuestion"),
  finishTest: document.getElementById("finishTest"),

  typeSummary: document.getElementById("typeSummary"),
  radarChart: document.getElementById("radarChart"),
  radarFallback: document.getElementById("radarFallback"),
  strengthList: document.getElementById("strengthList"),
  improveList: document.getElementById("improveList"),
  interactionAdvice: document.getElementById("interactionAdvice"),

  conversationHistoryList: document.getElementById("conversationHistoryList"),
  newConversationBtn: document.getElementById("newConversationBtn"),
  deleteConversationBtn: document.getElementById("deleteConversationBtn"),
  coachHistoryCount: document.getElementById("coachHistoryCount"),
  coachConversationTitle: document.getElementById("coachConversationTitle"),
  coachConversationMeta: document.getElementById("coachConversationMeta"),
  coachScenarioSelect: document.getElementById("coachScenarioSelect"),
  goalInput: document.getElementById("goalInput"),
  askAiBtn: document.getElementById("askAiBtn"),
  clearAiHistoryBtn: document.getElementById("clearAiHistoryBtn"),
  aiResponse: document.getElementById("aiResponse"),
  coachConfigStatus: document.getElementById("coachConfigStatus"),
  coachNotice: document.getElementById("coachNotice"),

  settingsTheme: document.getElementById("settingsTheme"),
  settingsScenario: document.getElementById("settingsScenario"),
  settingsMbtiSelect: document.getElementById("settingsMbtiSelect"),
  settingsMbtiSummary: document.getElementById("settingsMbtiSummary"),
  saveSettingsMbtiBtn: document.getElementById("saveSettingsMbtiBtn"),
  saveBasicSettingsBtn: document.getElementById("saveBasicSettingsBtn"),
  reopenOnboardingBtn: document.getElementById("reopenOnboardingBtn"),
  settingsUsername: document.getElementById("settingsUsername"),
  apiServiceSelect: document.getElementById("apiServiceSelect"),
  apiProviderSelect: document.getElementById("apiProviderSelect"),
  apiBaseUrlInput: document.getElementById("apiBaseUrlInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiModelSelect: document.getElementById("apiModelSelect"),
  saveApiSettingsBtn: document.getElementById("saveApiSettingsBtn"),
  testApiSettingsBtn: document.getElementById("testApiSettingsBtn"),
  apiTestStatus: document.getElementById("apiTestStatus"),

  ringValue: document.getElementById("ringValue"),
  progressText: document.getElementById("progressText"),
  planOverviewCards: document.getElementById("planOverviewCards"),
  activePlanList: document.getElementById("activePlanList"),
  achievedPlanList: document.getElementById("achievedPlanList"),
  activityList: document.getElementById("activityList"),
  badgeList: document.getElementById("badgeList"),
  milestoneText: document.getElementById("milestoneText"),

  onboardingModal: document.getElementById("onboardingModal"),
  closeOnboarding: document.getElementById("closeOnboarding")
};

init();

async function init() {
  bindEvents();
  ensureMbtiSelectOptions(els.manualMbtiSelect);
  ensureMbtiSelectOptions(els.settingsMbtiSelect);

  try {
    const session = await app.initialize();
    if (session.authenticated) {
      hydrateLatestCoachResponse();
      showAppShell();
      renderAll();
      restoreModuleFromURL();
      renderOnboarding();
      return;
    }
  } catch (error) {
    console.error("App bootstrap failed", error);
  }

  showAuthShell("login");
}

function bindEvents() {
  els.authToggleBtn.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    updateAuthModeUI();
  });

  els.authForm.addEventListener("submit", handleAuthSubmit);

  els.moduleNav.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => switchModule(button.dataset.module));
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => switchModule(button.dataset.jump));
  });

  window.addEventListener("hashchange", restoreModuleFromURL);

  window.addEventListener("app:auth-required", () => {
    latestCoachResponse = null;
    pendingCoachMessage = null;
    deletingHistoryIds.clear();
    hideOnboarding();
    showAuthShell("login");
    app.notify("登录已失效，请重新登录");
  });

  els.themeToggle.addEventListener("click", async () => {
    try {
      await app.toggleTheme();
      renderAll();
    } catch (error) {
      app.notify(error.message || "主题切换失败");
    }
  });

  els.continueTestBtn.addEventListener("click", async () => {
    const state = app.getState();

    if (hasCompletedMbtiState(state)) {
      switchModule("mbti");
      app.notify("当前测试已完成，你可以选择是否重新测试");
      return;
    }

    if (hasManualMbtiState(state)) {
      switchModule("mbti");
      app.notify("当前是手动选择结果，你可以直接开始正式测试");
      return;
    }

    try {
      await app.setCurrentQuestion(app.getNextUnansweredIndex());
      renderMBTI();
      switchModule("mbti");
      app.notify("已跳转到上次未完成题目");
    } catch (error) {
      app.notify(error.message || "无法恢复测试进度");
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    await app.logout();
    latestCoachResponse = null;
    pendingCoachMessage = null;
    deletingHistoryIds.clear();
    hideOnboarding();
    clearAuthForm();
    showAuthShell("login");
    app.notify("已退出登录");
  });

  els.homeCoachBtn.addEventListener("click", () => switchModule("coach"));
  els.homeMbtiBtn.addEventListener("click", () => switchModule("mbti"));

  els.closeOnboarding.addEventListener("click", async () => {
    try {
      await app.closeOnboarding();
      hideOnboarding();
    } catch (error) {
      app.notify(error.message || "引导状态保存失败");
    }
  });

  els.prevQuestion.addEventListener("click", async () => {
    try {
      await app.setCurrentQuestion(app.getState().currentQuestion - 1);
      renderMBTI();
    } catch (error) {
      app.notify(error.message || "无法切换题目");
    }
  });

  els.nextQuestion.addEventListener("click", async () => {
    try {
      await app.setCurrentQuestion(app.getState().currentQuestion + 1);
      renderMBTI();
    } catch (error) {
      app.notify(error.message || "无法切换题目");
    }
  });

  els.finishTest.addEventListener("click", async () => {
    try {
      const result = await app.completeMBTI();
      if (!result.ok) {
        app.notify(result.message);
        return;
      }

      renderAll();
      switchModule("analysis");
      app.notify("测试已完成，分析已更新");
    } catch (error) {
      app.notify(error.message || "测试提交失败");
    }
  });

  els.saveManualMbtiBtn.addEventListener("click", () => saveSelectedMbti("mbti"));
  els.saveSettingsMbtiBtn.addEventListener("click", () => saveSelectedMbti("settings"));
  els.askAiBtn.addEventListener("click", askAI);
  els.clearAiHistoryBtn.addEventListener("click", clearAllAiHistory);
  els.newConversationBtn.addEventListener("click", startNewConversation);
  els.deleteConversationBtn.addEventListener("click", deleteCurrentConversation);
  els.coachScenarioSelect.addEventListener("change", handleConversationScenarioChange);
  els.goalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askAI();
    }
  });

  els.saveBasicSettingsBtn.addEventListener("click", saveBasicSettings);
  els.reopenOnboardingBtn.addEventListener("click", async () => {
    try {
      await app.updatePreferences({ onboardingCompleted: false });
      renderAll();
      els.onboardingModal.classList.remove("hidden");
      app.notify("已重新显示新手引导");
    } catch (error) {
      app.notify(error.message || "引导设置更新失败");
    }
  });
  els.saveApiSettingsBtn.addEventListener("click", saveApiSettings);
  els.testApiSettingsBtn.addEventListener("click", testAiSettings);
  els.apiServiceSelect.addEventListener("change", () => {
    applyApiServiceSelection(els.apiServiceSelect.value, els.apiProviderSelect.value, "service");
    cancelPendingApiTest("已取消当前检测，请确认新的服务商配置后重新测试。");
  });
  els.apiProviderSelect.addEventListener("change", () => {
    applyApiServiceSelection(els.apiServiceSelect.value, els.apiProviderSelect.value, "interface");
    cancelPendingApiTest("已取消当前检测，请确认新的接口类型后重新测试。");
  });
  els.apiModelSelect.addEventListener("change", () => {
    cancelPendingApiTest("已取消当前检测，请确认新的模型后重新测试。");
  });
}

function showAuthShell(mode) {
  authMode = mode || "login";
  updateAuthModeUI();
  els.authShell.classList.remove("hidden");
  els.siteShell.classList.add("hidden");
  document.body.setAttribute("data-locked", "true");
}

function showAppShell() {
  const user = app.getUser();
  els.authShell.classList.add("hidden");
  els.siteShell.classList.remove("hidden");
  document.body.removeAttribute("data-locked");
  els.userPill.textContent = user ? user.username : "";
  els.userPill.classList.toggle("hidden", !user);
}

function updateAuthModeUI() {
  const isLogin = authMode === "login";
  els.authModeTitle.textContent = isLogin ? "登录" : "注册";
  els.authModeCopy.textContent = isLogin
    ? "输入用户名和密码，进入你的专属成长空间。"
    : "创建你的愈格账号，保存测试、任务与 AI 历史。";
  els.authSubmit.textContent = isLogin ? "登录" : "注册并进入";
  els.authTogglePrompt.textContent = isLogin ? "还没有账号？" : "已经有账号了？";
  els.authToggleBtn.textContent = isLogin ? "立即注册" : "返回登录";
  els.authConfirmWrap.classList.toggle("hidden", isLogin);
  els.authConfirm.required = !isLogin;
  els.authPassword.setAttribute("autocomplete", isLogin ? "current-password" : "new-password");
}

function clearAuthForm() {
  els.authForm.reset();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  const confirm = els.authConfirm.value;

  if (!username || !password) {
    app.notify("请填写完整信息");
    return;
  }

  if (authMode === "register" && password !== confirm) {
    app.notify("两次输入的密码不一致");
    return;
  }

  const isLogin = authMode === "login";
  els.authSubmit.disabled = true;
  els.authSubmit.textContent = isLogin ? "登录中..." : "注册中...";

  try {
    if (isLogin) {
      await app.login(username, password);
    } else {
      await app.register(username, password);
    }
  } catch (error) {
    app.notify(error.message || (isLogin ? "登录失败" : "注册失败"));
    els.authSubmit.disabled = false;
    updateAuthModeUI();
    return;
  }

  try {
    hydrateLatestCoachResponse();
    showAppShell();
    renderAll();
    restoreModuleFromURL();
    renderOnboarding();
    clearAuthForm();
    app.notify(isLogin ? "欢迎回来" : "注册成功，欢迎来到愈格");
  } catch (error) {
    console.error("Post-auth render failed", error);
    showAppShell();
    app.notify(isLogin ? "登录成功，但页面初始化失败，请刷新页面" : "注册成功，但页面初始化失败，请刷新页面");
  } finally {
    els.authSubmit.disabled = false;
    updateAuthModeUI();
  }
}

function restoreModuleFromURL() {
  if (!app.isAuthenticated()) return;
  const hashModule = location.hash.replace("#", "").trim();
  const pathModule = MODULE_PATH_MAP[location.pathname] || "home";
  const target = MODULE_NAMES.includes(hashModule) ? hashModule : pathModule;
  switchModule(target, false);
}

function switchModule(moduleName, writeURL = true) {
  if (!app.isAuthenticated()) return;

  if (!MODULE_NAMES.includes(moduleName)) {
    moduleName = "home";
  }

  activeModule = moduleName;
  document.body.setAttribute("data-module", moduleName);

  Object.entries(els.panels).forEach(([name, panel]) => {
    panel.classList.toggle("hidden", name !== moduleName);
    panel.setAttribute("aria-hidden", name !== moduleName ? "true" : "false");
  });

  els.moduleNav.querySelectorAll("[data-module]").forEach((button) => {
    const isCurrent = button.dataset.module === moduleName;
    button.classList.toggle("active", isCurrent);
    button.setAttribute("aria-pressed", isCurrent ? "true" : "false");
  });

  if (writeURL) {
    const nextHash = moduleName === "home" ? "" : `#${moduleName}`;
    history.replaceState(null, "", `${location.pathname}${nextHash}`);
  }

  if (moduleName === "home") renderHome();
  if (moduleName === "mbti") renderMBTI();
  if (moduleName === "analysis") renderAnalysis();
  if (moduleName === "coach") renderCoach();
  if (moduleName === "progress") renderProgress();
  if (moduleName === "settings") renderSettings();
}

function hydrateLatestCoachResponse() {
  const state = app.getState();
  const latestConversation = Array.isArray(state.aiConversations) ? state.aiConversations[0] : null;
  if (!latestConversation) {
    latestCoachResponse = null;
    return;
  }

  const summary = String(latestConversation.preview || latestConversation.title || "").trim();
  latestCoachResponse = summary
    ? {
        mode: "chat",
        reply: summary,
        summary,
        steps: [],
        reflectionQuestion: "",
        taskSuggestion: ""
      }
    : null;
}

function normalizeCoachDisplay(source) {
  if (!source || typeof source !== "object") return null;

  if (source.structuredPlan && Array.isArray(source.structuredPlan.plan_groups)) {
    const reply = String(source.reply || "").trim();
    return {
      mode: "plan",
      reply,
      structuredPlan: source.structuredPlan,
      summary: reply || "已生成结构化计划方案",
      steps: [],
      reflectionQuestion: "",
      taskSuggestion: ""
    };
  }

  if (source.reply) {
    const reply = String(source.reply || "").trim();
    return {
      mode: "chat",
      reply,
      summary: reply.length > 90 ? `${reply.slice(0, 90)}...` : reply,
      steps: [],
      reflectionQuestion: "",
      taskSuggestion: ""
    };
  }

  return {
    mode: "plan",
    summary: String(source.summary || ""),
    steps: Array.isArray(source.steps) ? source.steps.slice(0, 3).map((item) => String(item || "")) : [],
    reflectionQuestion: String(source.reflectionQuestion || ""),
    taskSuggestion: String(source.taskSuggestion || "")
  };
}

function ensureMbtiSelectOptions(selectEl) {
  if (!selectEl || selectEl.dataset.ready === "1") return;

  selectEl.innerHTML = [
    '<option value="">请选择一种 MBTI 类型</option>',
    ...app.MBTI_TYPES.map((type) => `<option value="${type}">${type}</option>`)
  ].join("");
  selectEl.dataset.ready = "1";
}

function syncMbtiSelectors(state) {
  const currentValue = state.mbti && app.MBTI_TYPES.includes(state.mbti) ? state.mbti : "";
  [els.manualMbtiSelect, els.settingsMbtiSelect].forEach((selectEl) => {
    ensureMbtiSelectOptions(selectEl);
    if (selectEl) selectEl.value = currentValue;
  });
}

function hasCompletedMbtiState(state) {
  return state.mbtiSource === "test" && Boolean(state.mbti) && state.answers.every((item) => item !== null);
}

function hasManualMbtiState(state) {
  return state.mbtiSource === "manual" && Boolean(state.mbti);
}

function getMbtiSourceText(state) {
  if (hasCompletedMbtiState(state)) {
    return `当前类型：${state.mbti}（信度 ${state.reliability}% / 匹配度 ${state.match}%）`;
  }

  if (hasManualMbtiState(state)) {
    return `当前类型：${state.mbti}（手动选择）`;
  }

  return state.mbti ? `当前类型：${state.mbti}` : "当前还没有 MBTI 结果";
}

function renderAll() {
  hydrateLatestCoachResponse();
  showAppShell();
  renderHome();
  renderMBTI();
  renderAnalysis();
  renderCoach();
  renderProgress();
  renderSettings();
}

function renderOnboarding() {
  if (app.shouldShowOnboarding()) {
    els.onboardingModal.classList.remove("hidden");
  } else {
    hideOnboarding();
  }
}

function hideOnboarding() {
  els.onboardingModal.classList.add("hidden");
}

function renderHome() {
  const state = app.getState();
  const metrics = app.getProgressMetrics();
  const latestConversation = Array.isArray(state.aiConversations) ? state.aiConversations[0] : null;
  const planStats = state.planBookStats || {};
  const currentPlan = planStats.currentPlanProgress || null;
  const recentAchieved = planStats.recentAchieved || null;
  const hasCompletedMbti = hasCompletedMbtiState(state);
  const hasManualMbti = hasManualMbtiState(state);

  els.homeMbti.textContent = hasCompletedMbti
    ? `MBTI：${state.mbti}（信度 ${state.reliability}% / 匹配度 ${state.match}%）`
    : hasManualMbti
      ? `MBTI：${state.mbti}（手动选择）`
      : "MBTI：未完成";
  els.homeMbtiBtn.textContent = hasCompletedMbti
    ? "查看 / 重新测试 MBTI"
    : hasManualMbti
      ? "查看 MBTI / 开始测试"
      : "完成 MBTI 测试";
  els.continueTestBtn.textContent = hasCompletedMbti
    ? "重新测试"
    : hasManualMbti
      ? "开始 MBTI 测试"
      : "继续测试";

  els.homeTodos.textContent = `${planStats.activeCount || 0}`;
  els.homeProgress.textContent = `${metrics.percent}%`;
  els.homeAiCount.textContent = `${planStats.achievedCount || 0}`;

  if (currentPlan) {
    els.homeCoachHeadline.textContent = `当前进行中 / ${currentPlan.planName}`;
    els.homeCoachSummary.textContent = `已完成 ${currentPlan.completedTasks}/${currentPlan.totalTasks} 个任务，达成阈值 ${formatRatioPercent(currentPlan.completionThreshold)}。你可以回到 AI 会话继续生成新方案，或直接去计划簿打钩推进。`;
    els.homeMilestone.textContent =
      metrics.nextMilestone === 0
        ? "当前计划已经接近或达到阈值，可以继续巩固。"
        : `距离当前计划达成，还差 ${metrics.nextMilestone} 个任务。`;
    return;
  }

  if (recentAchieved) {
    els.homeCoachHeadline.textContent = `最近达成 / ${recentAchieved.planName}`;
    els.homeCoachSummary.textContent = `最近一项计划已经达成。你可以继续和 AI 助手沟通新的目标，再挑一个计划加入计划簿。`;
    els.homeMilestone.textContent = "你已经有达成记录了，继续保持这个节奏。";
    return;
  }

  els.homeMilestone.textContent =
    latestConversation
      ? "先从最近一次 AI 方案里挑一个计划加入计划簿，会更容易持续推进。"
      : "先和 AI 助手聊一个具体目标，系统会自动生成分组计划。";

  if (latestConversation) {
    els.homeCoachHeadline.textContent = `${latestConversation.scenario || "AI 助手"} / 最近会话`;
    els.homeCoachSummary.textContent = latestConversation.preview || latestConversation.title || "最近一次 AI 会话已经保存，可继续回到历史窗口追问。";
  } else {
    els.homeCoachHeadline.textContent = "AI 结构化计划助手";
    els.homeCoachSummary.textContent = "开始一段新对话后，AI 会把你的目标拆成分组计划。你可以直接把其中一个计划加入计划簿，再逐项打钩推进。";
  }
}

function renderMBTI() {
  const state = app.getState();
  const hasCompletedMbti = hasCompletedMbtiState(state);
  const hasManualMbti = hasManualMbtiState(state);
  const navRow = els.prevQuestion.parentElement;

  syncMbtiSelectors(state);

  if (hasManualMbti) {
    els.manualMbtiHint.textContent = `当前已保存 ${state.mbti}（手动选择）。如果你重新完成 56 题测试，正式测试结果会覆盖这个手动结果。`;
  } else if (hasCompletedMbti) {
    els.manualMbtiHint.textContent = `当前已有 ${state.mbti} 的正式测试结果。你也可以手动切换成已知类型，之后重新测试会再次覆盖。`;
  } else {
    els.manualMbtiHint.textContent = "适合已经做过测试、只想直接使用结果的用户。保存后会立即同步到首页、分析页和 AI 助手上下文。";
  }

  if (hasManualMbti) {
    els.questionBox.innerHTML = `
      <div class="mbti-question-card mbti-question-card--state">
        <div class="mbti-question-kicker">
          <span>当前状态</span>
          <span>手动选择</span>
        </div>
        <div class="mbti-question-text">当前为 ${app.escapeHTML(state.mbti)} 的手动结果</div>
        <p class="mbti-question-tip">你可以直接查看分析，也可以随时开始一次新的正式测试。</p>
      </div>
    `;
    els.optionBox.classList.remove("mbti-option-list");
    els.optionBox.innerHTML = `
      <div class="mbti-finished-card">
        <p class="muted">你当前使用的是手动选择的 ${state.mbti} 结果。现在可以直接查看分析，也可以开始一次新的正式测试。</p>
        <div class="nav-row mbti-finished-actions">
          <button class="ghost-btn" type="button" data-mbti-action="analysis">查看性格分析</button>
          <button class="primary-btn" type="button" data-mbti-action="start-test">开始 / 重新进行测试</button>
        </div>
      </div>
    `;

    navRow.classList.add("hidden");
    els.questionDots.classList.add("hidden");
    els.questionDots.innerHTML = "";
    els.mbtiResult.classList.remove("hidden");
    els.mbtiResult.innerHTML = `
      <strong>当前结果：${state.mbti}</strong><br />
      当前来源：手动选择<br />
      <span class="muted">手动选择不会显示测试信度和匹配度；如需正式结果，可以重新完成 56 题测试。</span>
    `;

    els.optionBox.querySelector('[data-mbti-action="analysis"]').addEventListener("click", () => {
      switchModule("analysis");
    });

    els.optionBox.querySelector('[data-mbti-action="start-test"]').addEventListener("click", async () => {
      try {
        await app.resetMBTI();
        renderAll();
        switchModule("mbti");
        app.notify("已开始新的 MBTI 测试");
      } catch (error) {
        app.notify(error.message || "无法开始新的测试");
      }
    });

    return;
  }

  if (hasCompletedMbti) {
    els.questionBox.innerHTML = `
      <div class="mbti-question-card mbti-question-card--state">
        <div class="mbti-question-kicker">
          <span>当前状态</span>
          <span>正式测试结果</span>
        </div>
        <div class="mbti-question-text">MBTI 测试已完成</div>
        <p class="mbti-question-tip">结果已经保存，你可以直接查看分析，或者重新开始一次测试。</p>
      </div>
    `;
    els.optionBox.classList.remove("mbti-option-list");
    els.optionBox.innerHTML = `
      <div class="mbti-finished-card">
        <p class="muted">56 题测试结果已经保存。你可以直接查看分析，或者重新开始一次测试。</p>
        <div class="nav-row mbti-finished-actions">
          <button class="ghost-btn" type="button" data-mbti-action="analysis">查看性格分析</button>
          <button class="primary-btn" type="button" data-mbti-action="reset">重新测试</button>
        </div>
      </div>
    `;

    navRow.classList.add("hidden");
    els.questionDots.classList.add("hidden");
    els.questionDots.innerHTML = "";
    els.mbtiResult.classList.remove("hidden");
    els.mbtiResult.innerHTML = `
      <strong>当前结果：${state.mbti}</strong><br />
      测试信度：${state.reliability}%<br />
      与 ${state.mbti} 匹配度：${state.match}%<br />
      <span class="muted">如果你觉得这次作答不够准确，可以重新测试一次。</span>
    `;

    els.optionBox.querySelector('[data-mbti-action="analysis"]').addEventListener("click", () => {
      switchModule("analysis");
    });

    els.optionBox.querySelector('[data-mbti-action="reset"]').addEventListener("click", async () => {
      try {
        await app.resetMBTI();
        renderAll();
        switchModule("mbti");
        app.notify("已重新开始 MBTI 测试");
      } catch (error) {
        app.notify(error.message || "重新测试失败");
      }
    });

    return;
  }

  navRow.classList.remove("hidden");
  els.questionDots.classList.remove("hidden");

  const q = app.questionBank[state.currentQuestion];
  const questionNumber = state.currentQuestion + 1;
  const answeredCount = state.answers.filter((item) => item !== null).length;
  els.questionBox.innerHTML = `
    <div class="mbti-question-card">
      <div class="mbti-question-kicker">
        <span>第 ${questionNumber} / ${app.TOTAL_QUESTIONS} 题</span>
        <span>已完成 ${answeredCount} 题</span>
      </div>
      <div class="mbti-question-text">${app.escapeHTML(q.text)}</div>
      <p class="mbti-question-tip">请根据你平时更自然的反应来作答，不必刻意追求“更好”的答案。</p>
    </div>
  `;
  els.optionBox.innerHTML = "";
  els.optionBox.classList.add("mbti-option-list");

  q.options.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "option-item";
    const checked = state.answers[state.currentQuestion] === opt.value ? "checked" : "";
    label.innerHTML = `<input type="radio" name="answer" value="${opt.value}" ${checked} /> ${opt.label}`;

    label.querySelector("input").addEventListener("change", async (event) => {
      const questionIndex = state.currentQuestion;
      const selectedValue = Number(event.target.value);

      try {
        await app.answerQuestion(questionIndex, selectedValue);

        if (questionIndex >= app.TOTAL_QUESTIONS - 1) {
          const result = await app.completeMBTI();
          if (!result.ok) {
            await app.setCurrentQuestion(app.getNextUnansweredIndex());
            renderHome();
            renderMBTI();
            renderProgress();
            app.notify(result.message || "还有未完成题目");
            return;
          }

          renderAll();
          switchModule("analysis");
          app.notify("测试已完成，已自动生成分析结果");
          return;
        }

        await app.setCurrentQuestion(questionIndex + 1);
        renderHome();
        renderMBTI();
        renderProgress();
      } catch (error) {
        app.notify(error.message || "保存进度失败");
      }
    });

    els.optionBox.appendChild(label);
  });

  els.questionDots.innerHTML = "";
  for (let i = 0; i < app.TOTAL_QUESTIONS; i += 1) {
    const btn = document.createElement("button");
    btn.className = "dot";
    btn.type = "button";
    if (state.answers[i] !== null) btn.classList.add("done");
    if (i === state.currentQuestion) btn.classList.add("current");
    btn.addEventListener("click", async () => {
      try {
        await app.setCurrentQuestion(i);
        renderMBTI();
      } catch (error) {
        app.notify(error.message || "无法跳转到该题");
      }
    });
    els.questionDots.appendChild(btn);
  }

  els.mbtiResult.classList.add("hidden");
  els.mbtiResult.innerHTML = "";
}

function renderAnalysis() {
  const state = app.getState();
  const type = state.mbti || "INFP";
  const profile = app.getTypeProfile(type);

  els.typeSummary.textContent = hasCompletedMbtiState(state)
    ? `当前类型：${state.mbti}（信度 ${state.reliability}% ，匹配度 ${state.match}%）`
    : hasManualMbtiState(state)
      ? `当前类型：${state.mbti}（手动选择）`
      : "你还没有完成 MBTI 测试，当前展示默认示例画像（INFP）。";

  els.strengthList.innerHTML = profile.strengths.map((item) => `<li>${app.escapeHTML(item)}</li>`).join("");
  els.improveList.innerHTML = profile.improvements.map((item) => `<li>${app.escapeHTML(item)}</li>`).join("");
  els.interactionAdvice.textContent = profile.interaction;

  const labels = ["内向性", "直觉性", "情感性", "知觉性", "合作性", "执行力", "稳定性", "表达度"];
  const values = state.radar.length ? state.radar : profile.radar;

  if (typeof window.Chart !== "function") {
    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
    }

    els.radarChart.classList.add("hidden");
    els.radarFallback.classList.remove("hidden");
    els.radarFallback.innerHTML = values
      .map(
        (value, idx) => `
          <div class="radar-fallback-item">
            <span>${labels[idx]}</span>
            <div class="bar"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>
            <strong>${Math.round(value)}</strong>
          </div>
        `
      )
      .join("");

    return;
  }

  els.radarFallback.classList.add("hidden");
  els.radarChart.classList.remove("hidden");

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(els.radarChart, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "你的维度",
          data: values,
          fill: true,
          backgroundColor: "rgba(197, 156, 136, 0.18)",
          borderColor: "rgba(19, 16, 13, 1)",
          pointBackgroundColor: "rgba(19, 16, 13, 1)",
          pointRadius: 3
        }
      ]
    },
    options: {
      scales: {
        r: {
          min: 30,
          max: 95,
          ticks: { stepSize: 13, backdropColor: "transparent" },
          grid: { color: "rgba(110, 96, 88, 0.18)" },
          angleLines: { color: "rgba(110, 96, 88, 0.18)" },
          pointLabels: { color: getComputedStyle(document.documentElement).getPropertyValue("--muted") }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function formatChatTime(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    if (!els.aiResponse) return;
    els.aiResponse.scrollTop = els.aiResponse.scrollHeight;
  });
}

function captureChatScrollSnapshot() {
  if (!els.aiResponse) return null;
  return {
    scrollTop: els.aiResponse.scrollTop,
    scrollHeight: els.aiResponse.scrollHeight
  };
}

function restoreChatScrollSnapshot(snapshot) {
  if (!snapshot || !els.aiResponse) return;
  requestAnimationFrame(() => {
    if (!els.aiResponse) return;
    const heightDelta = els.aiResponse.scrollHeight - snapshot.scrollHeight;
    els.aiResponse.scrollTop = Math.max(0, snapshot.scrollTop + heightDelta);
  });
}

function getActiveConversation(state) {
  return (Array.isArray(state.aiConversations) ? state.aiConversations : []).find((item) => item.id === state.activeAiConversationId) || null;
}

function getDraftScenario(state) {
  return state.draftScenario || state.selectedScenario || app.SCENARIOS[0];
}

function isPlanBackendReady(state) {
  return app.hasStructuredPlanCapability(state || {});
}

function getBackendStatusText(state) {
  const build = state && state.backendBuild ? state.backendBuild : "unknown";
  return isPlanBackendReady(state)
    ? `当前后端：支持计划方案 / 支持计划簿 / build ${build}`
    : `当前后端：旧版，不支持计划方案 / build ${build}。请关闭旧服务，重启 personality-improvement-suite 最新版后刷新页面。`;
}
function groupConversationsByTime(conversations) {
  const groups = [
    { label: "今天", items: [] },
    { label: "近 7 天", items: [] },
    { label: "更早", items: [] }
  ];
  const now = Date.now();

  conversations.forEach((conversation) => {
    const stamp = new Date(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || 0).getTime();
    if (!Number.isFinite(stamp)) {
      groups[2].items.push(conversation);
      return;
    }

    const diff = now - stamp;
    if (diff < 24 * 60 * 60 * 1000) {
      groups[0].items.push(conversation);
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      groups[1].items.push(conversation);
    } else {
      groups[2].items.push(conversation);
    }
  });

  return groups.filter((group) => group.items.length);
}

function renderConversationHistory(conversations, activeConversationId) {
  if (!conversations.length) {
    els.conversationHistoryList.innerHTML = `
      <div class="conversation-history-empty">
        <p>还没有历史会话</p>
        <p class="muted">点击“新对话”后发送第一条消息，这里就会自动生成会话卡片。</p>
      </div>
    `;
    return;
  }

  const groups = groupConversationsByTime(conversations);
  els.conversationHistoryList.innerHTML = groups
    .map((group) => `
      <section class="conversation-group">
        <div class="conversation-group-label">${group.label}</div>
        <div class="conversation-group-list">
          ${group.items.map((item) => `
            <article class="conversation-item${item.id === activeConversationId ? " active" : ""}" data-conversation-id="${app.escapeHTML(item.id)}">
              <div class="conversation-item-main">
                <h4>${app.escapeHTML(item.title || "新的对话")}</h4>
                <p>${app.escapeHTML(item.preview || item.scenario || "继续和 AI 助手聊天")}</p>
                <div class="conversation-item-meta">${app.escapeHTML(item.scenario)} · ${app.escapeHTML(formatChatTime(item.lastMessageAt || item.updatedAt || item.createdAt))}</div>
              </div>
              <button class="conversation-delete-btn" type="button" data-conversation-delete="${app.escapeHTML(item.id)}">删除</button>
            </article>
          `).join("")}
        </div>
      </section>
    `)
    .join("");

  els.conversationHistoryList.querySelectorAll("[data-conversation-id]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest("[data-conversation-delete]")) return;
      openConversation(item.dataset.conversationId);
    });
  });

  els.conversationHistoryList.querySelectorAll("[data-conversation-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteConversationById(button.dataset.conversationDelete);
    });
  });
}

function formatRatioPercent(ratio) {
  return `${Math.round(Math.max(0, Math.min(1, Number(ratio) || 0)) * 100)}%`;
}

function buildPlanSelectionKey(sourceHistoryId, groupIndex, planIndex) {
  return `${String(sourceHistoryId || "")}::${Number(groupIndex) || 0}::${Number(planIndex) || 0}`;
}

function getPlanEntryTimestamp(entry) {
  const raw = entry && (entry.achievedAt || entry.updatedAt || entry.createdAt) ? (entry.achievedAt || entry.updatedAt || entry.createdAt) : "";
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getPlanSelectionLookup(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return list.reduce((lookup, entry) => {
    const key = buildPlanSelectionKey(entry.sourceHistoryId, entry.sourceGroupIndex, entry.sourcePlanIndex);
    const state = lookup.get(key) || {
      activeEntry: null,
      latestAchievedEntry: null,
      achievedCount: 0,
      totalCount: 0
    };

    state.totalCount += 1;
    if (entry.status === "achieved") {
      state.achievedCount += 1;
      if (!state.latestAchievedEntry || getPlanEntryTimestamp(entry) >= getPlanEntryTimestamp(state.latestAchievedEntry)) {
        state.latestAchievedEntry = entry;
      }
    } else if (!state.activeEntry || getPlanEntryTimestamp(entry) >= getPlanEntryTimestamp(state.activeEntry)) {
      state.activeEntry = entry;
    }

    lookup.set(key, state);
    return lookup;
  }, new Map());
}

function getPlanSelectionState(state, sourceHistoryId, groupIndex, planIndex) {
  const lookup = getPlanSelectionLookup(state && state.planBookEntries);
  return lookup.get(buildPlanSelectionKey(sourceHistoryId, groupIndex, planIndex)) || {
    activeEntry: null,
    latestAchievedEntry: null,
    achievedCount: 0,
    totalCount: 0
  };
}

function getPlanAddButtonLabel(selectionState) {
  if (selectionState && selectionState.activeEntry) {
    return "取消加入计划簿";
  }

  return Number(selectionState && selectionState.achievedCount) > 0 ? "重新开始这个计划" : "加入计划簿";
}

function applyPlanButtonState(button, selectionState) {
  if (!button) return;

  const activeEntry = selectionState && selectionState.activeEntry ? selectionState.activeEntry : null;
  const achievedCount = Math.max(0, Number(selectionState && selectionState.achievedCount) || 0);
  button.dataset.planEntryId = activeEntry ? String(activeEntry.id || "") : "";
  button.dataset.planAchievedCount = String(achievedCount);
  button.disabled = false;
  button.textContent = getPlanAddButtonLabel(selectionState);
  button.className = activeEntry ? "ghost-btn plan-add-btn is-added" : "primary-btn plan-add-btn";

  const card = button.closest(".chat-plan-card");
  if (card) {
    card.classList.toggle("is-added", Boolean(activeEntry));
  }

  const note = card ? card.querySelector("[data-plan-repeat-note]") : null;
  if (note) {
    if (achievedCount > 0) {
      note.textContent = `已完成 ${achievedCount} 次`;
      note.classList.remove("hidden");
    } else {
      note.textContent = "";
      note.classList.add("hidden");
    }
  }
}

function syncPlanSelectionInChat(sourceHistoryId, groupIndex, planIndex, selectionState) {
  if (!els.aiResponse) return;
  els.aiResponse.querySelectorAll("[data-add-plan-history]").forEach((button) => {
    if (
      String(button.dataset.addPlanHistory || "") === String(sourceHistoryId || "") &&
      Number(button.dataset.addPlanGroup || 0) === Number(groupIndex || 0) &&
      Number(button.dataset.addPlanIndex || 0) === Number(planIndex || 0)
    ) {
      applyPlanButtonState(button, selectionState);
    }
  });
}

function buildStructuredPlanMarkup(message, planSelectionLookup) {
  if (!message || !message.structuredPlan || !Array.isArray(message.structuredPlan.plan_groups)) {
    return "";
  }

  return `
    <div class="chat-plan-groups">
      ${message.structuredPlan.plan_groups.map((group, groupIndex) => `
        <section class="chat-plan-group">
          <div class="chat-plan-group-head">
            <div>
              <h4>${app.escapeHTML(group.group_name || `计划分组 ${groupIndex + 1}`)}</h4>
              <p class="muted">${app.escapeHTML(group.group_description || "")}</p>
            </div>
          </div>
          <div class="chat-plan-grid">
            ${(Array.isArray(group.plans) ? group.plans : []).map((plan, planIndex) => {
              const key = buildPlanSelectionKey(message.historyId, groupIndex, planIndex);
              const selectionState = planSelectionLookup.get(key) || { activeEntry: null, latestAchievedEntry: null, achievedCount: 0, totalCount: 0 };
              const activeEntry = selectionState.activeEntry || null;
              const latestAchievedEntry = selectionState.latestAchievedEntry || null;
              const achievedCount = Math.max(0, Number(selectionState.achievedCount) || 0);
              return `
                <article class="chat-plan-card${activeEntry ? " is-added" : ""}">
                  <div class="plan-card-topline">
                    <span>${app.escapeHTML(group.group_name || `分组 ${groupIndex + 1}`)}</span>
                    <span>${app.escapeHTML(String(plan.estimated_days || 14))} 天</span>
                  </div>
                  <h5>${app.escapeHTML(plan.plan_name || `计划 ${planIndex + 1}`)}</h5>
                  <p class="muted">${app.escapeHTML(plan.plan_description || "")}</p>
                  <div class="plan-card-meta">
                    <span>达成阈值 ${formatRatioPercent(plan.completion_threshold || 0.75)}</span>
                    <span>${Array.isArray(plan.tasks) ? plan.tasks.length : 0} 个任务</span>
                  </div>
                  <div class="plan-card-history-note${achievedCount ? "" : " hidden"}" data-plan-repeat-note>${achievedCount ? `已完成 ${app.escapeHTML(String(achievedCount))} 次` : ""}</div>
                  <ul class="plan-task-preview">
                    ${(Array.isArray(plan.tasks) ? plan.tasks : []).slice(0, 4).map((task) => `<li>${app.escapeHTML(task.task_description || "")}</li>`).join("")}
                  </ul>
                  <button
                    class="${activeEntry ? "ghost-btn plan-add-btn is-added" : "primary-btn plan-add-btn"}"
                    type="button"
                    data-add-plan-history="${app.escapeHTML(message.historyId || "") }"
                    data-add-plan-group="${groupIndex}"
                    data-add-plan-index="${planIndex}"
                    data-plan-entry-id="${app.escapeHTML(activeEntry ? activeEntry.id : "") }"
                    data-plan-achieved-entry-id="${app.escapeHTML(latestAchievedEntry ? latestAchievedEntry.id : "") }"
                    data-plan-achieved-count="${achievedCount}"
                  >${getPlanAddButtonLabel(selectionState)}</button>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function getPlanDisplayTime(entry) {
  return entry && (entry.achievedAt || entry.updatedAt || entry.createdAt)
    ? (entry.achievedAt || entry.updatedAt || entry.createdAt)
    : "";
}

function getAchievedMonthKey(value) {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return "unknown";
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatAchievedMonthLabel(key) {
  if (key === "unknown") return "更早记录";
  const [year, month] = String(key || "").split("-");
  return `${year} 年 ${Number(month) || 0} 月`;
}

function getRelativeMonthKey(offset = 0) {
  const date = new Date();
  const target = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function getAchievedPlanGroups(entries) {
  const sorted = (Array.isArray(entries) ? entries : []).slice().sort((a, b) => getPlanEntryTimestamp(b) - getPlanEntryTimestamp(a));
  const groups = [];
  const lookup = new Map();

  sorted.forEach((entry) => {
    const key = getAchievedMonthKey(getPlanDisplayTime(entry));
    let group = lookup.get(key);
    if (!group) {
      group = {
        key,
        label: formatAchievedMonthLabel(key),
        entries: []
      };
      lookup.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
  });

  return groups;
}

function buildAchievedPlanSummary(groups) {
  const counts = new Map(groups.map((group) => [group.key, group.entries.length]));
  const currentMonth = counts.get(getRelativeMonthKey(0)) || 0;
  const previousMonth = counts.get(getRelativeMonthKey(-1)) || 0;
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  if (currentMonth === 0 && previousMonth === 0 && groups[0]) {
    return `累计已达成 ${total} 项，最近一次集中完成于 ${groups[0].label}。`;
  }

  return `本月已达成 ${currentMonth} 项，上月 ${previousMonth} 项。`;
}

function isAchievedMonthExpanded(key, index) {
  if (achievedMonthVisibility.has(key)) {
    return Boolean(achievedMonthVisibility.get(key));
  }
  return index === 0;
}

function buildPlanEntryMarkup(entry, options = {}) {
  const ratioPercent = Math.round((Number(entry.completionRatio) || 0) * 100);
  const thresholdPercent = Math.round((Number(entry.completionThreshold) || 0.75) * 100);
  const isAchieved = entry.status === "achieved";
  const collapsed = Boolean(options.collapsed && isAchieved);
  const expanded = collapsed ? Boolean(options.expanded) : true;
  const achievedText = entry.achievedAt ? `达成时间：${app.escapeHTML(formatChatTime(entry.achievedAt))}` : "";
  const sideMeta = isAchieved
    ? `完成于 ${app.escapeHTML(formatChatTime(getPlanDisplayTime(entry)) || "最近")}`
    : `预计 ${app.escapeHTML(String(entry.estimatedDays || 14))} 天`;

  return `
    <article class="plan-entry-card ${isAchieved ? "is-achieved" : "is-active"}${collapsed ? " is-collapsible" : ""}">
      <div class="plan-entry-head">
        <div>
          <div class="plan-entry-kicker">${app.escapeHTML(entry.groupName || "计划分组")}</div>
          <h4>${app.escapeHTML(entry.planName || "未命名计划")}</h4>
          <p class="muted">${app.escapeHTML(entry.planDescription || entry.groupDescription || "")}</p>
        </div>
        <div class="plan-entry-side">
          <span class="plan-status-badge ${isAchieved ? "is-achieved" : "is-active"}">${isAchieved ? "已达成" : "进行中"}</span>
          <span class="muted">${sideMeta}</span>
          <div class="plan-entry-actions">
            ${collapsed ? `<button class="ghost-btn plan-action-btn" type="button" data-toggle-achieved-entry="${app.escapeHTML(entry.id)}" data-plan-expanded="${expanded ? "true" : "false"}">${expanded ? "收起详情" : "展开详情"}</button>` : ""}
            ${options.showRestart ? `<button class="ghost-btn plan-action-btn" type="button" data-restart-plan-entry="${app.escapeHTML(entry.id)}">重新开始</button>` : ""}
            ${options.showDelete ? `<button class="ghost-btn danger-btn plan-action-btn" type="button" data-delete-plan-entry="${app.escapeHTML(entry.id)}">删除</button>` : ""}
          </div>
        </div>
      </div>
      <div class="plan-progress-bar">
        <span class="plan-progress-fill" style="width:${Math.max(0, Math.min(100, ratioPercent))}%"></span>
        <i class="plan-threshold-marker" style="left:${Math.max(0, Math.min(100, thresholdPercent))}%"></i>
      </div>
      <div class="plan-progress-meta">
        <span>已完成 ${entry.completedTasks}/${entry.totalTasks}</span>
        <span>达成阈值 ${thresholdPercent}%</span>
      </div>
      ${expanded ? `
        <ul class="plan-task-list">
          ${(Array.isArray(entry.tasks) ? entry.tasks : []).map((task) => `
            <li class="plan-task-item${task.done ? " done" : ""}">
              <label>
                <input
                  type="checkbox"
                  ${task.done ? "checked" : ""}
                  data-plan-entry-id="${app.escapeHTML(entry.id)}"
                  data-plan-task-id="${app.escapeHTML(task.id)}"
                />
                <span>${app.escapeHTML(task.taskDescription || "")}</span>
              </label>
            </li>
          `).join("")}
        </ul>
      ` : ""}
      ${collapsed && !expanded
        ? `<div class="plan-entry-footer muted">共 ${entry.totalTasks} 个任务，点击“展开详情”查看或继续调整。</div>`
        : achievedText ? `<div class="plan-entry-footer muted">${achievedText}</div>` : ""}
    </article>
  `;
}

function buildAchievedPlanMarkup(achievedPlans) {
  const groups = getAchievedPlanGroups(achievedPlans);
  if (!groups.length) {
    return '<div class="plan-empty muted">还没有已达成计划。完成度达到阈值后，这里会自动记录成果。</div>';
  }

  return `
    <div class="achieved-plan-summary muted">${app.escapeHTML(buildAchievedPlanSummary(groups))}</div>
    <div class="achieved-plan-groups">
      ${groups.map((group, index) => {
        const expanded = isAchievedMonthExpanded(group.key, index);
        return `
          <section class="achieved-plan-group${expanded ? " is-open" : ""}">
            <button
              class="achieved-month-toggle"
              type="button"
              data-achieved-month-toggle="${app.escapeHTML(group.key)}"
              data-month-expanded="${expanded ? "true" : "false"}"
            >
              <strong>${app.escapeHTML(group.label)}</strong>
              <span class="achieved-month-toggle-meta">${group.entries.length} 项 · ${expanded ? "收起" : "展开"}</span>
            </button>
            ${expanded ? `
              <div class="achieved-plan-group-body plan-book-list plan-book-list--compact">
                ${group.entries.map((entry) => buildPlanEntryMarkup(entry, {
                  collapsed: true,
                  expanded: expandedAchievedPlanIds.has(entry.id),
                  showRestart: true,
                  showDelete: true
                })).join("")}
              </div>
            ` : ""}
          </section>
        `;
      }).join("")}
    </div>
  `;
}
function renderConversationStream(messages, scenario, isDraft, planBookEntries) {
  if (!messages.length) {
    els.aiResponse.innerHTML = `
      <div class="chat-empty">
        <p>${isDraft ? "这里是新的对话窗口。" : `这里会显示 ${app.escapeHTML(scenario)} 场景下的完整会话。`}</p>
        <p class="muted">${isDraft ? "旧记录已经收进左侧历史栏，发送第一条消息后会自动创建新会话。" : "继续追问时，只会围绕当前会话上下文生成回复。"}</p>
      </div>
    `;
    return;
  }

  const planSelectionLookup = getPlanSelectionLookup(planBookEntries);

  els.aiResponse.innerHTML = messages
    .map((message) => `
      <article class="chat-message-row ${message.role === "user" ? "is-user" : "is-assistant"}${message.pending ? " pending" : ""}">
        <div class="chat-meta">${app.escapeHTML(message.role === "user" ? "你" : "愈格 AI")}${message.createdAt ? ` · ${app.escapeHTML(formatChatTime(message.createdAt))}` : ""}</div>
        ${message.text ? `<div class="chat-bubble ${message.role}${message.pending && message.role === "assistant" ? " thinking" : ""}">${app.escapeHTML(message.text || "").replaceAll("\n", "<br />")}</div>` : ""}
        ${message.role === "assistant" ? buildStructuredPlanMarkup(message, planSelectionLookup) : ""}
        ${message.role === "assistant" && !message.pending && !message.structuredPlan ? `<div class="chat-legacy-note">旧版记录：这条回复不是计划方案格式，仅保留为历史查看。</div>` : ""}
        ${message.role === "user" && message.details ? `<div class="chat-note">补充背景：${app.escapeHTML(message.details).replaceAll("\n", "<br />")}</div>` : ""}
      </article>
    `)
    .join("");

  els.aiResponse.querySelectorAll("[data-add-plan-history]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sourceHistoryId = button.dataset.addPlanHistory;
      const groupIndex = Number(button.dataset.addPlanGroup || 0);
      const planIndex = Number(button.dataset.addPlanIndex || 0);
      const entryId = String(button.dataset.planEntryId || "").trim();
      const achievedEntryId = String(button.dataset.planAchievedEntryId || "").trim();
      const removing = Boolean(entryId);
      const restarting = !removing && Boolean(achievedEntryId);

      button.disabled = true;
      button.textContent = removing ? "取消中..." : restarting ? "重启中..." : "加入中...";

      try {
        if (removing) {
          await app.removePlanBookEntry(entryId);
          const nextSelection = getPlanSelectionState(app.getState(), sourceHistoryId, groupIndex, planIndex);
          syncPlanSelectionInChat(sourceHistoryId, groupIndex, planIndex, nextSelection);
          renderHome();
          renderProgress();
          app.notify("已从计划簿移除");
          return;
        }

        if (restarting) {
          await app.restartPlanBookEntry(achievedEntryId);
        } else {
          await app.addPlanBookEntry(sourceHistoryId, groupIndex, planIndex);
        }
        const nextSelection = getPlanSelectionState(app.getState(), sourceHistoryId, groupIndex, planIndex);
        syncPlanSelectionInChat(sourceHistoryId, groupIndex, planIndex, nextSelection);
        renderHome();
        renderProgress();
        app.notify(restarting ? "已重新开始这个计划" : "计划已加入计划簿");
      } catch (error) {
        const nextSelection = getPlanSelectionState(app.getState(), sourceHistoryId, groupIndex, planIndex);
        applyPlanButtonState(button, nextSelection);
        app.notify(error.message || (removing ? "移出计划簿失败" : restarting ? "重新开始计划失败" : "加入计划簿失败"));
      }
    });
  });
}
function renderCoach(options = {}) {
  const state = app.getState();
  const preserveScroll = Boolean(options.preserveScroll);
  const scrollSnapshot = preserveScroll ? captureChatScrollSnapshot() : null;
  const aiSettings = state.aiSettings || {};
  const conversations = Array.isArray(state.aiConversations) ? state.aiConversations : [];
  const activeConversation = getActiveConversation(state);
  const scenario = activeConversation ? activeConversation.scenario : getDraftScenario(state);
  const messages = activeConversation ? (Array.isArray(state.activeConversationMessages) ? state.activeConversationMessages.slice() : []) : [];
  const backendReady = isPlanBackendReady(state);

  if (pendingCoachMessage) {
    const sameWindow = pendingCoachMessage.conversationId
      ? pendingCoachMessage.conversationId === state.activeAiConversationId
      : !state.activeAiConversationId;

    if (sameWindow) {
      messages.push({
        id: "pending-user",
        role: "user",
        text: pendingCoachMessage.goal,
        details: "",
        createdAt: pendingCoachMessage.createdAt,
        pending: true
      });
      messages.push({
        id: "pending-assistant",
        role: "assistant",
        text: "正在整理回复...",
        details: "",
        createdAt: pendingCoachMessage.createdAt,
        pending: true,
        structuredPlan: null
      });
    }
  }
  const hasCustomApi = Boolean(aiSettings.hasApiKey);

  if (els.coachConfigStatus) {
    els.coachConfigStatus.textContent = "";
    els.coachConfigStatus.classList.add("hidden");
  }

  els.coachHistoryCount.textContent = `${conversations.length} 段`;
  els.coachConversationTitle.textContent = activeConversation ? activeConversation.title : "新的对话";
  els.coachConversationMeta.textContent = activeConversation
    ? `${activeConversation.scenario} · ${Math.max(1, activeConversation.turnCount || Math.ceil(messages.length / 2))} 轮对话 · ${formatChatTime(activeConversation.lastMessageAt || activeConversation.updatedAt || activeConversation.createdAt)}`
    : "当前是空白新对话窗口，发送第一条消息后会自动生成历史卡片。";
  els.coachScenarioSelect.value = scenario;
  els.goalInput.disabled = !backendReady || !hasCustomApi;
  els.askAiBtn.disabled = !backendReady || !hasCustomApi;
  els.askAiBtn.textContent = !backendReady ? "当前后端不支持" : hasCustomApi ? "发送" : "先配置 API";
  els.clearAiHistoryBtn.disabled = !conversations.length;
  els.deleteConversationBtn.disabled = !activeConversation;

  const effectiveNotice = !backendReady
    ? {
        kind: "error",
        text: "当前后端不是支持计划方案的最新版。现在只能查看旧历史，不能继续发送新消息。请关闭旧服务，重启 personality-improvement-suite 最新版后刷新页面。"
      }
    : !hasCustomApi
      ? {
          kind: "info",
          text: "当前采用用户自带 API 模式。请先到“设置”里填写并保存你自己的 API Key，然后再回来生成计划方案。"
        }
      : coachNotice;
  renderStatusNote(els.coachNotice, effectiveNotice);

  renderConversationHistory(conversations, state.activeAiConversationId);
  renderConversationStream(messages, scenario, !activeConversation, state.planBookEntries);
  if (preserveScroll) {
    restoreChatScrollSnapshot(scrollSnapshot);
  } else {
    scrollChatToBottom();
  }
}
async function startNewConversation() {
  try {
    pendingCoachMessage = null;
    coachNotice = null;
    await app.setActiveAiConversation(null);
    renderHome();
    renderCoach();
    app.notify("已切换到新对话");
  } catch (error) {
    app.notify(error.message || "无法开始新对话");
  }
}

async function openConversation(conversationId) {
  if (!conversationId) return;

  try {
    pendingCoachMessage = null;
    coachNotice = null;
    await app.setActiveAiConversation(conversationId);
    renderHome();
    renderCoach();
  } catch (error) {
    app.notify(error.message || "无法打开这段历史会话");
  }
}

async function handleConversationScenarioChange() {
  const state = app.getState();
  const scenario = els.coachScenarioSelect.value;

  try {
    if (state.activeAiConversationId) {
      await app.updateAiConversation(state.activeAiConversationId, { scenario });
    } else {
      await app.setSelectedScenario(scenario);
    }

    renderHome();
    renderCoach();
  } catch (error) {
    app.notify(error.message || "场景更新失败");
  }
}

async function askAI() {
  const state = app.getState();
  const activeConversation = getActiveConversation(state);
  const scenario = activeConversation ? activeConversation.scenario : getDraftScenario(state);
  const message = els.goalInput.value.trim();

  if (!isPlanBackendReady(state)) {
    coachNotice = {
      kind: "error",
      text: "当前后端不是支持计划方案的最新版。请先重启最新版愈格服务，再重新发送。"
    };
    renderCoach();
    app.notify("当前后端不支持计划方案，请先重启最新版服务");
    return;
  }

  if (!(state.aiSettings && state.aiSettings.hasApiKey)) {
    coachNotice = {
      kind: "info",
      text: "请先到“设置”里保存你自己的 API Key，愈格不会使用服务器默认 Key。"
    };
    renderCoach();
    app.notify("请先配置你自己的 API Key");
    return;
  }

  if (!message) {
    app.notify("请先输入你想对助手说的话");
    return;
  }

  els.askAiBtn.disabled = true;
  els.askAiBtn.textContent = "发送中...";
  pendingCoachMessage = {
    conversationId: state.activeAiConversationId || null,
    scenario,
    goal: message,
    createdAt: new Date().toISOString()
  };
  coachNotice = { kind: "info", text: "AI 正在整理回复..." };
  renderCoach();

  try {
    const data = await app.requestCoach({
      conversationId: state.activeAiConversationId,
      scenario,
      message,
      details: ""
    });

    pendingCoachMessage = null;
    coachNotice = null;
    latestCoachResponse = normalizeCoachDisplay(data);
    els.goalInput.value = "";
    renderHome();
    renderCoach();
    renderProgress();
    app.notify(state.activeAiConversationId ? "已继续当前会话" : "已创建新会话");
  } catch (error) {
    pendingCoachMessage = null;
    coachNotice = { kind: "error", text: error.message || "AI 请求失败，请稍后重试" };
    renderCoach();
    app.notify(error.message || "AI 请求失败，请稍后重试");
  } finally {
    els.askAiBtn.disabled = false;
    els.askAiBtn.textContent = "发送";
  }
}

async function deleteConversationById(conversationId) {
  if (!conversationId) return;

  const confirmed = window.confirm("删除后这整段会话将无法恢复，确定继续吗？");
  if (!confirmed) {
    return;
  }

  try {
    await app.deleteAiConversation(conversationId);
    latestCoachResponse = null;
    pendingCoachMessage = null;
    coachNotice = null;
    renderHome();
    renderCoach();
    renderProgress();
    app.notify("已删除这段会话");
  } catch (error) {
    app.notify(error.message || "删除会话失败");
  }
}

async function deleteCurrentConversation() {
  const state = app.getState();
  if (!state.activeAiConversationId) {
    app.notify("当前是新对话窗口，没有可删除的会话");
    return;
  }

  return deleteConversationById(state.activeAiConversationId);
}

async function clearAllAiHistory() {
  if (!app.getState().aiConversations.length) {
    app.notify("当前没有可清空的聊天记录");
    return;
  }

  const confirmed = window.confirm("这会清空当前账号下所有 AI 会话和消息，确定继续吗？");
  if (!confirmed) {
    return;
  }

  els.clearAiHistoryBtn.disabled = true;

  try {
    await app.clearAiHistory();
    latestCoachResponse = null;
    pendingCoachMessage = null;
    coachNotice = null;
    deletingHistoryIds.clear();
    renderHome();
    renderCoach();
    renderProgress();
    app.notify("已清空全部 AI 历史");
  } catch (error) {
    app.notify(error.message || "清空 AI 历史失败");
  } finally {
    els.clearAiHistoryBtn.disabled = false;
  }
}

function getProviderLabel(provider) {
  return provider === "gemini_native" ? "Gemini 原生接口" : "OpenAI 兼容接口";
}

function renderStatusNote(element, notice) {
  if (!element) return;
  if (!notice || !notice.text) {
    element.textContent = "";
    element.className = "status-note hidden";
    return;
  }

  element.textContent = notice.text;
  element.className = `status-note ${notice.kind || "info"}`;
}

function cancelPendingApiTest(message = "") {
  if (!activeApiTestController) return false;

  activeApiTestController.abort();
  activeApiTestController = null;
  els.testApiSettingsBtn.disabled = false;
  els.testApiSettingsBtn.textContent = "测试 API 连通性";

  if (message) {
    apiTestNotice = { kind: "info", text: message };
    renderStatusNote(els.apiTestStatus, apiTestNotice);
  }

  return true;
}
function normalizePresetValue(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeApiServiceKey(value) {
  const raw = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(API_SERVICE_CONFIG, raw) ? raw : "openai";
}

function inferApiServiceKey(settings) {
  const provider = String(settings && settings.provider || "").trim();
  const baseUrl = normalizePresetValue(settings && settings.baseUrl);
  const model = String(settings && settings.model || "").trim().toLowerCase();

  if (provider === "gemini_native") return "gemini";
  if (baseUrl === normalizePresetValue(API_SERVICE_CONFIG.deepseek.compatible.baseUrl) || model.startsWith("deepseek-")) return "deepseek";
  if (baseUrl === normalizePresetValue(API_SERVICE_CONFIG.gemini.compatible.baseUrl) || model.startsWith("gemini-")) return "gemini";
  return "openai";
}

function syncApiProviderOptions(serviceKey) {
  const nextService = normalizeApiServiceKey(serviceKey);
  const allowGeminiNative = nextService === "gemini";

  Array.from(els.apiProviderSelect.options).forEach((option) => {
    if (option.value === "gemini_native") {
      option.disabled = !allowGeminiNative;
      option.hidden = !allowGeminiNative;
    }
  });

  if (!allowGeminiNative && els.apiProviderSelect.value === "gemini_native") {
    els.apiProviderSelect.value = "openai_compatible";
  }
}

function getApiConfigForSelection(serviceKey, providerValue) {
  const serviceConfig = API_SERVICE_CONFIG[normalizeApiServiceKey(serviceKey)];
  return String(providerValue || "").trim() === "gemini_native"
    ? serviceConfig.native || serviceConfig.compatible
    : serviceConfig.compatible;
}

function renderApiModelOptions(serviceKey, providerValue, selectedModel = "") {
  const config = getApiConfigForSelection(serviceKey, providerValue);
  const models = Array.isArray(config.models) ? config.models : [config.model];
  const normalizedSelected = String(selectedModel || "").trim();
  const options = models.slice();

  if (normalizedSelected && !options.includes(normalizedSelected)) {
    options.unshift(normalizedSelected);
  }

  els.apiModelSelect.innerHTML = options
    .map((modelName) => {
      const selected = modelName === normalizedSelected || (!normalizedSelected && modelName === config.model) ? " selected" : "";
      const suffix = !models.includes(modelName) ? "（当前自定义）" : "";
      return `<option value="${app.escapeHTML(modelName)}"${selected}>${app.escapeHTML(modelName)}${suffix}</option>`;
    })
    .join("");
}

function resolveApiServiceSelection(serviceKey, providerValue, changedBy = "service") {
  let nextService = normalizeApiServiceKey(serviceKey);
  let nextProvider = String(providerValue || "").trim() === "gemini_native" ? "gemini_native" : "openai_compatible";

  if (changedBy === "service") {
    nextProvider = API_SERVICE_CONFIG[nextService].defaultProvider || "openai_compatible";
  } else if (nextProvider === "gemini_native") {
    nextService = "gemini";
  }

  if (nextService !== "gemini") {
    nextProvider = "openai_compatible";
  }

  const serviceConfig = API_SERVICE_CONFIG[nextService];
  const config = getApiConfigForSelection(nextService, nextProvider);

  return {
    serviceKey: nextService,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    models: config.models || [config.model],
    label: serviceConfig.label
  };
}

function applyApiServiceSelection(serviceKey, providerValue, changedBy = "service", options = {}) {
  const next = resolveApiServiceSelection(serviceKey, providerValue, changedBy);
  els.apiServiceSelect.value = next.serviceKey;
  syncApiProviderOptions(next.serviceKey);
  els.apiProviderSelect.value = next.provider;
  els.apiBaseUrlInput.value = next.baseUrl;
  renderApiModelOptions(next.serviceKey, next.provider, next.model);
  apiTestNotice = null;
  renderStatusNote(els.apiTestStatus, apiTestNotice);
  if (!options.silent) {
    app.notify(`已切换到 ${next.label} / ${next.provider === "gemini_native" ? "Gemini 原生接口" : "OpenAI 兼容接口"}`);
  }
}

async function saveSelectedMbti(source) {
  const isSettings = source === "settings";
  const selectEl = isSettings ? els.settingsMbtiSelect : els.manualMbtiSelect;
  const buttonEl = isSettings ? els.saveSettingsMbtiBtn : els.saveManualMbtiBtn;
  const originalText = buttonEl.textContent;
  const mbti = selectEl.value.trim();

  if (!mbti) {
    app.notify("请先选择一种 MBTI 类型");
    return;
  }

  buttonEl.disabled = true;
  buttonEl.textContent = "保存中...";

  try {
    await app.manualSelectMbti(mbti);
    renderAll();
    switchModule(isSettings ? "settings" : "mbti");
    app.notify(`已将当前 MBTI 设置为 ${mbti}`);
  } catch (error) {
    app.notify(error.message || "保存 MBTI 失败");
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

async function saveBasicSettings() {
  try {
    await app.updatePreferences({
      theme: els.settingsTheme.value,
      selectedScenario: els.settingsScenario.value
    });
    renderAll();
    app.notify("基础设置已保存");
  } catch (error) {
    app.notify(error.message || "基础设置保存失败");
  }
}

async function saveApiSettings() {
  const provider = els.apiProviderSelect.value;
  const baseUrl = els.apiBaseUrlInput.value.trim();
  const apiKey = els.apiKeyInput.value.trim();
  const model = els.apiModelSelect.value.trim();

  els.saveApiSettingsBtn.disabled = true;
  els.saveApiSettingsBtn.textContent = "保存中...";

  try {
    await app.saveAiSettings({ provider, baseUrl, apiKey, model });
    apiTestNotice = { kind: "success", text: "API 设置已保存，你现在可以去 AI 助手里直接聊天了。" };
    els.apiKeyInput.value = "";
    renderAll();
    switchModule("settings");
    app.notify("API 设置已保存");
  } catch (error) {
    apiTestNotice = { kind: "error", text: error.message || "API 设置保存失败" };
    renderStatusNote(els.apiTestStatus, apiTestNotice);
    app.notify(error.message || "API 设置保存失败");
  } finally {
    els.saveApiSettingsBtn.disabled = false;
    els.saveApiSettingsBtn.textContent = "保存 API 设置";
  }
}

async function testAiSettings() {
  const provider = els.apiProviderSelect.value;
  const baseUrl = els.apiBaseUrlInput.value.trim();
  const apiKey = els.apiKeyInput.value.trim();
  const model = els.apiModelSelect.value.trim();

  cancelPendingApiTest();
  const controller = new AbortController();
  activeApiTestController = controller;

  els.testApiSettingsBtn.disabled = true;
  els.testApiSettingsBtn.textContent = "测试中...";
  apiTestNotice = { kind: "info", text: "正在测试接口连通性，请稍候..." };
  renderStatusNote(els.apiTestStatus, apiTestNotice);

  try {
    const result = await app.testAiSettings(
      { provider, baseUrl, apiKey, model },
      { signal: controller.signal }
    );

    if (activeApiTestController !== controller) {
      return;
    }

    apiTestNotice = {
      kind: "success",
      text: `测试成功：${getProviderLabel(result.provider)} / ${result.model} / ${result.replyPreview}`
    };
    renderStatusNote(els.apiTestStatus, apiTestNotice);
    app.notify("API 连通性测试成功");
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }

    if (activeApiTestController !== controller) {
      return;
    }

    apiTestNotice = { kind: "error", text: error.message || "AI 接口测试失败" };
    renderStatusNote(els.apiTestStatus, apiTestNotice);
    app.notify(error.message || "AI 接口测试失败");
  } finally {
    if (activeApiTestController === controller) {
      activeApiTestController = null;
      els.testApiSettingsBtn.disabled = false;
      els.testApiSettingsBtn.textContent = "测试 API 连通性";
    }
  }
}
function renderSettings() {
  const state = app.getState();
  const aiSettings = state.aiSettings || {};
  const user = app.getUser();
  syncMbtiSelectors(state);
  els.settingsTheme.value = state.theme || "light";
  els.settingsScenario.value = state.selectedScenario || app.SCENARIOS[0];
  els.settingsUsername.textContent = user ? user.username : "-";
  const inferredService = inferApiServiceKey(aiSettings);
  const hasOfficialMatch = (() => {
    const provider = String(aiSettings.provider || "").trim();
    const baseUrl = normalizePresetValue(aiSettings.baseUrl || "");
    const model = String(aiSettings.model || "").trim();
    const serviceConfig = API_SERVICE_CONFIG[inferredService];
    const candidates = [serviceConfig.compatible, serviceConfig.native].filter(Boolean);
    return candidates.some((candidate) => candidate.provider === provider && normalizePresetValue(candidate.baseUrl) === baseUrl && String(candidate.model || "").trim() === model);
  })();

  if (hasOfficialMatch) {
    applyApiServiceSelection(inferredService, aiSettings.provider || "openai_compatible", aiSettings.provider === "gemini_native" ? "interface" : "service", { silent: true });
  } else {
    els.apiServiceSelect.value = inferredService;
    syncApiProviderOptions(els.apiServiceSelect.value);
    els.apiProviderSelect.value = aiSettings.provider || "openai_compatible";
    els.apiBaseUrlInput.value = aiSettings.baseUrl || "";
    renderApiModelOptions(els.apiServiceSelect.value, els.apiProviderSelect.value, aiSettings.model || "gpt-4.1-mini");
  }
  els.settingsMbtiSummary.textContent = hasCompletedMbtiState(state)
    ? `当前结果来自正式测试：${state.mbti}（信度 ${state.reliability}% / 匹配度 ${state.match}%）`
    : hasManualMbtiState(state)
      ? `当前结果来自手动选择：${state.mbti}`
      : "当前还没有 MBTI 结果；如果你已经知道自己的类型，可以直接在这里保存。";

  renderStatusNote(els.apiTestStatus, apiTestNotice);
}

function renderProgress() {
  const state = app.getState();
  const metrics = app.getProgressMetrics();
  const planStats = state.planBookStats || {};
  const activePlans = (state.planBookEntries || [])
    .filter((entry) => entry.status !== "achieved")
    .slice()
    .sort((a, b) => getPlanEntryTimestamp(b) - getPlanEntryTimestamp(a));
  const achievedPlans = (state.planBookEntries || [])
    .filter((entry) => entry.status === "achieved")
    .slice()
    .sort((a, b) => getPlanEntryTimestamp(b) - getPlanEntryTimestamp(a));

  app.setRingProgress(els.ringValue, metrics.percent);
  els.progressText.textContent = `${metrics.percent}%`;

  els.planOverviewCards.innerHTML = `
    <article class="plan-stat-card">
      <span>进行中计划</span>
      <strong>${app.escapeHTML(String(planStats.activeCount || 0))}</strong>
    </article>
    <article class="plan-stat-card">
      <span>已达成计划</span>
      <strong>${app.escapeHTML(String(planStats.achievedCount || 0))}</strong>
    </article>
    <article class="plan-stat-card">
      <span>已完成任务</span>
      <strong>${app.escapeHTML(String(planStats.completedTaskCount || 0))}/${app.escapeHTML(String(planStats.totalTaskCount || 0))}</strong>
    </article>
    <article class="plan-stat-card">
      <span>计划进度</span>
      <strong>${app.escapeHTML(String(planStats.overallProgressPercent || 0))}%</strong>
    </article>
  `;

  els.activityList.innerHTML = state.activities.length
    ? state.activities.map((item) => `<li>${app.escapeHTML(item)}</li>`).join("")
    : '<li class="muted">还没有活动记录，先开始一次测试或生成一组计划吧。</li>';

  els.badgeList.innerHTML = metrics.badges.length
    ? metrics.badges.map((badge) => `
        <article class="achievement-card">
          <h4>${app.escapeHTML(badge.title || "新的成就")}</h4>
          <p>${app.escapeHTML(badge.description || "继续推进，你会解锁更多成长记录。")}</p>
        </article>
      `).join("")
    : '<div class="plan-empty muted">继续推进计划簿里的任务，这里会逐步点亮你的成长成就。</div>';

  els.activePlanList.innerHTML = activePlans.length
    ? activePlans.map((entry) => buildPlanEntryMarkup(entry)).join("")
    : '<div class="plan-empty muted">还没有进行中的计划。去 AI 助手里生成方案，然后挑一个加入计划簿吧。</div>';

  els.achievedPlanList.innerHTML = buildAchievedPlanMarkup(achievedPlans);

  document.querySelectorAll("[data-plan-entry-id][data-plan-task-id]").forEach((input) => {
    input.addEventListener("change", async (event) => {
      const entryId = event.target.dataset.planEntryId;
      const taskId = event.target.dataset.planTaskId;

      try {
        await app.togglePlanBookTask(entryId, taskId, event.target.checked);
        renderHome();
        renderCoach({ preserveScroll: true });
        renderProgress();
        app.notify(event.target.checked ? "计划任务已完成" : "计划任务状态已更新");
      } catch (error) {
        event.target.checked = !event.target.checked;
        app.notify(error.message || "计划任务更新失败");
      }
    });
  });

  els.achievedPlanList.querySelectorAll("[data-achieved-month-toggle]").forEach((button, index) => {
    button.addEventListener("click", () => {
      const key = button.dataset.achievedMonthToggle;
      const current = achievedMonthVisibility.has(key)
        ? Boolean(achievedMonthVisibility.get(key))
        : index === 0;
      achievedMonthVisibility.set(key, !current);
      renderProgress();
    });
  });

  els.achievedPlanList.querySelectorAll("[data-toggle-achieved-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const entryId = button.dataset.toggleAchievedEntry;
      if (expandedAchievedPlanIds.has(entryId)) {
        expandedAchievedPlanIds.delete(entryId);
      } else {
        expandedAchievedPlanIds.add(entryId);
      }
      renderProgress();
    });
  });

  els.achievedPlanList.querySelectorAll("[data-restart-plan-entry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const entryId = button.dataset.restartPlanEntry;
      button.disabled = true;
      button.textContent = "重启中...";

      try {
        await app.restartPlanBookEntry(entryId);
        renderHome();
        renderCoach({ preserveScroll: true });
        renderProgress();
        app.notify("已重新开始这个计划");
      } catch (error) {
        button.disabled = false;
        button.textContent = "重新开始";
        app.notify(error.message || "重新开始计划失败");
      }
    });
  });

  els.achievedPlanList.querySelectorAll("[data-delete-plan-entry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const entryId = button.dataset.deletePlanEntry;
      button.disabled = true;
      button.textContent = "删除中...";

      try {
        await app.removePlanBookEntry(entryId);
        expandedAchievedPlanIds.delete(entryId);
        renderHome();
        renderCoach({ preserveScroll: true });
        renderProgress();
        app.notify("已删除达成计划");
      } catch (error) {
        button.disabled = false;
        button.textContent = "删除";
        app.notify(error.message || "删除计划失败");
      }
    });
  });

  if (planStats.currentPlanProgress) {
    const currentPlan = planStats.currentPlanProgress;
    els.milestoneText.textContent =
      metrics.nextMilestone === 0
        ? `当前计划“${currentPlan.planName}”已达到阈值，可以继续巩固。`
        : `当前计划“${currentPlan.planName}”还差 ${metrics.nextMilestone} 个任务达到阈值。`;
  } else if (planStats.recentAchieved) {
    els.milestoneText.textContent = `最近达成计划：${planStats.recentAchieved.planName}`;
  } else {
    els.milestoneText.textContent = "先从 AI 助手里选择一个计划加入计划簿，再逐项打钩推进。";
  }
}

