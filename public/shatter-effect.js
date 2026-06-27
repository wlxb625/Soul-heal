/**
 * 玻璃破碎碰撞效果 — 卡片接触视口顶部区域时持续触发
 * 模拟卡片"撞碎"在浏览器标题栏边缘的视觉效果
 */
(function () {
  'use strict';

  const zoneState = new WeakMap();  // true = card's top edge inside collision zone
  let throttleTimer = null;

  /* ── Find cards that are currently visible ── */
  function findVisibleCards() {
    const all = document.querySelectorAll('.site-shell .card.module-panel');
    return [...all].filter(function (c) {
      var s = window.getComputedStyle(c);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });
  }

  /* ── Scroll handler: edge detection — trigger when card top enters the collision zone ── */
  function checkCollisions() {
    var cards = findVisibleCards();

    cards.forEach(function (card) {
      var top = card.getBoundingClientRect().top;
      var inZone = top > -4 && top < 24;

      // Get previous state (default: outside)
      var prevInZone = zoneState.get(card) || false;

      // Transition: just stepped INTO the zone → trigger shatter
      if (inZone && !prevInZone) {
        triggerShatter(card);
      }

      // Save current state for next check
      zoneState.set(card, inZone);
    });
  }

  /* ── Trigger full shatter sequence ── */
  function triggerShatter(card) {
    var rect = card.getBoundingClientRect();
    // Impact line: card's top edge (which is now near viewport top)
    var impactY = rect.top;

    // 1. Brief full-width flash line at impact
    flashLine(rect, impactY);

    // 2. Spider cracks radiating from impact points
    makeCracks(rect.left, rect.right, impactY);

    // 3. Glass shards flying in all directions
    makeShards(rect, impactY);

    // 4. Particle sparks
    makeSparks(rect.left, rect.right, impactY);

    // 5. Card shake
    shakeCard(card);
  }

  /* ── 1. Flash line ── */
  function flashLine(rect, y) {
    var el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:' + rect.left + 'px;top:' + (y - 3) + 'px;' +
      'width:' + rect.width + 'px;height:6px;' +
      'background:rgba(255,255,255,0.85);' +
      'z-index:99999;pointer-events:none;border-radius:3px;';
    document.body.appendChild(el);

    el.animate([
      { opacity: 1, boxShadow: '0 0 24px 10px rgba(255,255,255,0.7)' },
      { opacity: 0, boxShadow: '0 0 48px 20px rgba(255,255,255,0)' }
    ], { duration: 400, easing: 'ease-out', fill: 'forwards' })
    .onfinish = function () { el.remove(); };
  }

  /* ── 2. Crack lines ── */
  function makeCracks(minX, maxX, y) {
    var w = maxX - minX;
    var count = 14 + Math.floor(Math.random() * 16);

    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      var sx = minX + Math.random() * w;
      var len = 30 + Math.random() * 100;
      var angle = (Math.random() - 0.5) * 160; // ±80°
      var thick = 1 + Math.random() * 2.5;

      el.style.cssText =
        'position:fixed;left:' + sx + 'px;top:' + y + 'px;' +
        'width:' + len + 'px;height:' + thick + 'px;' +
        'background:rgba(255,255,255,0.65);' +
        'z-index:99998;pointer-events:none;' +
        'transform-origin:left center;border-radius:1px;' +
        'box-shadow:0 0 ' + (3 + Math.random() * 5) + 'px rgba(91,168,154,0.35);';
      document.body.appendChild(el);

      el.animate([
        { width: '0px', opacity: 0.9, transform: 'rotate(' + angle + 'deg)' },
        { width: len + 'px', opacity: 0.6, transform: 'rotate(' + angle + 'deg)', offset: 0.1 },
        { width: len + 'px', opacity: 0, transform: 'rotate(' + angle + 'deg)' }
      ], { duration: 500 + Math.random() * 600, easing: 'ease-out', fill: 'forwards' })
      .onfinish = function () { el.remove(); };
    }

    // Branch cracks
    for (var j = 0; j < 10; j++) {
      var br = document.createElement('div');
      var bx = minX + Math.random() * w;
      var blen = 10 + Math.random() * 55;
      var ba = (Math.random() - 0.5) * 210;

      br.style.cssText =
        'position:fixed;left:' + bx + 'px;top:' + y + 'px;' +
        'width:' + blen + 'px;height:1px;' +
        'background:rgba(255,255,255,0.4);' +
        'z-index:99997;pointer-events:none;transform-origin:left center;';
      document.body.appendChild(br);

      br.animate([
        { width: '0px', opacity: 0.5, transform: 'rotate(' + ba + 'deg)' },
        { width: blen + 'px', opacity: 0.2, transform: 'rotate(' + ba + 'deg)' },
        { width: blen + 'px', opacity: 0, transform: 'rotate(' + ba + 'deg)' }
      ], { duration: 350 + Math.random() * 350, easing: 'ease-out', fill: 'forwards' })
      .onfinish = function () { br.remove(); };
    }
  }

  /* ── 3. Glass shards ── */
  function makeShards(rect, y) {
    var colors = [
      'rgba(91,168,154,0.6)',     // teal accent
      'rgba(255,250,243,0.65)',   // card surface
      'rgba(230,210,188,0.5)',   // warm tint
      'rgba(255,255,255,0.6)',   // clear glass
      'rgba(61,46,37,0.4)',      // dark
      'rgba(195,220,210,0.45)',  // pale
    ];
    var count = 30;

    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      var sw = 5 + Math.random() * 22;
      var sh = sw * (0.35 + Math.random() * 1.1);
      var ix = rect.left + Math.random() * rect.width;
      // 360° spread but biased slightly downward
      var angle = (Math.random() - 0.35) * Math.PI * 2;
      var dist = 50 + Math.random() * 200;
      var rot = (Math.random() - 0.5) * 900;
      var col = colors[Math.floor(Math.random() * colors.length)];

      var r = Math.random();
      var br;
      if (r < 0.35) br = '2px';
      else if (r < 0.6) br = '50%';
      else if (r < 0.8) br = '3px 10px 5px 2px';
      else br = '1px 7px 2px 8px';

      el.style.cssText =
        'position:fixed;left:' + ix + 'px;top:' + y + 'px;' +
        'width:' + sw + 'px;height:' + sh + 'px;' +
        'background:' + col + ';border-radius:' + br + ';' +
        'z-index:100000;pointer-events:none;' +
        'box-shadow:0 0 ' + (4 + Math.random() * 7) + 'px rgba(91,168,154,0.3);';
      document.body.appendChild(el);

      var ex = Math.cos(angle) * dist;
      var ey = Math.sin(angle) * dist;

      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 0.9 },
        { transform: 'translate(' + ex + 'px,' + ey + 'px) rotate(' + rot + 'deg)', opacity: 0 }
      ], {
        duration: 400 + Math.random() * 500,
        easing: 'cubic-bezier(0.22,0.61,0.36,1)',
        fill: 'forwards'
      }).onfinish = function () { el.remove(); };
    }
  }

  /* ── 4. Sparks ── */
  function makeSparks(minX, maxX, y) {
    var count = 20;
    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      var sx = minX + Math.random() * (maxX - minX);
      var angle = (Math.random() - 0.45) * 200; // bias left-right + slightly down
      var dist = 15 + Math.random() * 80;

      el.style.cssText =
        'position:fixed;left:' + sx + 'px;top:' + y + 'px;' +
        'width:3px;height:3px;background:white;border-radius:50%;' +
        'z-index:100001;pointer-events:none;' +
        'box-shadow:0 0 10px 4px rgba(255,255,255,0.9),' +
        '0 0 3px 1px rgba(91,168,154,0.6);';
      document.body.appendChild(el);

      el.animate([
        { transform: 'scale(1) translate(0,0)', opacity: 1 },
        { transform: 'scale(0) translate(' + (Math.cos(angle) * dist) + 'px,' + (Math.sin(angle) * dist) + 'px)', opacity: 0 }
      ], { duration: 200 + Math.random() * 350, easing: 'ease-out', fill: 'forwards' })
      .onfinish = function () { el.remove(); };
    }
  }

  /* ── 5. Card shake ── */
  function shakeCard(card) {
    card.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(-4px)', offset: 0.15 },
      { transform: 'translateY(3px)', offset: 0.3 },
      { transform: 'translateY(-2px)', offset: 0.5 },
      { transform: 'translateY(1px)', offset: 0.7 },
      { transform: 'translateY(0)' }
    ], { duration: 350, easing: 'ease-out' });
  }

  /* ── Init: wait for siteShell to become visible, then start ── */
  var listening = false;

  function start() {
    if (listening) return;
    listening = true;

    window.addEventListener('scroll', function () {
      if (throttleTimer) return;
      throttleTimer = setTimeout(function () {
        throttleTimer = null;
        checkCollisions();
      }, 50);
    }, { passive: true });

    setTimeout(checkCollisions, 500);
  }

  function tryStart() {
    var shell = document.getElementById('siteShell');
    if (!shell || shell.classList.contains('hidden')) return false;
    var topbar = document.querySelector('.site-shell .topbar');
    if (!topbar) return false;
    start();
    return true;
  }

  // First try immediately
  if (!tryStart()) {
    // Wait for siteShell to appear (post-login)
    document.addEventListener('DOMContentLoaded', function () {
      if (tryStart()) return;
      var shell = document.getElementById('siteShell');
      if (!shell) return;

      var obs = new MutationObserver(function () {
        if (tryStart()) obs.disconnect();
      });
      obs.observe(shell, { attributes: true, attributeFilter: ['class'] });
    });

    // Also handle case where DOMContentLoaded already fired
    if (document.readyState !== 'loading') {
      if (tryStart()) return;
      var shell = document.getElementById('siteShell');
      if (!shell) return;

      var obs = new MutationObserver(function () {
        if (tryStart()) obs.disconnect();
      });
      obs.observe(shell, { attributes: true, attributeFilter: ['class'] });
    }
  }
})();
