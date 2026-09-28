/* SureClick: the drop, the pool, the ripple.
   Plain JS. Everything that moves eases, rests when idle, and honours reduced motion. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const onMQ = (m, fn) => (m.addEventListener ? m.addEventListener('change', fn) : m.addListener(fn));

  /* The page itself eases in */
  requestAnimationFrame(() => document.body.classList.add('is-ready'));

  /* The five static-hero gates. Character for character the same as the CSS. */
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  const MQLS = GATES.map(q => matchMedia(q));
  const gated = () => MQLS.some(m => m.matches);

  /* =========================================================
     GLIDE: inertial page scroll for mouse and trackpad.
     The wheel moves a target and the page eases toward it, so the
     whole page (and everything scrubbed off it) carries on for a beat
     after the visitor stops. Touch keeps its own native momentum.
     ========================================================= */
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const glide = (() => {
    const LERP = 0.075;            // share of the gap closed per 60fps frame; lower glides longer
    let on = false, raf = null, last = 0, lastSet = -1;
    let target = 0, current = 0;
    let tween = null;              // programmatic glides (anchor links) use a timed ease instead
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    function frame(now) {
      const dt = Math.min(64, now - (last || now));
      last = now;
      let done;
      if (tween) {
        const t = clamp((now - tween.t0) / tween.dur, 0, 1);
        current = tween.from + (tween.to - tween.from) * easeInOut(t);
        target = current;
        done = t >= 1;
        if (done) {
          // Late-loading content can move the destination: settle on where it is now.
          const fix = tween.el ? clamp(tween.el.getBoundingClientRect().top + scrollY, 0, maxScroll()) : current;
          tween = null;
          if (Math.abs(fix - current) > 1) { target = fix; done = false; }
        }
      } else {
        current += (target - current) * (1 - Math.pow(1 - LERP, dt / 16.667));
        done = Math.abs(target - current) < 0.4;
        if (done) current = target;
      }
      lastSet = Math.round(current);
      scrollTo(0, current);
      if (done) { raf = null; last = 0; } else raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (raf === null) raf = requestAnimationFrame(frame); };
    function canScrollInside(el, dy) {
      for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        }
      }
      return false;
    }
    function onWheel(e) {
      if (e.ctrlKey || e.defaultPrevented || document.body.style.overflow === 'hidden') return;
      let dy = e.deltaY;
      if (Math.abs(e.deltaX) > Math.abs(dy)) return;
      if (e.deltaMode === 1) dy *= 40; else if (e.deltaMode === 2) dy *= innerHeight;
      if (canScrollInside(e.target, dy)) return;
      e.preventDefault();
      if (raf === null) current = target = scrollY;
      if (tween) { tween = null; target = current; }
      target = clamp(target + dy, 0, maxScroll());
      kick();
    }
    function onScroll() {
      // Keyboard, scrollbar or find-in-page moved the page: follow it, never fight it.
      if (Math.abs(scrollY - lastSet) > 2) {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = 0; }
        tween = null;
        current = target = lastSet = scrollY;
      }
    }
    function to(y, el) {
      y = clamp(y, 0, maxScroll());
      if (!on) { scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' }); return; }
      const from = raf === null ? scrollY : current;
      const dist = Math.abs(y - from);
      tween = { from, to: y, el, t0: performance.now(), dur: clamp(700 + dist * 0.12, 800, 2000) };
      last = 0;
      kick();
    }
    function enable() {
      if (on) return;
      on = true;
      document.documentElement.classList.add('glide');
      current = target = lastSet = scrollY;
      addEventListener('wheel', onWheel, { passive: false });
      addEventListener('scroll', onScroll, { passive: true });
    }
    function disable() {
      if (!on) return;
      on = false;
      document.documentElement.classList.remove('glide');
      removeEventListener('wheel', onWheel);
      removeEventListener('scroll', onScroll);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = 0; }
      tween = null;
    }
    return { enable, disable, to, get on() { return on; } };
  })();
  const applyGlide = () => (FINE.matches && !reduced() ? glide.enable() : glide.disable());

  // In-page links glide there too (the skip link stays an instant jump for keyboard users).
  document.addEventListener('click', e => {
    if (!glide.on || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 ? document.getElementById(id.slice(1)) : null;
    if (!el) return;
    e.preventDefault();
    glide.to(el.getBoundingClientRect().top + scrollY, el);
  });

  /* =========================================================
     HERO: the build. A website builds itself as the visitor scrolls:
     chat, design, build, live. Drawn entirely in code; the markup's
     default state is the finished site, so the scroll only ever
     rewinds it to earlier moments.
     ========================================================= */
  const hero = $('.hero');
  const stage = $('.stage');
  const scene = $('.scene');
  const rig = $('.rig');
  const browserEl = $('.browser');
  const barEl = $('.b-bar');
  const cursorEl = $('.cursor');
  const railSpans = $$('.rail span');
  const railBar = $('.rail-bar');

  // The hero plays everywhere except reduced motion and phones held sideways (no room).
  const HERO_GATES = [
    '(prefers-reduced-motion: reduce)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)'
  ];
  const HERO_MQLS = HERO_GATES.map(q => matchMedia(q));
  const heroGated = () => HERO_MQLS.some(m => m.matches);

  const bands = $$('.band', stage).map((el, i, arr) => ({
    el, a: +el.dataset.a, b: +el.dataset.b, ramp: el.dataset.ramp ? +el.dataset.ramp : 0,
    first: i === 0, last: i === arr.length - 1, op: -1, k: -1, vis: undefined, cta: null
  }));

  /* Split each band headline once: a hidden full sentence for screen readers,
     plus word and character spans with seeded offsets for the entrances. */
  function splitBand(el, seed, fx, spread) {
    const r = rng(seed);
    const full = el.textContent.replace(/\s+/g, ' ').trim();
    const vis = document.createElement('span');
    vis.className = 'vis';
    vis.setAttribute('aria-hidden', 'true');
    const words = [], chars = [];
    let prevWord = null, spaceBefore = true;
    [...el.childNodes].forEach(node => {
      const isEm = node.nodeType === 1 && node.tagName === 'EM';
      node.textContent.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { vis.appendChild(document.createTextNode(' ')); spaceBefore = true; return; }
        const w = document.createElement('span');
        w.className = isEm ? 'w em' : 'w';
        for (const ch of tok) {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          w.appendChild(c);
          chars.push(c);
        }
        if (!spaceBefore && prevWord) {
          // glue punctuation to the word before it, so a full stop never wraps alone
          let g = prevWord.parentNode;
          if (!g.classList.contains('wg')) { g = document.createElement('span'); g.className = 'wg'; prevWord.replaceWith(g); g.appendChild(prevWord); }
          g.appendChild(w);
        } else vis.appendChild(w);
        words.push(w);
        prevWord = w;
        spaceBefore = false;
      });
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = full;
    el.textContent = '';
    el.append(sr, vis);

    if (fx === 'snap') {
      // characters slide into place in reading order, like the blueprint drawing itself
      const n = chars.length;
      chars.forEach((c, i) => {
        c.style.setProperty('--th', ((i / Math.max(1, n - 1)) * spread + r() * 0.05).toFixed(3));
        c.style.setProperty('--jx', '18px');
      });
    } else {
      const span = fx === 'punch' ? 0.34 : 0.5;
      const n = words.length;
      words.forEach((w, i) => w.style.setProperty('--th', (n > 1 ? (i / (n - 1)) * span + r() * 0.02 : 0).toFixed(3)));
    }
  }

  function heroProgress() {
    const range = hero.offsetHeight - innerHeight;
    if (range <= 0) return 1;
    return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
  }

  /* Captions: opacity per band paced in scroll distance, assembly progress --k.
     Every DOM write is delta-gated. */
  let loadK = 0;
  function updateCaptions(p) {
    for (const b of bands) {
      const len = b.b - b.a;
      const f = Math.min(0.02, len / 3);
      let op;
      if ((!b.first && p < b.a) || (!b.last && p > b.b)) op = 0;
      else op = (b.first ? 1 : smoothstep(p, b.a, b.a + f)) * (b.last ? 1 : 1 - smoothstep(p, b.b - f, b.b));
      op = Math.round(op * 200) / 200;
      const ramp = b.ramp || Math.min(0.025, len * 0.35);
      let k = clamp((p - b.a) / ramp, 0, 1);
      if (b.first) k = Math.max(k, loadK);
      if (op !== b.op) {
        b.op = op;
        b.el.style.opacity = op;
        const vis = op > 0.01;
        if (vis !== b.vis) { b.vis = vis; b.el.style.visibility = vis ? 'visible' : 'hidden'; }
      }
      if (Math.abs(k - b.k) >= 0.008 || (k === 1 && b.k !== 1) || (k === 0 && b.k !== 0)) {
        b.k = k;
        b.el.style.setProperty('--k', k.toFixed(3));
      }
      if (b.last) {
        const on = k > 0.9 && op > 0.5;
        if (on !== b.cta) { b.cta = on; b.el.classList.toggle('cta-on', on); }
      }
    }
  }

  /* The scene's timeline lives in the markup: every [data-fx] element names when it
     starts (data-a), how long it takes (data-d) and, optionally, when it leaves
     (data-xa, data-xd). Transform and opacity only, written only when they change. */
  const ease01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const parts = $$('[data-fx]', scene).map(el => ({
    el, fx: el.dataset.fx, a: +el.dataset.a, d: +el.dataset.d || 0.03,
    xa: el.dataset.xa ? +el.dataset.xa : null, xd: +el.dataset.xd || 0.03,
    press: el.dataset.press ? +el.dataset.press : null, tf: null, op: null, dash: null
  }));
  let geo = null;          // measured once per resize: cursor path in rig pixels
  let lastRail = -1, lastRp = '', lastRig = '';

  function measureScene() {
    const W = browserEl.offsetWidth;
    const bar = barEl.offsetHeight + 1;               // the bar plus its border
    const viewH = W * 0.625;
    const btn = { x: W * 0.138, y: bar + W * 0.395 }; // centre of "Order flowers" (4.8 + 9, 37.2 + 2.3 cqw)
    const cw = cursorEl.getBoundingClientRect().width || 30;
    const tip = cw * (3 / 40);                        // the arrow's tip sits 3/40 into the drawing
    geo = {
      end: { x: btn.x - tip + cw * 0.18, y: btn.y - tip + cw * 0.1 },
      start: { x: -W * 0.32, y: bar + viewH * 1.2 },
      ctrl: { x: -W * 0.08, y: bar + viewH * 0.25 }
    };
  }
  function cursorAt(t) {
    const { start: s, ctrl: c, end: e } = geo, u = 1 - t;
    return { x: u * u * s.x + 2 * u * t * c.x + t * t * e.x, y: u * u * s.y + 2 * u * t * c.y + t * t * e.y };
  }
  function write(q, tf, op) {
    if (tf !== q.tf) { q.tf = tf; q.el.style.transform = tf; }
    if (op !== q.op) { q.op = op; q.el.style.opacity = op; }
  }
  function applyScene(p) {
    if (!geo) measureScene();
    for (const q of parts) {
      const e = q.a < 0 ? 1 : ease01((p - q.a) / q.d);
      const x = q.xa === null ? 0 : ease01((p - q.xa) / q.xd);
      const vis = Math.round(e * (1 - x) * 1000) / 1000;
      switch (q.fx) {
        case 'draw': {
          const dash = (1 - e).toFixed(3);
          if (dash !== q.dash) { q.dash = dash; q.el.style.strokeDashoffset = dash; }
          break;
        }
        case 'fade': write(q, '', vis); break;
        case 'out': write(q, '', Math.round((1 - e) * 1000) / 1000); break;
        case 'pop': write(q, `translateY(${((1 - e) * 12 - x * 14).toFixed(1)}px) scale(${(0.88 + 0.12 * e).toFixed(3)})`, vis); break;
        case 'rise': write(q, `translateY(${((1 - e) * 18).toFixed(1)}px)`, vis); break;
        case 'drop': write(q, `scale(${(1.22 - 0.22 * e).toFixed(3)})`, vis); break;
        case 'slide': write(q, `translateY(${((1 - e) * 80).toFixed(1)}px)`, vis); break;
        case 'btn': {
          const press = q.press === null ? 0 : Math.sin(Math.PI * clamp((p - q.press) / 0.025, 0, 1));
          write(q, `scale(${((0.6 + 0.4 * e) * (1 - 0.07 * press)).toFixed(3)})`, vis);
          break;
        }
        case 'ring': {
          const on = p >= q.a ? 1 : 0;
          write(q, `scale(${(0.2 + e * 2.6).toFixed(3)})`, on ? Math.round((1 - e) * 900) / 1000 : 0);
          break;
        }
        case 'cursor': {
          const t = easeInOut(clamp((p - q.a) / q.d, 0, 1));
          const pt = cursorAt(t);
          write(q, `translate(${pt.x.toFixed(1)}px,${pt.y.toFixed(1)}px)`, p <= q.a ? 0 : Math.round(ease01((p - q.a) / (q.d * 0.25)) * 1000) / 1000);
          break;
        }
      }
    }
    // The browser sits turned toward the words, then squares up as the site goes live.
    const flat = ease01((p - 0.62) / 0.3);
    const rig3d = `rotateY(${(-11 * (1 - flat)).toFixed(2)}deg) rotateX(${(4 * (1 - flat)).toFixed(2)}deg)`;
    if (rig3d !== lastRig) { lastRig = rig3d; rig.style.transform = rig3d; }
    // The rail: which of the four steps we're on, and how far through.
    const step = p < 0.235 ? 0 : p < 0.485 ? 1 : p < 0.74 ? 2 : 3;
    if (step !== lastRail) { lastRail = step; railSpans.forEach((s, i) => { s.classList.toggle('on', i === step); s.classList.toggle('done', i < step); }); }
    const rp = p.toFixed(3);
    if (rp !== lastRp) { lastRp = rp; railBar.style.setProperty('--rp', rp); }
  }
  // Finished state: clear everything the timeline wrote, park the cursor on the button.
  function resetScene() {
    for (const q of parts) {
      q.el.style.transform = ''; q.el.style.opacity = ''; q.el.style.strokeDashoffset = '';
      q.tf = q.op = q.dash = null;
    }
    rig.style.transform = ''; lastRig = '';
    measureScene();
    const pt = cursorAt(1);
    cursorEl.style.transform = `translate(${pt.x.toFixed(1)}px,${pt.y.toFixed(1)}px)`;
    cursorEl.style.opacity = '';
  }

  /* One loop that rests: the scene's progress trails the gliding page a touch. */
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true, scrubOn = false;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - 0.12, dt / 16.667));
    const settled = Math.abs(target - shown) < 0.0003;
    if (settled) shown = target;
    applyScene(shown);
    updateCaptions(shown);
    if (settled) { rafId = null; lastTick = 0; } else rafId = requestAnimationFrame(tick);
  }
  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen && scrubOn) rafId = requestAnimationFrame(tick);
  }
  new IntersectionObserver(es => {
    heroOnScreen = es[0].isIntersecting;
    if (heroOnScreen) onScroll();
  }).observe(hero);

  // Band one opens settled: a short, one-time assembly on load that hands over to scroll.
  let loadRamped = false;
  function startLoadRamp() {
    if (loadRamped) return;
    loadRamped = true;
    let t0 = 0;
    const step = now => {
      if (!t0) t0 = now;
      loadK = easeOut(clamp((now - t0) / 1400, 0, 1));
      if (scrubOn) updateCaptions(shown);
      if (loadK < 1) requestAnimationFrame(step);
    };
    let went = false;
    const go = () => { if (!went) { went = true; requestAnimationFrame(step); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    setTimeout(go, 900);
  }

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    hero.classList.add('scrub');
    addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.vis = undefined; b.cta = null; });
    lastRail = -1; lastRp = ''; lastRig = '';
    measureScene();
    target = shown = heroProgress();
    applyScene(shown);
    updateCaptions(shown);
    startLoadRamp();
    onScroll();
  }
  function disableScrub() {
    if (scrubOn) {
      scrubOn = false;
      removeEventListener('scroll', onScroll);
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
    }
    hero.classList.remove('scrub');
    bands.forEach(b => { b.el.style.opacity = ''; b.el.style.visibility = ''; b.el.style.removeProperty('--k'); b.el.classList.remove('cta-on'); });
    resetScene();
  }
  function heroResize() {
    geo = null;
    if (scrubOn) { measureScene(); applyScene(shown); onScroll(); } else resetScene();
  }

  bands.forEach((b, i) => {
    const head = $('.split', b.el);
    const fx = ([...b.el.classList].find(c => c.startsWith('fx-')) || 'fx-rise').slice(3);
    if (head) splitBand(head, 11 + i * 7, fx, +(b.el.dataset.spread || 0.45));
  });

  /* =========================================================
     THE POOL: click ripples (the signature) and drifting specks
     ========================================================= */
  const cvs = $('.rings');
  const ctx = cvs.getContext('2d');
  let rings = [], ringRaf = null, dpr = 1;
  function sizeRings() {
    dpr = Math.min(1.5, devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr);
    cvs.height = Math.round(innerHeight * dpr);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height = innerHeight + 'px';
  }
  function drawRings(now) {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    rings = rings.filter(r => now - r.t0 < 2400);
    for (const r of rings) {
      for (let j = 0; j < 3; j++) {
        const t = (now - r.t0 - j * 240) / 1750;
        if (t <= 0 || t >= 1) continue;
        const rad = (6 + easeOut(t) * r.max) * dpr;
        const a = (1 - t) * (1 - t) * (0.5 - j * 0.14);
        ctx.beginPath();
        ctx.arc(r.x * dpr, r.y * dpr, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(130,214,255,${a.toFixed(3)})`;
        ctx.lineWidth = (1.6 - j * 0.35) * dpr;
        ctx.stroke();
      }
    }
    if (rings.length) ringRaf = requestAnimationFrame(drawRings);
    else { ringRaf = null; ctx.clearRect(0, 0, cvs.width, cvs.height); }
  }
  function addRing(x, y) {
    if (reduced()) return;
    rings.push({ x, y, t0: performance.now(), max: 110 + Math.random() * 70 });
    if (rings.length > 8) rings.shift();
    if (ringRaf === null) ringRaf = requestAnimationFrame(drawRings);
  }
  sizeRings();
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    addRing(e.clientX, e.clientY);
  }, { passive: true });

  (function specks() {
    const box = $('.env-specks');
    const r = rng(7);
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('i');
      s.className = 'speck';
      s.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--y:${(38 + r() * 70).toFixed(1)}%;--s:${(1.4 + r() * 2.2).toFixed(1)}px;--d:${(38 + r() * 42).toFixed(1)}s;--dl:-${(r() * 70).toFixed(1)}s;--dx:${((r() - 0.5) * 70).toFixed(0)}px`;
      box.appendChild(s);
    }
  })();

  /* =========================================================
     Reveals, living elements, pause on hidden tabs
     ========================================================= */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    revealIO.unobserve(el);
    const n = $$('.rc', el).length;
    setTimeout(() => el.classList.add('settled'), 1200 + n * 110);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  $$('.rv').forEach(el => revealIO.observe(el));

  const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec').forEach(s => liveIO.observe(s));

  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* =========================================================
     Nav and mobile menu
     ========================================================= */
  const nav = $('.nav');
  const menuBtn = $('.menu-btn');
  const menu = $('#mobile-menu');
  let menuOpen = false, navScrolled = null;
  function toggleMenu(open) {
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('open'));
      document.body.style.overflow = 'hidden';
      const first = $('a', menu);
      if (first) first.focus({ preventScroll: true });
    } else {
      menu.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 460);
    }
  }
  menuBtn.addEventListener('click', () => toggleMenu(!menuOpen));
  $$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { toggleMenu(false); menuBtn.focus(); } });

  /* =========================================================
     01 The live speed receipt
     ========================================================= */
  const receipt = $('.receipt');
  const receiptVal = $('.receipt-val');
  let receiptTarget = null, receiptShown = false, receiptSeen = false;
  function readLoad() {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    const ms = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : 0;
    if (!(ms > 0)) { receipt.classList.add('no-data'); return; }
    receiptTarget = ms / 1000;
    const bench = () => receipt.style.setProperty('--b', Math.min(1, receiptTarget / 4).toFixed(3));  // the bar runs 0 to 4 s, Google's 3 s mark sits at 75%
    receipt.benchNow = bench;
    if (reduced()) { receiptShown = true; receiptVal.textContent = receiptTarget.toFixed(2); bench(); return; }
    if (receiptSeen) countReceipt();
  }
  function countReceipt() {
    if (receiptShown || receiptTarget === null) return;
    receiptShown = true;
    receipt.benchNow();
    if (reduced()) { receiptVal.textContent = receiptTarget.toFixed(2); return; }
    let t0 = 0, last = '';
    const step = now => {
      if (!t0) t0 = now;
      const t = clamp((now - t0) / 1300, 0, 1);
      const s = (receiptTarget * easeOut(t)).toFixed(2);
      if (s !== last) { last = s; receiptVal.textContent = s; }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  new IntersectionObserver((es, o) => {
    if (es[0].isIntersecting) { receiptSeen = true; countReceipt(); o.disconnect(); }
  }, { threshold: 0.4 }).observe(receipt);
  if (document.readyState === 'complete') setTimeout(readLoad, 0);
  else addEventListener('load', () => setTimeout(readLoad, 0));

  /* =========================================================
     02 Redesign it yourself: press and hold
     ========================================================= */
  const DEMO = {
    trades: { kick: 'Builders · Dublin', head: 'Kitchens, extensions and fit-outs, built to last.', sub: 'Family-run builders serving Dublin and the surrounding counties.', cta: 'Get a free quote', alt: 'or call us today', rev: '4.9 from 86 Google reviews', img: 'assets/demo/trades.jpg' },
    cafe: { kick: 'Café · Dublin', head: 'Good coffee. Better mornings.', sub: 'Fresh bakes every day, and a proper flat white from 7am.', cta: 'See the menu', alt: 'or find us on the map', rev: '4.8 from 212 Google reviews', img: 'assets/demo/cafe.jpg' },
    salon: { kick: 'Hair salon · Dublin', head: 'Hair that feels like you.', sub: 'Cuts, colour and care in a calm, friendly salon.', cta: 'Book an appointment', alt: 'or call us today', rev: '4.9 from 154 Google reviews', img: 'assets/demo/salon.jpg' },
    clinic: { kick: 'Physiotherapy · Dublin', head: 'Move better. Feel better.', sub: 'Chartered physiotherapists, with appointments this week.', cta: 'Book a session', alt: 'or call us today', rev: '5.0 from 97 Google reviews', img: 'assets/demo/clinic.jpg' }
  };
  const trySec = $('#try');
  const mock = $('.mock');
  const nameIn = $('#demo-name');
  const holdBtn = $('#hold');
  const holdLabel = $('.hold-label');
  const stepsLi = $$('.steps-list li');
  const done = $('.try-done');
  const tImg = $('.t-img', mock);
  const DEFAULT_NAME = 'Murphy & Sons';

  function currentName() { return (nameIn.value || '').trim() || DEFAULT_NAME; }
  function applyName() {
    const n = currentName();
    $$('.m-name', mock).forEach(el => { el.textContent = n; });
    $('.m-slug', mock).textContent = n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '') || 'yourbusiness';
    $('.dn', done).textContent = n;
  }
  function applyTrade(key) {
    const d = DEMO[key] || DEMO.trades;
    mock.dataset.trade = key;
    $('.t-kick', mock).textContent = d.kick;
    $('.t-head', mock).textContent = d.head;
    $('.t-sub', mock).textContent = d.sub;
    $('.t-cta', mock).textContent = d.cta;
    $('.t-alt', mock).textContent = d.alt;
    $('.t-rev', mock).textContent = d.rev;
    if (!tImg.src.endsWith(d.img)) {
      tImg.style.opacity = 0;
      tImg.onload = () => { tImg.style.opacity = 1; };
      tImg.src = d.img;
    }
  }
  nameIn.addEventListener('input', applyName);
  $$('input[name="trade"]').forEach(r => r.addEventListener('change', () => applyTrade(r.value)));

  let hp = 0, holding = false, hRaf = null, hLast = 0, isDone = false, autoPinned = false, stageNow = -1;
  const HOLD_MS = 2600, BACK_MS = 1300;
  function setStage(s) {
    if (s === stageNow) return;
    stageNow = s;
    mock.dataset.stage = s;
    stepsLi.forEach((li, i) => li.classList.toggle('on', i < s));
  }
  function stageFor(p) { return p < 0.06 ? 0 : Math.min(5, 1 + Math.floor(((p - 0.06) / 0.94) * 5)); }
  function hTick(now) {
    const dt = Math.min(64, now - (hLast || now));
    hLast = now;
    hp = clamp(hp + (holding ? dt / HOLD_MS : -dt / BACK_MS), 0, 1);
    holdBtn.style.setProperty('--p', hp.toFixed(3));
    setStage(stageFor(hp));
    if (hp >= 1) { hRaf = null; hLast = 0; complete(false); return; }
    if (!holding && hp <= 0) { hRaf = null; hLast = 0; return; }
    hRaf = requestAnimationFrame(hTick);
  }
  function startHold() {
    if (isDone) return;
    if (reduced()) { complete(false); return; }
    holding = true;
    if (hRaf === null) hRaf = requestAnimationFrame(hTick);
  }
  function endHold() {
    if (!holding) return;
    holding = false;
    if (hRaf === null && !isDone && hp > 0) hRaf = requestAnimationFrame(hTick);
  }
  function complete(pinned) {
    isDone = true;
    autoPinned = pinned;
    holding = false;
    hp = 1;
    holdBtn.style.setProperty('--p', 1);
    setStage(5);
    trySec.setAttribute('data-done', '');
    done.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => done.classList.add('show')));
  }
  function resetDemo() {
    isDone = false;
    autoPinned = false;
    hp = 0;
    holdBtn.style.setProperty('--p', 0);
    setStage(0);
    trySec.removeAttribute('data-done');
    done.classList.remove('show');
    done.hidden = true;
  }
  function setHoldLabel() { holdLabel.textContent = reduced() ? 'Show the redesign' : 'Hold to redesign'; }
  holdBtn.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { holdBtn.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
    startHold();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => holdBtn.addEventListener(t, endHold));
  holdBtn.addEventListener('contextmenu', e => e.preventDefault());
  holdBtn.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); }
  });
  holdBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endHold(); } });
  holdBtn.addEventListener('click', e => { if (reduced()) { e.preventDefault(); complete(false); } });
  $('#demo-reset').addEventListener('click', () => { resetDemo(); holdBtn.focus(); });
  $('#demo-cta').addEventListener('click', () => {
    const typed = (nameIn.value || '').trim();
    const biz = $('#f-business');
    if (typed && !biz.value) biz.value = typed;
    setTimeout(() => { const f = $('#lead-form input[name="name"]'); if (f) f.focus({ preventScroll: true }); }, reduced() ? 0 : 900);
  });
  applyName();
  setStage(0);
  setHoldLabel();

  /* =========================================================
     03 Selected work: the flythrough
     ========================================================= */
  const wall = $('.wall');
  const cards = $$('.wcard');
  const idx = $$('.wall-index li');
  const N = cards.length;
  const X = [-17, 16, -15, 17, -12];
  const Y = [-3, 4, -5, 3, -2];
  const RY = [9, -9, 8, -9, 7];
  const T0 = 0.35, TSPAN = N + 0.05;
  const cardCache = cards.map(() => ({ tf: '', op: -1 }));
  let wallOn = false, wallActive = -2;

  function wallProgress() {
    const range = wall.offsetHeight - innerHeight;
    return range > 0 ? clamp(-wall.getBoundingClientRect().top / range, 0, 1) : 0;
  }
  function updateWall() {
    if (!wallOn) return;
    const r = wall.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) return;
    const T = T0 + wallProgress() * TSPAN;
    let active = -1, best = 9;
    cards.forEach((c, i) => {
      const u = T - i;
      let z, o;
      if (u < 0) { z = -2600; o = 0; }
      else if (u < 1) { z = -2600 + easeOut(u) * 2450; o = smoothstep(u, 0, 0.4); }
      else if (u < 1.5) { z = -150 + ((u - 1) / 0.5) * 150; o = 1; }
      else if (u < 1.9) { const e = (u - 1.5) / 0.4; z = e * e * 1000; o = 1 - smoothstep(u, 1.5, 1.8); }
      else { z = 1000; o = 0; }
      if (u > 0.55 && u < 1.75 && Math.abs(u - 1.2) < best) { best = Math.abs(u - 1.2); active = i; }
      const ry = RY[i] * (1 - clamp(u - 0.5, 0, 1));
      const tf = `translate3d(${X[i]}vw,${Y[i]}vh,${z.toFixed(0)}px) rotateY(${ry.toFixed(2)}deg)`;
      const oo = Math.round(o * 100) / 100;
      const cc = cardCache[i];
      if (tf !== cc.tf) { cc.tf = tf; c.style.transform = tf; }
      if (oo !== cc.op) { cc.op = oo; c.style.opacity = oo; c.style.visibility = oo > 0.01 ? 'visible' : 'hidden'; }
    });
    if (active !== wallActive) {
      wallActive = active;
      cards.forEach((c, i) => c.classList.toggle('active', i === active));
      idx.forEach((li, i) => li.classList.toggle('on', i === active));
    }
  }
  function clearWall() {
    cards.forEach((c, i) => { c.style.transform = ''; c.style.opacity = ''; c.style.visibility = ''; c.classList.remove('active'); cardCache[i].tf = ''; cardCache[i].op = -1; });
    idx.forEach(li => li.classList.remove('on'));
    wallActive = -2;
  }
  $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const i = +a.dataset.jump;
    const range = wall.offsetHeight - innerHeight;
    const p = clamp((i + 1.2 - T0) / TSPAN, 0, 1);
    glide.to(wall.getBoundingClientRect().top + scrollY + p * range);
  }));

  /* =========================================================
     04 How it works: the line draws itself on scroll
     ========================================================= */
  const howTrack = $('.how-track');
  const howPath = $('.how-line path');
  let howLast = -1, pinned = false;
  function measureHow() {
    const fig = $('.step figure');
    if (fig) howTrack.style.setProperty('--img-h', fig.offsetHeight + 'px');
  }
  function updateHowLine() {
    const r = howTrack.getBoundingClientRect();
    if (!pinned && (r.bottom < 0 || r.top > innerHeight)) return;
    const prog = pinned ? 1 : clamp((innerHeight * 0.85 - r.top) / (r.height * 0.8), 0, 1);
    const v = Math.round(prog * 200) / 200;
    if (v !== howLast) { howLast = v; howPath.style.strokeDashoffset = (1 - v).toFixed(3); }
  }

  /* =========================================================
     06 FAQ accordion
     ========================================================= */
  $$('.qa-q').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.closest('.qa').classList.toggle('open', open);
  }));

  /* =========================================================
     07 The form: the one call to action
     ========================================================= */
  // DEPLOY STEP: paste the free form service endpoint here (for example https://formspree.io/f/xxxxxxx).
  // Until it is set, the button opens the visitor's email app with their message filled in.
  const FORM_ENDPOINT = '';
  const form = $('#lead-form');
  const status = $('.form-status', form);
  const MSG = {
    name: 'Please tell us your name.',
    business: "What's your business called?",
    email: 'Please check your email address.'
  };
  function setErr(input, msg) {
    const field = input.closest('.field');
    field.classList.toggle('bad', !!msg);
    $('.err', field).textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function validate() {
    let first = null;
    ['name', 'business', 'email'].forEach(n => {
      const el = form.elements[n];
      const v = el.value.trim();
      const bad = !v || (n === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
      setErr(el, bad ? MSG[n] : '');
      if (bad && !first) first = el;
    });
    if (first) first.focus();
    return !first;
  }
  ['name', 'business', 'email'].forEach(n => form.elements[n].addEventListener('input', e => {
    if (e.target.closest('.field').classList.contains('bad')) setErr(e.target, '');
  }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('err');
    if (!validate()) return;
    const data = new FormData(form);
    if (data.get('_gotcha')) return;
    const first = String(data.get('name')).trim().split(/\s+/)[0];
    if (!FORM_ENDPOINT) {
      const subject = `Website enquiry from ${data.get('business')}`;
      const body = [
        `Name: ${data.get('name')}`,
        `Business: ${data.get('business')}`,
        `Email: ${data.get('email')}`,
        `Phone: ${data.get('phone') || '-'}`,
        `Needs: ${data.get('need')}`,
        '',
        String(data.get('message') || '')
      ].join('\n');
      location.href = `mailto:info@sureclick.ie?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Your email app should open with your message ready. Just press send.';
      return;
    }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Form service said ' + res.status);
      $('.fd-name', form).textContent = first ? `, ${first}` : '';
      $('.form-done', form).hidden = false;
      form.classList.add('sent');
    } catch (_) {
      status.textContent = "That didn't send. Please email info@sureclick.ie or call 083 054 6973.";
      status.classList.add('err');
    } finally {
      btn.disabled = false;
    }
  });

  /* =========================================================
     One page-scroll frame for everything outside the hero
     ========================================================= */
  let pageTicking = false;
  function pageFrame() {
    pageTicking = false;
    const sc = scrollY > 40;
    if (sc !== navScrolled) { navScrolled = sc; nav.classList.toggle('scrolled', sc); }
    updateWall();
    updateHowLine();
  }
  function onPageScroll() { if (!pageTicking) { pageTicking = true; requestAnimationFrame(pageFrame); } }
  addEventListener('scroll', onPageScroll, { passive: true });
  addEventListener('resize', () => {
    sizeRings();
    measureHow();
    howLast = -1;
    heroResize();
    onPageScroll();
  });
  addEventListener('load', () => { measureHow(); onPageScroll(); });

  /* =========================================================
     Live modes: the gates re-evaluate on rotate, resize and preference flips
     ========================================================= */
  function applyHeroMode() {
    if (heroGated()) disableScrub(); else enableScrub();
    const w = !gated();
    if (w !== wallOn) { wallOn = w; if (!w) clearWall(); }
    onPageScroll();
  }
  function pinToFinalStates() {
    pinned = true;
    howLast = -1;
    updateHowLine();
    if (!isDone) complete(true);
    if (receiptTarget !== null) { receiptShown = true; receiptVal.textContent = receiptTarget.toFixed(2); receipt.benchNow(); }
    rings = [];
    setHoldLabel();
  }
  function unpinFinalStates() {
    pinned = false;
    howLast = -1;
    updateHowLine();
    if (autoPinned) resetDemo();
    setHoldLabel();
  }
  MQLS.forEach(m => onMQ(m, applyHeroMode));
  HERO_MQLS.forEach(m => onMQ(m, applyHeroMode));
  onMQ(RM, e => {
    applyGlide();
    if (e.matches) pinToFinalStates();
    else { unpinFinalStates(); applyHeroMode(); }
  });
  onMQ(FINE, applyGlide);

  measureHow();
  applyGlide();
  applyHeroMode();
  if (reduced()) pinToFinalStates();
  pageFrame();
})();
