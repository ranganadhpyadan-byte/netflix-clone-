import { formatRuntime, h, icon, slugify } from '../dom.js';
import { navigate } from '../router.js';
import { getSimilar, getTitle, isKidsSafe } from '../data/catalog.js';
import { artUrl, logoNode } from '../art.js';
import {
  getActiveProfile,
  getProgress,
  getRating,
  isInList,
  setRating,
  subscribe,
  toggleList,
} from '../store.js';

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FINISHED_AT = 0.95;
const SIMILAR_COUNT = 12;
const RATINGS = [
  { value: 'down', iconName: 'thumb-down', label: 'Not for me' },
  { value: 'up', iconName: 'thumb-up', label: 'I like this' },
  { value: 'love', iconName: 'heart', label: 'Love this' },
];

// The one open modal, or null. Holds everything closeDetails has to undo.
let modal = null;

export function openDetails(id) {
  if (!modal) mount();
  showTitle(id);
}

export function closeDetails() {
  if (!modal) return;
  const { overlay, opener, inerted, unsubscribe, bodyPadding } = modal;
  modal = null;
  document.removeEventListener('keydown', onKeydown, true);
  unsubscribe();
  inerted.forEach((el) => { el.inert = false; });
  overlay.remove();
  document.body.classList.remove('scroll-locked');
  document.body.style.paddingRight = bodyPadding;
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
}

function mount() {
  const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : null;

  const content = h('div', { class: 'dt-content' });
  const panel = h('div', {
    class: 'dt-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'dt-title',
    tabindex: '-1',
  },
    h('div', { class: 'dt-close-wrap' },
      h('button', {
        class: 'icon-btn dt-close',
        type: 'button',
        'aria-label': 'Close details',
        onclick: closeDetails,
      }, icon('x', 22))),
    content);

  let pressStartedOnBackdrop = false;
  const overlay = h('div', {
    class: 'dt-overlay',
    onpointerdown: (event) => {
      // A press on the overlay's own scrollbar also targets the overlay, so it is excluded by position.
      pressStartedOnBackdrop = event.target === overlay && event.clientX < overlay.clientWidth;
    },
    onclick: (event) => {
      if (event.target === overlay && pressStartedOnBackdrop) closeDetails();
    },
  }, panel);

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  const bodyPadding = document.body.style.paddingRight;
  const inerted = [...document.body.children].filter((el) => !el.inert);
  inerted.forEach((el) => { el.inert = true; });
  document.body.append(overlay);
  document.body.classList.add('scroll-locked');
  if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  document.addEventListener('keydown', onKeydown, true);

  modal = {
    overlay,
    panel,
    content,
    opener,
    inerted,
    bodyPadding,
    sync: () => {},
    unsubscribe: subscribe(() => modal && modal.sync()),
  };
}

function onKeydown(event) {
  if (!modal) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeDetails();
    return;
  }
  if (event.key !== 'Tab') return;

  const { panel } = modal;
  const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
  if (!items.length) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!panel.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function showTitle(id) {
  const title = getTitle(id);
  const syncers = [];
  modal.content.replaceChildren(...(title ? buildTitle(title, syncers) : buildMissing()));
  modal.sync = () => syncers.forEach((fn) => fn());
  modal.sync();
  modal.overlay.scrollTop = 0;
  modal.panel.focus({ preventScroll: true });
}

function buildMissing() {
  return [
    h('div', { class: 'dt-missing' },
      h('h2', { id: 'dt-title' }, 'This title is not available'),
      h('p', {}, 'It may have left the catalog. Try browsing for something similar.')),
  ];
}

function buildTitle(title, syncers) {
  const upcoming = Boolean(title.comingSoon);
  return [
    buildHero(title, syncers),
    h('div', { class: 'dt-body' },
      buildOverview(title),
      title.type === 'series' && !upcoming && title.seasons.length > 0 ? buildEpisodes(title) : null,
      buildSimilar(title),
      buildAbout(title)),
  ];
}

/* Hero */

function buildHero(title, syncers) {
  return h('div', { class: 'dt-hero' },
    h('img', { class: 'dt-hero-art', src: artUrl(title, 'backdrop'), alt: '' }),
    h('div', { class: 'dt-hero-fade' }),
    h('div', { class: 'dt-hero-inner' },
      h('h2', { id: 'dt-title', class: 'sr-only' }, title.name),
      h('div', { class: 'dt-logo', 'aria-hidden': 'true' }, logoNode(title)),
      title.comingSoon ? buildUpcomingActions(title, syncers) : buildActions(title, syncers)));
}

function buildActions(title, syncers) {
  const target = playTarget(title);
  return h('div', { class: 'dt-actions-wrap' },
    target.fraction > 0 ? buildResumeProgress(target) : null,
    h('div', { class: 'dt-actions' },
      h('button', {
        class: 'btn btn-primary dt-play',
        type: 'button',
        onclick: () => watch(title, target.season, target.episode),
      }, icon('play', 22), target.label),
      buildListButton(title, syncers),
      buildRating(title, syncers)));
}

function buildResumeProgress(target) {
  const left = Math.max(1, Math.ceil(target.secondsLeft / 60));
  return h('div', { class: 'dt-resume' },
    h('span', { class: 'dt-bar' }, h('span', { class: 'dt-bar-fill', style: { width: toPercent(target.fraction) } })),
    h('span', { class: 'dt-resume-text' }, `${formatRuntime(left)} left`));
}

function buildListButton(title, syncers) {
  const button = h('button', { class: 'icon-btn dt-action-btn', type: 'button', onclick: () => toggleList(title.id) });
  syncers.push(() => {
    const inList = isInList(title.id);
    const label = inList ? 'Remove from My List' : 'Add to My List';
    button.replaceChildren(icon(inList ? 'check' : 'plus', 22));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(inList));
  });
  return button;
}

function buildRating(title, syncers) {
  const buttons = RATINGS.map(({ value, iconName, label }) => {
    const button = h('button', {
      class: 'icon-btn dt-action-btn dt-rate',
      type: 'button',
      'aria-label': label,
      title: label,
      onclick: () => setRating(title.id, getRating(title.id) === value ? null : value),
    }, icon(iconName, 20));
    syncers.push(() => button.setAttribute('aria-pressed', String(getRating(title.id) === value)));
    return button;
  });
  return h('div', { class: 'dt-rating', role: 'group', 'aria-label': `Rate ${title.name}` }, buttons);
}

function buildUpcomingActions(title, syncers) {
  const button = h('button', { class: 'btn dt-remind', type: 'button', onclick: () => toggleList(title.id) });
  syncers.push(() => {
    const on = isInList(title.id);
    button.replaceChildren(icon(on ? 'check' : 'bell', 20), on ? 'Reminder Set' : 'Remind Me');
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('btn-primary', !on);
    button.classList.toggle('btn-secondary', on);
  });
  return h('div', { class: 'dt-actions-wrap' },
    h('p', { class: 'dt-coming' }, `Coming ${formatReleaseDate(title.comingSoon)}`),
    h('div', { class: 'dt-actions' }, button));
}

/* Overview */

function buildOverview(title) {
  return h('section', { class: 'dt-overview' },
    h('div', { class: 'dt-overview-main' },
      title.isOriginal ? h('p', { class: 'dt-eyebrow' }, 'A Lumora Original') : null,
      h('div', { class: 'dt-meta' },
        h('span', { class: 'match' }, `${title.match}% Match`),
        h('span', {}, String(title.year)),
        h('span', { class: 'badge' }, title.maturity),
        h('span', {}, lengthLabel(title)),
        title.isNew && !title.comingSoon ? h('span', { class: 'dt-new' }, 'New') : null),
      title.tagline ? h('p', { class: 'dt-tagline' }, title.tagline) : null,
      h('p', { class: 'dt-synopsis' }, title.synopsis)),
    h('dl', { class: 'dt-facts' },
      factRow('Cast', title.cast.slice(0, 4).join(', ')),
      factRow('Genres', genreLinks(title)),
      factRow('Moods', title.moods.join(', '))));
}

function factRow(label, value) {
  if (!value || value.length === 0) return null;
  return h('div', { class: 'dt-fact' }, h('dt', {}, `${label}:`), h('dd', {}, value));
}

function genreLinks(title) {
  return title.genres.flatMap((genre, i) => {
    const path = `/genre/${slugify(genre)}`;
    const link = h('a', {
      class: 'dt-genre',
      href: `#${path}`,
      onclick: (event) => {
        event.preventDefault();
        closeDetails();
        navigate(path);
      },
    }, genre);
    return i ? [', ', link] : [link];
  });
}

/* Episodes */

function buildEpisodes(title) {
  const progress = getProgress(title.id);
  const seasons = title.seasons;
  const startSeason = seasons.find((s) => progress && s.number === progress.season) || seasons[0];
  const list = h('ol', { class: 'dt-episodes' });
  const renderSeason = (number) => {
    const season = seasons.find((s) => s.number === number) || seasons[0];
    list.replaceChildren(...season.episodes.map((ep) => buildEpisode(title, season.number, ep, progress)));
  };
  renderSeason(startSeason.number);

  const picker = seasons.length > 1
    ? h('select', {
      class: 'dt-season-select',
      'aria-label': 'Season',
      onchange: (event) => renderSeason(Number(event.target.value)),
    }, seasons.map((s) => h('option', {
      value: String(s.number),
      selected: s === startSeason,
    }, `Season ${s.number}`)))
    : h('span', { class: 'dt-season-single' }, `Season ${startSeason.number}`);

  return h('section', { class: 'dt-section' },
    h('div', { class: 'dt-section-head' }, h('h3', { class: 'dt-heading' }, 'Episodes'), picker),
    list);
}

function buildEpisode(title, seasonNumber, ep, progress) {
  const isCurrent = progress && progress.season === seasonNumber && progress.episode === ep.number;
  const fraction = isCurrent ? progressFraction(progress) : 0;
  const watched = fraction > 0 ? `, ${Math.round(fraction * 100)}% watched` : '';
  return h('li', { class: 'dt-episode-item' },
    h('button', {
      class: 'dt-episode',
      type: 'button',
      'aria-label': `Play episode ${ep.number}: ${ep.title}, ${formatRuntime(ep.runtimeMin)}${watched}`,
      onclick: () => watch(title, seasonNumber, ep.number),
    },
      h('span', { class: 'dt-ep-num', 'aria-hidden': 'true' }, String(ep.number)),
      h('span', { class: 'dt-ep-thumb' },
        h('img', { src: artUrl(title, 'card'), alt: '', loading: 'lazy', style: episodeCrop(seasonNumber, ep.number) }),
        h('span', { class: 'dt-ep-play' }, icon('play', 28)),
        fraction > 0
          ? h('span', { class: 'dt-bar dt-ep-bar' }, h('span', { class: 'dt-bar-fill', style: { width: toPercent(fraction) } }))
          : null),
      h('span', { class: 'dt-ep-text' },
        h('span', { class: 'dt-ep-head' },
          h('span', { class: 'dt-ep-title' }, ep.title),
          h('span', { class: 'dt-ep-time' }, formatRuntime(ep.runtimeMin))),
        h('span', { class: 'dt-ep-synopsis' }, ep.synopsis))));
}

// Zooms into a different part of the card art for each episode. Deterministic, so a thumbnail never changes.
function episodeCrop(seasonNumber, episodeNumber) {
  const seed = seasonNumber * 131 + episodeNumber * 37;
  const scale = 1.5 + ((seed * 7) % 8) / 10;
  const x = (seed * 13) % 101;
  const y = (seed * 29) % 101;
  return { transform: `scale(${scale})`, transformOrigin: `${x}% ${y}%` };
}

/* More Like This */

function buildSimilar(title) {
  const kids = getActiveProfile()?.isKids;
  const items = getSimilar(title.id, SIMILAR_COUNT * 2)
    .filter((t) => t.id !== title.id && !t.comingSoon && (!kids || isKidsSafe(t)))
    .slice(0, SIMILAR_COUNT);
  if (!items.length) return null;
  return h('section', { class: 'dt-section' },
    h('h3', { class: 'dt-heading' }, 'More Like This'),
    h('ul', { class: 'dt-similar' }, items.map((item) => h('li', {}, buildTile(item)))));
}

function buildTile(title) {
  return h('button', { class: 'dt-tile', type: 'button', onclick: () => showTitle(title.id) },
    h('img', { class: 'dt-tile-art', src: artUrl(title, 'card'), alt: title.name, loading: 'lazy' }),
    h('span', { class: 'dt-tile-body' },
      h('span', { class: 'dt-tile-meta' },
        h('span', { class: 'match' }, `${title.match}% Match`),
        h('span', { class: 'badge' }, title.maturity),
        h('span', {}, String(title.year))),
      h('span', { class: 'dt-tile-synopsis' }, title.synopsis)));
}

/* About */

function buildAbout(title) {
  return h('section', { class: 'dt-section dt-about' },
    h('h3', { class: 'dt-heading' }, `About ${title.name}`),
    h('dl', { class: 'dt-facts' },
      factRow('Creators', title.creators.join(', ')),
      factRow('Cast', title.cast.join(', ')),
      factRow('Genres', genreLinks(title)),
      factRow('Moods', title.moods.join(', ')),
      factRow('Maturity rating', title.maturity),
      factRow('Released', title.comingSoon ? `Coming ${formatReleaseDate(title.comingSoon)}` : String(title.year))));
}

/* Helpers */

function watch(title, season, episode) {
  const query = title.type === 'series' ? `?s=${season}&e=${episode}` : '';
  closeDetails();
  navigate(`/watch/${encodeURIComponent(title.id)}${query}`);
}

function progressFraction(progress) {
  if (!progress || !(progress.durationSec > 0)) return 0;
  return Math.min(1, Math.max(0, progress.positionSec / progress.durationSec));
}

// Works out what the main button does: resume unfinished progress, or start the next unwatched thing.
function playTarget(title) {
  const progress = getProgress(title.id);
  const fraction = progressFraction(progress);
  const inProgress = fraction > 0 && fraction < FINISHED_AT;
  const secondsLeft = inProgress ? progress.durationSec - progress.positionSec : 0;

  if (title.type !== 'series' || !title.seasons.length) {
    return {
      label: inProgress ? 'Resume' : 'Play',
      fraction: inProgress ? fraction : 0,
      secondsLeft,
      season: 1,
      episode: 1,
    };
  }

  const episodes = title.seasons.flatMap((s) => s.episodes.map((ep) => ({ season: s.number, episode: ep.number })));
  const currentIndex = progress
    ? episodes.findIndex((ep) => ep.season === progress.season && ep.episode === progress.episode)
    : -1;

  if (currentIndex >= 0 && inProgress) {
    const { season, episode } = episodes[currentIndex];
    return { label: `Resume S${season}:E${episode}`, fraction, secondsLeft, season, episode };
  }
  if (currentIndex >= 0 && fraction >= FINISHED_AT && episodes[currentIndex + 1]) {
    const { season, episode } = episodes[currentIndex + 1];
    return { label: `Play S${season}:E${episode}`, fraction: 0, secondsLeft: 0, season, episode };
  }
  const first = episodes[0] || { season: 1, episode: 1 };
  return { label: 'Play', fraction: 0, secondsLeft: 0, season: first.season, episode: first.episode };
}

function lengthLabel(title) {
  if (title.type !== 'series') return formatRuntime(title.runtimeMin);
  const count = title.seasons.length;
  return `${count} ${count === 1 ? 'Season' : 'Seasons'}`;
}

function formatReleaseDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'soon';
  // Date-only ISO strings parse as UTC, so they are formatted in UTC to stay on the intended day.
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) options.timeZone = 'UTC';
  return date.toLocaleDateString(undefined, options);
}

function toPercent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}
