const app = window.PersonalityApp;
let radarChart = null;
let activeModule = "home";
let authMode = "login";
let authMethod = "email";
let latestCoachResponse = null;
let coachNotice = null;
let apiTestNotice = null;
let activeApiTestController = null;
let pendingCoachMessage = null;
let authValidationTimers = {};
let phoneOtpRequestedFor = "";
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
  },
  custom_relay: {
    label: "其他",
    defaultProvider: "openai_compatible",
    subPresets: {
      openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", modelPlaceholder: "例如：openai/gpt-4.1-mini" },
      api2d:     { label: "API2D",       baseUrl: "https://openai.api2d.net",        modelPlaceholder: "例如：gpt-4.1-mini" },
      one_api:   { label: "one-api",      baseUrl: "https://your-one-api.example.com",  modelPlaceholder: "例如：gpt-4.1-mini" },
      custom:    { label: "纯自定义",       baseUrl: "",                                modelPlaceholder: "输入模型名称" }
    },
    compatible: {
      provider: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "",
      models: []
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
  authModeTabs: document.querySelectorAll("[data-auth-mode]"),
  authMethodTabs: document.getElementById("authMethodTabs"),
  authMethodTabBtns: null, // populated after DOM
  authModeTitle: document.getElementById("authModeTitle"),
  authModeCopy: document.getElementById("authModeCopy"),
  authAccountLabel: document.getElementById("authAccountLabel"),
  authUsername: document.getElementById("authUsername"),
  authEmailFields: document.getElementById("authEmailFields"),
  authPhoneFields: document.getElementById("authPhoneFields"),
  authPhoneOtpFields: document.getElementById("authPhoneOtpFields"),
  authPhoneOtp: document.getElementById("authPhoneOtp"),
  authPhoneOtpError: document.getElementById("authPhoneOtpError"),
  authPhoneHint: document.getElementById("authPhoneHint"),
  authPhoneSetupHint: document.getElementById("authPhoneSetupHint"),
  authResendPhoneOtp: document.getElementById("authResendPhoneOtp"),
  authRegisterFields: document.getElementById("authRegisterFields"),
  authLoginExtras: document.getElementById("authLoginExtras"),
  authEmailWrap: document.getElementById("authEmailWrap"),
  authEmail: document.getElementById("authEmail"),
  authPhone: document.getElementById("authPhone"),
  authPassword: document.getElementById("authPassword"),
  authPasswordToggle: document.getElementById("authPasswordToggle"),
  authPasswordHint: document.getElementById("authPasswordHint"),
  authConfirmWrap: document.getElementById("authConfirmWrap"),
  authConfirm: document.getElementById("authConfirm"),
  authSubmit: document.getElementById("authSubmit"),
  authSubmitText: null, // populated after DOM
  authSpinner: null,
  authTogglePrompt: document.getElementById("authTogglePrompt"),
  authToggleBtn: document.getElementById("authToggleBtn"),
  authRememberMe: document.getElementById("authRememberMe"),
  authForgotBtn: document.getElementById("authForgotBtn"),
  authServerError: document.getElementById("authServerError"),
  authStrengthMeter: document.getElementById("authStrengthMeter"),
  authStrengthFill: document.getElementById("authStrengthFill"),
  authStrengthLabel: document.getElementById("authStrengthLabel"),

  // Error elements
  authUsernameError: document.getElementById("authUsernameError"),
  authPasswordError: document.getElementById("authPasswordError"),
  authEmailError: document.getElementById("authEmailError"),
  authConfirmError: document.getElementById("authConfirmError"),
  authPhoneError: document.getElementById("authPhoneError"),

  // Forgot password
  forgotPasswordModal: document.getElementById("forgotPasswordModal"),
  forgotEmail: document.getElementById("forgotEmail"),
  forgotEmailError: document.getElementById("forgotEmailError"),
  forgotSubmitBtn: document.getElementById("forgotSubmitBtn"),
  forgotStatus: document.getElementById("forgotStatus"),
  forgotCloseBtn: document.getElementById("forgotCloseBtn"),

  // Verification reminder
  verifyReminder: document.getElementById("verifyReminder"),
  verifyReminderEmail: document.getElementById("verifyReminderEmail"),
  resendVerifyBtn: document.getElementById("resendVerifyBtn"),
  dismissVerifyBtn: document.getElementById("dismissVerifyBtn"),

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
  startMbtiTestBtn: document.getElementById("startMbtiTestBtn"),
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
  relayPresetLabel: document.getElementById("relayPresetLabel"),
  relayPresetSelect: document.getElementById("relayPresetSelect"),
  apiBaseUrlInput: document.getElementById("apiBaseUrlInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiModelInput: document.getElementById("apiModelInput"),
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

function applyStaggerAnimations(container, selector, delay = 50) {
  if (!container) return;
  const items = container.querySelectorAll(selector);
  items.forEach((item, index) => {
    item.style.animationDelay = `${index * delay}ms`;
    item.classList.add("animate-in");
  });
}

function animateModulePanel(panel) {
  if (!panel) return;
  panel.style.animation = "none";
  panel.offsetHeight;
  panel.style.animation = "";
}

init();

async function init() {
  bindEvents();
  initAuthPortalReveal();
  initMbtiOrbitScene();
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
  // Auth mode tabs (login / register)
  els.authModeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      authMode = tab.dataset.authMode;
      updateAuthModeUI();
    });
  });

  // Auth method tabs (email / phone)
  if (els.authMethodTabs) {
    els.authMethodTabBtns = els.authMethodTabs.querySelectorAll("[data-auth-method]");
    els.authMethodTabBtns.forEach((tab) => {
      tab.addEventListener("click", () => {
        authMethod = tab.dataset.authMethod;
        updateAuthMethodUI();
      });
    });
  }

  els.authForm.addEventListener("submit", handleAuthSubmit);

  // Password visibility toggle
  if (els.authPasswordToggle) {
    els.authPasswordToggle.addEventListener("click", () => {
      const isPassword = els.authPassword.type === "password";
      els.authPassword.type = isPassword ? "text" : "password";
      els.authPasswordToggle.classList.toggle("visible", isPassword);
    });
  }

  // Forgot password
  if (els.authForgotBtn) {
    els.authForgotBtn.addEventListener("click", openForgotPassword);
  }
  if (els.authResendPhoneOtp) {
    els.authResendPhoneOtp.addEventListener("click", requestPhoneOtp);
  }
  if (els.forgotCloseBtn) {
    els.forgotCloseBtn.addEventListener("click", closeForgotPassword);
  }
  if (els.forgotSubmitBtn) {
    els.forgotSubmitBtn.addEventListener("click", submitForgotPassword);
  }

  // Verification reminder
  if (els.resendVerifyBtn) {
    els.resendVerifyBtn.addEventListener("click", resendVerificationEmail);
  }
  if (els.dismissVerifyBtn) {
    els.dismissVerifyBtn.addEventListener("click", () => {
      els.verifyReminder.classList.add("hidden");
    });
  }

  // Real-time validation on input
  setupAuthFieldValidation();

  els.moduleNav.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => switchModule(button.dataset.module));
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

  els.homeMbtiBtn.addEventListener("click", () => switchModule("mbti"));
  els.homeCoachBtn.addEventListener("click", () => switchModule("coach"));

  document.addEventListener("click", (event) => {
    const clickedElement = event.target instanceof Element ? event.target : event.target.parentElement;
    const jumpButton = clickedElement?.closest("[data-jump]");
    const target = jumpButton?.getAttribute("data-jump");
    if (!target || !MODULE_NAMES.includes(target)) return;
    event.preventDefault();
    if (target === "coach") {
      openCoachWorkspace(jumpButton);
      return;
    }
    switchModule(target);
  });
  els.startMbtiTestBtn.addEventListener("click", () => {
    const mbtiPanel = els.panels.mbti;
    const answerStage = document.querySelector(".mbti-answer-stage");
    if (!answerStage) return;
    const enterAnswerMode = () => {
      mbtiPanel.classList.remove("mbti-transitioning");
      mbtiPanel.classList.add("mbti-answer-mode");
      answerStage.scrollIntoView({ behavior: "auto", block: "start" });
      answerStage.querySelector('input[name="answer"], [data-mbti-action="start-test"], [data-mbti-action="reset"]')?.focus();
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      enterAnswerMode();
      return;
    }

    if (mbtiTestTransitionTimer || mbtiPanel.classList.contains("mbti-answer-mode")) return;
    mbtiPanel.classList.add("mbti-transitioning");
    mbtiTestTransitionTimer = window.setTimeout(() => {
      mbtiTestTransitionTimer = 0;
      enterAnswerMode();
    }, 760);
  });

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
    applyApiServiceSelection(els.apiServiceSelect.value,…41260 tokens truncated…  const totalPlans = entries.length;
  const totalTasks = allTasks.length;
  const completedPlans = achieved.length;
  const avgCompletion = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Completion trend: last 7 days
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const completionsByDate = {};
  completedTasks.forEach((t) => {
    if (t.completedAt) {
      const date = t.completedAt.slice(0, 10);
      completionsByDate[date] = (completionsByDate[date] || 0) + 1;
    }
  });
  const trendData = last7.map((date) => completionsByDate[date] || 0);

  // Dimension breakdown
  const dimensionKeys = ["emotion", "action", "empathy", "focus", "openness"];
  const dimensionLabels = ["情绪力", "行动力", "共情力", "专注力", "开放度"];
  const dimensionColors = ["#7F77DD", "#D85A30", "#378ADD", "#1D9E75", "#BA7517"];
  const dimensionStats = dimensionKeys.map((key, i) => {
    const dimTasks = allTasks.filter((t) => {
      const entry = entries.find((e) => e.tasks && e.tasks.includes(t));
      return entry && entry.groupName && entry.groupName.includes(dimensionLabels[i]);
    });
    // Fallback: match by entry index or just use entry tasks
    const entryForDim = entries.filter((_, idx) => idx === i || (entries[idx] && entries[idx].tasks));
    const dimCompleted = completedTasks.filter((t) => {
      return entries.some((e) => e.tasks && e.tasks.includes(t) && e.status !== "achieved");
    }).length;
    const total = dimTasks.length;
    const done = dimTasks.filter((t) => t.done).length;
    return {
      key,
      label: dimensionLabels[i],
      color: dimensionColors[i],
      total,
      completed: done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  return {
    totalPlans, completedPlans, totalTasks,
    completedTaskCount: completedTasks.length,
    avgCompletion,
    trendData,
    trendLabels: last7.map((d) => d.slice(5)), // MM-DD
    dimensionStats,
    activeCount: active.length,
    achievedCount: achieved.length,
  };
}

// ════════════════════════════════════════════════════════
//  Chart Instances (reuse)
// ════════════════════════════════════════════════════════

let chartInstances = {};

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

// ════════════════════════════════════════════════════════
//  Render Dashboard Charts
// ════════════════════════════════════════════════════════

function renderDashboardCharts() {
  if (typeof window.Chart !== "function") {
    console.warn("Chart.js not loaded");
    return;
  }

  const stats = calculateDashboardStats();

  // Update stat cards
  const el = (id) => document.getElementById(id);
  if (el("dashTotalPlans")) el("dashTotalPlans").textContent = stats.totalPlans;
  if (el("dashCompletedPlans")) el("dashCompletedPlans").textContent = stats.completedPlans;
  if (el("dashTotalTasks")) el("dashTotalTasks").textContent = stats.totalTasks;
  if (el("dashCurrentStreak")) el("dashCurrentStreak").textContent = DASH.streak || 0;
  if (el("dashAvgCompletion")) el("dashAvgCompletion").textContent = stats.avgCompletion + "%";

  // Render dimension stats table
  renderDimensionStatsTable(stats.dimensionStats);

  // Chart 1: Completion Trend (line chart)
  renderCompletionTrendChart(stats);

  // Chart 2: Dimension Breakdown (doughnut)
  renderDimensionChart(stats);

  // Chart 3: Daily Completions (bar chart)
  renderDailyCompletionsChart(stats);

  // Chart 4: Productivity Score (line chart)
  renderProductivityScoreChart(stats);
}

function renderDimensionStatsTable(dimStats) {
  const table = document.getElementById("dimensionStatsTable");
  if (!table) return;
  table.innerHTML = dimStats
    .map(
      (d) => `
    <div class="dimension-stat-row">
      <span class="dimension-stat-name" style="color:${d.color};">${d.label}</span>
      <div class="dimension-stat-bar-wrap">
        <div class="dimension-stat-bar" style="width:${d.pct}%;background:${d.color};"></div>
      </div>
      <span class="dimension-stat-value">${d.pct}%</span>
      <span class="dimension-stat-count">${d.completed}/${d.total}</span>
    </div>`
    )
    .join("");
}

// ── Chart 1: Completion Trend (line) ──
function renderCompletionTrendChart(stats) {
  const canvas = document.getElementById("chartCompletionTrend");
  if (!canvas) return;
  destroyChart("completionTrend");
  const ctx = canvas.getContext("2d");
  chartInstances.completionTrend = new window.Chart(ctx, {
    type: "line",
    data: {
      labels: stats.trendLabels,
      datasets: [
        {
          label: "完成任务数",
          data: stats.trendData,
          borderColor: "var(--accent, #5D9B7A)",
          backgroundColor: "rgba(93,155,122,0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "var(--accent, #5D9B7A)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

// ── Chart 2: Dimension Breakdown (doughnut) ──
function renderDimensionChart(stats) {
  const canvas = document.getElementById("chartDimensionBreakdown");
  if (!canvas) return;
  destroyChart("dimension");
  const ctx = canvas.getContext("2d");
  const dims = stats.dimensionStats;
  chartInstances.dimension = new window.Chart(ctx, {
    type: "doughnut",
    data: {
      labels: dims.map((d) => d.label),
      datasets: [
        {
          data: dims.map((d) => d.completed),
          backgroundColor: dims.map((d) => d.color),
          borderWidth: 2,
          borderColor: "var(--surface, #fff)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 12 } } },
      },
    },
  });
}

// ── Chart 3: Daily Completions (bar) ──
function renderDailyCompletionsChart(stats) {
  const canvas = document.getElementById("chartDailyCompletions");
  if (!canvas) return;
  destroyChart("daily");
  const ctx = canvas.getContext("2d");
  chartInstances.daily = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels: stats.trendLabels,
      datasets: [
        {
          label: "完成任务",
          data: stats.trendData,
          backgroundColor: "rgba(93,155,122,0.7)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

// ── Chart 4: Productivity Score (radar-like line) ──
function renderProductivityScoreChart(stats) {
  const canvas = document.getElementById("chartProductivityScore");
  if (!canvas) return;
  destroyChart("productivity");
  const ctx = canvas.getContext("2d");
  // Calculate a "productivity score" per day (simulated)
  const scores = stats.trendData.map((count, i) => {
    // Simple heuristic: more completions = higher score
    return Math.min(100, count * 25 + Math.round(Math.random() * 10));
  });
  chartInstances.productivity = new window.Chart(ctx, {
    type: "line",
    data: {
      labels: stats.trendLabels,
      datasets: [
        {
          label: "生产力评分",
          data: scores,
          borderColor: "#7F77DD",
          backgroundColor: "rgba(127,119,221,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#7F77DD",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 25 } },
      },
    },
  });
}

// ════════════════════════════════════════════════════════
//  Achievements System
// ════════════════════════════════════════════════════════

const ACHIEVEMENTS = [
  {
    id: "first_plan",
    name: "第一步",
    desc: "创建你的第一个计划",
    icon: "🎯",
    check: (s) => s.totalPlans >= 1,
  },
  {
    id: "complete_first_task",
    name: "行动派",
    desc: "完成第一个任务",
    icon: "✅",
    check: (s) => s.completedTaskCount >= 1,
  },
  {
    id: "complete_first_plan",
    name: "达成者",
    desc: "完成第一个完整计划",
    icon: "🏆",
    check: (s) => s.completedPlans >= 1,
  },
  {
    id: "streak_3",
    name: "三天打鱼",
    desc: "连续打卡 3 天",
    icon: "🔥",
    check: (s) => s.streak >= 3,
  },
  {
    id: "streak_7",
    name: "一周坚持",
    desc: "连续打卡 7 天",
    icon: "📅",
    check: (s) => s.streak >= 7,
  },
  {
    id: "streak_30",
    name: "月度达人",
    desc: "连续打卡 30 天",
    icon: "👑",
    check: (s) => s.streak >= 30,
  },
  {
    id: "tasks_10",
    name: "小有成效",
    desc: "累计完成 10 个任务",
    icon: "⭐",
    check: (s) => s.completedTaskCount >= 10,
  },
  {
    id: "tasks_50",
    name: "高效能手",
    desc: "累计完成 50 个任务",
    icon: "💎",
    check: (s) => s.completedTaskCount >= 50,
  },
  {
    id: "tasks_100",
    name: "百 task 斩",
    desc: "累计完成 100 个任务",
    icon: "🏅",
    check: (s) => s.completedTaskCount >= 100,
  },
  {
    id: "plans_5",
    name: "规划师",
    desc: "创建 5 个计划",
    icon: "📋",
    check: (s) => s.totalPlans >= 5,
  },
  {
    id: "all_dimensions",
    name: "全面成长",
    desc: "在所有 5 个维度都有进行中的计划",
    icon: "🌟",
    check: (s) => {
      const entries = (app.getState && app.getState().planBookEntries) || [];
      const active = entries.filter((e) => e.status !== "achieved");
      return active.length >= 5;
    },
  },
  {
    id: "early_bird",
    name: "早起鸟",
    desc: "在早上 8 点前完成任务",
    icon: "🐦",
    check: () => false, // Would need timestamp tracking
  },
];

function renderAchievements() {
  const grid = document.getElementById("achievementsGrid");
  const statsEl = document.getElementById("achievementStats");
  if (!grid) return;

  const stats = calculateDashboardStats();
  const unlocked = ACHIEVEMENTS.filter((a) => a.check(stats));
  const locked = ACHIEVEMENTS.filter((a) => !a.check(stats));

  grid.innerHTML = [...unlocked, ...locked]
    .map((a) => {
      const isUnlocked = unlocked.includes(a);
      return `
      <div class="achievement-card ${isUnlocked ? "unlocked" : "locked"}">
        ${!isUnlocked ? '<span class="achievement-lock">🔒</span>' : ""}
        <span class="achievement-icon">${a.icon}</span>
        <span class="achievement-name">${a.name}</span>
        <span class="achievement-desc">${a.desc}</span>
        ${isUnlocked ? `<span class="achievement-date">已解锁</span>` : ""}
      </div>`;
    })
    .join("");

  // Stats
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="achievement-stat-item">
        <div class="achievement-stat-value">${unlocked.length}</div>
        <div class="achievement-stat-label">已解锁</div>
      </div>
      <div class="achievement-stat-item">
        <div class="achievement-stat-value">${locked.length}</div>
        <div class="achievement-stat-label">未解锁</div>
      </div>
      <div class="achievement-stat-item">
        <div class="achievement-stat-value">${Math.round((unlocked.length / ACHIEVEMENTS.length) * 100)}%</div>
        <div class="achievement-stat-label">完成率</div>
      </div>
      <div class="achievement-stat-item">
        <div class="achievement-stat-value">${stats.streak}</div>
        <div class="achievement-stat-label">当前连胜</div>
      </div>`;
  }
}

// ════════════════════════════════════════════════════════
//  Task Drag-and-Drop Reordering
// ════════════════════════════════════════════════════════

function initTaskDragDrop() {
  const lists = document.querySelectorAll(".pd-pending-list, .plan-task-list");
  lists.forEach((list) => {
    list.querySelectorAll(".pd-pending-item, .plan-task-item").forEach((item) => {
      addDragListeners(item);
    });
  });
}

function addDragListeners(item) {
  item.setAttribute("draggable", "true");
  item.addEventListener("dragstart", handleDragStart);
  item.addEventListener("dragover", handleDragOver);
  item.addEventListener("drop", handleDrop);
  item.addEventListener("dragend", handleDragEnd);
}

let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/html", this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  this.classList.add("drag-over");
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();
  if (dragSrcEl !== this) {
    // Swap the items visually
    const list = this.parentNode;
    const items = [...list.children];
    const srcIdx = items.indexOf(dragSrcEl);
    const dstIdx = items.indexOf(this);
    if (srcIdx < dstIdx) {
      list.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      list.insertBefore(dragSrcEl, this);
    }
    // Persist new order
    persistTaskOrder(list);
  }
  this.classList.remove("drag-over");
  return false;
}

function handleDragEnd() {
  this.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
}

function persistTaskOrder(list) {
  // Extract entry/task IDs from the DOM and update sortOrder
  const items = [...list.children];
  items.forEach((item, idx) => {
    const entryId = item.dataset.planEntryId;
    const taskId = item.dataset.planTaskId;
    if (entryId && taskId && app.updatePlanBookEntry) {
      // Update the task's sortOrder in the data
      const state = app.getState && app.getState();
      if (!state) return;
      const entry = state.planBookEntries.find((e) => e.id === entryId);
      if (!entry || !entry.tasks) return;
      const task = entry.tasks.find((t) => t.id === taskId);
      if (task) task.sortOrder = idx;
    }
  });
  // Save state
  if (app.saveState) app.saveState();
}

// ════════════════════════════════════════════════════════
//  Initialize when progress module is shown
// ════════════════════════════════════════════════════════

// initProgressTabs() is called from renderProgress() directly
// Task Swap and Dashboard Refresh Functions
// Append to app.chat.js

let _swapEntryId = null;
let _swapTaskId = null;

function openSwapModal(entryId, taskId) {
  _swapEntryId = entryId;
  _swapTaskId = taskId;
  const modal = document.getElementById("taskSwapModal");
  const list = document.getElementById("swapTargetList");
  if (!modal || !list) return;

  const entries = (app.getState && app.getState().planBookEntries) || [];
  const active = entries.filter(e => e.status !== "achieved" && e.id !== entryId);
  if (active.length === 0) {
    list.innerHTML = '<p class="muted">没有其他进行中的计划。</p>';
  } else {
    const GOAL_COLORS = ["goal-purple","goal-coral","goal-blue","goal-teal","goal-amber"];
    list.innerHTML = active.map((entry, i) => {
      const colorClass = GOAL_COLORS[i % GOAL_COLORS.length];
      const colorMap = { "goal-purple":"#7F77DD","goal-coral":"#D85A30","goal-blue":"#378ADD","goal-teal":"#1D9E75","goal-amber":"#BA7517"};
      const dotColor = colorMap[colorClass] || "#5D9B7A";
      return `<div class="swap-target-item" data-target-entry="${entry.id}">
        <span class="swap-target-dot" style="background:${dotColor};"></span>
        <span class="swap-target-name">${escapeHtml(entry.planName)}</span>
        <span class="swap-target-count">${(entry.tasks||[]).length} 任务</span>
      </div>`;
    }).join("");

    list.querySelectorAll(".swap-target-item").forEach(item => {
      item.addEventListener("click", () => {
        const targetId = item.dataset.targetEntry;
        executeTaskSwap(entryId, taskId, targetId);
      });
    });
  }
  modal.classList.remove("hidden");
}

async function executeTaskSwap(entryId, taskId, targetEntryId) {
  const state = app.getState && app.getState();
  if (!state) return;
  const source = state.planBookEntries.find(e => e.id === entryId);
  const target = state.planBookEntries.find(e => e.id === targetEntryId);
  if (!source || !target || !source.tasks) return;
  const task = source.tasks.find(t => t.id === taskId);
  if (!task) return;

  const newTaskId = "tsk_" + Math.random().toString(36).slice(2, 10);
  const updatedSourceTasks = source.tasks.filter(t => t.id !== taskId);
  const updatedTargetTasks = [...(target.tasks||[]), { ...task, id: newTaskId, sortOrder: (target.tasks||[]).length }];

  try {
    await app.updatePlanBookEntry(entryId, { tasks: updatedSourceTasks });
    await app.updatePlanBookEntry(targetEntryId, { tasks: updatedTargetTasks });
    closeSwapModal();
    renderPlanDashboard();
    app.notify("任务已移动到「" + target.planName + "」 ✓");
    refreshDashboardIfVisible();
  } catch (err) {
    app.notify(err.message || "移动任务失败");
  }
}

function closeSwapModal() {
  const modal = document.getElementById("taskSwapModal");
  if (modal) modal.classList.add("hidden");
  _swapEntryId = null;
  _swapTaskId = null;
}

function refreshDashboardIfVisible() {
  const dashTab = document.getElementById("progressTabDashboard");
  if (dashTab && !dashTab.classList.contains("hidden")) {
    renderDashboardCharts();
  }
  const achTab = document.getElementById("progressTabAchievements");
  if (achTab && !achTab.classList.contains("hidden")) {
    renderAchievements();
  }
}

// Close swap modal on background click
document.addEventListener("click", (e) => {
  const modal = document.getElementById("taskSwapModal");
  if (modal && !modal.classList.contains("hidden") && e.target === modal) {
    closeSwapModal();
  }
});

