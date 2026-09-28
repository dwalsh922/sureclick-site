/* SureClick service pages: the homepage's calm parts without the hero engine.
   Reveals, the nav, the mobile menu, the FAQ, and links that never write #section. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A refresh always starts at the top of the page.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  addEventListener('hashchange', () => history.replaceState(null, '', location.pathname + location.search));

  // Reveals, and living elements only while their section is on screen.
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    revealIO.unobserve(el);
    setTimeout(() => el.classList.add('settled'), 1200 + $$('.rc', el).length * 110);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  $$('.rv').forEach(el => revealIO.observe(el));
  const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec').forEach(s => liveIO.observe(s));
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  // Drifting specks in the background, same seed as the homepage.
  (function specks() {
    const box = $('.env-specks');
    if (!box) return;
    let s = 7 >>> 0;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('i');
      el.className = 'speck';
      el.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--y:${(38 + r() * 70).toFixed(1)}%;--s:${(1.4 + r() * 2.2).toFixed(1)}px;--d:${(38 + r() * 42).toFixed(1)}s;--dl:-${(r() * 70).toFixed(1)}s;--dx:${((r() - 0.5) * 70).toFixed(0)}px`;
      box.appendChild(el);
    }
  })();

  // Nav background once the page has scrolled.
  const nav = $('.nav');
  let scrolled = null;
  const onScroll = () => { const v = scrollY > 40; if (v !== scrolled) { scrolled = v; nav.classList.toggle('scrolled', v); } };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu.
  const menuBtn = $('.menu-btn');
  const menu = $('#mobile-menu');
  let menuOpen = false;
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

  // Same-page links scroll smoothly without writing #section into the address bar.
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    e.preventDefault();
    scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY : 0, behavior: reduced() ? 'auto' : 'smooth' });
  });

  // FAQ accordion.
  $$('.qa-q').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.closest('.qa').classList.toggle('open', open);
  }));
})();
