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
     HERO: the scroll-scrubbed drop
     ========================================================= */
  const hero = $('.hero');
  const stage = $('.stage');
  const canvas = $('.hero-canvas');
  const poster = $('.poster');
  const posterEnd = $('.poster-end');
  const ring = $('.ring');
  const hud = $('.hud');
  const msEl = $('.hud .ms');
  const POSTER_URL = 'assets/hero-poster.jpg';

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
    [...el.childNodes].forEach(node => {
      const isEm = node.nodeType === 1 && node.tagName === 'EM';
      node.textContent.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { vis.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = isEm ? 'w em' : 'w';
        for (const ch of tok) {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          w.appendChild(c);
          chars.push(c);
        }
        vis.appendChild(w);
        words.push(w);
      });
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = full;
    el.textContent = '';
    el.append(sr, vis);

    if (fx === 'ripple') {
      const mid = (chars.length - 1) / 2 || 1;
      chars.forEach((c, i) => {
        const d = Math.abs(i - mid) / mid;
        c.style.setProperty('--th', (d * spread + r() * 0.04).toFixed(3));
        c.style.setProperty('--jx', ((mid - i) * 4.5).toFixed(1) + 'px');
      });
    } else {
      const span = fx === 'punch' ? 0.34 : 0.5;
      const n = words.length;
      words.forEach((w, i) => w.style.setProperty('--th', (n > 1 ? (i / (n - 1)) * span + r() * 0.02 : 0).toFixed(3)));
    }
  }
  bands.forEach((b, i) => {
    const head = $('.split', b.el);
    const fx = ([...b.el.classList].find(c => c.startsWith('fx-')) || 'fx-drift').slice(3);
    if (head) splitBand(head, 11 + i * 7, fx, +(b.el.dataset.spread || 0.45));
  });

  function heroProgress() {
    const range = hero.offsetHeight - innerHeight;
    if (range <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
  }

  /* Captions: opacity per band paced in scroll distance, assembly progress --k.
     Every DOM write is delta-gated. */
  let loadK = 0;
  let lastEnd = -1, hudOff = null, lastLabel = '', lastLabelAt = 0;

  function updateLabel(p, now, force) {
    const text = String(Math.round(clamp(p / 0.2, 0, 1) * 50)).padStart(2, '0') + ' ms';
    if (!force && now - lastLabelAt < 100) return;
    if (text === lastLabel) return;
    lastLabel = text;
    lastLabelAt = now;
    msEl.textContent = text;
  }

  function updateCaptions(p, now = performance.now(), force = false) {
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
    updateLabel(p, now, force);
    const off = p > 0.7;
    if (off !== hudOff) { hudOff = off; hud.classList.toggle('off', off); }
    if (filmFailed) {
      const e = Math.round(smoothstep(p, 0.4, 0.85) * 100) / 100;
      if (e !== lastEnd) { lastEnd = e; posterEnd.style.opacity = e; }
    }
  }

  /* The film as a frame sequence drawn to a canvas. Every frame is a still that is
     already downloaded, so the picture follows the scroll with no seek delay, and
     neighbouring frames blend so the motion is continuous between them. */
  const FRAMES = 273;
  const frameUrl = i => `assets/frames/v1/f${String(i + 1).padStart(3, '0')}.webp`;
  const imgs = new Array(FRAMES).fill(null);
  const loaded = new Uint8Array(FRAMES);
  const warmed = new Uint8Array(FRAMES);
  const ctx2 = canvas.getContext('2d', { alpha: false });
  let cw = 0, ch = 0, drawnF = -1, lastIdx = -1, lastF = 0;
  let framesReady = false, filmFailed = false, framesStarted = false;
  let loadedCount = 0, failedCount = 0, lastRing = 0, lastLoadAt = 0;

  function sizeCanvas() {
    const r = stage.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1920 / Math.max(1, r.width), 2);
    const w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
    if (w !== cw || h !== ch) { cw = canvas.width = w; ch = canvas.height = h; drawnF = -1; }
  }
  function nearestLoaded(i) {
    if (loaded[i]) return i;
    for (let d = 1; d < FRAMES; d++) {
      if (i - d >= 0 && loaded[i - d]) return i - d;
      if (i + d < FRAMES && loaded[i + d]) return i + d;
    }
    return -1;
  }
  function blit(img, alpha) {
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx2.globalAlpha = alpha;
    ctx2.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }
  // Decode the next few frames in the direction of travel before they are needed.
  function warm(i, dir) {
    for (let d = 1; d <= 6; d++) {
      const j = i + d * dir;
      if (j < 0 || j >= FRAMES || !loaded[j] || warmed[j]) continue;
      warmed[j] = 1;
      imgs[j].decode().catch(() => { warmed[j] = 0; });
    }
  }
  function drawFrame(f, force) {
    if (!framesReady) return;
    f = clamp(f, 0, FRAMES - 1);
    if (!force && Math.abs(f - drawnF) < 0.002) return;
    const i0 = Math.floor(f), a = f - i0, i1 = Math.min(FRAMES - 1, i0 + 1);
    const base = nearestLoaded(i0);
    if (base < 0) return;
    blit(imgs[base], 1);
    if (a > 0.004 && base === i0 && i1 !== i0 && loaded[i1]) blit(imgs[i1], a);
    ctx2.globalAlpha = 1;
    drawnF = f;
    const idx = Math.round(f);
    if (idx !== lastIdx) { lastIdx = idx; stage.dataset.frame = idx; warm(idx, f >= lastF ? 1 : -1); }
    lastF = f;
  }

  /* Coarse to fine: the ends and every 32nd and 16th frame first, so the scrub works
     within moments, then the gaps fill in. The ring reports real progress, and a
     stall before the first pass lands falls back to the still-image journey. */
  function startFrames() {
    if (framesStarted) return;
    framesStarted = true;
    const order = [], seen = new Uint8Array(FRAMES);
    const push = i => { if (i >= 0 && i < FRAMES && !seen[i]) { seen[i] = 1; order.push(i); } };
    push(0); push(FRAMES - 1);
    for (let i = 0; i < FRAMES; i += 32) push(i);
    for (let i = 0; i < FRAMES; i += 16) push(i);
    const readyCount = order.length;
    for (const s of [8, 4, 2, 1]) for (let i = 0; i < FRAMES; i += s) push(i);
    let next = 0, active = 0;
    lastLoadAt = performance.now();
    const settle = () => {
      if (loadedCount + failedCount < FRAMES) return;
      ring.style.setProperty('--ld', 0);
      stage.classList.add('film-loaded');
      if (!framesReady) { if (loadedCount) makeReady(); else failFilm(); }
    };
    const pump = () => {
      while (active < 6 && next < order.length) {
        const i = order[next++];
        active++;
        const img = new Image();
        img.decoding = 'async';
        if ('fetchPriority' in img) img.fetchPriority = 'low';
        img.onload = () => {
          imgs[i] = img; loaded[i] = 1; loadedCount++; active--;
          lastLoadAt = performance.now();
          if (lastLoadAt - lastRing > 100) { lastRing = lastLoadAt; ring.style.setProperty('--ld', Math.round(126 * (1 - loadedCount / FRAMES))); }
          if (!framesReady && loadedCount >= readyCount) makeReady();
          else if (framesReady && Math.abs(i - fd) <= 1.5) drawFrame(fd, true);
          pump(); settle();
        };
        img.onerror = () => { failedCount++; active--; pump(); settle(); };
        img.src = frameUrl(i);
      }
    };
    pump();
    const watch = () => {
      if (framesReady || filmFailed) return;
      if (performance.now() - lastLoadAt > 20000) failFilm(); else setTimeout(watch, 2000);
    };
    setTimeout(watch, 2000);
  }
  function makeReady() {
    if (framesReady || filmFailed) return;
    framesReady = true;
    sizeCanvas();
    drawFrame(fd, true);
    stage.classList.add('film-ready');
    onScroll();
  }
  function failFilm() {
    if (filmFailed || framesReady) return;
    filmFailed = true;
    ring.style.display = 'none';
    stage.classList.add('film-failed');
    posterEnd.style.backgroundImage = "url('assets/hero-ending.jpg')";
    updateCaptions(shown, performance.now(), true);
  }

  /* Two eases, one loop that rests. The film's progress trails the gliding page,
     and when everything stops the picture settles onto the nearest whole frame. */
  let target = 0, shown = 0, fd = 0, rafId = null, lastTick = 0, heroOnScreen = true, scrubOn = false;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const ease = n => 1 - Math.pow(1 - n, dt / 16.667);
    shown += (target - shown) * ease(0.1);
    const resting = Math.abs(target - shown) < 0.0005;
    if (resting) shown = target;
    const goal = resting ? Math.round(shown * (FRAMES - 1)) : shown * (FRAMES - 1);
    fd += (goal - fd) * ease(resting ? 0.18 : 0.5);
    const settled = resting && Math.abs(goal - fd) < 0.01;
    if (settled) fd = goal;
    drawFrame(fd);
    updateCaptions(shown, now, settled);
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

  function startLoadRamp() {
    let t0 = 0;
    const step = now => {
      if (!t0) t0 = now;
      loadK = easeOut(clamp((now - t0) / 1500, 0, 1));
      updateCaptions(shown, now, true);
      if (loadK < 1) requestAnimationFrame(step);
    };
    let went = false;
    const go = () => { if (!went) { went = true; requestAnimationFrame(step); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    setTimeout(go, 900);
  }

  // The poster and the page win the bandwidth race: frames start once the poster has
  // painted (or failed) and the page itself has finished loading.
  let heroInit = false;
  function initHeroOnce() {
    if (heroInit) return;
    heroInit = true;
    poster.style.backgroundImage = `url('${POSTER_URL}')`;
    const afterLoad = () => (document.readyState === 'complete' ? setTimeout(startFrames, 0) : addEventListener('load', () => setTimeout(startFrames, 0), { once: true }));
    const img = new Image();
    img.onload = afterLoad;
    img.onerror = afterLoad;
    img.src = POSTER_URL;
    setTimeout(startFrames, 5000);
    startLoadRamp();
  }

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    initHeroOnce();
    addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.vis = undefined; b.cta = null; });
    hudOff = null; lastLabel = ''; lastEnd = -1;
    target = shown = heroProgress();
    fd = shown * (FRAMES - 1);
    if (framesReady) { sizeCanvas(); drawFrame(fd, true); }
    updateCaptions(shown, performance.now(), true);
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
  }

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
    if (scrubOn) { sizeCanvas(); drawFrame(fd, true); onScroll(); }
    onPageScroll();
  });
  addEventListener('load', () => { measureHow(); onPageScroll(); });

  /* =========================================================
     Live modes: the gates re-evaluate on rotate, resize and preference flips
     ========================================================= */
  function applyHeroMode() {
    if (gated()) disableScrub(); else enableScrub();
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
