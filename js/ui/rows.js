import { h, icon, formatRuntime } from '../dom.js';
import { navigate } from '../router.js';
import { artUrl } from '../art.js';
import { openDetails } from './details.js';
import { getProgress, isInList, toggleList, getRating, setRating, subscribe } from '../store.js';

const OPEN_DELAY = 400;
const CLOSE_GRACE = 120;
const EDGE = 8;
const RATINGS = [
  { value: 'down', icon: 'thumb-down', label: 'Not for me', state: 'not for me' },
  { value: 'up', icon: 'thumb-up', label: 'I like this', state: 'liked' },
  { value: 'love', icon: 'heart', label: 'Love this', state: 'loved' },
];

const hoverQuery = window.matchMedia('(hover: hover)');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function scrollBehavior() {
  return motionQuery.matches ? 'auto' : 'smooth';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resumePath(id) {
  const saved = getProgress(id);
  if (saved && saved.season != null && saved.episode != null) {
    return `/watch/${id}?s=${saved.season}&e=${saved.episode}`;
  }
  return `/watch/${id}`;
}

function lengthLabel(title) {
  const count = title.seasons ? title.seasons.length : 0;
  if (title.type === 'series' && count) return count === 1 ? '1 Season' : `${count} Seasons`;
  return formatRuntime(title.runtimeMin);
}

function comingLabel(title) {
  const date = new Date(title.comingSoon);
  if (Number.isNaN(date.getTime())) return 'Coming soon';
  return `Coming ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

/* The single hover popover. Everything below is module state on purpose: only one can exist. */

let active = null;
let openTimer = 0;
let closeTimer = 0;

function cancelOpen() {
  clearTimeout(openTimer);
  openTimer = 0;
}

function cancelClose() {
  clearTimeout(closeTimer);
  closeTimer = 0;
}

function scheduleClose() {
  cancelClose();
  closeTimer = setTimeout(dismissPopover, CLOSE_GRACE);
}

function dismissPopover() {
  cancelOpen();
  cancelClose();
  if (!active) return;
  const { root, button, el, unsubscribe, observer } = active;
  const hadFocus = el.contains(document.activeElement);
  active = null;
  observer.disconnect();
  unsubscribe();
  el.remove();
  if (hadFocus && root.isConnected) button.focus({ preventScroll: true });
}

function hoverAllowed(root) {
  if (!hoverQuery.matches) return false;
  // A popover sits below the modal layer, so it must not open from cards inside the details dialog.
  if (document.body.classList.contains('scroll-locked')) return false;
  return !root.closest('dialog, [aria-modal="true"]');
}

function buildRating(title) {
  const trigger = h('button', {
    type: 'button',
    class: 'icon-btn card-pop-btn card-rate-trigger',
    'aria-haspopup': 'true',
    'aria-expanded': 'false',
  });
  const options = RATINGS.map((rating) => h('button', {
    type: 'button',
    class: 'card-rate-opt',
    'aria-label': `${rating.label}: ${title.name}`,
    onClick: (event) => {
      event.stopPropagation();
      setRating(title.id, getRating(title.id) === rating.value ? null : rating.value);
      refresh();
    },
  }, icon(rating.icon, 20)));
  const menu = h('div', { class: 'card-rate-menu', hidden: true },
    h('div', { class: 'card-rate-pill', role: 'group', 'aria-label': `Rate ${title.name}` }, options));
  const wrap = h('div', { class: 'card-rate' }, menu, trigger);

  function setOpen(open) {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  }

  function refresh() {
    const current = getRating(title.id);
    const rated = RATINGS.find((rating) => rating.value === current);
    trigger.replaceChildren(icon(rated ? rated.icon : 'thumb-up', 20));
    trigger.classList.toggle('card-rated', Boolean(rated));
    trigger.setAttribute('aria-label', rated
      ? `Rate ${title.name}, currently ${rated.state}`
      : `Rate ${title.name}`);
    RATINGS.forEach((rating, index) => {
      options[index].setAttribute('aria-pressed', String(rating.value === current));
    });
  }

  trigger.addEventListener('click', (event) => {
    // detail is 0 for keyboard activation. A mouse has already opened the menu by hovering.
    setOpen(event.detail === 0 ? menu.hidden : true);
  });
  wrap.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') setOpen(true);
  });
  wrap.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !wrap.contains(document.activeElement)) setOpen(false);
  });
  wrap.addEventListener('focusout', (event) => {
    if (!wrap.contains(event.relatedTarget) && !wrap.matches(':hover')) setOpen(false);
  });
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.stopPropagation();
      setOpen(false);
      trigger.focus();
    }
  });

  refresh();
  return { el: wrap, refresh };
}

function buildPopover(title, root, button, activate) {
  const coming = Boolean(title.comingSoon);
  const listButton = h('button', {
    type: 'button',
    class: 'icon-btn card-pop-btn',
    onClick: () => {
      toggleList(title.id);
      refreshList();
    },
  });

  function refreshList() {
    const inList = isInList(title.id);
    listButton.replaceChildren(icon(inList ? 'check' : 'plus', 20));
    listButton.setAttribute('aria-label', `${inList ? 'Remove' : 'Add'} ${title.name} ${inList ? 'from' : 'to'} My List`);
  }

  const rating = buildRating(title);
  refreshList();

  const art = h('button', {
    type: 'button',
    class: 'card-pop-art',
    'aria-label': button.getAttribute('aria-label'),
    onClick: activate,
  }, h('img', { src: artUrl(title, 'card'), alt: '', draggable: false }));

  const actions = h('div', { class: 'card-pop-actions' },
    !coming && h('button', {
      type: 'button',
      class: 'icon-btn card-pop-btn card-pop-play',
      'aria-label': `Play ${title.name}`,
      onClick: () => {
        const path = resumePath(title.id);
        dismissPopover();
        navigate(path);
      },
    }, icon('play', 20)),
    listButton,
    rating.el,
    h('button', {
      type: 'button',
      class: 'icon-btn card-pop-btn card-pop-more',
      'aria-label': `More details about ${title.name}`,
      onClick: () => {
        dismissPopover();
        openDetails(title.id);
      },
    }, icon('chevron-down', 20)));

  const el = h('div', { class: 'card-pop', role: 'group', 'aria-label': title.name },
    art,
    h('div', { class: 'card-pop-body' },
      actions,
      h('div', { class: 'card-pop-meta' },
        coming
          ? h('span', { class: 'card-pop-coming' }, comingLabel(title))
          : h('span', { class: 'match' }, `${title.match}% Match`),
        h('span', { class: 'badge' }, title.maturity),
        h('span', {}, lengthLabel(title))),
      h('ul', { class: 'card-pop-moods' },
        (title.moods || []).slice(0, 3).map((mood) => h('li', {}, mood)))));

  el.addEventListener('pointerenter', cancelClose);
  el.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') scheduleClose();
  });
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...el.querySelectorAll('button')].filter((item) => item.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      button.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      // Hand focus back so the browser's Tab continues on to the next card.
      dismissPopover();
    }
  });

  return {
    el,
    refresh() {
      refreshList();
      rating.refresh();
    },
  };
}

function showPopover(title, root, button, activate) {
  dismissPopover();
  if (!root.isConnected || !hoverAllowed(root)) return;

  const rect = root.getBoundingClientRect();
  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = window.innerHeight;
  const width = Math.min(clamp(rect.width * 1.45, 280, 460), viewWidth - EDGE * 2);
  const { el, refresh } = buildPopover(title, root, button, activate);
  el.style.width = `${width}px`;
  el.style.visibility = 'hidden';
  document.body.append(el);

  const height = el.offsetHeight;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const left = clamp(centerX - width / 2, EDGE, viewWidth - width - EDGE);
  const top = Math.max(EDGE, Math.min(centerY - (width * 9) / 32, viewHeight - height - EDGE));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.transformOrigin = `${centerX - left}px ${centerY - top}px`;
  el.style.setProperty('--card-from', String(rect.width / width));
  el.style.visibility = '';

  const observer = new MutationObserver(() => {
    if (active && !active.root.isConnected) dismissPopover();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  active = { root, button, el, unsubscribe: subscribe(refresh), observer };
}

window.addEventListener('scroll', () => {
  if (active || openTimer) dismissPopover();
}, { capture: true, passive: true });
window.addEventListener('hashchange', dismissPopover);
window.addEventListener('resize', dismissPopover);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && (active || openTimer)) dismissPopover();
});

export function createCard(title, opts = {}) {
  const { ranked = false, rank = null, progress = false } = opts;
  const saved = progress ? getProgress(title.id) : null;
  const percent = saved && saved.durationSec > 0
    ? clamp((saved.positionSec / saved.durationSec) * 100, 0, 100)
    : null;

  let label = title.name;
  if (ranked && rank) label = `Number ${rank}: ${label}`;
  if (saved) label = `Resume ${label}${percent !== null ? `, ${Math.round(percent)}% watched` : ''}`;

  function activate() {
    const resume = progress && getProgress(title.id);
    const path = resume ? resumePath(title.id) : null;
    dismissPopover();
    if (path) navigate(path);
    else openDetails(title.id);
  }

  const image = h('img', {
    class: 'card-art',
    src: artUrl(title, ranked ? 'poster' : 'card'),
    alt: '',
    loading: 'lazy',
    decoding: 'async',
  });
  image.draggable = false;

  const button = h('button', {
    type: 'button',
    class: 'card-btn',
    'aria-label': label,
    style: { backgroundColor: title.palette ? title.palette[0] : '' },
    onClick: activate,
  },
  image,
  saved && h('span', { class: 'card-resume' }, icon('play', 20)),
  percent !== null && h('span', { class: 'card-progress' },
    h('span', { class: 'card-progress-fill', style: { width: `${percent}%` } })));

  const root = h('div', { class: `card-root${ranked ? ' card-ranked' : ''}` },
    ranked && rank && h('span', {
      class: `card-rank${rank > 9 ? ' card-rank-wide' : ''}`,
      'aria-hidden': 'true',
    }, String(rank)),
    button);

  root.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || event.buttons) return;
    if (active && active.root === root) {
      cancelClose();
      return;
    }
    if (!hoverAllowed(root)) return;
    cancelOpen();
    openTimer = setTimeout(() => {
      openTimer = 0;
      showPopover(title, root, button, activate);
    }, OPEN_DELAY);
  });
  root.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    cancelOpen();
    if (active && active.root === root && !active.el.contains(event.relatedTarget)) scheduleClose();
  });
  root.addEventListener('pointerdown', cancelOpen);
  button.addEventListener('keydown', (event) => {
    // The popover lives at the end of body, so bridge Tab from its card into it.
    if (event.key === 'Tab' && !event.shiftKey && active && active.root === root) {
      const target = active.el.querySelector('.card-pop-body button');
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }
  });

  return root;
}

export function createGrid(items) {
  return h('ul', { class: 'card-grid' },
    (items || []).filter(Boolean).map((title) => h('li', { class: 'card-grid-item' }, createCard(title))));
}

let rowCounter = 0;

export function createRow({ title, items, ranked = false, progress = false }) {
  const list = (items || []).filter(Boolean);
  const headingId = `row-heading-${++rowCounter}`;

  const track = h('ul', { class: 'row-track', 'aria-labelledby': headingId },
    list.map((item, index) => h('li', { class: 'row-item' },
      createCard(item, { ranked, rank: ranked ? index + 1 : null, progress }))));
  const bars = h('div', { class: 'row-bars', 'aria-hidden': 'true' });
  const prev = h('button', {
    type: 'button',
    class: 'row-nav row-nav-prev',
    'aria-label': `Previous page of ${title}`,
    onClick: () => goTo(page === 0 ? pages - 1 : page - 1),
  }, icon('chevron-left', 28));
  const next = h('button', {
    type: 'button',
    class: 'row-nav row-nav-next',
    'aria-label': `Next page of ${title}`,
    onClick: () => goTo(page === pages - 1 ? 0 : page + 1),
  }, icon('chevron-right', 28));

  const root = h('section', {
    class: `row-root${ranked ? ' row-ranked' : ''}`,
    'aria-labelledby': headingId,
    hidden: !list.length,
  },
  h('div', { class: 'row-head' }, h('h2', { class: 'row-title', id: headingId }, title), bars),
  h('div', { class: 'row-viewport' }, prev, track, next));

  let page = 0;
  let pages = 1;
  let perPage = 1;
  let settling = false;
  let settleTimer = 0;
  let settleLeft = 0;
  let settleDeadline = 0;
  let frame = 0;

  function stride() {
    const first = track.firstElementChild;
    if (!first) return 1;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.getBoundingClientRect().width + gap || 1;
  }

  function maxScroll() {
    return Math.max(0, track.scrollWidth - track.clientWidth);
  }

  function pageFromScroll() {
    const max = maxScroll();
    if (max > 0 && track.scrollLeft >= max - 2) return pages - 1;
    return clamp(Math.round(track.scrollLeft / (perPage * stride())), 0, pages - 1);
  }

  function paint() {
    [...bars.children].forEach((bar, index) => bar.classList.toggle('row-bar-on', index === page));
  }

  function settle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      // Scroll events can stall on a busy page, so keep the target page until the scroll arrives.
      if (Math.abs(track.scrollLeft - settleLeft) > 2 && performance.now() < settleDeadline) {
        settle();
        return;
      }
      settling = false;
      page = pageFromScroll();
      paint();
    }, 180);
  }

  function goTo(target) {
    page = target;
    settling = true;
    settleLeft = Math.min(target * perPage * stride(), maxScroll());
    settleDeadline = performance.now() + 2000;
    paint();
    track.scrollTo({ left: settleLeft, behavior: scrollBehavior() });
    settle();
  }

  function measure() {
    if (!track.clientWidth) return;
    const count = parseInt(getComputedStyle(track).getPropertyValue('--row-count'), 10) || 1;
    const nextPages = Math.max(1, Math.ceil(list.length / count));
    perPage = count;
    if (nextPages !== pages || bars.children.length !== (nextPages > 1 ? nextPages : 0)) {
      pages = nextPages;
      bars.replaceChildren(...(pages > 1
        ? Array.from({ length: pages }, () => h('span', { class: 'row-bar' }))
        : []));
    }
    root.classList.toggle('row-single', pages <= 1);
    page = pageFromScroll();
    paint();
  }

  track.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (settling) {
        settle();
        return;
      }
      page = pageFromScroll();
      paint();
    });
  }, { passive: true });

  if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(track);

  track.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const cards = [...track.querySelectorAll('.card-btn')];
    const index = cards.indexOf(event.target);
    if (index < 0) return;
    let target = -1;
    if (event.key === 'ArrowRight') target = (index + 1) % cards.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + cards.length) % cards.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = cards.length - 1;
    if (target < 0) return;
    event.preventDefault();
    cards[target].focus();
  });

  /* Touch uses native scrolling. Only a mouse needs drag handling. */
  let drag = null;
  let suppressClick = false;

  function endDrag() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    track.removeEventListener('pointermove', onDragMove);
    track.removeEventListener('pointerup', endDrag);
    track.removeEventListener('pointercancel', endDrag);
    if (!moved) return;
    root.classList.remove('row-dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const step = stride();
    track.scrollTo({
      left: Math.min(Math.round(track.scrollLeft / step) * step, maxScroll()),
      behavior: scrollBehavior(),
    });
  }

  function onDragMove(event) {
    // A release outside the row never reaches pointerup, so check the button is still held.
    if (!(event.buttons & 1)) {
      endDrag();
      return;
    }
    const distance = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(distance) < 6) return;
      drag.moved = true;
      root.classList.add('row-dragging');
      track.setPointerCapture(event.pointerId);
      dismissPopover();
    }
    track.scrollLeft = drag.left - distance;
  }

  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: track.scrollLeft, moved: false };
    settling = false;
    clearTimeout(settleTimer);
    track.addEventListener('pointermove', onDragMove);
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
  });
  track.addEventListener('click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  track.addEventListener('dragstart', (event) => event.preventDefault());

  return root;
}
