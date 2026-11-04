import { h, icon } from '../dom.js';
import { navigate } from '../router.js';
import { avatarNode, getActiveProfile, getProfiles, setActiveProfile, signOut, subscribe } from '../store.js';
import { TITLES, getComingSoon } from '../data/catalog.js';
import { artUrl } from '../art.js';
import { openDetails } from './details.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCROLL_SOLID_AT = 40;
const SEARCH_DEBOUNCE_MS = 250;
const MAX_NEW_NOTIFICATIONS = 8;

const NAV_LINKS = [
  { label: 'Home', path: '/browse' },
  { label: 'Series', path: '/series' },
  { label: 'Films', path: '/films' },
  { label: 'New & Popular', path: '/new' },
  { label: 'My List', path: '/my-list' },
];

const FOOTER_COLUMNS = [
  { heading: 'Lumora', links: ['About', 'Careers', 'Press room', 'Originals'] },
  { heading: 'Help', links: ['Help centre', 'Supported devices', 'Contact us', 'Accessibility'] },
  { heading: 'Membership', links: ['Plans', 'Gift cards', 'Redeem a code', 'Ways to watch'] },
  { heading: 'Legal', links: ['Terms of use', 'Privacy', 'Cookie preferences', 'Notices'] },
];

/** The Lumora wordmark. Without a size it follows the font size set in nav.css. */
export function logoMark(size) {
  const mark = document.createElementNS(SVG_NS, 'svg');
  mark.setAttribute('viewBox', '0 0 24 24');
  mark.setAttribute('class', 'nav-logo-mark');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<path fill="currentColor" d="M4 16.5a8 8 0 0 1 16 0z"/>'
    + '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M2.5 20.5h19"/>';
  const logo = h('span', { class: 'nav-logo' }, mark, h('span', { class: 'nav-logo-text' }, 'Lumora'));
  if (size) logo.style.fontSize = `${size}px`;
  return logo;
}

function readHash() {
  const [path, search = ''] = (location.hash.slice(1) || '/').split('?');
  return { path, query: new URLSearchParams(search) };
}

function searchValueFromHash() {
  const { path, query } = readHash();
  return path === '/search' ? query.get('q') || '' : '';
}

function formatComingDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'soon';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function notificationItems() {
  const coming = getComingSoon().map((title) => ({ title, note: `Coming ${formatComingDate(title.comingSoon)}` }));
  const seen = new Set(coming.map(({ title }) => title.id));
  const fresh = TITLES
    .filter((title) => title.isNew && !title.comingSoon && !seen.has(title.id))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, MAX_NEW_NOTIFICATIONS)
    .map((title) => ({ title, note: 'New on Lumora' }));
  return [...coming, ...fresh];
}

function profilesSignature() {
  const shape = (p) => [p.id, p.name, p.avatar, p.isKids];
  const active = getActiveProfile();
  return JSON.stringify([active ? active.id : null, getProfiles().map(shape)]);
}

/** Disclosure dropdowns: at most one open, shared Esc, outside-press and focus-leave handling. */
function createDropdowns(signal) {
  let current = null;

  function close() {
    if (!current) return;
    const { trigger, panel } = current;
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    current = null;
    if (hadFocus) trigger.focus();
  }

  // pointerdown covers mouse, pen and touch; iOS does not send click to non-interactive page content.
  document.addEventListener('pointerdown', (event) => {
    if (current && !current.wrap.contains(event.target)) close();
  }, { signal, capture: true });
  document.addEventListener('focusin', (event) => {
    if (current && !current.wrap.contains(event.target)) close();
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !current) return;
    event.preventDefault();
    const { trigger } = current;
    close();
    trigger.focus();
  }, { signal });

  function create({ wrapClass, trigger, panel, onOpen }) {
    const dropdown = { wrap: null, trigger, panel };

    function open() {
      if (current === dropdown) return;
      close();
      if (onOpen) onOpen();
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      current = dropdown;
    }

    function moveFocus(key) {
      const items = [...panel.querySelectorAll('a[href], button')];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      let next = 0;
      if (key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
      else if (key === 'ArrowUp') next = index <= 0 ? items.length - 1 : index - 1;
      else if (key === 'End') next = items.length - 1;
      items[next].focus();
    }

    trigger.addEventListener('click', () => {
      if (current === dropdown) close();
      else open();
    });

    dropdown.wrap = h('div', {
      class: `nav-dd ${wrapClass}`,
      onKeydown: (event) => {
        const isMove = ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key);
        if (!isMove) return;
        if ((event.key === 'Home' || event.key === 'End') && current !== dropdown) return;
        event.preventDefault();
        open();
        moveFocus(event.key);
      },
    }, trigger, panel);
    return dropdown.wrap;
  }

  /** Close, then put focus on the trigger, so a following dialog restores focus there. */
  function closeToTrigger() {
    if (!current) return;
    const { trigger } = current;
    close();
    trigger.focus();
  }

  return { create, close, closeToTrigger };
}

export function renderNav(container) {
  const controller = new AbortController();
  const { signal } = controller;
  const dropdowns = createDropdowns(signal);
  const navLinks = [];

  const makeLink = ({ label, path }, onClick) => {
    const link = h('a', { href: `#${path}`, dataset: { path }, onClick }, label);
    navLinks.push(link);
    return link;
  };

  function updateActiveLinks() {
    const { path } = readHash();
    for (const link of navLinks) {
      if (link.dataset.path === path) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  /* Browse dropdown, shown instead of the inline links below 900px */
  const browseTrigger = h('button', {
    type: 'button',
    class: 'nav-browse-trigger',
    'aria-expanded': 'false',
    'aria-controls': 'nav-panel-browse',
  }, 'Browse', icon('chevron-down', 16));
  const browsePanel = h('div', { id: 'nav-panel-browse', class: 'nav-panel nav-panel-browse', hidden: true },
    NAV_LINKS.map((link) => {
      const item = makeLink(link, () => dropdowns.closeToTrigger());
      item.className = 'nav-panel-item';
      return item;
    }));
  const browseDropdown = dropdowns.create({
    wrapClass: 'nav-browse',
    trigger: browseTrigger,
    panel: browsePanel,
  });

  const inlineLinks = h('div', { class: 'nav-links' }, NAV_LINKS.map((link) => {
    const item = makeLink(link);
    item.className = 'nav-link';
    return item;
  }));

  /* Search */
  let searchTimer = null;
  let searchActive = false;
  // The hash this box last asked for. A hashchange to it must not overwrite what is being typed.
  let lastSentHash = null;

  const searchInput = h('input', {
    type: 'search',
    class: 'nav-search-input',
    placeholder: 'Titles, people, genres',
    autocomplete: 'off',
    enterKeyHint: 'search',
    'aria-label': 'Search titles, people and genres',
  });
  searchInput.spellcheck = false;

  const keepInputFocus = (event) => event.preventDefault();

  const searchToggle = h('button', {
    type: 'button',
    class: 'nav-search-toggle',
    'aria-label': 'Search',
    onMousedown: keepInputFocus,
    onClick: () => {
      setSearchActive(true);
      searchInput.focus();
    },
  }, icon('search', 22));

  const searchClear = h('button', {
    type: 'button',
    class: 'nav-search-clear',
    'aria-label': 'Clear search',
    hidden: true,
    onMousedown: keepInputFocus,
    onClick: () => {
      searchInput.value = '';
      cancelSearchTimer();
      runSearch();
      setSearchActive(true);
      searchInput.focus();
    },
  }, icon('x', 18));

  const searchForm = h('form', {
    class: 'nav-search',
    role: 'search',
    onSubmit: (event) => {
      event.preventDefault();
      cancelSearchTimer();
      runSearch();
    },
    onFocusout: (event) => {
      // Switching window keeps the input focused; only a real focus move collapses the box.
      if (!document.hasFocus() || searchForm.contains(event.relatedTarget)) return;
      setSearchActive(false);
    },
  }, searchToggle, searchInput, searchClear);

  function refreshSearchState() {
    searchForm.classList.toggle('nav-search--open', searchActive || Boolean(searchInput.value));
    searchForm.classList.toggle('nav-search--active', searchActive);
    searchClear.hidden = !searchInput.value;
    searchToggle.tabIndex = searchActive ? -1 : 0;
  }

  function setSearchActive(active) {
    searchActive = active;
    refreshSearchState();
  }

  function cancelSearchTimer() {
    clearTimeout(searchTimer);
    searchTimer = null;
  }

  function runSearch() {
    const query = searchInput.value.trim();
    const { path } = readHash();
    if (!query) {
      if (path === '/search') {
        lastSentHash = '#/browse';
        navigate('/browse');
      }
      return;
    }
    const target = `/search?q=${encodeURIComponent(query)}`;
    lastSentHash = `#${target}`;
    if (location.hash === lastSentHash) return;
    // Replace while already searching, so Back leaves search instead of replaying each keystroke.
    if (path === '/search') location.replace(lastSentHash);
    else navigate(target);
  }

  function syncSearchFromHash() {
    const value = searchValueFromHash();
    if (searchInput.value !== value) searchInput.value = value;
    refreshSearchState();
  }

  searchInput.addEventListener('focus', () => setSearchActive(true));
  searchInput.addEventListener('input', () => {
    refreshSearchState();
    cancelSearchTimer();
    searchTimer = setTimeout(() => {
      searchTimer = null;
      runSearch();
    }, SEARCH_DEBOUNCE_MS);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cancelSearchTimer();
    if (searchInput.value) {
      searchInput.value = '';
      refreshSearchState();
      runSearch();
    } else {
      searchInput.blur();
    }
  });

  /* Notifications */
  const notifications = notificationItems();
  const bellDot = h('span', { class: 'nav-bell-dot', hidden: !notifications.length });
  const bellTrigger = h('button', {
    type: 'button',
    class: 'nav-icon-trigger',
    'aria-expanded': 'false',
    'aria-controls': 'nav-panel-bell',
    'aria-label': notifications.length ? `Notifications, ${notifications.length} new` : 'Notifications',
  }, icon('bell', 22), bellDot);
  const bellPanel = h('div', { id: 'nav-panel-bell', class: 'nav-panel nav-panel-bell', hidden: true });

  function fillBellPanel() {
    bellDot.hidden = true;
    bellTrigger.setAttribute('aria-label', 'Notifications');
    if (bellPanel.childElementCount) return;
    bellPanel.append(h('h2', { class: 'nav-panel-heading' }, 'Notifications'));
    if (!notifications.length) {
      bellPanel.append(h('p', { class: 'nav-panel-empty' }, 'Nothing new right now.'));
      return;
    }
    // Artwork is generated, so it is built on first open and not with the shell.
    bellPanel.append(...notifications.map(({ title, note }) => h('button', {
      type: 'button',
      class: 'nav-notice',
      onClick: () => {
        dropdowns.closeToTrigger();
        openDetails(title.id);
      },
    },
    h('img', {
      class: 'nav-notice-art',
      src: artUrl(title, 'card'),
      alt: '',
      width: 96,
      height: 54,
      decoding: 'async',
    }),
    h('span', { class: 'nav-notice-text' },
      h('span', { class: 'nav-notice-name' }, title.name),
      h('span', { class: 'nav-notice-note' }, note)))));
  }

  const bellDropdown = dropdowns.create({
    wrapClass: 'nav-bell',
    trigger: bellTrigger,
    panel: bellPanel,
    onOpen: fillBellPanel,
  });

  /* Profile */
  const profileAvatar = h('span', { class: 'nav-profile-avatar' });
  const profileChevron = icon('chevron-down', 16);
  profileChevron.classList.add('nav-profile-chevron');
  const profileTrigger = h('button', {
    type: 'button',
    class: 'nav-profile-trigger',
    'aria-expanded': 'false',
    'aria-controls': 'nav-panel-profile',
    'aria-label': 'Profile menu',
  }, profileAvatar, profileChevron);
  const profilePanel = h('div', { id: 'nav-panel-profile', class: 'nav-panel nav-panel-profile', hidden: true });
  const profileDropdown = dropdowns.create({
    wrapClass: 'nav-profile',
    trigger: profileTrigger,
    panel: profilePanel,
  });
  const kidsBadge = h('span', { class: 'nav-kids-badge', hidden: true }, 'Kids');

  function switchProfile(id, isActive) {
    dropdowns.closeToTrigger();
    if (isActive) return;
    cancelSearchTimer();
    lastSentHash = null;
    searchInput.value = '';
    refreshSearchState();
    setActiveProfile(id);
    // Lists, ratings and Kids filtering are per profile, so the page has to render again.
    navigate('/browse');
  }

  function renderProfileState() {
    const active = getActiveProfile();
    profileAvatar.replaceChildren(active ? avatarNode(active, 32) : icon('user', 24));
    profileTrigger.setAttribute('aria-label', active ? `Profile menu, ${active.name}` : 'Profile menu');
    const isKids = Boolean(active && active.isKids);
    kidsBadge.hidden = !isKids;
    bellDropdown.hidden = isKids;

    profilePanel.replaceChildren(
      ...getProfiles().map((profile) => {
        const isActive = Boolean(active && active.id === profile.id);
        return h('button', {
          type: 'button',
          class: 'nav-panel-item nav-panel-profile-item',
          'aria-current': isActive ? 'true' : null,
          onClick: () => switchProfile(profile.id, isActive),
        },
        avatarNode(profile, 28),
        h('span', { class: 'nav-panel-item-label' }, profile.name),
        profile.isKids ? h('span', { class: 'nav-kids-badge' }, 'Kids') : null,
        isActive ? icon('check', 16) : null);
      }),
      h('div', { class: 'nav-panel-divider' }),
      h('a', {
        href: '#/profiles/manage',
        class: 'nav-panel-item',
        onClick: () => dropdowns.closeToTrigger(),
      }, icon('pencil', 18), 'Manage Profiles'),
      h('a', {
        href: '#/account',
        class: 'nav-panel-item',
        onClick: () => dropdowns.closeToTrigger(),
      }, icon('user', 18), 'Account'),
      h('div', { class: 'nav-panel-divider' }),
      h('button', {
        type: 'button',
        class: 'nav-panel-item',
        onClick: () => {
          cancelSearchTimer();
          dropdowns.close();
          signOut();
          navigate('/');
        },
      }, icon('arrow-left', 18), 'Sign out'),
    );
  }

  /* Assembly */
  const brand = h('a', { href: '#/browse', class: 'nav-brand', 'aria-label': 'Lumora home' }, logoMark());
  const bar = h('header', { class: 'nav-bar' },
    brand,
    h('nav', { class: 'nav-primary', 'aria-label': 'Primary' }, inlineLinks, browseDropdown),
    h('div', { class: 'nav-actions' }, searchForm, bellDropdown, kidsBadge, profileDropdown));
  container.append(bar);

  /* Global state */
  const updateSolid = () => bar.classList.toggle('nav-bar--solid', window.scrollY > SCROLL_SOLID_AT);

  function onHashChange() {
    updateActiveLinks();
    updateSolid();
    dropdowns.close();
    if (location.hash === lastSentHash) return;
    // Back, Forward, a link or a chip moved the route: that route now owns the box.
    lastSentHash = null;
    cancelSearchTimer();
    syncSearchFromHash();
  }

  let signature = profilesSignature();
  renderProfileState();
  const unsubscribe = subscribe(() => {
    // subscribe fires on every store change (list, progress, settings), not only profile changes.
    const next = profilesSignature();
    if (next === signature) return;
    signature = next;
    dropdowns.close();
    renderProfileState();
  });

  window.addEventListener('hashchange', onHashChange, { signal });
  window.addEventListener('scroll', updateSolid, { signal, passive: true });
  window.matchMedia('(max-width: 899.98px)').addEventListener('change', () => dropdowns.close(), { signal });

  updateActiveLinks();
  updateSolid();
  syncSearchFromHash();

  return () => {
    controller.abort();
    cancelSearchTimer();
    unsubscribe();
    container.replaceChildren();
  };
}

export function renderFooter(container) {
  const ignoreClick = (event) => event.preventDefault();
  const columns = FOOTER_COLUMNS.map(({ heading, links }) => h('div', { class: 'ft-column' },
    h('h2', { class: 'ft-heading' }, heading),
    h('ul', { class: 'ft-list' }, links.map((label) => h('li', {},
      h('a', { href: '#', class: 'ft-link', onClick: ignoreClick }, label))))));

  container.append(h('footer', { class: 'ft-root' },
    h('div', { class: 'ft-inner' },
      h('div', { class: 'ft-brand' }, logoMark(22)),
      h('div', { class: 'ft-columns' }, columns),
      h('p', { class: 'ft-note' }, 'Lumora is a demo project, not affiliated with any streaming service. '
        + 'All titles, people and artwork are invented.'),
      h('p', { class: 'ft-legal' }, `© ${new Date().getFullYear()} Lumora demo`))));

  return () => container.replaceChildren();
}
