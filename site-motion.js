(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const surfaceSelector = [
    ".auth-card", ".module-panel", ".subcard", ".quick-link-card", ".home-coach-entry",
    ".mbti-question-card", ".manual-mbti-card", ".coach-sidebar", ".coach-chat-shell",
    ".dashboard-stat-card", ".dashboard-chart-card", ".plan-stat-card", ".task-card",
    ".ring-card", ".pd-goal-card", ".pd-achieved-card", ".achievement-card", ".chat-plan-card",
    ".plan-entry-card", ".modal-card", ".verify-reminder-card", ".breath-panel"
  ].join(",");
  const featuredSelector = ".auth-card, .module-panel, .modal-card, .breath-panel, .coach-chat-shell";
  let activeSurface = null;
  let pointerFrame = 0;
  let pointerEvent = null;

  function isVisible(element) {
    return !element.classList.contains("hidden") && element.getClientRects().length > 0;
  }

  function addFrame(element, featured = false) {
    if (!(element instanceof HTMLElement) || element.dataset.yugeMotionReady) return;
    element.dataset.yugeMotionReady = "true";
    element.classList.add("yuge-motion-surface");
    if (featured) element.classList.add("yuge-motion-featured");

    const mesh = document.createElement("span");
    mesh.className = "yuge-motion-glow-mesh";
    mesh.setAttribute("aria-hidden", "true");
    const edge = document.createElement("span");
    edge.className = "yuge-motion-glow-edge";
    edge.setAttribute("aria-hidden", "true");
    element.append(mesh, edge);
  }

  function decorate(root = document) {
    const candidates = [];
    if (root instanceof HTMLElement && root.matches(surfaceSelector)) candidates.push(root);
    if (root.querySelectorAll) candidates.push(...root.querySelectorAll(surfaceSelector));
    candidates.forEach((element) => addFrame(element, element.matches(featuredSelector)));
  }

  function updateGlow() {
    pointerFrame = 0;
    if (!activeSurface || !pointerEvent || reducedMotion.matches) return;
    const rect = activeSurface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = pointerEvent.clientX - rect.left;
    const y = pointerEvent.clientY - rect.top;
    const edgeDistance = Math.min(x, y, rect.width - x, rect.height - y);
    const proximity = Math.max(0, Math.min(1, 1 - edgeDistance / Math.min(rect.width, rect.height, 160)));
    const angle = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 90;
    activeSurface.style.setProperty("--yuge-glow-strength", proximity.toFixed(3));
    activeSurface.style.setProperty("--yuge-glow-angle", `${angle.toFixed(1)}deg`);
  }

  function queueGlow(event) {
    const candidate = event.target instanceof Element ? event.target.closest(".yuge-motion-surface") : null;
    if (candidate !== activeSurface) activeSurface = candidate;
    pointerEvent = event;
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updateGlow);
  }

  function enterPanel(panel) {
    if (!panel || reducedMotion.matches) return;
    panel.classList.remove("yuge-motion-panel-enter");
    void panel.offsetWidth;
    panel.classList.add("yuge-motion-panel-enter");
    window.setTimeout(() => panel.classList.remove("yuge-motion-panel-enter"), 520);
  }

  function observeDynamicContent() {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        decorate(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    decorate();
    observeDynamicContent();
    document.addEventListener("pointermove", queueGlow, { passive: true });
    document.addEventListener("pointerleave", () => { activeSurface = null; }, true);
    window.addEventListener("yuge:module-changed", (event) => {
      const panel = event.detail?.panel;
      decorate(panel);
      enterPanel(panel);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
