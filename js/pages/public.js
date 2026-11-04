import { h, icon } from '../dom.js';
import { navigate } from '../router.js';
import {
  PLANS,
  avatarNode,
  getAccount,
  getActiveProfile,
  getProfiles,
  getSettings,
  isSignedIn,
  setPlan,
  setSettings,
  signIn,
  signOut,
  subscribe,
} from '../store.js';
import { TITLES, getTopTen } from '../data/catalog.js';
import { artUrl } from '../art.js';
import { logoMark } from '../ui/nav.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ERROR = 'Please enter an email in the form name@example.com.';

const FAQ = [
  {
    q: 'What exactly is Lumora?',
    a: 'A demo project that imagines what a streaming service could feel like. Browse, build a list, and press play on films and series that exist only inside this site.',
  },
  {
    q: 'Does it cost anything?',
    a: 'Nothing at all. The plans are make-believe and their prices are only there for show. You will never be asked for payment details, and nothing can be charged.',
  },
  {
    q: 'Should I use my real password?',
    a: 'Please do not. Any email is accepted, and the password box is never checked or saved. Type whatever you like, or leave it empty.',
  },
  {
    q: 'Where does my information go?',
    a: 'Nowhere. Your email, profiles, list and viewing progress stay in this browser, and clearing your site data removes them.',
  },
  {
    q: 'Are the titles real?',
    a: 'Every title, plot and cast member is invented. The posters are generated in your browser, and the "video" is an animated scene drawn frame by frame.',
  },
  {
    q: 'Is there something for younger viewers?',
    a: 'Yes. Each new membership comes with a Kids profile that only shows gently rated titles, including in search.',
  },
];

const PLAYBACK_TOGGLES = [
  { key: 'autoplayPreviews', label: 'Autoplay previews', hint: 'Let billboards come to life while you browse.' },
  { key: 'autoplayNext', label: 'Autoplay next episode', hint: 'Roll straight into the next chapter of a series.' },
  { key: 'subtitles', label: 'Subtitles on by default', hint: 'Start every title with captions showing.' },
  { key: 'muted', label: 'Start muted', hint: 'Keep the score silent until you turn it up.' },
];

function popularTitles() {
  return TITLES.filter((title) => !title.comingSoon).sort((a, b) => b.popularity - a.popularity);
}

function homeLink() {
  return h('a', { class: 'pb-logo', href: '#/', 'aria-label': 'Lumora home' }, logoMark());
}

function poster(title, variant = 'poster') {
  return h('img', { class: 'pb-art', loading: 'lazy', decoding: 'async', alt: '', src: artUrl(title, variant) });
}

function showError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

/* Landing page */

function emailCapture(idBase) {
  const inputId = `${idBase}-email`;
  const errorId = `${idBase}-error`;
  const input = h('input', {
    class: 'pb-input',
    id: inputId,
    type: 'email',
    name: 'email',
    autocomplete: 'email',
    placeholder: 'name@example.com',
    'aria-describedby': errorId,
  });
  const error = h('p', { class: 'pb-error', id: errorId, role: 'alert', hidden: true });
  input.addEventListener('input', () => showError(input, error, ''));

  return h('form', {
    class: 'pb-capture',
    noValidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      const email = input.value.trim();
      if (!EMAIL_PATTERN.test(email)) {
        showError(input, error, EMAIL_ERROR);
        input.focus();
        return;
      }
      navigate(`/signup?email=${encodeURIComponent(email)}`);
    },
  },
    h('label', { class: 'pb-label', for: inputId }, 'Your email, any address will do'),
    h('div', { class: 'pb-capture-row' },
      input,
      h('button', { class: 'btn btn-accent pb-capture-btn', type: 'submit' }, 'Start the demo', icon('chevron-right', 20)),
    ),
    error,
  );
}

function collage(titles) {
  const columns = [];
  for (let c = 0; c < 7; c += 1) {
    const items = titles.slice(c * 5, c * 5 + 5).map((title) => h('img', {
      class: 'pb-collage-img',
      decoding: 'async',
      alt: '',
      src: artUrl(title, 'poster'),
    }));
    columns.push(h('div', { class: 'pb-collage-col' }, items));
  }
  return h('div', { class: 'pb-collage', 'aria-hidden': 'true' }, h('div', { class: 'pb-collage-tilt' }, columns));
}

function publicHeader() {
  return h('header', { class: 'pb-header' },
    homeLink(),
    h('a', { class: 'btn btn-accent pb-signin', href: '#/login' }, 'Sign In'),
  );
}

function band(heading, copy, visual) {
  return h('section', { class: 'pb-band' },
    h('div', { class: 'pb-band-copy' },
      h('h2', { class: 'pb-band-title' }, heading),
      h('p', { class: 'pb-band-text' }, copy),
    ),
    h('div', { class: 'pb-band-visual', 'aria-hidden': 'true' }, visual),
  );
}

function artVisual(title) {
  return h('div', { class: 'pb-frame' },
    poster(title, 'card'),
    h('span', { class: 'pb-frame-play' }, icon('play', 30)),
  );
}

function resumeVisual(title) {
  return h('div', { class: 'pb-frame' },
    poster(title, 'card'),
    h('div', { class: 'pb-resume' },
      h('span', { class: 'pb-resume-name' }, title.name),
      h('span', { class: 'pb-resume-left' }, '18m left'),
      h('span', { class: 'pb-resume-bar' }, h('span', { class: 'pb-resume-fill' })),
    ),
  );
}

function profilesVisual() {
  const people = [
    { id: 'pb-demo-1', name: 'Mara', avatar: 1, isKids: false },
    { id: 'pb-demo-2', name: 'Theo', avatar: 4, isKids: false },
    { id: 'pb-demo-3', name: 'Juno', avatar: 7, isKids: false },
    { id: 'pb-demo-4', name: 'Kids', avatar: 10, isKids: true },
  ];
  return h('div', { class: 'pb-people' }, people.map((person) => h('div', { class: 'pb-person' },
    avatarNode(person, 84),
    h('span', {}, person.name),
  )));
}

function moodsVisual(titles) {
  const moods = [...new Set(titles.flatMap((title) => title.moods))].slice(0, 12);
  return h('div', { class: 'pb-chips' }, moods.map((mood) => h('span', { class: 'pb-chip' }, mood)));
}

function trendingTile(title, rank) {
  return h('li', { class: 'pb-tile' },
    h('a', { class: 'pb-tile-link', href: '#/signup', 'aria-label': `Number ${rank}: ${title.name}. Create a demo membership to watch` },
      h('span', { class: 'pb-tile-art' },
        poster(title),
        h('span', { class: 'pb-tile-rank' }, String(rank)),
      ),
      h('span', { class: 'pb-tile-name' }, title.name),
      h('span', { class: 'pb-tile-meta' }, `${title.year} | ${title.type === 'movie' ? 'Film' : 'Series'}`),
    ),
  );
}

function faqItem(entry, index, items) {
  const panelId = `pb-faq-panel-${index}`;
  const panel = h('div', { class: 'pb-faq-panel', id: panelId, hidden: true }, h('p', {}, entry.a));
  const button = h('button', {
    class: 'pb-faq-btn',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': panelId,
    onclick: () => {
      const opening = panel.hidden;
      items.forEach((item) => item.setOpen(false));
      setOpen(opening);
    },
  }, h('span', {}, entry.q), icon('plus', 24));

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  items.push({ setOpen });
  return h('div', { class: 'pb-faq-item' }, h('h3', { class: 'pb-faq-q' }, button), panel);
}

function faqSection() {
  const items = [];
  return h('section', { class: 'pb-section pb-faq' },
    h('h2', { class: 'pb-section-title' }, 'Questions, answered'),
    h('div', { class: 'pb-faq-list' }, FAQ.map((entry, index) => faqItem(entry, index, items))),
  );
}

function publicFooter() {
  return h('footer', { class: 'pb-footer' },
    homeLink(),
    h('nav', { class: 'pb-footer-links', 'aria-label': 'Footer' },
      h('a', { href: '#/login' }, 'Sign In'),
      h('a', { href: '#/signup' }, 'Create a demo membership'),
    ),
    h('p', { class: 'pb-footer-note' }, 'Lumora is a demo project, not affiliated with any streaming service. All titles and people are invented.'),
  );
}

export function renderLanding(container) {
  const popular = popularTitles();
  const series = popular.filter((title) => title.type === 'series');

  container.append(h('div', { class: 'pb-page' },
    h('section', { class: 'pb-hero' },
      collage(popular),
      h('div', { class: 'pb-hero-shade' }),
      publicHeader(),
      h('div', { class: 'pb-hero-body' },
        h('h1', { class: 'pb-hero-title' }, 'Stories that glow long after the credits.'),
        h('p', { class: 'pb-hero-sub' }, 'Wander a library of invented series and films, each one painted live in your browser. Choose a profile, press play and stay a while.'),
        emailCapture('pb-hero'),
        h('p', { class: 'pb-hero-fine' }, 'A free demo. No payment details, no real password, nothing to install.'),
      ),
    ),
    band(
      'Every frame is painted on the spot',
      'No downloads and no video files. Posters, backdrops and full-screen scenes are drawn by your browser the moment you ask for them, so no two worlds look alike.',
      artVisual(popular[0]),
    ),
    band(
      'A seat for everyone on the couch',
      'Give each person their own profile, with a separate list, ratings and viewing history. The Kids profile keeps things gentle without any extra setup.',
      profilesVisual(),
    ),
    band(
      'Pick up where the plot left you',
      'Lumora remembers the exact moment you stopped. Come back tomorrow and the cliffhanger is waiting for you, one click away.',
      resumeVisual(series[0] || popular[1]),
    ),
    band(
      'Search by feeling, not only by genre',
      'In the mood for something witty, or something that lingers? Search understands moods as well as names, so tonight\'s pick can start with a feeling.',
      moodsVisual(popular),
    ),
    h('section', { class: 'pb-section pb-trending' },
      h('h2', { class: 'pb-section-title' }, 'Trending on Lumora'),
      h('ol', { class: 'pb-tiles' }, getTopTen().map((title, index) => trendingTile(title, index + 1))),
    ),
    faqSection(),
    h('section', { class: 'pb-section pb-closing' },
      h('h2', { class: 'pb-section-title' }, 'Your first story is one step away'),
      emailCapture('pb-closing'),
    ),
    publicFooter(),
  ));
}

/* Sign in and sign up */

function demoNote(extra) {
  return h('div', { class: 'pb-note', role: 'note' },
    icon('info', 22),
    h('p', {},
      h('strong', {}, 'This is a demo. '),
      'Any email works. The password is not checked or stored, so do not use a real password.',
      extra ? ` ${extra}` : '',
    ),
  );
}

function authLayout(heading, body, wide) {
  const backdrop = popularTitles()[wide ? 2 : 1];
  return h('div', { class: 'pb-auth' },
    backdrop && h('img', { class: 'pb-auth-bg', alt: '', src: artUrl(backdrop, 'backdrop') }),
    h('div', { class: 'pb-auth-shade' }),
    h('header', { class: 'pb-header pb-auth-header' }, homeLink()),
    h('main', { class: 'pb-auth-main' },
      h('div', { class: `pb-auth-card${wide ? ' pb-auth-card-wide' : ''}` },
        h('h1', { class: 'pb-auth-title' }, heading),
        body,
      ),
    ),
  );
}

function emailField(initial) {
  const input = h('input', {
    class: 'pb-input',
    id: 'pb-auth-email',
    type: 'email',
    name: 'email',
    autocomplete: 'email',
    required: true,
    value: initial || '',
    'aria-describedby': 'pb-auth-email-error',
  });
  const error = h('p', { class: 'pb-error', id: 'pb-auth-email-error', role: 'alert', hidden: true });
  input.addEventListener('input', () => showError(input, error, ''));
  const el = h('div', { class: 'pb-field' }, h('label', { class: 'pb-label', for: 'pb-auth-email' }, 'Email'), input, error);
  return { el, input, error };
}

function passwordField() {
  // The value is never read: the field exists only so the flow feels familiar.
  return h('div', { class: 'pb-field' },
    h('label', { class: 'pb-label', for: 'pb-auth-password' }, 'Password (not checked, may be left empty)'),
    h('input', {
      class: 'pb-input',
      id: 'pb-auth-password',
      type: 'password',
      autocomplete: 'off',
      placeholder: 'Anything but a real password',
    }),
  );
}

function validatedEmail(field) {
  const email = field.input.value.trim();
  if (EMAIL_PATTERN.test(email)) return email;
  showError(field.input, field.error, EMAIL_ERROR);
  field.input.focus();
  return null;
}

export function renderLogin(container, ctx) {
  const email = emailField(ctx?.query?.email);
  const form = h('form', {
    class: 'pb-form',
    noValidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      const value = validatedEmail(email);
      if (!value) return;
      signIn(value);
      navigate('/profiles');
    },
  },
    demoNote(),
    email.el,
    passwordField(),
    h('button', { class: 'btn btn-accent pb-submit', type: 'submit' }, 'Sign In'),
    h('p', { class: 'pb-switch' }, 'New to Lumora? ', h('a', { href: '#/signup' }, 'Create a demo membership')),
  );
  container.append(authLayout('Welcome back', form));
  email.input.focus();
}

function formatPrice(price) {
  return typeof price === 'number' ? `$${price.toFixed(2)} a month` : String(price);
}

function formatScreens(screens) {
  if (typeof screens !== 'number') return String(screens);
  return `${screens} ${screens === 1 ? 'screen' : 'screens'} at a time`;
}

function planPicker({ name, legend, selected, onChange }) {
  return h('fieldset', { class: 'pb-plans' },
    h('legend', { class: 'pb-label' }, legend),
    h('div', { class: 'pb-plan-grid' }, PLANS.map((plan) => h('label', { class: 'pb-plan' },
      h('input', {
        class: 'pb-plan-input',
        type: 'radio',
        name,
        value: plan.id,
        checked: plan.id === selected,
        onchange: onChange ? () => onChange(plan.id) : null,
      }),
      h('span', { class: 'pb-plan-body' },
        h('span', { class: 'pb-plan-head' },
          h('span', { class: 'pb-plan-name' }, plan.name),
          h('span', { class: 'pb-plan-check' }, icon('check', 18)),
        ),
        h('span', { class: 'pb-plan-price' }, formatPrice(plan.price)),
        h('span', { class: 'pb-plan-detail' }, plan.quality),
        h('span', { class: 'pb-plan-detail' }, formatScreens(plan.screens)),
      ),
    ))),
  );
}

export function renderSignup(container, ctx) {
  const email = emailField(ctx?.query?.email);
  const defaultPlan = (PLANS.find((plan) => plan.id === 'standard') || PLANS[0])?.id;
  const form = h('form', {
    class: 'pb-form',
    noValidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      const value = validatedEmail(email);
      if (!value) return;
      const choice = form.querySelector('input[name="pb-signup-plan"]:checked');
      signIn(value);
      if (choice) setPlan(choice.value);
      navigate('/profiles');
    },
  },
    demoNote('No payment details are requested, and the prices below are only for show.'),
    email.el,
    passwordField(),
    planPicker({ name: 'pb-signup-plan', legend: 'Choose a plan', selected: defaultPlan }),
    h('button', { class: 'btn btn-accent pb-submit', type: 'submit' }, 'Create membership'),
    h('p', { class: 'pb-switch' }, 'Already joined? ', h('a', { href: '#/login' }, 'Sign in')),
  );
  container.append(authLayout('Create your demo membership', form, true));
  if (!email.input.value) email.input.focus();
}

/* Account */

function formatMemberSince(value) {
  const date = new Date(value);
  if (value === null || value === undefined || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function accountSection(heading, ...content) {
  return h('section', { class: 'pb-acct-section' },
    h('h2', { class: 'pb-acct-heading' }, heading),
    h('div', { class: 'pb-acct-content' }, content),
  );
}

function detail(label, valueEl) {
  return h('div', { class: 'pb-detail' }, h('dt', {}, label), h('dd', {}, valueEl));
}

function settingToggle({ key, label, hint }) {
  const input = h('input', {
    class: 'pb-toggle-input',
    type: 'checkbox',
    role: 'switch',
    onchange: (event) => setSettings({ [key]: event.target.checked }),
  });
  const el = h('label', { class: 'pb-toggle' },
    h('span', { class: 'pb-toggle-copy' },
      h('span', { class: 'pb-toggle-label' }, label),
      h('span', { class: 'pb-toggle-hint' }, hint),
    ),
    input,
    h('span', { class: 'pb-toggle-track' }, h('span', { class: 'pb-toggle-thumb' })),
  );
  return { el, input, key };
}

export function renderAccount(container) {
  const email = h('span', {});
  const since = h('span', {});
  const planName = h('span', {});
  const status = h('p', { class: 'pb-status', role: 'status' });
  const settingsOwner = h('p', { class: 'pb-acct-owner' });
  const profileList = h('ul', { class: 'pb-profile-list' });
  const toggles = PLAYBACK_TOGGLES.map(settingToggle);
  const volumeValue = h('output', { class: 'pb-volume-value', for: 'pb-volume' });
  const volume = h('input', {
    class: 'pb-volume',
    id: 'pb-volume',
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    oninput: () => { volumeValue.textContent = `${volume.value}%`; },
    onchange: () => setSettings({ volume: Number(volume.value) / 100 }),
  });
  const plans = planPicker({
    name: 'pb-account-plan',
    legend: 'Change plan',
    selected: getAccount()?.plan,
    onChange: (planId) => {
      setPlan(planId);
      const plan = PLANS.find((item) => item.id === planId);
      status.textContent = `You are now on the ${plan.name} plan. No payment is involved in this demo.`;
    },
  });

  function refresh() {
    if (!isSignedIn()) return;
    const account = getAccount();
    if (account) {
      email.textContent = account.email;
      since.textContent = formatMemberSince(account.memberSince) || 'Today';
      planName.textContent = PLANS.find((plan) => plan.id === account.plan)?.name || account.plan;
      plans.querySelectorAll('input').forEach((input) => { input.checked = input.value === account.plan; });
    }

    const active = getActiveProfile();
    settingsOwner.textContent = active ? `These settings apply to the ${active.name} profile.` : '';
    profileList.replaceChildren(...getProfiles().map((profile) => h('li', { class: 'pb-profile' },
      avatarNode(profile, 48),
      h('span', { class: 'pb-profile-name' }, profile.name),
      profile.isKids && h('span', { class: 'badge' }, 'Kids'),
    )));

    if (!active) return;
    const settings = getSettings();
    toggles.forEach(({ input, key }) => { input.checked = Boolean(settings[key]); });
    if (document.activeElement !== volume) {
      const percent = Math.round((settings.volume ?? 0.8) * 100);
      volume.value = String(percent);
      volumeValue.textContent = `${percent}%`;
    }
  }

  container.append(h('div', { class: 'page-pad pb-acct' },
    h('h1', { class: 'pb-acct-title' }, 'Account'),
    accountSection('Membership',
      h('dl', { class: 'pb-details' },
        detail('Email', email),
        detail('Member since', since),
        detail('Current plan', planName),
      ),
      h('button', {
        class: 'btn btn-secondary',
        type: 'button',
        onclick: () => {
          signOut();
          navigate('/');
        },
      }, 'Sign out'),
    ),
    accountSection('Plan',
      plans,
      status,
      h('p', { class: 'pb-acct-fine' }, 'Plans are part of the demo. Switching is instant and nothing is ever charged.'),
    ),
    accountSection('Playback settings',
      settingsOwner,
      h('div', { class: 'pb-toggles' }, toggles.map((toggle) => toggle.el)),
      h('div', { class: 'pb-volume-row' },
        h('label', { class: 'pb-toggle-label', for: 'pb-volume' }, 'Default volume'),
        volume,
        volumeValue,
      ),
    ),
    accountSection('Profiles',
      profileList,
      h('a', { class: 'btn btn-secondary', href: '#/profiles/manage' }, icon('pencil', 18), 'Manage Profiles'),
    ),
  ));

  refresh();
  return subscribe(refresh);
}
