import { h } from './dom.js';
import { addRoute, navigate, startRouter } from './router.js';
import { getActiveProfile, isSignedIn } from './store.js';
import { renderFooter, renderNav } from './ui/nav.js';
import { closeDetails } from './ui/details.js';
import { renderAccount, renderLanding, renderLogin, renderSignup } from './pages/public.js';
import { renderManageProfiles, renderProfiles } from './pages/profiles.js';
import { renderFilms, renderGenre, renderHome, renderMyList, renderNew, renderSearch, renderSeries } from './pages/browse.js';
import { renderPlayer } from './pages/player.js';

const PUBLIC = 'public';
const SIGNED_IN = 'signed-in';
const WATCHING = 'watching';

addRoute('/', { render: renderLanding, guard: PUBLIC });
addRoute('/login', { render: renderLogin, guard: PUBLIC });
addRoute('/signup', { render: renderSignup, guard: PUBLIC });
addRoute('/profiles', { render: renderProfiles, guard: SIGNED_IN });
addRoute('/profiles/manage', { render: renderManageProfiles, guard: SIGNED_IN });
addRoute('/browse', { render: renderHome, guard: WATCHING, shell: true });
addRoute('/series', { render: renderSeries, guard: WATCHING, shell: true });
addRoute('/films', { render: renderFilms, guard: WATCHING, shell: true });
addRoute('/new', { render: renderNew, guard: WATCHING, shell: true });
addRoute('/my-list', { render: renderMyList, guard: WATCHING, shell: true });
addRoute('/genre/:slug', { render: renderGenre, guard: WATCHING, shell: true });
addRoute('/search', { render: renderSearch, guard: WATCHING, shell: true });
addRoute('/account', { render: renderAccount, guard: WATCHING, shell: true });
addRoute('/watch/:id', { render: renderPlayer, guard: WATCHING });

const app = document.getElementById('app');
let shell = null;
let pageCleanup = null;

function buildShell() {
  const nav = h('div');
  const main = h('main', { class: 'shell-main' });
  const footer = h('div');
  app.append(nav, main, footer);
  const cleanups = [renderNav(nav), renderFooter(footer)];
  return { main, destroy: () => cleanups.forEach((fn) => typeof fn === 'function' && fn()) };
}

function redirectFor(guard) {
  if (guard === PUBLIC) return isSignedIn() ? '/browse' : null;
  if (!isSignedIn()) return '/login';
  if (guard === WATCHING && !getActiveProfile()) return '/profiles';
  return null;
}

function runCleanup() {
  if (typeof pageCleanup === 'function') pageCleanup();
  pageCleanup = null;
}

function handleRoute(config, ctx) {
  const redirect = redirectFor(config.guard);
  if (redirect) {
    navigate(redirect);
    return;
  }
  closeDetails();
  runCleanup();

  let target;
  if (config.shell) {
    if (!shell) {
      app.replaceChildren();
      shell = buildShell();
    }
    shell.main.replaceChildren();
    target = shell.main;
  } else {
    if (shell) {
      shell.destroy();
      shell = null;
    }
    app.replaceChildren();
    target = app;
  }

  // Search re-renders on every keystroke, so it keeps its scroll position.
  if (ctx.path !== '/search') window.scrollTo(0, 0);
  pageCleanup = config.render(target, ctx);
}

startRouter(handleRoute);
