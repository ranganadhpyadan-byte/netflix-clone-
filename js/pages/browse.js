import { h, icon, slugify, formatRuntime } from '../dom.js';
import {
  getActiveProfile,
  getContinueWatching,
  getMyList,
  isInList,
  subscribe,
  toggleList,
} from '../store.js';
import {
  GENRES,
  TITLES,
  genreFromSlug,
  getComingSoon,
  getHomeRows,
  getTitle,
  getTopTen,
  isKidsSafe,
  searchTitles,
  titlesByGenre,
} from '../data/catalog.js';
import { artUrl } from '../art.js';
import { createHero } from '../ui/hero.js';
import { createGrid, createRow } from '../ui/rows.js';
import { openDetails } from '../ui/details.js';

const HERO_POOL_SIZE = 12;
const LAZY_MARGIN = '600px 0px';
const MAX_RELATED_CHIPS = 4;

/* ------------------------------ filtering ------------------------------ */

function isKids() {
  return Boolean(getActiveProfile()?.isKids);
}

// Everything shown to the active profile passes through one of these two.
function allowed(items) {
  return isKids() ? items.filter(isKidsSafe) : items;
}

function streamable(items) {
  return allowed(items).filter((title) => !title.comingSoon);
}

function byPopularity(a, b) {
  return b.popularity - a.popularity;
}

function byNewest(a, b) {
  return b.year - a.year || Number(b.isNew) - Number(a.isNew) || byPopularity(a, b);
}

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function ofType(items, type) {
  return type ? items.filter((title) => title.type === type) : items;
}

function topTen(type) {
  // A kids profile would lose most of the global chart, so it gets a chart of its own.
  if (!isKids()) return getTopTen(type);
  return ofType(streamable(TITLES), type).sort(byPopularity).slice(0, 10);
}

function resolveIds(ids) {
  return ids.map((id) => getTitle(id)).filter(Boolean);
}

function continueWatchingTitles(type) {
  return ofType(streamable(resolveIds(getContinueWatching().map((entry) => entry.id))), type);
}

function myListRowTitles(type) {
  return ofType(streamable(resolveIds(getMyList())), type);
}

function idSignature(items) {
  return items.map((title) => title.id).join('|');
}

/* --------------------------------- mount -------------------------------- */

function profileKey() {
  const profile = getActiveProfile();
  return profile ? `${profile.id}:${profile.isKids ? 1 : 0}` : null;
}

/**
 * Runs a page build and owns its lifetime. build(page, addCleanup) may return a function
 * called after store changes. A profile switch rebuilds the page, since every list depends on it.
 */
function mount(container, build) {
  let disposed = false;
  let scheduled = false;
  let cleanups = [];
  let onStore = null;
  let key = null;

  const teardown = () => {
    const pending = cleanups;
    cleanups = [];
    pending.reverse().forEach((fn) => fn());
  };

  const run = () => {
    key = profileKey();
    const page = h('div', { class: 'br-page' });
    container.replaceChildren(page);
    onStore = build(page, (fn) => cleanups.push(fn)) || null;
  };

  run();

  const unsubscribe = subscribe(() => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed) return;
      const next = profileKey();
      if (next === null) return; // Signing out: the route change is about to clean up.
      if (next !== key) {
        teardown();
        run();
      } else if (onStore) {
        onStore();
      }
    });
  });

  return () => {
    disposed = true;
    unsubscribe();
    teardown();
  };
}

/* ------------------------------ shared parts ----------------------------- */

function pickHeroTitle(type) {
  const pool = ofType(streamable(TITLES), type).sort(byPopularity).slice(0, HERO_POOL_SIZE);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function emptyState({ iconName, title, body, action, extra }) {
  return h(
    'div',
    { class: 'br-empty' },
    h('div', { class: 'br-empty-icon' }, icon(iconName, 40)),
    h('h2', { class: 'br-empty-title' }, title),
    h('p', { class: 'br-empty-body' }, body),
    action && h('a', { class: 'btn btn-primary', href: `#${action.path}` }, action.label),
    extra,
  );
}

function skeleton() {
  return h(
    'div',
    { class: 'br-skeleton', 'aria-hidden': 'true' },
    h('div', { class: 'br-skeleton-title' }),
    h('div', { class: 'br-skeleton-band' }),
  );
}

/** Row slots whose rows are only built as they near the viewport. */
function lazyRows(specs, addCleanup) {
  const load = (slot, spec) => {
    slot.classList.remove('br-slot-pending');
    slot.replaceChildren(createRow(spec));
  };

  const hasObserver = typeof IntersectionObserver === 'function';
  const pending = new Map();
  const observer = hasObserver
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            load(entry.target, pending.get(entry.target));
            pending.delete(entry.target);
          }
        },
        { rootMargin: LAZY_MARGIN },
      )
    : null;
  if (observer) addCleanup(() => observer.disconnect());

  return specs.map((spec) => {
    const slot = h('div', { class: 'br-slot br-slot-pending' }, skeleton());
    if (observer) {
      pending.set(slot, spec);
      observer.observe(slot);
    } else {
      load(slot, spec);
    }
    return slot;
  });
}

/** A row that follows the store, rebuilt only when its titles actually change. */
function liveRow(title, getItems, options = {}) {
  const slot = h('div', { class: 'br-slot' });
  let signature = null;
  const update = () => {
    const items = getItems();
    const next = idSignature(items);
    if (next === signature) return;
    signature = next;
    slot.hidden = items.length === 0;
    slot.replaceChildren(...(items.length ? [createRow({ title, items, ...options })] : []));
  };
  update();
  return { slot, update };
}

function chip(label, path) {
  return h('a', { class: 'br-chip', href: `#${path}` }, label);
}

function genrePath(genre) {
  return `/genre/${slugify(genre)}`;
}

function searchPath(query) {
  return `/search?q=${encodeURIComponent(query)}`;
}

function chipList(chips, ariaLabel) {
  return h(
    'ul',
    { class: 'br-chips', 'aria-label': ariaLabel },
    chips.map((item) => h('li', {}, item)),
  );
}

function suggestedGenreChips(count = 8) {
  return GENRES.filter((genre) => streamable(titlesByGenre(genre)).length > 0)
    .slice(0, count)
    .map((genre) => chip(genre, genrePath(genre)));
}

/** Disclosure of genre links; links rather than a select so arrow keys never navigate by accident. */
function genreMenu(genres, addCleanup) {
  const panelId = 'br-genre-panel';
  const panel = h(
    'ul',
    { class: 'br-genre-panel', id: panelId, hidden: true },
    genres.map((genre) =>
      h('li', {}, h('a', { class: 'br-genre-link', href: `#${genrePath(genre)}` }, genre)),
    ),
  );
  const button = h(
    'button',
    {
      class: 'br-genre-button',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': panelId,
      onClick: () => setOpen(panel.hidden),
    },
    'Genres',
    icon('chevron-down', 16),
  );
  const wrap = h('div', { class: 'br-genre' }, button, panel);

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });
  wrap.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !wrap.contains(event.relatedTarget)) setOpen(false);
  });

  const onPointerDown = (event) => {
    if (!wrap.contains(event.target)) setOpen(false);
  };
  document.addEventListener('pointerdown', onPointerDown);
  addCleanup(() => document.removeEventListener('pointerdown', onPointerDown));

  return wrap;
}

/* --------------------------- home, series, films -------------------------- */

function curatedRows() {
  return getHomeRows()
    .map((row) => ({ title: row.title, items: streamable(row.items), ranked: Boolean(row.ranked) }))
    .filter((row) => row.items.length > 0);
}

function typedRows(type, label, genreRows) {
  // Ranked curated rows are charts across both types, so the typed chart below replaces them.
  const curated = getHomeRows()
    .filter((row) => !row.ranked)
    .map((row) => ({ title: row.title, items: ofType(streamable(row.items), type) }));
  const chart = { title: `Top 10 ${label} Today`, items: topTen(type), ranked: true };
  const [lead, ...rest] = curated;
  const ordered = [lead, chart, ...rest, ...genreRows].filter((row) => row && row.items.length > 0);

  const seen = new Set();
  return ordered.filter((row) => {
    if (seen.has(row.title)) return false;
    seen.add(row.title);
    return true;
  });
}

function buildBillboardPage(page, addCleanup, { type = null, label = null } = {}) {
  const heroTitle = pickHeroTitle(type);
  const genreRows = type
    ? GENRES.map((genre) => ({
        title: genre,
        items: ofType(streamable(titlesByGenre(genre)), type),
      })).filter((row) => row.items.length > 0)
    : [];
  const specs = type ? typedRows(type, label, genreRows) : curatedRows();

  const bar = type
    ? h(
        'div',
        { class: `br-typebar${heroTitle ? ' br-typebar-over' : ''}` },
        h('h1', { class: 'br-typebar-title' }, label),
        genreRows.length > 0 && genreMenu(genreRows.map((row) => row.title), addCleanup),
      )
    : null;

  if (heroTitle) {
    const hero = createHero(heroTitle);
    addCleanup(() => hero.destroy());
    page.append(hero.el);
    if (bar) page.append(bar);
  } else if (bar) {
    page.append(h('div', { class: 'page-pad br-head-only' }, bar));
  } else {
    page.append(h('div', { class: 'page-pad br-head-only' }));
  }

  const continueRow = liveRow('Continue Watching', () => continueWatchingTitles(type), { progress: true });
  const listRow = liveRow('My List', () => myListRowTitles(type));

  const rows = h(
    'div',
    { class: `br-rows${heroTitle ? ' br-rows-over' : ''}` },
    continueRow.slot,
    listRow.slot,
    lazyRows(specs, addCleanup),
  );
  page.append(rows);

  if (!heroTitle && specs.length === 0) {
    page.append(
      h(
        'div',
        { class: 'page-pad br-head-only' },
        emptyState({
          iconName: 'search',
          title: 'Nothing here for this profile yet',
          body: 'Try another section of Lumora to find something to watch.',
          action: { label: 'Back to Home', path: '/browse' },
        }),
      ),
    );
  }

  return () => {
    continueRow.update();
    listRow.update();
  };
}

export function renderHome(container) {
  return mount(container, (page, addCleanup) => buildBillboardPage(page, addCleanup));
}

export function renderSeries(container) {
  return mount(container, (page, addCleanup) =>
    buildBillboardPage(page, addCleanup, { type: 'series', label: 'Series' }),
  );
}

export function renderFilms(container) {
  return mount(container, (page, addCleanup) =>
    buildBillboardPage(page, addCleanup, { type: 'movie', label: 'Films' }),
  );
}

/* ----------------------------- new & popular ----------------------------- */

function releaseDate(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(date.getTime())) return { month: '', day: '', full: String(iso) };
  return {
    month: date.toLocaleDateString(undefined, { month: 'short' }),
    day: String(date.getDate()),
    full: date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
  };
}

function titleMeta(title) {
  if (title.type === 'movie') return formatRuntime(title.runtimeMin);
  const count = title.seasons.length;
  if (!count) return 'Series';
  return count === 1 ? '1 Season' : `${count} Seasons`;
}

function comingSoonItem(title) {
  const date = releaseDate(title.comingSoon);
  const remind = h('button', {
    class: 'btn btn-secondary br-remind',
    type: 'button',
    onClick: () => toggleList(title.id),
  });
  const sync = () => {
    const on = isInList(title.id);
    remind.setAttribute('aria-pressed', String(on));
    remind.replaceChildren(
      icon(on ? 'check' : 'bell', 18),
      'Remind Me',
      h('span', { class: 'sr-only' }, `: ${title.name}`),
    );
  };
  sync();

  const open = () => openDetails(title.id);
  const element = h(
    'li',
    { class: 'br-soon-item' },
    h(
      'time',
      { class: 'br-soon-date', dateTime: title.comingSoon, title: date.full },
      h('span', { class: 'br-soon-month' }, date.month),
      h('span', { class: 'br-soon-day' }, date.day),
      h('span', { class: 'sr-only' }, date.full),
    ),
    // The name button below is the keyboard path to details, so the art stays out of the tab order.
    h(
      'button',
      { class: 'br-soon-art', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: open },
      h('img', { src: artUrl(title, 'card'), alt: '', loading: 'lazy', decoding: 'async', width: 480, height: 270 }),
    ),
    h(
      'div',
      { class: 'br-soon-body' },
      h('h3', { class: 'br-soon-name' }, h('button', { type: 'button', onClick: open }, title.name)),
      h('p', { class: 'br-soon-when' }, `Coming ${date.full}`),
      h(
        'p',
        { class: 'br-soon-meta' },
        h('span', { class: 'badge' }, title.maturity),
        h('span', {}, titleMeta(title)),
        h('span', {}, title.genres.slice(0, 2).join(', ')),
      ),
      h('p', { class: 'br-soon-tagline' }, title.tagline),
      remind,
    ),
  );
  return { element, sync };
}

export function renderNew(container) {
  return mount(container, (page, addCleanup) => {
    const soon = allowed(getComingSoon()).map(comingSoonItem);
    const fresh = streamable(TITLES).filter((title) => title.isNew).sort(byNewest);
    const specs = [
      { title: 'New on Lumora', items: fresh },
      { title: 'New Series', items: ofType(fresh, 'series') },
      { title: 'New Films', items: ofType(fresh, 'movie') },
      { title: 'Top 10 Series Today', items: topTen('series'), ranked: true },
      { title: 'Top 10 Films Today', items: topTen('movie'), ranked: true },
    ].filter((row) => row.items.length > 0);

    const nothing = soon.length === 0 && specs.length === 0;
    page.append(
      h(
        'div',
        { class: 'page-pad br-head-only' },
        h('h1', { class: 'br-heading' }, 'New & Popular'),
        soon.length > 0 &&
          h(
            'section',
            { class: 'br-soon', 'aria-labelledby': 'br-soon-heading' },
            h('h2', { class: 'br-subheading', id: 'br-soon-heading' }, 'Coming Soon'),
            h('ol', { class: 'br-soon-list' }, soon.map((item) => item.element)),
          ),
        nothing &&
          emptyState({
            iconName: 'bell',
            title: 'Nothing new for this profile yet',
            body: 'Fresh titles land here as soon as they are ready.',
            action: { label: 'Back to Home', path: '/browse' },
          }),
      ),
      h('div', { class: 'br-rows' }, lazyRows(specs, addCleanup)),
    );

    return () => soon.forEach((item) => item.sync());
  });
}

/* --------------------------------- my list -------------------------------- */

export function renderMyList(container) {
  return mount(container, (page) => {
    const heading = h('h1', { class: 'br-heading', tabindex: '-1' }, 'My List');
    const count = h('p', { class: 'br-count' });
    const slot = h('div', {});
    let signature = null;

    const update = () => {
      // Includes coming-soon titles: "Remind Me" adds them here.
      const items = allowed(resolveIds(getMyList()));
      const next = idSignature(items);
      if (next === signature) return;
      signature = next;

      const hadFocus = slot.contains(document.activeElement);
      count.textContent = items.length ? `${items.length} ${items.length === 1 ? 'title' : 'titles'}` : '';
      slot.replaceChildren(
        items.length
          ? createGrid(items)
          : emptyState({
              iconName: 'plus',
              title: 'Your list is waiting',
              body: 'Add series and films you want to watch later, and they will be kept here for you.',
              action: { label: 'Find Something to Watch', path: '/browse' },
            }),
      );
      if (hadFocus) heading.focus();
    };

    page.append(h('div', { class: 'page-pad' }, h('div', { class: 'br-head' }, heading, count), slot));
    update();
    return update;
  });
}

/* ---------------------------------- genre --------------------------------- */

const GENRE_SORTS = {
  popular: { label: 'Most popular', compare: byPopularity },
  newest: { label: 'Newest', compare: byNewest },
  az: { label: 'A-Z', compare: byName },
};

export function renderGenre(container, ctx) {
  const genre = genreFromSlug(ctx.params.slug);
  let sort = 'popular';

  return mount(container, (page) => {
    const pad = h('div', { class: 'page-pad' });
    page.append(pad);

    if (!genre) {
      pad.append(
        emptyState({
          iconName: 'search',
          title: 'We could not find that genre',
          body: 'It may have moved. Here are some others to explore.',
          action: { label: 'Back to Home', path: '/browse' },
          extra: chipList(suggestedGenreChips(), 'Genres'),
        }),
      );
      return null;
    }

    const items = streamable(titlesByGenre(genre));
    const heading = h('h1', { class: 'br-heading' }, genre);

    if (items.length === 0) {
      pad.append(
        h('div', { class: 'br-head' }, heading),
        emptyState({
          iconName: 'search',
          title: 'Nothing in this genre for this profile',
          body: 'Here are some others to explore.',
          action: { label: 'Back to Home', path: '/browse' },
          extra: chipList(suggestedGenreChips(), 'Genres'),
        }),
      );
      return null;
    }

    const slot = h('div', {});
    const drawGrid = () => {
      slot.replaceChildren(createGrid([...items].sort(GENRE_SORTS[sort].compare)));
    };
    const selectId = 'br-sort-select';
    const select = h(
      'select',
      {
        class: 'br-select',
        id: selectId,
        onChange: (event) => {
          sort = event.target.value;
          drawGrid();
        },
      },
      Object.entries(GENRE_SORTS).map(([value, option]) =>
        h('option', { value, selected: value === sort }, option.label),
      ),
    );

    pad.append(
      h(
        'div',
        { class: 'br-head' },
        heading,
        h('p', { class: 'br-count' }, `${items.length} ${items.length === 1 ? 'title' : 'titles'}`),
        h(
          'div',
          { class: 'br-sort' },
          h('label', { class: 'br-sort-label', htmlFor: selectId }, 'Sort by'),
          select,
        ),
      ),
      slot,
    );
    drawGrid();
    return null;
  });
}

/* --------------------------------- search -------------------------------- */

function topTerms(lists, limit, exclude) {
  const counts = new Map();
  for (const list of lists) {
    for (const term of list) {
      if (term.toLowerCase() !== exclude) counts.set(term, (counts.get(term) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function relatedChips(results, query) {
  const exclude = query.toLowerCase();
  const genres = topTerms(results.map((title) => title.genres), MAX_RELATED_CHIPS, exclude);
  const taken = new Set(genres);
  const moods = topTerms(results.map((title) => title.moods), MAX_RELATED_CHIPS, exclude).filter(
    (mood) => !taken.has(mood),
  );
  return [
    ...genres.map((genre) => chip(genre, genrePath(genre))),
    ...moods.map((mood) => chip(mood, searchPath(mood))),
  ];
}

export function renderSearch(container, ctx) {
  const query = String(ctx.query.q || '').trim();

  return mount(container, (page) => {
    const pad = h('div', { class: 'page-pad' });
    page.append(pad);

    if (!query) {
      pad.append(
        emptyState({
          iconName: 'search',
          title: 'Search Lumora',
          body: 'Look up a title, a cast member, a genre, or a mood.',
          extra: chipList(suggestedGenreChips(), 'Browse by genre'),
        }),
      );
      return null;
    }

    const results = allowed(searchTitles(query));

    if (results.length === 0) {
      pad.append(
        emptyState({
          iconName: 'search',
          title: `No results for "${query}"`,
          body: 'Check the spelling, try something broader, or browse a genre instead.',
          extra: chipList(suggestedGenreChips(), 'Browse by genre'),
        }),
      );
      return null;
    }

    const chips = relatedChips(results, query);
    pad.append(
      h(
        'div',
        { class: 'br-head' },
        h('h1', { class: 'br-heading br-heading-query' }, `Results for "${query}"`),
        h('p', { class: 'br-count', role: 'status' }, `${results.length} ${results.length === 1 ? 'title' : 'titles'}`),
      ),
      chips.length > 0 &&
        h(
          'div',
          { class: 'br-related' },
          h('span', { class: 'br-related-label', id: 'br-related-label' }, 'Explore titles related to:'),
          h(
            'ul',
            { class: 'br-chips', 'aria-labelledby': 'br-related-label' },
            chips.map((item) => h('li', {}, item)),
          ),
        ),
      createGrid(results),
    );
    return null;
  });
}
