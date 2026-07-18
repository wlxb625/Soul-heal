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
    applyApiServiceSelection(els.apiServiceSelect.value, els.apiProviderSelect.value, "interface");
    cancelPendingApiTest("已取消当前检测，请确认新的接口类型后重新测试。");
  });
  els.apiModelInput.addEventListener("input", () => {
    cancelPendingApiTest("已取消当前检测，请确认新的模型后重新测试。");
  });
  els.relayPresetSelect.addEventListener("change", () => {
    applyRelayPreset(els.relayPresetSelect.value);
    cancelPendingApiTest("已切换中转站预设，请确认配置后重新测试。");
  });
}

function showAuthShell(mode) {
  authMode = mode || "login";
  authMethod = "email";
  updateAuthModeUI();
  updateAuthMethodUI();
  els.authShell.classList.remove("hidden");
  els.siteShell.classList.add("hidden");
  document.body.setAttribute("data-locked", "true");

  // Check URL for verification success
  if (window.location.search.includes("verified=1")) {
    setTimeout(() => app.notify("邮箱验证成功！现在可以正常使用所有功能"), 500);
    // Clean URL
    history.replaceState(null, "", location.pathname + location.hash);
  }
}

function showAppShell() {
  const user = app.getUser();
  els.authShell.classList.add("hidden");
  els.siteShell.classList.remove("hidden");
  document.body.removeAttribute("data-locked");
  els.userPill.textContent = user ? user.username : "";
  els.userPill.classList.toggle("hidden", !user);

  // Show verification reminder if needed
  updateVerificationReminder();
}

function updateAuthModeUI() {
  const isLogin = authMode === "login";

  // Update mode tabs
  els.authModeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authMode === authMode);
  });

  // Show/hide method tabs (only for login)
  if (els.authMethodTabs) {
    els.authMethodTabs.classList.toggle("hidden", !isLogin);
  }

  // Show/hide register fields
  els.authRegisterFields.classList.toggle("hidden", isLogin);
  els.authLoginExtras.classList.toggle("hidden", !isLogin);

  // Update submit button
  updateAuthSubmitButton(isLogin ? "登录" : "注册");

  // Update username input
  els.authUsername.placeholder = isLogin
    ? (authMethod === "phone" ? "请输入用户名（手机号已作为账号）" : "请输入用户名或邮箱")
    : "请输入用户名（2-20个字符）";
  els.authUsername.setAttribute("autocomplete", "username");

  if (isLogin) {
    els.authPassword.setAttribute("autocomplete", "current-password");
    els.authPassword.placeholder = "请输入密码";
  } else {
    els.authPassword.setAttribute("autocomplete", "new-password");
    els.authPassword.placeholder = "请设置密码（8-64位，含字母和数字）";

    // Clear register-only fields
    els.authEmail.value = "";
    els.authConfirm.value = "";
    els.authPhone.value = "";
  }

  // Clear errors
  clearAllAuthErrors();

  // Hide strength meter for login
  if (els.authStrengthMeter) {
    els.authStrengthMeter.classList.toggle("hidden", isLogin);
  }
}

function updateAuthMethodUI() {
  els.authMethodTabBtns.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authMethod === authMethod);
  });

  const isPhone = authMethod === "phone";
  els.authEmailFields.classList.toggle("hidden", isPhone);
  els.authPhoneFields.classList.toggle("hidden", !isPhone);

  if (isPhone) {
    els.authUsername.placeholder = "请输入用户名（手机号已作为账号）";
  } else {
    els.authUsername.placeholder = authMode === "login" ? "请输入用户名或邮箱" : "请输入用户名（2-20个字符）";
  }

  clearAllAuthErrors();
}

function updateAuthSubmitButton(text) {
  els.authSubmitText = els.authSubmit.querySelector(".auth-submit-text");
  els.authSpinner = els.authSubmit.querySelector(".auth-spinner");
  if (!els.authSubmitText) {
    els.authSubmitText = document.createElement("span");
    els.authSubmitText.className = "auth-submit-text";
    els.authSubmit.appendChild(els.authSubmitText);
  }
  if (!els.authSpinner) {
    els.authSpinner = document.createElement("span");
    els.authSpinner.className = "auth-spinner hidden";
    els.authSpinner.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>';
    els.authSubmit.appendChild(els.authSpinner);
  }
  els.authSubmitText.textContent = text;
}

function setAuthLoading(loading, text) {
  if (!els.authSubmit) return;
  const idleText = authMode === "login" ? "登录" : "注册";
  updateAuthSubmitButton(loading ? (text || "处理中...") : idleText);
  els.authSubmit.disabled = loading;
  els.authSubmit.classList.toggle("is-loading", loading);
  els.authSubmit.setAttribute("aria-busy", String(loading));
  if (els.authSpinner) els.authSpinner.classList.toggle("hidden", !loading);
}

function clearAllAuthErrors() {
  const errorEls = [
    els.authUsernameError, els.authPasswordError, els.authEmailError,
    els.authConfirmError, els.authPhoneError, els.authServerError
  ];
  errorEls.forEach((el) => {
    if (el) {
      el.textContent = "";
      el.classList.remove("visible");
    }
  });

  // Reset field statuses
  document.querySelectorAll(".auth-field-status").forEach((el) => {
    el.classList.remove("valid", "error");
  });
  document.querySelectorAll(".auth-input-wrap").forEach((el) => {
    el.classList.remove("valid", "error");
  });
}

function showAuthFieldError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.add("visible");
}

// ── Real-time Field Validation ──

function setupAuthFieldValidation() {
  const fields = [
    { el: els.authUsername, errorEl: els.authUsernameError, validate: validateAuthUsername, debounce: 600 },
    { el: els.authEmail, errorEl: els.authEmailError, validate: validateAuthEmail, debounce: 600 },
    { el: els.authPassword, errorEl: els.authPasswordError, validate: validateAuthPassword, debounce: 400 },
    { el: els.authConfirm, errorEl: els.authConfirmError, validate: validateAuthConfirm, debounce: 400 },
    { el: els.authPhone, errorEl: els.authPhoneError, validate: validateAuthPhone, debounce: 600 }
  ];

  fields.forEach(({ el, errorEl, validate, debounce }) => {
    if (!el) return;
    el.addEventListener("input", () => {
      clearTimeout(authValidationTimers[el.id]);
      authValidationTimers[el.id] = setTimeout(() => {
        const result = validate();
        const wrap = el.closest(".auth-input-wrap");
        const status = wrap ? wrap.querySelector(".auth-field-status") : null;

        if (result && result.error) {
          showAuthFieldError(errorEl, result.error);
          if (status) { status.classList.remove("valid"); status.classList.add("error"); }
          if (wrap) { wrap.classList.remove("valid"); wrap.classList.add("error"); }
        } else if (el.value.trim()) {
          if (errorEl) { errorEl.textContent = ""; errorEl.classList.remove("visible"); }
          if (status) { status.classList.add("valid"); status.classList.remove("error"); }
          if (wrap) { wrap.classList.add("valid"); wrap.classList.remove("error"); }
        }
      }, debounce);
    });

    el.addEventListener("blur", () => {
      clearTimeout(authValidationTimers[el.id]);
      const result = validate();
      const wrap = el.closest(".auth-input-wrap");
      const status = wrap ? wrap.querySelector(".auth-field-status") : null;

      if (result && result.error) {
        showAuthFieldError(errorEl, result.error);
        if (status) { status.classList.remove("valid"); status.classList.add("error"); }
        if (wrap) { wrap.classList.remove("valid"); wrap.classList.add("error"); }
      } else if (el.value.trim()) {
        if (errorEl) { errorEl.textContent = ""; errorEl.classList.remove("visible"); }
        if (status) { status.classList.add("valid"); status.classList.remove("error"); }
        if (wrap) { wrap.classList.add("valid"); wrap.classList.remove("error"); }
      }
    });
  });

  // Password strength meter for registration
  if (els.authPassword) {
    els.authPassword.addEventListener("input", updatePasswordStrength);
  }
}

function validateAuthUsername() {
  const val = els.authUsername.value.trim();
  if (!val) return null; // Don't validate empty
  if (val.length < 2) return { error: "用户名至少需要2个字符" };
  if (val.length > 20) return { error: "用户名不能超过20个字符" };
  if (!/^[\u4e00-\u9fff_a-zA-Z0-9]+$/.test(val)) {
    return { error: "只能包含中文、英文字母、数字和下划线" };
  }
  return null;
}

function validateAuthEmail() {
  const val = els.authEmail.value.trim();
  if (!val) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return { error: "请输入有效的邮箱地址" };
  }
  return null;
}

function validateAuthPassword() {
  const val = els.authPassword.value;
  if (!val) return null;
  if (val.length < 8) return { error: "密码至少需要8个字符" };
  if (val.length > 64) return { error: "密码不能超过64个字符" };
  if (!/[A-Za-z]/.test(val)) return { error: "密码需要包含字母" };
  if (!/[0-9]/.test(val)) return { error: "密码需要包含数字" };
  return null;
}

function validateAuthConfirm() {
  const val = els.authConfirm.value;
  if (!val) return null;
  if (val !== els.authPassword.value) {
    return { error: "两次输入的密码不一致" };
  }
  return null;
}

function validateAuthPhone() {
  const val = els.authPhone.value.replace(/\D/g, "");
  if (!val) return null;
  if (!/^1[3-9]\d{9}$/.test(val)) {
    return { error: "请输入有效的11位手机号" };
  }
  return null;
}

function updatePasswordStrength() {
  if (!els.authStrengthMeter || authMode === "login") return;

  const val = els.authPassword.value;
  if (!val) {
    els.authStrengthMeter.classList.add("hidden");
    return;
  }

  els.authStrengthMeter.classList.remove("hidden");

  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[a-z]/.test(val)) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { label: "弱", width: "25%", className: "weak" },
    { label: "一般", width: "50%", className: "fair" },
    { label: "较好", width: "75%", className: "good" },
    { label: "强", width: "100%", className: "strong" }
  ];

  let level;
  if (score <= 2) level = levels[0];
  else if (score <= 3) level = levels[1];
  else if (score <= 4) level = levels[2];
  else level = levels[3];

  els.authStrengthFill.style.width = level.width;
  els.authStrengthFill.className = `auth-strength-fill ${level.className}`;
  els.authStrengthLabel.textContent = `密码强度：${level.label}`;
  els.authStrengthLabel.className = `auth-strength-label ${level.className}`;

  // Check confirm field too
  if (els.authConfirm.value) {
    validateAuthConfirm();
  }
}

function clearAuthForm() {
  els.authForm.reset();
  clearAllAuthErrors();
  if (els.authStrengthMeter) els.authStrengthMeter.classList.add("hidden");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  clearAllAuthErrors();

  const isLogin = authMode === "login";
  const isPhone = authMethod === "phone";

  // Gather fields
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  const email = els.authEmail.value.trim();
  const confirm = els.authConfirm.value;
  const phone = els.authPhone ? els.authPhone.value.replace(/\D/g, "") : "";

  // Validate
  if (isPhone && isLogin) {
    if (!phone) { showAuthFieldError(els.authPhoneError, "请输入手机号"); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { showAuthFieldError(els.authPhoneError, "请输入有效的11位手机号"); return; }
    if (!password) { showAuthFieldError(els.authPasswordError, "请输入密码"); return; }
  } else if (isLogin) {
    if (!username) { showAuthFieldError(els.authUsernameError, "请输入用户名或邮箱"); return; }
    if (!password) { showAuthFieldError(els.authPasswordError, "请输入密码"); return; }
  } else {
    // Register
    if (!username) { showAuthFieldError(els.authUsernameError, "请输入用户名"); return; }
    if (username.length < 2 || username.length > 20) { showAuthFieldError(els.authUsernameError, "用户名需2-20个字符"); return; }
    if (!/^[\u4e00-\u9fff_a-zA-Z0-9]+$/.test(username)) {
      showAuthFieldError(els.authUsernameError, "用户名只能包含中文、英文、数字和下划线"); return;
    }
    if (!email) { showAuthFieldError(els.authEmailError, "请输入邮箱"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAuthFieldError(els.authEmailError, "请输入有效的邮箱地址"); return;
    }
    if (!password) { showAuthFieldError(els.authPasswordError, "请设置密码"); return; }
    if (password.length < 8) { showAuthFieldError(els.authPasswordError, "密码至少需要8个字符"); return; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      showAuthFieldError(els.authPasswordError, "密码需同时包含字母和数字"); return;
    }
    if (password !== confirm) { showAuthFieldError(els.authConfirmError, "两次输入的密码不一致"); return; }
  }

  setAuthLoading(true, isLogin ? "登录中..." : "注册中...");

  try {
    if (isLogin) {
      if (isPhone) {
        await app.login(phone, password);
      } else {
        const rememberMe = els.authRememberMe ? els.authRememberMe.checked : false;
        await app.login(username, password, rememberMe);
      }
    } else {
      await app.register(username, email, password);
    }
  } catch (error) {
    if (error.status === 429 || error.status === 423) {
      showAuthServerError(error.message);
    } else {
      // Try to identify which field has the error
      const msg = error.message || (isLogin ? "登录失败" : "注册失败");
      if (msg.includes("用户名")) showAuthFieldError(els.authUsernameError, msg);
      else if (msg.includes("邮箱")) showAuthFieldError(els.authEmailError, msg);
      else if (msg.includes("手机")) showAuthFieldError(els.authPhoneError, msg);
      else if (msg.includes("密码")) showAuthFieldError(els.authPasswordError, msg);
      else showAuthServerError(msg);
    }
    setAuthLoading(false);
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
    setAuthLoading(false);
  }
}

function showAuthServerError(message) {
  if (els.authServerError) {
    els.authServerError.textContent = message || "登录暂时不可用，请稍后重试";
    els.authServerError.classList.remove("hidden");
    setTimeout(() => els.authServerError.classList.add("hidden"), 8000);
  }
}

// ── Forgot Password Flow ──

function openForgotPassword() {
  els.forgotPasswordModal.classList.remove("hidden");
  if (els.forgotEmail) els.forgotEmail.value = els.authUsername.value.trim() || "";
  if (els.forgotEmailError) { els.forgotEmailError.textContent = ""; els.forgotEmailError.classList.remove("visible"); }
  if (els.forgotStatus) { els.forgotStatus.textContent = ""; els.forgotStatus.className = "status-note hidden"; }
}

function closeForgotPassword() {
  els.forgotPasswordModal.classList.add("hidden");
}

async function submitForgotPassword() {
  const email = els.forgotEmail.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthFieldError(els.forgotEmailError, "请输入有效的邮箱地址");
    return;
  }

  els.forgotSubmitBtn.disabled = true;
  const submitText = els.forgotSubmitBtn.querySelector(".auth-submit-text");
  const spinner = els.forgotSubmitBtn.querySelector(".auth-spinner");
  if (submitText) submitText.textContent = "发送中...";
  if (spinner) spinner.classList.remove("hidden");

  try {
    const resp = await app.apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      allowUnauthorized: true
    });
    if (els.forgotStatus) {
      els.forgotStatus.textContent = resp.resetLink
        ? `重置链接：${resp.resetLink}（开发模式下显示，请访问此链接重置密码）`
        : resp.message || "重置邮件已发送";
      els.forgotStatus.className = "status-note success";
    }
    if (els.forgotEmailError) { els.forgotEmailError.textContent = ""; els.forgotEmailError.classList.remove("visible"); }
  } catch (error) {
    if (els.forgotStatus) {
      els.forgotStatus.textContent = error.message || "发送失败";
      els.forgotStatus.className = "status-note error";
    }
  } finally {
    els.forgotSubmitBtn.disabled = false;
    if (submitText) submitText.textContent = "发送重置邮件";
    if (spinner) spinner.classList.add("hidden");
  }
}

// ── Verification Reminder ──

function updateVerificationReminder() {
  const user = app.getUser();
  if (!user || !user.email || user.emailVerified) {
    if (els.verifyReminder) els.verifyReminder.classList.add("hidden");
    return;
  }
  if (els.verifyReminder) els.verifyReminder.classList.remove("hidden");
  if (els.verifyReminderEmail) els.verifyReminderEmail.textContent = user.email;
}

async function resendVerificationEmail() {
  if (els.resendVerifyBtn) els.resendVerifyBtn.disabled = true;
  try {
    await app.apiFetch("/api/auth/send-verification-email", { method: "POST" });
    app.notify("验证邮件已重新发送");
  } catch (error) {
    app.notify(error.message || "重新发送失败");
  } finally {
    if (els.resendVerifyBtn) els.resendVerifyBtn.disabled = false;
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
  const orbitIndex = MODULE_NAMES.indexOf(moduleName);
  els.moduleNav.style.setProperty("--nav-orbit-x", `${((orbitIndex + 0.5) / MODULE_NAMES.length) * 100}%`);

  if (writeURL) {
    const nextHash = moduleName === "home" ? "" : `#${moduleName}`;
    history.replaceState(null, "", `${location.pathname}${nextHash}`);
  }

  if (moduleName === "home") renderHome();
  if (moduleName === "mbti") {
    renderMBTI();
    initMbtiOrbitScene();
  }
  if (moduleName === "analysis") renderAnalysis();
  if (moduleName === "coach") renderCoach();
  if (moduleName === "progress") renderProgress();
  if (moduleName === "settings") renderSettings();
  scheduleHomeSceneMotion(moduleName === "home");
}

function initAuthPortalReveal() {
  const sensor = document.querySelector(".auth-orbit-sensor");
  if (!sensor || !els.authShell) return;
  const setActive = (active) => els.authShell.classList.toggle("auth-portal-active", active);
  sensor.addEventListener("pointerenter", () => setActive(true));
  sensor.addEventListener("pointerleave", () => setActive(false));
  sensor.addEventListener("focusin", () => setActive(true));
  sensor.addEventListener("focusout", () => setActive(false));
}

function initMbtiOrbitScene() {
  const scene = document.getElementById("mbtiOrbitScene");
  if (!scene || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (scene._orbitUpdate) {
    scene._orbitUpdate();
    return;
  }

  let frame = 0;
  const update = () => {
    frame = 0;
    if (window.innerWidth <= 860) {
      scene.style.setProperty("--mbti-p", "0");
      scene.style.setProperty("--mbti-scale", "1");
      scene.style.setProperty("--mbti-radius", "22px");
      return;
    }
    const rect = scene.getBoundingClientRect();
    const distance = Math.max(1, scene.offsetHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / distance));
    scene.style.setProperty("--mbti-p", progress.toFixed(4));
    scene.style.setProperty("--mbti-scale", (0.82 + progress * 0.29).toFixed(4));
    scene.style.setProperty("--mbti-radius", `${Math.max(0, 28 - progress * 28).toFixed(2)}px`);
    scene.style.setProperty("--mbti-rotate", `${(-13 + progress * 28).toFixed(2)}deg`);
    scene.style.setProperty("--mbti-field-scale", (1.03 + progress * 0.12).toFixed(4));
  };
  const requestUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  scene._orbitUpdate = requestUpdate;
  window.addEventListener("scroll", requestUpdate, { passive: true });
  document.addEventListener("scroll", requestUpdate, { passive: true, capture: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  requestUpdate();
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

  const metricsContainer = document.querySelector(".hero-metrics");
  if (metricsContainer) {
    applyStaggerAnimations(metricsContainer, "article", 80);
  }

  if (latestConversation) {
    els.homeCoachHeadline.textContent = `${latestConversation.scenario || "AI 助手"} / 最近会话`;
    els.homeCoachSummary.textContent = latestConversation.preview || latestConversation.title || "最近一次 AI 会话已经保存，可继续回到历史窗口追问。";
  } else {
    els.homeCoachHeadline.textContent = "AI 结构化计划助手";
    els.homeCoachSummary.textContent = "开始一段新对话后，AI 会把你的目标拆成分组计划。你可以直接把其中一个计划加入计划簿，再逐项打钩推进。";
  }

  // Refresh the unified plan dashboard on home render
  renderPlanDashboard();
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

  applyStaggerAnimations(els.strengthList, "li", 40);
  applyStaggerAnimations(els.improveList, "li", 40);

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
            <div class="bar"><span style="transform:scaleX(${Math.max(0, Math.min(100, value)) / 100})"></span></div>
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
        <span class="plan-progress-fill" style="transform:scaleX(${Math.max(0, Math.min(100, ratioPercent)) / 100})"></span>
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

  applyStaggerAnimations(els.aiResponse, ".chat-message-row", 60);

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

function renderApiModelValue(serviceKey, providerValue, selectedModel = "") {
  const config = getApiConfigForSelection(serviceKey, providerValue);
  const normalizedSelected = String(selectedModel || "").trim();
  els.apiModelInput.value = normalizedSelected || config.model || "gpt-4.1-mini";
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
  renderApiModelValue(next.serviceKey, next.provider, next.model);
  apiTestNotice = null;
  renderStatusNote(els.apiTestStatus, apiTestNotice);

  // Show/hide relay preset selector
  if (next.serviceKey === "custom_relay") {
    els.relayPresetLabel.classList.remove("hidden");
    els.relayPresetSelect.classList.remove("hidden");
    els.relayPresetSelect.value = "openrouter";
  } else {
    els.relayPresetLabel.classList.add("hidden");
    els.relayPresetSelect.classList.add("hidden");
  }

  if (!options.silent) {
    app.notify(`已切换到 ${next.label} / ${next.provider === "gemini_native" ? "Gemini 原生接口" : "OpenAI 兼容接口"}`);
  }
}

/* ── Relay preset handling ── */
function applyRelayPreset(presetKey) {
  var relayCfg = API_SERVICE_CONFIG.custom_relay;
  if (!relayCfg || !relayCfg.subPresets) return;
  var preset = relayCfg.subPresets[presetKey];
  if (!preset) return;
  els.apiBaseUrlInput.value = preset.baseUrl;
  els.apiModelInput.placeholder = preset.modelPlaceholder || "输入模型名称";
  els.apiModelInput.value = "";
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
  const model = els.apiModelInput.value.trim();

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
  const model = els.apiModelInput.value.trim();

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
    renderApiModelValue(els.apiServiceSelect.value, els.apiProviderSelect.value, aiSettings.model || "gpt-4.1-mini");
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

  applyStaggerAnimations(els.activePlanList, ".plan-entry-card", 60);
  applyStaggerAnimations(els.badgeList, ".achievement-card", 60);
  applyStaggerAnimations(els.planOverviewCards, ".plan-stat-card", 50);

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

  // Initialize progress sub-tabs (idempotent)
  initProgressTabs();
}

/* ════════════════════════════════════════════════════════
   HOME DASHBOARD v2 — Rings, Tasks, Mouse FX, Breathing
   ════════════════════════════════════════════════════════ */

const DASH = {
  rings: [
    { key: "emotion", label: "情绪力", sublabel: "Emotion", value: 0, ringType: "default" },
    { key: "action", label: "行动力", sublabel: "Action", value: 0, ringType: "action" },
    { key: "empathy", label: "共情力", sublabel: "Empathy", value: 0, ringType: "default" },
    { key: "focus", label: "专注力", sublabel: "Focus", value: 0, ringType: "default" },
    { key: "openness", label: "开放度", sublabel: "Openness", value: 0, ringType: "gain" }
  ],
  tasks: [
    { text: "观察并记录一次自己的情绪波动", done: false, ringIndex: 0 },
    { text: "主动倾听朋友/家人说话10分钟不打断", done: false, ringIndex: 2 },
    { text: "做一件突破微小舒适区的事", done: false, ringIndex: 1 }
  ],
  // All possible tasks for each dimension — used for dynamic rotation
  taskPool: {
    emotion: [
      "观察并记录一次自己的情绪波动",
      "今晚睡前写下今天最强烈的情绪及触发原因",
      "面对一次不耐烦时，先默数 5 秒再回应",
      "今天至少一次用「我感到...」开头表达自己的感受"
    ],
    action: [
      "做一件突破微小舒适区的事",
      "今天把一件想了很久但一直拖延的小事做了",
      "设定一个 25 分钟的番茄钟，专注完成一件事",
      "主动向一个人提出一个请求或建议"
    ],
    empathy: [
      "主动倾听朋友/家人说话10分钟不打断",
      "今天至少一次，在回应前先复述对方的话",
      "观察身边一个人的情绪状态，然后给ta一个善意的举动",
      "今天不和任何人争论对错，只试着理解对方的出发点"
    ],
    focus: [
      "今天完成工作时，关闭手机通知至少 1 小时",
      "用纸笔写下今天最重要的 3 件事，做完才看手机",
      "阅读一篇长文章/书籍 20 分钟，不做任何别的事",
      "在开始每件事之前，先深呼吸 3 次再动手"
    ],
    openness: [
      "今天了解一个与自己观点相反的看法，尝试理解其逻辑",
      "尝试一种你没做过的小事（新路线、新食物、新方法）",
      "问一个你平时不会问的问题，接收新信息",
      "回顾今天有没有下意识拒绝的事，问自己「如果试试呢？」"
    ]
  },
  streak: 1,
  totalGain: 0,
  initialized: false
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 40; // r=40

function initDashboard() {
  if (DASH.initialized) return;
  DASH.initialized = true;

  // Load ring data from localStorage (persists across sessions)
  const savedRings = localStorage.getItem("yuge_rings");
  if (savedRings) {
    try {
      const parsed = JSON.parse(savedRings);
      if (Array.isArray(parsed) && parsed.length === 5) {
        DASH.rings.forEach((r, i) => {
          r.value = typeof parsed[i].value === "number" && parsed[i].value >= 0
            ? parsed[i].value : Math.floor(40 + Math.random() * 36);
        });
      }
    } catch (_) {
      DASH.rings.forEach((r) => { r.value = Math.floor(40 + Math.random() * 36); });
    }
  } else {
    // First visit: random init 40~75
    DASH.rings.forEach((r) => {
      r.value = Math.floor(40 + Math.random() * 36);
    });
    localStorage.setItem("yuge_rings", JSON.stringify(DASH.rings.map(r => ({ key: r.key, value: r.value }))));
  }

  // Dynamically generate today's tasks based on weakest dimensions
  generateTodayTasks();

  // Load done state from today's localStorage
  loadTodayTaskState();

  // Try to load streak from localStorage
  const savedStreak = parseInt(localStorage.getItem("yuge_streak") || "1", 10);
  DASH.streak = isNaN(savedStreak) ? 1 : savedStreak;

  // Load total gain
  DASH.totalGain = parseInt(localStorage.getItem("yuge_total_gain") || "0", 10) || 0;

  renderRings();
  renderDateAndQuote();
  updateStreakDisplay();
  updateCoachEntry(); // AI coach recommendation based on profile
  updateTotalGain();

  // Render the unified plan dashboard (replaces old renderTasks)
  renderPlanDashboard();

  // Bind dashboard interaction events
  bindPlanDashEvents();

  // Bind coach entry jump
  document.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-jump");
      if (target) switchModule(target);
    });
  });

  // ── Refresh buttons: topbar + dashboard ──
  const handleDashboardRefresh = async () => {
    const topBtn = document.getElementById("homeRefreshBtn");
    const dashBtn = document.getElementById("dashRefreshBtn");
    if (topBtn) topBtn.classList.add("spinning");
    if (dashBtn) dashBtn.classList.add("spinning");

    try {
      await app.fetchAppState();
      renderPlanDashboard();
      renderRings();
      renderDateAndQuote();
      updateStreakDisplay();
      updateCoachEntry();
      updateTotalGain();
      app.notify("数据已刷新 ✓");
    } catch (err) {
      console.error("Refresh failed:", err);
      app.notify("刷新失败，请稍后重试");
    } finally {
      if (topBtn) topBtn.classList.remove("spinning");
      if (dashBtn) dashBtn.classList.remove("spinning");
    }
  };

  document.getElementById("homeRefreshBtn")?.addEventListener("click", handleDashboardRefresh);
  document.getElementById("dashRefreshBtn")?.addEventListener("click", handleDashboardRefresh);

  // Listen for cross-page plan book changes (e.g. coach page adds a plan)
  document.addEventListener("planBookChanged", () => {
    const homeMod = document.querySelector(".module[data-module='home']");
    if (homeMod && homeMod.classList.contains("is-active")) {
      renderPlanDashboard();
    }
    // Real-time dashboard refresh
    refreshDashboardIfVisible();
  });

}

// ── Task generation based on personality profile ──

function generateTodayTasks() {
  // Sort rings by value ascending — target the 3 weakest dimensions
  const sorted = [...DASH.rings].map((r, i) => ({ ...r, originalIndex: i }))
    .sort((a, b) => a.value - b.value);

  // Pick a random task from each of the 3 weakest dimensions' pools
  const todaySeed = Math.floor(Date.now() / 86400000); // day-based seed
  DASH.tasks = sorted.slice(0, 3).map((ring) => {
    const pool = DASH.taskPool[ring.key] || [];
    const idx = (todaySeed + ring.originalIndex) % pool.length;
    return {
      text: pool[idx] || ring.label,
      done: false,
      ringIndex: ring.originalIndex,
      dimension: ring.key,
      dimensionLabel: ring.label
    };
  });
}

function loadTodayTaskState() {
  const key = "yuge_tasks_" + new Date().toISOString().slice(0, 10);
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const doneArr = JSON.parse(saved);
      if (Array.isArray(doneArr)) {
        DASH.tasks.forEach((t, i) => { t.done = !!doneArr[i]; });
      }
    } catch (_) { /* ignore */ }
  }
}

function saveTodayTaskState() {
  const key = "yuge_tasks_" + new Date().toISOString().slice(0, 10);
  localStorage.setItem(key, JSON.stringify(DASH.tasks.map(t => t.done)));
}

function persistRingData() {
  localStorage.setItem("yuge_rings", JSON.stringify(DASH.rings.map(r => ({ key: r.key, value: r.value }))));
}

// ── Coach entry adaptation ──

function updateCoachEntry() {
  const titleEl = document.getElementById("homeCoachEntryTitle");
  const descEl = document.getElementById("homeCoachEntryDesc");
  if (!titleEl || !descEl) return;

  // Find the weakest dimension
  const sorted = [...DASH.rings].sort((a, b) => a.value - b.value);
  const weakest = sorted[0];
  const secondWeak = sorted[1];

  titleEl.textContent = `建议优先提升「${weakest.label}」`;
  descEl.textContent = `你目前在「${weakest.label}」（${weakest.value}分）和「${secondWeak.label}」（${secondWeak.value}分）上有更大的成长空间。和 AI 助手聊聊，获得针对性的 3 步行动计划。`;
}

function renderRings() {
  const grid = document.getElementById("homeRingsGrid");
  if (!grid) return;

  grid.innerHTML = DASH.rings.map((ring, i) => {
    const pct = Math.round(ring.value);
    return `
      <div class="ring-card" data-ring="${ring.ringType}" data-index="${i}">
        <div class="ring-svg-wrap">
          <svg class="ring-svg" viewBox="0 0 96 96">
            <circle class="ring-track" cx="48" cy="48" r="40"></circle>
            <circle class="ring-progress" cx="48" cy="48" r="40"
              style="stroke-dasharray: ${RING_CIRCUMFERENCE}; stroke-dashoffset: ${RING_CIRCUMFERENCE};"
            ></circle>
          </svg>
          <span class="ring-value" data-value="${pct}">${pct}%</span>
        </div>
        <span class="ring-label">${ring.label}</span>
        <span class="ring-sublabel">${ring.sublabel}</span>
      </div>
    `;
  }).join("");

  // Animate rings after a short delay
  setTimeout(() => {
    DASH.rings.forEach((ring, i) => {
      const card = grid.querySelector(`[data-index="${i}"]`);
      if (!card) return;
      const progress = card.querySelector(".ring-progress");
      const valueEl = card.querySelector(".ring-value");
      if (progress) {
        const offset = RING_CIRCUMFERENCE - (ring.value / 100) * RING_CIRCUMFERENCE;
        progress.style.strokeDashoffset = offset;
        progress.style.setProperty("--final-offset", offset);
      }
      if (valueEl) {
        animateNumber(valueEl, 0, ring.value, 1500);
      }
    });
  }, 300);
}

function renderTasks() {
  const list = document.getElementById("homeTasksList");
  if (!list) return;

  list.innerHTML = DASH.tasks.map((task, i) => `
    <div class="task-card ${task.done ? "done" : ""}" data-index="${i}">
      <div class="task-info">
        <span class="task-index">${i + 1}</span>
        <span class="task-text">${task.text}</span>
      </div>
      <div class="task-right">
        <span class="task-dimension" data-dim="${task.dimension || DASH.rings[task.ringIndex].key}">
          提升 ${task.dimensionLabel || DASH.rings[task.ringIndex].label}
        </span>
        <button class="task-complete-btn ${task.done ? "completed" : ""}" type="button"
          ${task.done ? "disabled" : ""} data-task-index="${i}">
          ${task.done ? "✅ 已完成" : "完成 ✓"}
        </button>
      </div>
    </div>
  `).join("");
}

function handleTaskClick(e) {
  const btn = e.target.closest("[data-task-index]");
  if (!btn || btn.disabled) return;

  const idx = parseInt(btn.getAttribute("data-task-index"), 10);
  if (isNaN(idx) || DASH.tasks[idx].done) return;

  DASH.tasks[idx].done = true;
  saveTodayTaskState();

  // Update task card
  const card = btn.closest(".task-card");
  if (card) {
    card.classList.add("done");
  }
  btn.classList.add("completed");
  btn.textContent = "✅ 已完成";
  btn.disabled = true;

  // Boost the corresponding ring
  const ringIdx = DASH.tasks[idx].ringIndex;
  const gain = Math.floor(1 + Math.random() * 3); // 1~3
  DASH.rings[ringIdx].value = Math.min(100, DASH.rings[ringIdx].value + gain);
  DASH.totalGain += gain;

  // Persist to localStorage
  persistRingData();
  localStorage.setItem("yuge_total_gain", String(DASH.totalGain));

  updateRingProgress(ringIdx, gain);
  updateTotalGain();
  updateCoachEntry(); // refresh AI coach recommendation

  // Bump streak
  DASH.streak += 1;
  localStorage.setItem("yuge_streak", String(DASH.streak));
  updateStreakDisplay(true);
}

function updateRingProgress(ringIdx, gain) {
  const grid = document.getElementById("homeRingsGrid");
  if (!grid) return;
  const card = grid.querySelector(`[data-index="${ringIdx}"]`);
  if (!card) return;

  const ring = DASH.rings[ringIdx];
  const progress = card.querySelector(".ring-progress");
  const valueEl = card.querySelector(".ring-value");

  if (progress) {
    const offset = RING_CIRCUMFERENCE - (ring.value / 100) * RING_CIRCUMFERENCE;
    progress.style.strokeDashoffset = offset;
    progress.style.setProperty("--final-offset", offset);
  }

  if (valueEl) {
    const oldVal = parseInt(valueEl.getAttribute("data-value") || "0", 10);
    animateNumber(valueEl, oldVal, ring.value, 800);

    // Floating gain number — positioned relative to the value element
    const floatEl = document.createElement("span");
    floatEl.className = "ring-gain-float";
    floatEl.textContent = `+${gain}`;
    valueEl.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1100);
  }
}

function updateTotalGain() {
  const el = document.getElementById("homeTotalGain");
  if (el) {
    el.textContent = `+${DASH.totalGain}%`;
  }
}

function updateStreakDisplay(bump) {
  const el = document.getElementById("homeStreakNum");
  if (!el) return;
  el.textContent = String(DASH.streak);
  if (bump) {
    el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 300);
  }
}

/* ════════════════════════════════════════════════════════
   PLAN DASHBOARD — Unified Plan Book Homepage Renderer
   ════════════════════════════════════════════════════════ */

// Color mapping for goal card accents
const GOAL_COLORS = ["goal-purple", "goal-coral", "goal-blue", "goal-teal", "goal-amber"];
const DIMENSION_BADGE_CLASS = {
  action:   "badge-action",
  empathy:  "badge-empathy",
  focus:    "badge-focus",
  openness: "badge-openness"
};

function renderPlanDashboard() {
  const state = app.getState();
  const planStats = state.planBookStats || {};
  const entries = state.planBookEntries || [];

  // ── 1. Stats bar ──
  const activeCount = entries.filter(e => e.status !== "achieved").length || 0;
  const achievedCount = entries.filter(e => e.status === "achieved").length || 0;
  const todayDone = DASH.tasks.filter(t => t.done).length;

  setElText("pdActiveCount", String(activeCount));
  setElText("pdAchievedCount", String(achievedCount));
  setElText("pdProgress", `${planStats.overallProgressPercent || 0}%`);
  setElText("pdTodayDone", `${todayDone}/${DASH.tasks.length}`);

  // ── 2. Long-term goals (left column) ──
  renderPdGoals(entries);

  // ── 3. Quick wins (today's personality tasks, right column) ──
  renderPdQuickTasks();

  // ── 4. Pending tasks from active plans (right column) ──
  renderPdPendingTasks(entries);

  // ── 5. Recent achievements (bottom strip) ──
  renderPdAchieved(entries);

  // Initialize drag-and-drop for pending tasks
  setTimeout(() => initTaskDragDrop(), 0);
  
  // Re-bind events after render (ensures buttons work after re-render)
  bindPlanDashEvents();
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// --- Left column: Long-term Goal Cards ---
function renderPdGoals(entries) {
  const list = document.getElementById("pdGoalList");
  if (!list) return;

  const activePlans = entries.filter(e => e.status !== "achieved");

  if (activePlans.length === 0) {
    list.innerHTML = `
      <div class="pd-goals-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <p>还没有进行中的长期目标</p>
        <button class="ghost-btn" type="button" data-jump="coach">去 AI 助手生成一个 →</button>
      </div>`;
    return;
  }

  // Sort: in-progress first (with completed tasks), then not started
  const sorted = [...activePlans].sort((a, b) => {
    const aProgress = a.completedTasks > 0 ? 1 : 0;
    const bProgress = b.completedTasks > 0 ? 1 : 0;
    if (bProgress !== aProgress) return bProgress - aProgress;
    return getPlanEntryTimestamp(b) - getPlanEntryTimestamp(a);
  });

  list.innerHTML = sorted.map((entry, i) => {
    const colorClass = GOAL_COLORS[i % GOAL_COLORS.length];
    const ratio = entry.completionRatio || 0;
    const pct = Math.round(ratio * 100);
    const days = entry.estimatedDays || 0;
    const hasTasks = entry.tasks && entry.tasks.length > 0;
    const taskRows = hasTasks ? (entry.tasks || []).map(task => `
      <div class="pd-detail-task-row ${task.done ? "done" : ""}" data-plan-id="${escapeAttr(entry.id)}" data-task-id="${escapeAttr(task.id)}">
        <span class="pd-detail-task-check ${task.done ? "checked" : ""}">
          ${task.done ? '<svg viewBox="0 0 24 24"><polyline points="18 6 9 17 5 12"/></svg>' : ""}
        </span>
        <span class="pd-detail-task-text">${escapeHtml(task.taskDescription || task.text || "")}</span>
        <div class="pd-task-actions">
          ${!task.done ? `
            <button class="pd-task-complete-btn" data-plan-id="${escapeAttr(entry.id)}" data-task-id="${escapeAttr(task.id)}" title="标记完成">✓</button>
            <button class="pd-task-edit-btn" data-plan-id="${escapeAttr(entry.id)}" data-task-id="${escapeAttr(task.id)}" title="编辑任务">✏️</button>
            <button class="pd-task-delete-btn" data-plan-id="${escapeAttr(entry.id)}" data-task-id="${escapeAttr(task.id)}" title="删除任务">🗑</button>
          ` : ""}
        </div>
      </div>`).join("") + `
      <div class="pd-add-task-btn" data-plan-id="${escapeAttr(entry.id)}">
        <span>+ 添加新任务</span>
      </div>` : "<div class=\"pd-detail-no-tasks\">暂无任务，请从 AI 助手添加</div>" + `
      <div class="pd-add-task-btn" data-plan-id="${escapeAttr(entry.id)}">
        <span>+ 添加新任务</span>
      </div>`;

    return `
      <div class="pd-goal-card-wrap">
        <article class="pd-goal-card ${colorClass} ${hasTasks ? "expandable" : ""}" data-plan-id="${escapeAttr(entry.id)}">
          <button class="pd-goal-menu-btn" type="button" data-plan-id="${escapeAttr(entry.id)}" title="操作">⋮</button>
          <div class="pd-goal-menu" id="pdGoalMenu-${escapeAttr(entry.id)}">
            <button class="pd-goal-menu-item" data-goal-action="edit" data-plan-id="${escapeAttr(entry.id)}">✏️ 编辑</button>
            <button class="pd-goal-menu-item pd-goal-menu-del" data-goal-action="delete" data-plan-id="${escapeAttr(entry.id)}">🗑 删除</button>
          </div>
          <span class="pd-goal-tag">${escapeHtml(entry.groupName)}</span>
          <h4 class="pd-goal-name">${escapeHtml(entry.planName)}</h4>
          ${entry.planDescription ? `<p class="pd-goal-desc">${escapeHtml(entry.planDescription)}</p>` : ""}
          <div class="pd-goal-progress">
            <div class="pd-progress-track">
              <div class="pd-progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="pd-progress-pct">${pct}%</span>
          </div>
          <div class="pd-goal-meta">
            <span class="pd-meta-text">已完成 ${entry.completedTasks || 0}/${entry.totalTasks || 0} 任务</span>
            <span class="pd-days-badge">~${days} 天</span>
          </div>
        </article>
        <div class="pd-goal-detail" id="pdGoalDetail-${escapeAttr(entry.id)}" style="display:none;">
          <div class="pd-detail-tasks">
            ${taskRows}
          </div>
        </div>
      </div>`;
  }).join("");
}

// --- Right column: Quick Win Tasks ---
function renderPdQuickTasks() {
  const list = document.getElementById("pdQuickTasks");
  if (!list) return;

  list.innerHTML = DASH.tasks.map((task, i) => {
    const badgeCls = DIMENSION_BADGE_CLASS[task.dimension] || "";
    const dimLabel = task.dimensionLabel || DASH.rings[task.ringIndex]?.label || "";
    return `
      <div class="pd-task-row ${task.done ? "done" : ""}" data-task-index="${i}">
        <span class="pd-check">
          <svg viewBox="0 0 24 24"><polyline points="18 6 9 17 5 12"/></svg>
        </span>
        <span class="pd-task-body">
          <span class="pd-task-text">${escapeHtml(task.text)}</span>
        </span>
        <span class="pd-task-badge ${badgeCls}">${dimLabel}</span>
      </div>`;
  }).join("");
}

// --- Right column: Pending Tasks from Active Plans ---
function renderPdPendingTasks(entries) {
  const list = document.getElementById("pdPendingTasks");
  if (!list) return;

  // Collect the next undone task from each active plan that has tasks
  const pendingItems = [];
  entries.filter(e => e.status !== "achieved").forEach((entry) => {
    if (!entry.tasks || !Array.isArray(entry.tasks)) return;
    const nextTask = entry.tasks.find(t => !t.done);
    if (!nextTask) return; // all done or no tasks

    const colorIdx = pendingItems.length % GOAL_COLORS.length;
    const colorVarMap = { "goal-purple": "#7F77DD", "goal-coral": "#D85A30", "goal-blue": "#378ADD", "goal-teal": "#1D9E75", "goal-amber": "#BA7517" };
    pendingItems.push({
      entry,
      task: nextTask,
      colorClass: GOAL_COLORS[colorIdx],
      dotColor: colorVarMap[GOAL_COLORS[colorIdx]] || "var(--accent)",
      ratio: entry.completionRatio || 0,
      pct: Math.round((entry.completionRatio || 0) * 100)
    });
  });

  if (pendingItems.length === 0) {
    list.innerHTML = `<div style="padding:16px;text-align:center;font-size:0.84rem;color:var(--text-tertiary);">
      ${entries.some(e => e.status !== "achieved")
        ? "当前计划的任务已全部完成 ✓"
        : "加入计划簿后，待办任务会显示在这里"}</div>`;
    return;
  }

  list.innerHTML = pendingItems.map(item => `
    <div class="pd-pending-item" data-plan-entry-id="${escapeAttr(item.entry.id)}" data-plan-task-id="${escapeAttr(item.task.id)}">
      <span class="drag-handle" title="拖拽排序">⠿</span>
      <span class="pd-pending-dot" style="border-color:${item.dotColor};"></span>
      <span class="pd-pending-body">
        <span class="pd-pending-plan-name" style="color:${item.dotColor};">${escapeHtml(item.entry.planName)}</span>
        <span class="pd-pending-task-text">${escapeHtml(item.task.taskDescription)}</span>
      </span>
      <span class="pd-pending-pct">${item.pct}%</span>
      <button type="button" class="task-swap-btn" data-swap-entry="${escapeAttr(item.entry.id)}" data-swap-task="${escapeAttr(item.task.id)}" title="移动到其他计划">⇄</button>
      <button type="button" class="pd-pending-menu-btn" data-plan-entry-id="${escapeAttr(item.entry.id)}" data-plan-task-id="${escapeAttr(item.task.id)}" title="编辑任务">⋯</button>
    </div>`).join("");
}

// --- Bottom: Recent Achievements Strip ---
function renderPdAchieved(entries) {
  const list = document.getElementById("pdAchievedList");
  if (!list) return;

  const achieved = entries
    .filter(e => e.status === "achieved")
    .sort((a, b) => getPlanEntryTimestamp(b) - getPlanEntryTimestamp(a))
    .slice(0, 4); // Show max 4 on homepage, rest via "view all"

  if (achieved.length === 0) {
    list.innerHTML = `<div style="padding:20px;text-align:center;font-size:0.86rem;color:var(--text-tertiary);">
      完成第一个计划后，成就记录会显示在这里 🌱</div>`;
    return;
  }

  let cards = achieved.map(entry => {
    const dateStr = entry.achievedAt
      ? formatDateAgo(entry.achievedAt)
      : "最近";
    return `
      <div class="pd-achieved-card">
        <span class="pd-achieved-check">
          <svg viewBox="0 0 24 24"><polyline points="18 6 9 17 5 12"/></svg>
        </span>
        <span class="pd-achieved-info">
          <span class="pd-achieved-name">${escapeHtml(entry.planName)}</span>
          <span class="pd-achieved-date">达成于 ${dateStr}</span>
        </span>
      </div>`;
  }).join("");

  if ((entries.filter(e => e.status === "achieved").length) > 4) {
    cards += `
      <button class="pd-view-all" type="button" data-jump="progress">
        查看全部 ${entries.filter(e => e.status === "achieved").length} 个 →
      </button>`;
  }

  list.innerHTML = `<div class="plan-dash-achieved-strip">${cards}</div>`;
}

// --- Helpers ---

function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function escapeAttr(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getPlanEntryTimestamp(entry) {
  if (!entry) return 0;
  const ts = entry.updated_at || entry.createdAt || entry.created_at || entry.achievedAt;
  if (!ts) return 0;
  return new Date(ts).getTime() || 0;
}

function formatDateAgo(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 8) return `${diffDays}天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch (_) { return dateStr; }
}

// Bind dashboard interaction events (event delegation on persistent parent)
function bindPlanDashEvents() {
  // Bind to document.body (never re-rendered) for reliable event delegation
  document.body.removeEventListener("click", handlePlanDashClick);
  document.body.addEventListener("click", handlePlanDashClick);
  console.log("✅ bindPlanDashEvents: click event bound to document.body");
  
  // Bind swap modal cancel button
  const cancelSwapBtn = document.getElementById("cancelSwapBtn");
  if (cancelSwapBtn) {
    cancelSwapBtn.removeEventListener("click", closeSwapModal);
    cancelSwapBtn.addEventListener("click", closeSwapModal);
  }
}

async function handlePlanDashClick(e) {
  // Only handle clicks inside #planDash
  const dash = document.getElementById("planDash");
  if (!dash || !dash.contains(e.target)) return;
  
  console.log("🖱️ handlePlanDashClick triggered", e.target);

  // ── [data-jump] buttons ──
  const jumpBtn = e.target.closest("[data-jump]");
  if (jumpBtn) {
    const target = jumpBtn.getAttribute("data-jump");
    if (target) { switchModule(target); return; }
  }

  // ── Quick task toggle ──
  const quickRow = e.target.closest("[data-task-index]");
  if (quickRow && dash.contains(quickRow)) {
    handlePdQuickTaskClick(e);
    return;
  }

  // ── Pending plan task: toggle done (only when not clicking action buttons) ──
  const pendingItem = e.target.closest(".pd-pending-item[data-plan-entry-id][data-plan-task-id]");
  if (pendingItem && !e.target.closest('.task-swap-btn') && !e.target.closest('.pd-pending-menu-btn') && !e.target.closest('.pd-pending-menu')) {
    const entryId = pendingItem.dataset.planEntryId;
    const taskId = pendingItem.dataset.planTaskId;
    try {
      await app.togglePlanBookTask(entryId, taskId, true);
      renderPlanDashboard();
      app.notify("计划任务已完成 ✓");
    } catch (err) {
      app.notify(err.message || "更新失败");
    }
    return;
  }

  // ── Pending task menu button ──
  const pendingMenuBtn = e.target.closest('.pd-pending-menu-btn');
  if (pendingMenuBtn) {
    e.stopPropagation();
    e.preventDefault();
    const entryId = pendingMenuBtn.dataset.planEntryId;
    const taskId = pendingMenuBtn.dataset.planTaskId;
    togglePendingMenu(entryId, taskId, pendingMenuBtn);
    return;
  }

  // ── Pending task menu: edit ──
  const pendingEditBtn = e.target.closest("[data-pending-action='edit']");
  if (pendingEditBtn) {
    const entryId = pendingEditBtn.dataset.planId;
    const taskId = pendingEditBtn.dataset.taskId;
    closeAllPendingMenus();
    startEditPendingTask(entryId, taskId);
    return;
  }

  // ── Pending task menu: delete ──
  const pendingDeleteBtn = e.target.closest("[data-pending-action='delete']");
  if (pendingDeleteBtn) {
    const entryId = pendingDeleteBtn.dataset.planId;
    const taskId = pendingDeleteBtn.dataset.taskId;
    closeAllPendingMenus();
    confirmDeletePendingTask(entryId, taskId);
    return;
  }


  // ── Task swap button ──
  const swapBtn = e.target.closest('.task-swap-btn');
  if (swapBtn) {
    const entryId = swapBtn.dataset.swapEntry;
    const taskId = swapBtn.dataset.swapTask;
    openSwapModal(entryId, taskId);
    return;
  }

  // ── Goal card: expand/collapse detail ──
  const goalCard = e.target.closest(".pd-goal-card[data-plan-id]");
  if (goalCard) {
    const entryId = goalCard.dataset.planId;
    toggleGoalDetail(entryId);
    return;
  }

  // ── Goal card menu: edit / delete ──
  const menuBtn = e.target.closest(".pd-goal-menu-btn");
  if (menuBtn) {
    const entryId = menuBtn.dataset.planId;
    toggleGoalMenu(entryId);
    return;
  }

  // ── Goal menu item: edit ──
  const editBtn = e.target.closest("[data-goal-action='edit']");
  if (editBtn) {
    const entryId = editBtn.dataset.planId;
    closeAllGoalMenus();
    startEditPlanEntry(entryId);
    return;
  }

  // ── Goal menu item: delete ──
  const delBtn = e.target.closest("[data-goal-action='delete']");
  if (delBtn) {
    const entryId = delBtn.dataset.planId;
    closeAllGoalMenus();
    confirmDeletePlanEntry(entryId);
    return;
  }

  // ── Inline edit: save/cancel ──
  const saveBtn = e.target.closest("[data-edit-action='save']");
  if (saveBtn) {
    const entryId = saveBtn.dataset.planId;
    savePlanEntryEdit(entryId);
    return;
  }
  const cancelBtn = e.target.closest("[data-edit-action='cancel']");
  if (cancelBtn) {
    renderPlanDashboard();
    return;
  }

  // ── Task row: toggle done (only when clicking checkbox) ──
  const taskCheck = e.target.closest(".pd-detail-task-check");
  if (taskCheck) {
    const taskRow = taskCheck.closest(".pd-detail-task-row[data-task-id]");
    if (taskRow) {
      const entryId = taskRow.dataset.planId;
      const taskId = taskRow.dataset.taskId;
      const entry = (app.getState().planBookEntries || []).find(en => en.id === entryId);
      if (entry) {
        const task = (entry.tasks || []).find(t => t.id === taskId);
        if (task) {
          try {
            await app.togglePlanBookTask(entryId, taskId, !task.done);
            renderPlanDashboard();
            // Re-expand the same goal
            setTimeout(() => toggleGoalDetail(entryId), 0);
          } catch (err) {
            app.notify(err.message || "更新失败");
          }
        }
      }
    }
    return;
  }

  // ── Task complete button ──
  const taskCompleteBtn = e.target.closest('.pd-task-complete-btn');
  if (taskCompleteBtn) {
    const entryId = taskCompleteBtn.dataset.planId;
    const taskId = taskCompleteBtn.dataset.taskId;
    try {
      await app.togglePlanBookTask(entryId, taskId, true);
      renderPlanDashboard();
      setTimeout(() => toggleGoalDetail(entryId), 0);
      app.notify("任务已完成 ✓");
    } catch (err) {
      app.notify(err.message || "更新失败");
    }
    return;
  }

  // ── Task edit button ──
  const taskEditBtn = e.target.closest('.pd-task-edit-btn');
  if (taskEditBtn) {
    const entryId = taskEditBtn.dataset.planId;
    const taskId = taskEditBtn.dataset.taskId;
    startEditTask(entryId, taskId);
    return;
  }

  // ── Task delete button ──
  const taskDeleteBtn = e.target.closest('.pd-task-delete-btn');
  if (taskDeleteBtn) {
    const entryId = taskDeleteBtn.dataset.planId;
    const taskId = taskDeleteBtn.dataset.taskId;
    confirmDeleteTask(entryId, taskId);
    return;
  }

  // ── Add new task button ──
  const addTaskBtn = e.target.closest('.pd-add-task-btn');
  if (addTaskBtn && !e.target.closest('.pd-new-task-form')) {
    const entryId = addTaskBtn.dataset.planId;
    startAddNewTask(entryId);
    return;
  }

  // ── Task edit form: save/cancel ──
  const taskEditSaveBtn = e.target.closest("[data-task-edit-action='save']");
  if (taskEditSaveBtn) {
    const entryId = taskEditSaveBtn.dataset.planId;
    const taskId = taskEditSaveBtn.dataset.taskId;
    saveTaskEdit(entryId, taskId);
    return;
  }
  const taskEditCancelBtn = e.target.closest("[data-task-edit-action='cancel']");
  if (taskEditCancelBtn) {
    renderPlanDashboard();
    return;
  }

  // ── New task form: save/cancel ──
  const newTaskSaveBtn = e.target.closest("[data-new-task-action='add']");
  if (newTaskSaveBtn) {
    const entryId = newTaskSaveBtn.dataset.planId;
    saveNewTask(entryId);
    return;
  }
  const newTaskCancelBtn = e.target.closest("[data-new-task-action='cancel']");
  if (newTaskCancelBtn) {
    renderPlanDashboard();
    return;
  }

  // ── Pending task edit form: save/cancel ──
  const pendingEditSaveBtn = e.target.closest("[data-pending-edit-action='save']");
  if (pendingEditSaveBtn) {
    const entryId = pendingEditSaveBtn.dataset.planId;
    const taskId = pendingEditSaveBtn.dataset.taskId;
    savePendingTaskEdit(entryId, taskId);
    return;
  }
  const pendingEditCancelBtn = e.target.closest("[data-pending-edit-action='cancel']");
  if (pendingEditCancelBtn) {
    renderPlanDashboard();
    return;
  }

  // ── Click outside menus to close ──
  closeAllGoalMenus();
  closeAllPendingMenus();
}

// ── Goal card expand/collapse detail ──
function toggleGoalDetail(entryId) {
  const detailEl = document.getElementById(`pdGoalDetail-${entryId}`);
  if (!detailEl) {
    renderPlanDashboard();
    setTimeout(() => {
      const el = document.getElementById(`pdGoalDetail-${entryId}`);
      if (el) el.style.display = "block";
    }, 50);
    return;
  }
  detailEl.style.display = detailEl.style.display === "none" ? "block" : "none";
}

// ── Goal card context menu ──
function toggleGoalMenu(entryId) {
  closeAllGoalMenus();
  const menu = document.getElementById(`pdGoalMenu-${entryId}`);
  if (menu) menu.style.display = "block";
}

function closeAllGoalMenus() {
  document.querySelectorAll(".pd-goal-menu").forEach(m => m.style.display = "none");
}

// ── Pending task context menu ──
function togglePendingMenu(entryId, taskId, btnEl) {
  console.log("🔽 togglePendingMenu called", { entryId, taskId, btnEl });
  closeAllPendingMenus();
  const menuId = `pdPendingMenu-${entryId}-${taskId}`;
  let menu = document.getElementById(menuId);
  
  if (!menu) {
    // Create menu - append to body to avoid being clipped by parent overflow
    menu = document.createElement("div");
    menu.id = menuId;
    menu.className = "pd-pending-menu";
    menu.innerHTML = `
      <div class="pd-pending-menu-item" data-pending-action="edit" data-plan-id="${escapeAttr(entryId)}" data-task-id="${escapeAttr(taskId)}">
        ✏️ 编辑任务
      </div>
      <div class="pd-pending-menu-item pd-pending-menu-delete" data-pending-action="delete" data-plan-id="${escapeAttr(entryId)}" data-task-id="${escapeAttr(taskId)}">
        🗑 删除任务
      </div>`;
    document.body.appendChild(menu);
  }
  
  // Position menu near the button
  const rect = btnEl.getBoundingClientRect();
  menu.style.display = "block";
  menu.style.position = "fixed";
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.zIndex = "10000";
}

function closeAllPendingMenus() {
  document.querySelectorAll(".pd-pending-menu").forEach(m => m.style.display = "none");
}

// ── Edit pending task (inline) ──
function startEditPendingTask(entryId, taskId) {
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;
  
  const task = (entry.tasks || []).find(t => t.id === taskId);
  if (!task) return;
  
  const pendingItem = document.querySelector(`.pd-pending-item[data-plan-entry-id="${CSS.escape(entryId)}"][data-plan-task-id="${CSS.escape(taskId)}"]`);
  if (!pendingItem) return;
  
  pendingItem.classList.add("editing");
  pendingItem.innerHTML = `
    <div class="pd-pending-edit-form">
      <input type="text" class="pd-pending-edit-input" id="pdPendingEdit-${taskId}" value="${escapeAttr(task.taskDescription || "")}" maxlength="200" />
      <div class="pd-pending-edit-actions">
        <button class="ghost-btn" type="button" data-pending-edit-action="cancel" data-plan-id="${escapeAttr(entryId)}" data-task-id="${escapeAttr(taskId)}">取消</button>
        <button class="primary-btn" type="button" data-pending-edit-action="save" data-plan-id="${escapeAttr(entryId)}" data-task-id="${escapeAttr(taskId)}">保存</button>
      </div>
    </div>`;
  
  const input = document.getElementById(`pdPendingEdit-${taskId}`);
  if (input) {
    input.focus();
    input.select();
  }
}

async function savePendingTaskEdit(entryId, taskId) {
  const input = document.getElementById(`pdPendingEdit-${taskId}`);
  if (!input || !input.value.trim()) {
    app.notify("任务描述不能为空");
    return;
  }
  
  try {
    await app.updatePlanBookTask(entryId, taskId, {
      taskDescription: input.value.trim()
    });
    renderPlanDashboard();
    app.notify("任务已更新 ✓");
  } catch (err) {
    app.notify(err.message || "保存失败");
  }
}

async function confirmDeletePendingTask(entryId, taskId) {
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;
  
  const task = (entry.tasks || []).find(t => t.id === taskId);
  if (!task) return;
  
  if (!confirm(`确定要删除任务「${task.taskDescription || task.text}」吗？`)) return;
  
  try {
    await app.removePlanBookTask(entryId, taskId);
    renderPlanDashboard();
    app.notify("任务已删除");
  } catch (err) {
    app.notify(err.message || "删除失败");
  }
}

// ── Inline edit plan entry ──
function startEditPlanEntry(entryId) {
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;

  const card = document.querySelector(`.pd-goal-card[data-plan-id="${CSS.escape(entryId)}"]`);
  if (!card) return;

  card.classList.add("editing");
  card.innerHTML = `
    <div class="pd-edit-form">
      <label>计划名称</label>
      <input type="text" class="pd-edit-input" id="pdEditName-${entryId}" value="${escapeAttr(entry.planName)}" maxlength="60" />
      <label>计划描述</label>
      <textarea class="pd-edit-textarea" id="pdEditDesc-${entryId}" maxlength="200" rows="2">${escapeHtml(entry.planDescription || "")}</textarea>
      <label>预估天数</label>
      <input type="number" class="pd-edit-input pd-edit-num" id="pdEditDays-${entryId}" value="${entry.estimatedDays || 0}" min="1" max="365" />
      <div class="pd-edit-actions">
        <button class="ghost-btn" type="button" data-edit-action="cancel">取消</button>
        <button class="primary-btn" type="button" data-edit-action="save" data-plan-id="${escapeAttr(entryId)}">保存</button>
      </div>
    </div>`;
}

async function savePlanEntryEdit(entryId) {
  const nameEl = document.getElementById(`pdEditName-${entryId}`);
  const descEl = document.getElementById(`pdEditDesc-${entryId}`);
  const daysEl = document.getElementById(`pdEditDays-${entryId}`);
  if (!nameEl || !nameEl.value.trim()) {
    app.notify("计划名称不能为空");
    return;
  }
  try {
    await app.updatePlanBookEntry(entryId, {
      planName: nameEl.value.trim(),
      planDescription: descEl ? descEl.value.trim() : "",
      estimatedDays: daysEl ? parseInt(daysEl.value, 10) || 0 : 0,
    });
    renderPlanDashboard();
    app.notify("计划已更新 ✓");
  } catch (err) {
    app.notify(err.message || "保存失败");
  }
}

async function confirmDeletePlanEntry(entryId) {
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;
  if (!confirm(`确定要删除计划「${entry.planName}」吗？此操作不可撤销。`)) return;
  try {
    await app.removePlanBookEntry(entryId);
    renderPlanDashboard();
    app.notify("计划已删除");
  } catch (err) {
    app.notify(err.message || "删除失败");
  }
}

// ── Task-level editing functions ──

// Start editing a task
function startEditTask(entryId, taskId) {
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;
  
  const task = (entry.tasks || []).find(t => t.id === taskId);
  if (!task) return;
  
  const taskRow = document.querySelector(`.pd-detail-task-row[data-task-id="${CSS.escape(taskId)}"]`);
  if (!taskRow) return;
  
  taskRow.classList.add("editing");
  taskRow.innerHTML = `
    <div class="pd-task-edit-form">
      <input type="text" class="pd-task-edit-input" id="pdTaskEdit-${escapeAttr(taskId)}" value="${escapeAttr(task.taskDescription || task.text || "")}" maxlength="200" />
      <div class="pd-task-edit-actions">
        <button class="ghost-btn" type="button" data-task-edit-action="cancel" data-plan-id="${escapeAttr(entryId)}" data-task-id="${escapeAttr(taskId)}">取消</button>
        <button class="primary-btn" type="button" data-task-edit-action="save" data-plan-id="${escapeAttr(entryId)}" data-task-id="${escapeAttr(taskId)}">保存</button>
      </div>
    </div>`;
  
  // Focus input
  const input = document.getElementById(`pdTaskEdit-${taskId}`);
  if (input) {
    input.focus();
    input.select();
  }
}

// Save task edit
async function saveTaskEdit(entryId, taskId) {
  const input = document.getElementById(`pdTaskEdit-${taskId}`);
  if (!input || !input.value.trim()) {
    app.notify("任务描述不能为空");
    return;
  }
  
  try {
    await app.updatePlanBookTask(entryId, taskId, {
      taskDescription: input.value.trim()
    });
    renderPlanDashboard();
    // Re-expand the same goal
    setTimeout(() => toggleGoalDetail(entryId), 50);
    app.notify("任务已更新 ✓");
  } catch (err) {
    app.notify(err.message || "保存失败");
  }
}

// Confirm and delete a task
async function confirmDeleteTask(entryId, taskId) {
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;
  
  const task = (entry.tasks || []).find(t => t.id === taskId);
  if (!task) return;
  
  if (!confirm(`确定要删除任务「${task.taskDescription || task.text}」吗？`)) return;
  
  try {
    await app.removePlanBookTask(entryId, taskId);
    renderPlanDashboard();
    // Re-expand the same goal
    setTimeout(() => toggleGoalDetail(entryId), 50);
    app.notify("任务已删除");
  } catch (err) {
    app.notify(err.message || "删除失败");
  }
}

// Start adding a new task
function startAddNewTask(entryId) {
  const addBtn = document.querySelector(`.pd-add-task-btn[data-plan-id="${CSS.escape(entryId)}"]`);
  if (!addBtn) return;
  
  addBtn.innerHTML = `
    <div class="pd-new-task-form">
      <input type="text" class="pd-new-task-input" id="pdNewTask-${escapeAttr(entryId)}" placeholder="输入新任务描述..." maxlength="200" />
      <div class="pd-new-task-actions">
        <button class="ghost-btn" type="button" data-new-task-action="cancel" data-plan-id="${escapeAttr(entryId)}">取消</button>
        <button class="primary-btn" type="button" data-new-task-action="add" data-plan-id="${escapeAttr(entryId)}">添加</button>
      </div>
    </div>`;
  
  const input = document.getElementById(`pdNewTask-${entryId}`);
  if (input) {
    input.focus();
  }
}

// Save new task
async function saveNewTask(entryId) {
  const input = document.getElementById(`pdNewTask-${entryId}`);
  if (!input || !input.value.trim()) {
    app.notify("任务描述不能为空");
    return;
  }
  
  const state = app.getState();
  const entry = (state.planBookEntries || []).find(en => en.id === entryId);
  if (!entry) return;
  
  const newTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    taskDescription: input.value.trim(),
    done: false,
    createdAt: new Date().toISOString()
  };
  
  try {
    const updatedTasks = [...(entry.tasks || []), newTask];
    await app.updatePlanBookEntry(entryId, {
      tasks: updatedTasks,
      totalTasks: updatedTasks.length
    });
    renderPlanDashboard();
    // Re-expand the same goal
    setTimeout(() => toggleGoalDetail(entryId), 50);
    app.notify("任务已添加 ✓");
  } catch (err) {
    app.notify(err.message || "添加失败");
  }
}

function handlePdQuickTaskClick(e) {
  const row = e.target.closest("[data-task-index]");
  if (!row) return;
  const idx = parseInt(row.getAttribute("data-task-index"), 10);
  if (isNaN(idx) || DASH.tasks[idx]?.done) return;

  DASH.tasks[idx].done = true;
  saveTodayTaskState();

  const ringIdx = DASH.tasks[idx].ringIndex;
  const gain = Math.floor(1 + Math.random() * 3);
  DASH.rings[ringIdx].value = Math.min(100, DASH.rings[ringIdx].value + gain);
  DASH.totalGain += gain;
  persistRingData();
  localStorage.setItem("yuge_total_gain", String(DASH.totalGain));

  updateRingProgress(ringIdx, gain);
  updateTotalGain();

  // Update just this task's visual state
  row.classList.add("done");
  const check = row.querySelector(".pd-check svg");
  if (check) { check.style.opacity = "1"; check.style.transform = "scale(1)"; }

  // Refresh stats and achievements
  const todayDone = DASH.tasks.filter(t => t.done).length;
  setElText("pdTodayDone", `${todayDone}/${DASH.tasks.length}`);

  // Bump streak if all done for first time
  if (todayDone === DASH.tasks.length && DASH.tasks.every(t => t.done)) {
    DASH.streak += 1;
    localStorage.setItem("yuge_streak", String(DASH.streak));
    updateStreakDisplay(true);
  }
}

function renderDateAndQuote() {
  const dateEl = document.getElementById("homeDate");
  if (dateEl) {
    const now = new Date();
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    dateEl.textContent = `${now.getFullYear()}年 ${months[now.getMonth()]}${now.getDate()}日 星期${days[now.getDay()]}`;
  }

  const quotes = [
    { text: "性格不是岩石，而是河流。", author: "— 愈格" },
    { text: "每一次微小的行动，都在重塑你的形状。", author: "— 愈格" },
    { text: "理解自己，是改变自己最温柔的开始。", author: "— 愈格" },
    { text: "你不需要变成另一个人，只需要更接近自己。", author: "— 愈格" },
    { text: "成长不是一场考试，而是一次长距离的散步。", author: "— 愈格" },
    { text: "允许自己慢一点，但不要停下来。", author: "— 愈格" },
    { text: "性格的弹性，来自每一次「再试一次」。", author: "— 愈格" }
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const quote = quotes[dayOfYear % quotes.length];
  const quoteEl = document.getElementById("homeQuoteText");
  const authorEl = document.getElementById("homeQuoteAuthor");
  if (quoteEl) quoteEl.textContent = quote.text;
  if (authorEl) authorEl.textContent = quote.author;
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  const diff = to - from;
  const hasPercent = el.textContent.includes("%");
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    // ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + diff * eased);
    el.textContent = hasPercent ? `${current}%` : String(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = hasPercent ? `${to}%` : String(to);
      el.setAttribute("data-value", String(to));
    }
  }
  requestAnimationFrame(step);
}

/* ── Mouse Cursor Effects ── */

function initMouseEffects() {
  console.log("🖱️ initMouseEffects: starting...");
  const glow = document.getElementById("cursorGlow");
  const dot = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  const veil = document.getElementById("bgVeil");
  const orb1 = document.getElementById("orb1");
  const orb2 = document.getElementById("orb2");
  const orb3 = document.getElementById("orb3");

  console.log("🖱️ Elements found:", { glow: !!glow, dot: !!dot, ring: !!ring });

  if (!glow || !dot || !ring) {
    console.warn("❌ initMouseEffects: Missing cursor elements, aborting");
    return;
  }

  // Check for touch device
  const isTouch = window.matchMedia("(hover: none)").matches;
  console.log("🖱️ Touch device detected:", isTouch);
  if (isTouch) {
    glow.style.display = "none";
    dot.style.display = "none";
    ring.style.display = "none";
    console.log("🖱️ Touch device - cursor effects disabled");
    return;
  }

  // Check for reduced motion preference
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  console.log("🖱️ Reduced motion preferred:", reducedMotion);
  if (reducedMotion) {
    console.log("🖱️ User prefers reduced motion - cursor effects may be disabled by CSS");
  }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;
  let glowX = mouseX;
  let glowY = mouseY;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  // Smooth follow for ring and glow
  function updatePositions() {
    // Ring follows with slight lag
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;

    // Glow follows with more lag (bigger, softer)
    glowX += (mouseX - glowX) * 0.06;
    glowY += (mouseY - glowY) * 0.06;
    glow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;

    // Background orbs parallax
    const cx = (mouseX / window.innerWidth - 0.5);
    const cy = (mouseY / window.innerHeight - 0.5);
    if (orb1) orb1.style.transform = `translate(${cx * 30}px, ${cy * 30}px)`;
    if (orb2) orb2.style.transform = `translate(${cx * -40}px, ${cy * -25}px)`;
    if (orb3) orb3.style.transform = `translate(${cx * 50}px, ${cy * -35}px)`;
    if (veil) veil.style.transform = `translate(${cx * 10}px, ${cy * 10}px)`;

    requestAnimationFrame(updatePositions);
  }
  requestAnimationFrame(updatePositions);
  console.log("✅ initMouseEffects: cursor follow animation started");

  // Ring expands on hover over interactive elements
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest("button, a, input, textarea, select, .quick-link-card, .task-card, .ring-card, .conversation-item, .nav-link")) {
      ring.classList.add("hover-active");
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest("button, a, input, textarea, select, .quick-link-card, .task-card, .ring-card, .conversation-item, .nav-link")) {
      ring.classList.remove("hover-active");
    }
  });

  // Hide on mouse leave
  document.addEventListener("mouseleave", () => {
    glow.style.opacity = "0";
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  document.addEventListener("mouseenter", () => {
    glow.style.opacity = "";
    dot.style.opacity = "";
    ring.style.opacity = "";
  });
  console.log("✅ initMouseEffects: completed successfully");
}

/* ── Breathing Light ── */

function initBreathButton() {
  const btn = document.getElementById("breathButton");
  const panel = document.getElementById("breathPanel");
  const closeBtn = document.getElementById("breathCloseButton");
  const startBtn = document.getElementById("breathStartButton");
  const coachBtn = document.getElementById("breathCoachButton");
  const phase = document.getElementById("breathPhase");
  const detail = document.getElementById("breathDetail");
  if (!btn || !panel || !closeBtn || !startBtn || !coachBtn || !phase || !detail) return;

  let breathTimers = [];

  const clearBreathTimers = () => {
    breathTimers.forEach((timer) => clearTimeout(timer));
    breathTimers = [];
  };

  const setOpen = (open) => {
    panel.classList.toggle("show", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("breath-panel-open", open);
  };

  const resetGuide = () => {
    clearBreathTimers();
    panel.classList.remove("is-guiding");
    phase.textContent = "先让肩膀放下来";
    detail.textContent = "接下来完成 3 轮：吸气 4 秒、停留 2 秒、缓慢呼气 6 秒。";
    startBtn.disabled = false;
    startBtn.textContent = "开始 3 轮呼吸";
  };

  btn.addEventListener("click", () => setOpen(!panel.classList.contains("show")));
  closeBtn.addEventListener("click", () => {
    resetGuide();
    setOpen(false);
  });

  startBtn.addEventListener("click", () => {
    resetGuide();
    panel.classList.add("is-guiding");
    startBtn.disabled = true;
    startBtn.textContent = "正在陪你呼吸…";

    const phases = [
      { title: "吸气 · 4 秒", detail: "轻轻吸气，让注意力回到身体。", duration: 4000 },
      { title: "停留 · 2 秒", detail: "不用用力，安静地停在这一刻。", duration: 2000 },
      { title: "呼气 · 6 秒", detail: "慢一点呼出，把紧绷感一起放下。", duration: 6000 }
    ];
    let current = 0;

    const advance = () => {
      if (current >= phases.length * 3) {
        panel.classList.remove("is-guiding");
        phase.textContent = "完成了，做得很好";
        detail.textContent = "你刚刚为自己留出了 36 秒。现在可以带着更稳定的状态继续下一步。";
        startBtn.disabled = false;
        startBtn.textContent = "再来 3 轮";
        return;
      }

      const step = phases[current % phases.length];
      const round = Math.floor(current / phases.length) + 1;
      phase.textContent = `${step.title} · 第 ${round}/3 轮`;
      detail.textContent = step.detail;
      current += 1;
      breathTimers.push(setTimeout(advance, step.duration));
    };

    advance();
  });

  coachBtn.addEventListener("click", () => {
    resetGuide();
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    switchModule("coach");
  });
}

/* ── Initialize all dashboard effects ── */

/* The browser-wide scroll timeline API is not enabled everywhere. These tiny
   rAF-driven variables make the 3D camera transition feel the same in every
   modern browser, without putting scroll work on the main event itself. */
let homeSceneMotionFrame = 0;
let homeSceneHeroRestTop = null;
let homeSceneDashboardRestTop = null;
let homeScenePlanRestTop = null;
let homeSceneMotionBound = false;
let mbtiTestTransitionTimer = 0;

function homeSceneClamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function scheduleHomeSceneMotion(resetRestingPoint = false) {
  if (resetRestingPoint) {
    homeSceneHeroRestTop = null;
    homeSceneDashboardRestTop = null;
    homeScenePlanRestTop = null;
  }

  if (homeSceneMotionFrame) return;
  homeSceneMotionFrame = requestAnimationFrame(() => {
    homeSceneMotionFrame = 0;

    const hero = document.querySelector(".home-hero");
    const dashboard = document.querySelector(".home-dashboard");
    const planGrid = document.querySelector(".plan-dash-grid");
    const island = document.getElementById("homeDynamicIsland");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!hero || activeModule !== "home" || reducedMotion) {
      document.body.classList.remove("home-island-active");
      if (island) {
        island.classList.remove("is-visible");
        island.setAttribute("aria-hidden", "true");
        island.tabIndex = -1;
      }
      [hero, dashboard, planGrid].filter(Boolean).forEach((element) => element.removeAttribute("style"));
      return;
    }

    const heroRect = hero.getBoundingClientRect();
    if (homeSceneHeroRestTop === null || heroRect.top > homeSceneHeroRestTop + 8) {
      homeSceneHeroRestTop = heroRect.top;
    }
    const heroProgress = homeSceneClamp(
      (homeSceneHeroRestTop - heroRect.top) / Math.max(heroRect.height * 0.82, 1)
    );

    hero.style.setProperty("--home-hero-y", `${(-30 * heroProgress).toFixed(2)}px`);
    hero.style.setProperty("--home-hero-scale", `${(1 - heroProgress * 0.045).toFixed(4)}`);
    hero.style.setProperty("--home-hero-saturation", `${(1 - heroProgress * 0.16).toFixed(3)}`);
    hero.style.setProperty("--home-hero-brightness", `${(1 - heroProgress * 0.11).toFixed(3)}`);
    hero.style.setProperty("--home-copy-y", `${(-14 * heroProgress).toFixed(2)}px`);
    hero.style.setProperty("--home-copy-z", `${(36 - heroProgress * 28).toFixed(2)}px`);
    hero.style.setProperty("--home-stage-x", `${(-18 * heroProgress).toFixed(2)}px`);
    hero.style.setProperty("--home-stage-y", `${(-10 * heroProgress).toFixed(2)}px`);
    hero.style.setProperty("--home-stage-z", `${(64 - heroProgress * 48).toFixed(2)}px`);

    const islandActive = heroProgress > 0.34;
    document.body.classList.toggle("home-island-active", islandActive);
    if (island) {
      island.classList.toggle("is-visible", islandActive);
      island.setAttribute("aria-hidden", islandActive ? "false" : "true");
      island.tabIndex = islandActive ? 0 : -1;
    }

    if (dashboard) {
      const dashboardRect = dashboard.getBoundingClientRect();
      if (homeSceneDashboardRestTop === null || dashboardRect.top > homeSceneDashboardRestTop + 8) {
        homeSceneDashboardRestTop = dashboardRect.top;
      }
      const dashboardProgress = homeSceneClamp(
        (homeSceneDashboardRestTop - dashboardRect.top) / Math.max(window.innerHeight * 0.62, 1)
      );
      dashboard.style.setProperty("--home-dashboard-y", `${((1 - dashboardProgress) * 42).toFixed(2)}px`);
      dashboard.style.setProperty("--home-dashboard-opacity", `${(0.48 + dashboardProgress * 0.52).toFixed(3)}`);
    }

    if (planGrid) {
      const planRect = planGrid.getBoundingClientRect();
      if (homeScenePlanRestTop === null || planRect.top > homeScenePlanRestTop + 8) {
        homeScenePlanRestTop = planRect.top;
      }
      const planProgress = homeSceneClamp(
        (homeScenePlanRestTop - planRect.top) / Math.max(window.innerHeight * 0.55, 1)
      );
      planGrid.style.setProperty("--home-plan-y", `${((1 - planProgress) * 30).toFixed(2)}px`);
      planGrid.style.setProperty("--home-plan-tilt", `${((1 - planProgress) * 2.5).toFixed(2)}deg`);
      planGrid.style.setProperty("--home-plan-opacity", `${(0.60 + planProgress * 0.40).toFixed(3)}`);
    }
  });
}

function initHomeSceneMotion() {
  const island = document.getElementById("homeDynamicIsland");
  if (island && !island.dataset.bound) {
    island.dataset.bound = "true";
    island.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      switchModule("coach");
    });
  }
  if (!homeSceneMotionBound) {
    homeSceneMotionBound = true;
    window.addEventListener("scroll", () => scheduleHomeSceneMotion(), { passive: true });
    window.addEventListener("resize", () => scheduleHomeSceneMotion(true));
  }
  scheduleHomeSceneMotion(true);
}

const _origRenderHome = renderHome;
renderHome = function() {
  _origRenderHome();
  initDashboard();
  syncDashboardFromState();
  initHomeSceneMotion();
};

function syncDashboardFromState() {
  // Update AI coach entry text based on app state
  const state = app.getState();
  const metrics = app.getProgressMetrics();
  const planStats = state.planBookStats || {};
  const currentPlan = planStats.currentPlanProgress || null;

  const entryTitle = document.getElementById("homeCoachEntryTitle");
  const entryDesc = document.getElementById("homeCoachEntryDesc");

  if (entryTitle && entryDesc) {
    if (currentPlan) {
      entryTitle.textContent = `当前进行中 / ${currentPlan.planName}`;
      entryDesc.textContent = `已完成 ${currentPlan.completedTasks}/${currentPlan.totalTasks} 个任务。回到 AI 助手可以继续生成新方案。`;
    } else if (metrics.activeCount > 0) {
      entryTitle.textContent = "继续推进你的计划";
      entryDesc.textContent = `你有 ${metrics.activeCount} 个进行中的计划，去计划簿打钩推进吧。`;
    } else {
      entryTitle.textContent = "需要更具体的建议？";
      entryDesc.textContent = "和 AI 助手聊聊你的实际场景，马上得到分组行动计划。";
    }
  }

  const islandTitle = document.getElementById("homeIslandTitle");
  const islandDetail = document.getElementById("homeIslandDetail");
  if (islandTitle && islandDetail) {
    if (currentPlan) {
      islandTitle.textContent = currentPlan.planName || "继续当前计划";
      islandDetail.textContent = `已完成 ${currentPlan.completedTasks}/${currentPlan.totalTasks} 项 · 点击继续`;
    } else if (metrics.activeCount > 0) {
      islandTitle.textContent = "你的下一步正在等待";
      islandDetail.textContent = `${metrics.activeCount} 个计划进行中 · 点击查看建议`;
    } else {
      islandTitle.textContent = "AI 今日聚焦";
      islandDetail.textContent = "从一个真实场景开始，得到分组行动计划";
    }
  }
}

// ── Click Ripple Effect ──
function initClickRipple() {
  console.log("🌊 initClickRipple: starting...");
  
  // Find or create a single shared ripple container that always exists
  let container = document.getElementById("rippleContainer");
  
  if (!container) {
    console.warn("⚠️ rippleContainer not found, creating shared one in body");
    container = document.createElement("div");
    container.id = "rippleContainer";
    container.className = "ripple-container";
    document.body.appendChild(container);
  }
  
  // Move the container to body so it persists across shell switches
  if (container.parentElement !== document.body) {
    document.body.appendChild(container);
  }
  
  console.log("✅ initClickRipple: container found");

  // Determine context for ripple styling
  function getRippleContext(target) {
    const authShell = document.getElementById("authShell");
    if (authShell && !authShell.classList.contains("hidden") && authShell.offsetParent !== null) {
      return "auth";
    }
    if (target.closest(".primary-btn, .breath-button, [data-jump]")) return "action";
    if (target.closest("button, a, .auth-field, input, textarea, select, .ring-card, .task-item, .scenario-row")) {
      return "primary";
    }
    return "primary";
  }

  document.addEventListener("click", (e) => {
    // Skip ripple on cursor elements and certain interactive components
    if (e.target.closest(".cursor-glow, .cursor-dot, .cursor-ring, .ripple-container, .breath-tooltip")) return;

    // Don't create ripple on small accidental clicks (touch devices)
    if ("ontouchstart" in window && e.clientX === 0 && e.clientY === 0) return;

    const ctx = getRippleContext(e.target);
    const x = e.clientX;
    const y = e.clientY;

    // 1) Bright center dot - immediate visual feedback
    const dot = document.createElement("div");
    dot.className = "click-dot";
    dot.style.cssText = `left:${x}px;top:${y}px;`;
    container.appendChild(dot);
    setTimeout(() => { dot.remove(); }, 600);

    // 2) Expanding burst ring - vivid color, fast expansion
    const burst = document.createElement("div");
    burst.className = `click-burst ${ctx}`;
    burst.style.cssText = `left:${x}px;top:${y}px;`;
    container.appendChild(burst);
    setTimeout(() => { burst.remove(); }, 800);

    // 3) Outward shockwave ring (slower, larger)
    const shock = document.createElement("div");
    shock.className = "click-shock";
    shock.style.cssText = `left:${x}px;top:${y}px;`;
    container.appendChild(shock);
    setTimeout(() => { shock.remove(); }, 1100);

    // 4) Subtle particle sparks around click point
    if (ctx !== "auth") {
      const sparkCount = 6;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() * 0.4);
        const distance = 25 + Math.random() * 20;
        const spark = document.createElement("div");
        spark.className = "click-spark";
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        spark.style.cssText = `left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;animation-delay:${i * 15}ms;`;
        container.appendChild(spark);
        setTimeout(() => { spark.remove(); }, 900);
      }
    }

    // 5) Main ripple (the original, kept for context)
    const size = ctx === "auth" ? Math.max(window.innerWidth, window.innerHeight) * 0.4 : 160;
    const ripple = document.createElement("div");
    ripple.className = `ripple ${ctx}`;
    ripple.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;animation:ripple-expand 700ms cubic-bezier(0.16,1,0.3,1) forwards;`;
    container.appendChild(ripple);
    setTimeout(() => { ripple.remove(); }, 750);

    // 6) Wind-blow background effect — brief blur + displacement, then snap back
    const shell = document.getElementById("siteShell") || document.getElementById("authShell") || document.body;
    shell.classList.add("wind-blow");
    setTimeout(() => { shell.classList.remove("wind-blow"); }, 550);
  });

  // Double-click: bigger ripple with accent color
  document.addEventListener("dblclick", (e) => {
    if (e.target.closest(".cursor-glow, .cursor-dot, .cursor-ring, .ripple-container")) return;

    const x = e.clientX;
    const y = e.clientY;

    // Double-click creates a dramatic starburst
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const distance = 80;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const spark = document.createElement("div");
      spark.className = "click-spark double";
      spark.style.cssText = `left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;`;
      container.appendChild(spark);
      setTimeout(() => { spark.remove(); }, 1200);
    }

    const size = 500;
    const ripple = document.createElement("div");
    ripple.className = "ripple action";
    ripple.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;animation:ripple-expand 900ms cubic-bezier(0.34,1.56,0.64,1) forwards;`;
    container.appendChild(ripple);
    setTimeout(() => { ripple.remove(); }, 950);
  });

  console.log("✅ initClickRipple: click listeners bound");
}

// Initialize mouse effects and breathing on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initMouseEffects();
    initBreathButton();
    initClickRipple();
  });
} else {
  initMouseEffects();
  initBreathButton();
  initClickRipple();
}



// ════════════════════════════════════════════════════════
//  DASHBOARD FEATURES (appended)
// ════════════════════════════════════════════════════════

/**
 * Progress Module Tabs + Dashboard Charts + Achievements + Drag-Drop
 * Append to app.chat.js
 */

// ════════════════════════════════════════════════════════
//  Progress Sub-Tab Switching
// ════════════════════════════════════════════════════════

function initProgressTabs() {
  const tabBtns = document.querySelectorAll(".progress-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.progressTab;
      // Update button active state
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      // Show/hide tab content
      document.querySelectorAll(".progress-tab-content").forEach((el) => el.classList.add("hidden"));
      const target = document.getElementById("progressTab" + capitalize(tab));
      if (target) target.classList.remove("hidden");
      // Render tab content
      if (tab === "dashboard") renderDashboardCharts();
      if (tab === "achievements") renderAchievements();
    });
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ════════════════════════════════════════════════════════
//  Dashboard Data Calculation
// ════════════════════════════════════════════════════════

function calculateDashboardStats() {
  const entries = (app.getState && app.getState().planBookEntries) || [];
  const active = entries.filter((e) => e.status !== "achieved");
  const achieved = entries.filter((e) => e.status === "achieved");
  const allTasks = entries.flatMap((e) => e.tasks || []);
  const completedTasks = allTasks.filter((t) => t.done);
  const totalPlans = entries.length;
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
