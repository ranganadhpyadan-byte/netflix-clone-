import { h, icon } from '../dom.js';
import { navigate } from '../router.js';
import { artUrl, logoNode, renderScene } from '../art.js';
import { getSettings, setSettings, subscribe } from '../store.js';
import { openDetails } from './details.js';

const PREVIEW_DELAY_MS = 2000;
const SYNOPSIS_HIDE_AFTER_SEC = 8;
const MAX_DPR = 1.5;
const MAX_FRAME_STEP_SEC = 0.25;
const VISIBLE_RATIO = 0.15;

export function createHero(title) {
  const canvas = h('canvas', { class: 'hero-canvas', 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');

  const muteBtn = h('button', {
    class: 'icon-btn hero-mute',
    type: 'button',
    'aria-label': 'Mute previews',
    onClick: () => setSettings({ muted: !getSettings().muted }),
  });

  const el = h('section', { class: 'hero-root', 'aria-label': `Featured: ${title.name}` },
    h('div', { class: 'hero-media', style: { backgroundColor: title.palette[0] } },
      h('img', { class: 'hero-backdrop', src: artUrl(title, 'backdrop'), alt: '', decoding: 'async' }),
      canvas,
    ),
    h('div', { class: 'hero-scrim' }),
    h('div', { class: 'hero-content' },
      h('h1', { class: 'hero-logo', 'aria-label': title.name }, logoNode(title)),
      h('p', { class: 'hero-tagline' }, title.tagline),
      h('div', { class: 'hero-synopsis-wrap' },
        h('p', { class: 'hero-synopsis' }, title.synopsis),
      ),
      h('div', { class: 'hero-actions' },
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          onClick: () => navigate(`/watch/${encodeURIComponent(title.id)}`),
        }, icon('play', 22), 'Play'),
        h('button', {
          class: 'btn btn-secondary hero-info',
          type: 'button',
          onClick: () => openDetails(title.id),
        }, icon('info', 22), 'More Info'),
      ),
    ),
    h('div', { class: 'hero-side' },
      muteBtn,
      h('span', { class: 'hero-maturity' }, h('span', { class: 'sr-only' }, 'Rated '), title.maturity),
    ),
  );

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let destroyed = false;
  let failed = false;
  let inView = false;
  let started = false;       // the 2s delay has elapsed at least once
  let shown = false;         // the canvas has painted and is faded in
  let previewSec = 0;        // advances only while actually rendering
  let lastTs = null;
  let rafId = 0;
  let delayTimer = 0;
  let muted = null;

  const previewAllowed = () =>
    !failed && !!ctx && !motionQuery.matches && getSettings().autoplayPreviews !== false;

  function syncMute() {
    const next = !!getSettings().muted;
    if (next === muted) return;
    muted = next;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.replaceChildren(icon(muted ? 'volume-mute' : 'volume', 22));
  }

  function fitCanvas() {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!cssW || !cssH) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(cssW * dpr);
    const h2 = Math.round(cssH * dpr);
    // Assigning width or height wipes the bitmap, so only do it on a real change.
    if (canvas.width === w && canvas.height === h2) return false;
    canvas.width = w;
    canvas.height = h2;
    return true;
  }

  function draw() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    try {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      renderScene(ctx, title, previewSec, canvas.width, canvas.height);
      ctx.restore();
    } catch (err) {
      console.error('Hero preview stopped, keeping the backdrop.', err);
      failed = true;
      sync();
      return;
    }
    if (!shown) {
      shown = true;
      el.classList.add('hero-live');
    }
  }

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (lastTs !== null) previewSec += Math.min((ts - lastTs) / 1000, MAX_FRAME_STEP_SEC);
    lastTs = ts;
    draw();
    if (!failed && previewSec >= SYNOPSIS_HIDE_AFTER_SEC) el.classList.add('hero-synopsis-hidden');
  }

  function stopLoop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    lastTs = null;
  }

  function clearDelay() {
    clearTimeout(delayTimer);
    delayTimer = 0;
  }

  // Single source of truth for whether the preview should be running right now.
  function sync() {
    if (destroyed) return;
    if (!previewAllowed()) {
      stopLoop();
      clearDelay();
      shown = false;
      el.classList.remove('hero-live', 'hero-synopsis-hidden');
      return;
    }
    if (!inView || document.hidden) {
      stopLoop();
      clearDelay();
      return;
    }
    if (started) {
      if (!rafId) {
        fitCanvas();
        rafId = requestAnimationFrame(frame);
      }
    } else if (!delayTimer) {
      delayTimer = setTimeout(() => {
        delayTimer = 0;
        started = true;
        sync();
      }, PREVIEW_DELAY_MS);
    }
  }

  // Resizing clears the bitmap; repaint in the same tick so a paused or running preview never flashes.
  const resizeObserver = new ResizeObserver(() => {
    if (fitCanvas() && started && previewAllowed()) draw();
  });
  resizeObserver.observe(canvas);

  const intersectionObserver = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    inView = entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO;
    sync();
  }, { threshold: [0, VISIBLE_RATIO] });
  intersectionObserver.observe(el);

  document.addEventListener('visibilitychange', sync);
  motionQuery.addEventListener('change', sync);
  const unsubscribe = subscribe(() => {
    syncMute();
    sync();
  });

  syncMute();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    clearDelay();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', sync);
    motionQuery.removeEventListener('change', sync);
    unsubscribe();
    // Free the bitmap immediately rather than waiting on GC.
    canvas.width = 0;
    canvas.height = 0;
    el.remove();
  }

  return { el, destroy };
}
