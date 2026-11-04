// All persistent state for Lumora. Everything lives in localStorage under `lumora:`, falling back to
// memory when storage is missing or full. Nothing here touches the DOM except avatarNode.
//
//   lumora:session             { email, activeProfileId }   removed on sign-out
//   lumora:account:<email>     { email, plan, memberSince, profiles: [...] }
//   lumora:p:<profileId>:<kind>  list | ratings | progress | settings

const PREFIX = 'lumora:';
const SESSION_KEY = 'session';
const DATA_KINDS = ['list', 'ratings', 'progress', 'settings'];
const RATINGS = ['up', 'down', 'love'];
const CONTINUE_CUTOFF = 0.95;
const DEFAULT_PLAN = 'standard';
const DEFAULT_SETTINGS = Object.freeze({
  autoplayPreviews: true,
  autoplayNext: true,
  subtitles: false,
  muted: false,
  volume: 0.8,
});

export const MAX_PROFILES = 5;
export const MIN_PROFILES = 1;
export const MAX_NAME_LENGTH = 20;
export const AVATAR_COUNT = 12;
export const AVATAR_NAMES = Object.freeze([
  'Sun', 'Moon', 'Robot', 'Cat', 'Ghost', 'Cyclops', 'Fox', 'Owl', 'Cactus', 'Penguin', 'Mushroom', 'Planet',
]);

export const PLANS = Object.freeze([
  Object.freeze({ id: 'basic', name: 'Basic', price: 7.99, quality: 'HD 720p', screens: 1 }),
  Object.freeze({ id: 'standard', name: 'Standard', price: 12.99, quality: 'Full HD 1080p', screens: 2 }),
  Object.freeze({ id: 'premium', name: 'Premium', price: 18.99, quality: 'Ultra HD 4K + HDR', screens: 4 }),
]);

/* ---------- Storage ---------- */

// Values whose write failed. Read first, so a full or blocked store still behaves consistently.
const memory = new Map();

function backend() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readRaw(key) {
  const full = PREFIX + key;
  if (memory.has(full)) return memory.get(full);
  try {
    const value = backend()?.getItem(full);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function read(key, fallback) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const full = PREFIX + key;
  const raw = JSON.stringify(value);
  try {
    const store = backend();
    if (!store) throw new Error('no storage');
    store.setItem(full, raw);
    memory.delete(full);
  } catch {
    memory.set(full, raw);
  }
}

function remove(key) {
  const full = PREFIX + key;
  memory.delete(full);
  try {
    backend()?.removeItem(full);
  } catch {
    // Nothing to do: the memory copy is already gone.
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObject(key) {
  const value = read(key, null);
  return isPlainObject(value) ? value : {};
}

/* ---------- Subscriptions ---------- */

const listeners = new Set();

function notify() {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (error) {
      console.error('Lumora store subscriber failed', error);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Other tabs share the same storage, so their changes count as changes here too.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === null) memory.clear();
    else if (event.key.startsWith(PREFIX)) memory.delete(event.key);
    else return;
    notify();
  });
}

/* ---------- Normalizers ---------- */

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function cleanName(name) {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, MAX_NAME_LENGTH).join('').trim();
}

function isAvatar(value) {
  return Number.isInteger(value) && value >= 0 && value < AVATAR_COUNT;
}

function isTitleId(id) {
  // `__proto__` would write to the prototype of the maps below rather than to the map.
  return typeof id === 'string' && id !== '' && id !== '__proto__';
}

function hasOwn(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function readProfile(value) {
  if (!isPlainObject(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    name: cleanName(value.name) || 'Profile',
    avatar: isAvatar(value.avatar) ? value.avatar : 0,
    isKids: value.isKids === true,
  };
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function readProgress(id, value) {
  if (!isPlainObject(value) || !finite(value.positionSec) || !finite(value.durationSec)) return null;
  return {
    id,
    season: finite(value.season) ? value.season : null,
    episode: finite(value.episode) ? value.episode : null,
    positionSec: value.positionSec,
    durationSec: value.durationSec,
    updatedAt: finite(value.updatedAt) ? value.updatedAt : 0,
  };
}

/* ---------- Session and account ---------- */

function accountKey(email) {
  return `account:${email}`;
}

function getSession() {
  const session = readObject(SESSION_KEY);
  return typeof session.email === 'string' && session.email ? session : null;
}

function getRecord() {
  const session = getSession();
  if (!session) return null;
  const record = read(accountKey(session.email), null);
  return isPlainObject(record) ? record : null;
}

function saveRecord(record) {
  write(accountKey(record.email), record);
}

function recordProfiles(record) {
  if (!record || !Array.isArray(record.profiles)) return [];
  return record.profiles.map(readProfile).filter(Boolean);
}

let idCounter = 0;

function newProfileId() {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function seedProfiles(email) {
  const handle = email.split('@')[0].split(/[^a-z0-9]+/)[0] || '';
  const first = cleanName(handle.charAt(0).toUpperCase() + handle.slice(1)) || 'Viewer';
  const second = first === 'Guest' ? 'Friend' : 'Guest';
  return [
    { id: newProfileId(), name: first, avatar: 0, isKids: false },
    { id: newProfileId(), name: second, avatar: 3, isKids: false },
    { id: newProfileId(), name: 'Kids', avatar: 9, isKids: true },
  ];
}

export function isSignedIn() {
  return getRecord() !== null;
}

export function signIn(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const stored = read(accountKey(normalized), null);
  const previous = isPlainObject(stored) ? stored : {};
  const profiles = recordProfiles(previous);
  saveRecord({
    email: normalized,
    plan: PLANS.some((plan) => plan.id === previous.plan) ? previous.plan : DEFAULT_PLAN,
    memberSince: typeof previous.memberSince === 'string' ? previous.memberSince : new Date().toISOString(),
    profiles: profiles.length ? profiles : seedProfiles(normalized),
  });
  const session = getSession();
  write(SESSION_KEY, {
    email: normalized,
    activeProfileId: session?.email === normalized ? session.activeProfileId ?? null : null,
  });
  notify();
  return getAccount();
}

// Per-profile data and the account record stay behind so the same email picks up where it left off.
export function signOut() {
  if (!getSession()) return;
  remove(SESSION_KEY);
  notify();
}

export function getAccount() {
  const record = getRecord();
  if (!record) return null;
  return { email: record.email, plan: record.plan, memberSince: record.memberSince };
}

export function setPlan(planId) {
  const record = getRecord();
  if (!record || !PLANS.some((plan) => plan.id === planId)) return null;
  if (record.plan !== planId) {
    record.plan = planId;
    saveRecord(record);
    notify();
  }
  return getAccount();
}

/* ---------- Profiles ---------- */

export function getProfiles() {
  return recordProfiles(getRecord());
}

export function getActiveProfile() {
  const session = getSession();
  if (!session || !session.activeProfileId) return null;
  return getProfiles().find((profile) => profile.id === session.activeProfileId) || null;
}

export function setActiveProfile(id) {
  const session = getSession();
  const profile = getProfiles().find((candidate) => candidate.id === id);
  if (!session || !profile) return null;
  if (session.activeProfileId !== id) {
    write(SESSION_KEY, { ...session, activeProfileId: id });
    notify();
  }
  return profile;
}

export function clearActiveProfile() {
  const session = getSession();
  if (!session || !session.activeProfileId) return;
  write(SESSION_KEY, { ...session, activeProfileId: null });
  notify();
}

export function addProfile({ name, avatar, isKids = false } = {}) {
  const record = getRecord();
  if (!record) return null;
  const profiles = recordProfiles(record);
  const cleaned = cleanName(name);
  if (!cleaned || profiles.length >= MAX_PROFILES) return null;
  const used = new Set(profiles.map((profile) => profile.avatar));
  let chosen = avatar;
  if (!isAvatar(chosen)) {
    chosen = 0;
    while (chosen < AVATAR_COUNT - 1 && used.has(chosen)) chosen += 1;
  }
  const profile = { id: newProfileId(), name: cleaned, avatar: chosen, isKids: !!isKids };
  record.profiles = [...profiles, profile];
  saveRecord(record);
  notify();
  return { ...profile };
}

export function updateProfile(id, patch = {}) {
  const record = getRecord();
  if (!record || !isPlainObject(patch)) return null;
  const profiles = recordProfiles(record);
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) return null;
  if ('name' in patch) profile.name = cleanName(patch.name) || profile.name;
  if (isAvatar(patch.avatar)) profile.avatar = patch.avatar;
  if ('isKids' in patch) profile.isKids = !!patch.isKids;
  record.profiles = profiles;
  saveRecord(record);
  notify();
  return { ...profile };
}

export function deleteProfile(id) {
  const record = getRecord();
  if (!record) return false;
  const profiles = recordProfiles(record);
  if (profiles.length <= MIN_PROFILES || !profiles.some((profile) => profile.id === id)) return false;
  record.profiles = profiles.filter((profile) => profile.id !== id);
  saveRecord(record);
  for (const kind of DATA_KINDS) remove(`p:${id}:${kind}`);
  const session = getSession();
  if (session.activeProfileId === id) write(SESSION_KEY, { ...session, activeProfileId: null });
  notify();
  return true;
}

/* ---------- Per-profile data ---------- */

function dataKey(kind) {
  const profile = getActiveProfile();
  return profile ? `p:${profile.id}:${kind}` : null;
}

export function getMyList() {
  const key = dataKey('list');
  if (!key) return [];
  const list = read(key, []);
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
}

export function isInList(id) {
  return getMyList().includes(id);
}

// Returns whether the title is in the list afterwards. Most recently added comes first.
export function toggleList(id) {
  const key = dataKey('list');
  if (!key || !isTitleId(id)) return false;
  const list = getMyList();
  const present = list.includes(id);
  write(key, present ? list.filter((item) => item !== id) : [id, ...list]);
  notify();
  return !present;
}

export function getRating(id) {
  const key = dataKey('ratings');
  if (!key) return null;
  const ratings = readObject(key);
  if (!hasOwn(ratings, id)) return null;
  return RATINGS.includes(ratings[id]) ? ratings[id] : null;
}

export function setRating(id, rating) {
  const key = dataKey('ratings');
  const next = rating ?? null;
  if (!key || !isTitleId(id) || (next !== null && !RATINGS.includes(next))) return getRating(id);
  const ratings = readObject(key);
  if (next === null) delete ratings[id];
  else ratings[id] = next;
  write(key, ratings);
  notify();
  return next;
}

export function getProgress(id) {
  const key = dataKey('progress');
  if (!key) return null;
  const progress = readObject(key);
  return hasOwn(progress, id) ? readProgress(id, progress[id]) : null;
}

export function saveProgress(id, { season, episode, positionSec, durationSec } = {}) {
  const key = dataKey('progress');
  if (!key || !isTitleId(id) || !finite(positionSec) || !finite(durationSec)) return null;
  const progress = readObject(key);
  // Strictly increasing per profile, so two saves in one millisecond still sort newest first.
  const latest = Object.values(progress).reduce((max, item) => Math.max(max, finite(item?.updatedAt) ? item.updatedAt : 0), 0);
  const duration = Math.max(0, durationSec);
  const position = Math.max(0, duration > 0 ? Math.min(positionSec, duration) : positionSec);
  progress[id] = {
    season: finite(season) ? season : null,
    episode: finite(episode) ? episode : null,
    positionSec: position,
    durationSec: duration,
    updatedAt: Math.max(Date.now(), latest + 1),
  };
  write(key, progress);
  notify();
  return readProgress(id, progress[id]);
}

export function clearProgress(id) {
  const key = dataKey('progress');
  if (!key) return;
  const progress = readObject(key);
  if (!hasOwn(progress, id)) return;
  delete progress[id];
  write(key, progress);
  notify();
}

export function getContinueWatching() {
  const key = dataKey('progress');
  if (!key) return [];
  return Object.entries(readObject(key))
    .map(([id, value]) => readProgress(id, value))
    .filter((item) => item && item.durationSec > 0 && item.positionSec / item.durationSec < CONTINUE_CUTOFF)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function cleanSettings(value) {
  const settings = { ...DEFAULT_SETTINGS };
  if (!isPlainObject(value)) return settings;
  for (const name of ['autoplayPreviews', 'autoplayNext', 'subtitles', 'muted']) {
    if (typeof value[name] === 'boolean') settings[name] = value[name];
  }
  if (finite(value.volume)) settings.volume = Math.min(1, Math.max(0, value.volume));
  return settings;
}

export function getSettings() {
  const key = dataKey('settings');
  return cleanSettings(key ? read(key, null) : null);
}

export function setSettings(patch) {
  const key = dataKey('settings');
  if (!key) return getSettings();
  const settings = cleanSettings({ ...getSettings(), ...(isPlainObject(patch) ? patch : {}) });
  write(key, settings);
  notify();
  return settings;
}

/* ---------- Avatars ---------- */

const FACE = '#241a2e';
const AVATARS = [
  // Sun
  ['#ffc24d', '#ff7a3d', `
    <path d="M50 8v11M50 85v11M6 52h11M83 52h11M19 21l8 8M73 75l8 8M81 21l-8 8M27 75l-8 8" stroke="#fff3c4" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="52" r="25" fill="#ffe27a"/>
    <circle cx="41" cy="47" r="3.6" fill="#5b2c0a"/><circle cx="59" cy="47" r="3.6" fill="#5b2c0a"/>
    <path d="M38 58q12 12 24 0" fill="none" stroke="#5b2c0a" stroke-width="3.6" stroke-linecap="round"/>`],
  // Moon
  ['#26336f', '#0b0f2c', `
    <path d="M60 16a35 35 0 1 0 24 56a29 29 0 1 1-24-56z" fill="#f6e8b4"/>
    <path d="M26 46q5 5 10 0M28 64q6 5 12 0" fill="none" stroke="#3b3560" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M74 26l2.4 6.6 6.6 2.4-6.6 2.4-2.4 6.6-2.4-6.6-6.6-2.4 6.6-2.4z" fill="#fff"/>
    <circle cx="86" cy="54" r="2" fill="#fff"/><circle cx="62" cy="50" r="1.8" fill="#fff"/>`],
  // Robot
  ['#16b5ad', '#07505e', `
    <path d="M50 26V14" stroke="#e7f3f4" stroke-width="4"/><circle cx="50" cy="12" r="5" fill="#ffd34d"/>
    <rect x="12" y="44" width="10" height="20" rx="3" fill="#a9c3c9"/><rect x="78" y="44" width="10" height="20" rx="3" fill="#a9c3c9"/>
    <rect x="20" y="26" width="60" height="56" rx="11" fill="#e7f3f4"/>
    <rect x="28" y="38" width="44" height="18" rx="9" fill="#10303a"/>
    <circle cx="40" cy="47" r="5" fill="#6ff5e6"/><circle cx="60" cy="47" r="5" fill="#6ff5e6"/>
    <path d="M34 70h32M41 64v12M50 64v12M59 64v12" stroke="#10303a" stroke-width="3" fill="none"/>`],
  // Cat
  ['#ff6aa9', '#b4206f', `
    <path d="M23 38L25 12L44 27Q50 25 56 27L75 12L77 38Q83 47 81 57C79 75 64 86 50 86C36 86 21 75 19 57Q17 47 23 38Z" fill="#2a1731"/>
    <path d="M28 21l1 11 8-6zM72 21l-1 11-8-6z" fill="#ff9cc6"/>
    <path d="M30 50q7-8 14 0q-7 7-14 0zM56 50q7-8 14 0q-7 7-14 0z" fill="#ffe14d"/>
    <rect x="35.8" y="44.5" width="2.6" height="11" rx="1.3" fill="#2a1731"/><rect x="61.6" y="44.5" width="2.6" height="11" rx="1.3" fill="#2a1731"/>
    <path d="M46 62h8l-4 5z" fill="#ff9cc6"/>
    <path d="M38 64l-20-3M38 69l-19 4M62 64l20-3M62 69l19 4" stroke="#f7e8f2" stroke-width="1.8" stroke-linecap="round"/>`],
  // Ghost
  ['#8a5cff', '#34178f', `
    <path d="M22 88V46a28 28 0 0 1 56 0v42l-9.3-8-9.4 8-9.3-8-9.3 8-9.4-8z" fill="#f5f2ff"/>
    <ellipse cx="39" cy="44" rx="5.5" ry="8" fill="${FACE}"/><ellipse cx="61" cy="44" rx="5.5" ry="8" fill="${FACE}"/>
    <ellipse cx="50" cy="62" rx="5" ry="6.5" fill="${FACE}"/>
    <circle cx="29" cy="55" r="4" fill="#ffc2e0"/><circle cx="71" cy="55" r="4" fill="#ffc2e0"/>`],
  // Cyclops
  ['#c7f05a', '#5da514', `
    <path d="M32 26L26 10l16 10M68 26l6-16-16 10" fill="#f9f3d6"/>
    <path d="M50 18c21 0 34 15 34 36s-13 34-34 34-34-13-34-34 13-36 34-36z" fill="#17694a"/>
    <circle cx="50" cy="46" r="18" fill="#fff"/><circle cx="50" cy="46" r="10" fill="#ff8a2b"/><circle cx="50" cy="46" r="5" fill="#10201a"/><circle cx="53" cy="43" r="2" fill="#fff"/>
    <path d="M32 72q18 10 36 0" fill="none" stroke="#0a3a29" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M42 75.5l3 6 3-4.5zM58 75.5l-3 6-3-4.5z" fill="#fff"/>`],
  // Fox
  ['#4b2a1b', '#1d0f0a', `
    <path d="M14 14L36 36Q50 30 64 36L86 14L84 56L50 90L16 56Z" fill="#f47b28"/>
    <path d="M16 56L50 90V68Q40 52 22 46Z" fill="#fff4e6"/><path d="M84 56L50 90V68Q60 52 78 46Z" fill="#fff4e6"/>
    <path d="M20 22l13 13-11 3zM80 22L67 35l11 3z" fill="#3b1a0c"/>
    <path d="M32 50l11 3-3 5q-6-1-8-8zM68 50l-11 3 3 5q6-1 8-8z" fill="#20100a"/>
    <path d="M43 78h14l-7 9z" fill="#20100a"/>`],
  // Owl
  ['#3a86ff', '#0f2f86', `
    <path d="M24 30L20 12l17 11zM76 30l4-18-17 11z" fill="#6b3f1f"/>
    <ellipse cx="50" cy="55" rx="34" ry="37" fill="#8b5a2b"/>
    <ellipse cx="50" cy="70" rx="20" ry="20" fill="#e9cfa6"/>
    <path d="M38 66q4 4 8 0M54 66q4 4 8 0M46 77q4 4 8 0" fill="none" stroke="#8b5a2b" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="35" cy="40" r="15" fill="#fff"/><circle cx="65" cy="40" r="15" fill="#fff"/>
    <circle cx="35" cy="40" r="8" fill="#ffb627"/><circle cx="65" cy="40" r="8" fill="#ffb627"/>
    <circle cx="35" cy="40" r="4.4" fill="#111"/><circle cx="65" cy="40" r="4.4" fill="#111"/>
    <path d="M45 48h10l-5 10z" fill="#ff9a1f"/>`],
  // Cactus
  ['#ffe3a8', '#ec9f58', `
    <circle cx="78" cy="22" r="11" fill="#fff4cf"/>
    <path d="M0 84q50-12 100 0v16H0z" fill="#b5642f"/>
    <path d="M30 40v14a8 8 0 0 0 8 8h4M70 34v14a8 8 0 0 1-8 8h-4" fill="none" stroke="#2c8f5a" stroke-width="10" stroke-linecap="round"/>
    <rect x="37" y="20" width="26" height="70" rx="13" fill="#2c8f5a"/>
    <circle cx="45" cy="42" r="3" fill="#0f3121"/><circle cx="55" cy="42" r="3" fill="#0f3121"/>
    <path d="M44 51q6 6 12 0" fill="none" stroke="#0f3121" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M50 12l3 5 5.5 1-4 4 1 5.5-5.5-3-5.5 3 1-5.5-4-4 5.5-1z" fill="#ff5f8f"/>`],
  // Penguin
  ['#c9eeff', '#62b9ea', `
    <path d="M22 54q-10 14-8 24 10-4 16-14zM78 54q10 14 8 24-10-4-16-14z" fill="#1a2433"/>
    <ellipse cx="50" cy="54" rx="29" ry="38" fill="#1a2433"/>
    <path d="M50 32c-7-6-22-3-21 14 1 20 8 40 21 40s20-20 21-40c1-17-14-20-21-14z" fill="#fbfdff"/>
    <circle cx="41" cy="42" r="4" fill="#1a2433"/><circle cx="59" cy="42" r="4" fill="#1a2433"/>
    <path d="M43 50h14l-7 8z" fill="#ff9a1f"/>
    <path d="M32 92q6-7 14-2M68 92q-6-7-14-2" fill="none" stroke="#ff9a1f" stroke-width="5" stroke-linecap="round"/>`],
  // Mushroom
  ['#23875a', '#0b3a27', `
    <path d="M34 54h32v26a10 10 0 0 1-10 10H44a10 10 0 0 1-10-10z" fill="#f8eeda"/>
    <path d="M12 56a38 40 0 0 1 76 0q-38 8-76 0z" fill="#dd3b61"/>
    <circle cx="34" cy="36" r="7" fill="#fff4e0"/><circle cx="58" cy="28" r="9" fill="#fff4e0"/><circle cx="74" cy="46" r="5" fill="#fff4e0"/><circle cx="24" cy="50" r="3.6" fill="#fff4e0"/>
    <circle cx="43" cy="68" r="3" fill="#33241a"/><circle cx="57" cy="68" r="3" fill="#33241a"/>
    <path d="M44 77q6 5 12 0" fill="none" stroke="#33241a" stroke-width="2.8" stroke-linecap="round"/>`],
  // Planet
  ['#d9477f', '#3c0f52', `
    <g transform="rotate(-16 50 52)">
      <ellipse cx="50" cy="52" rx="44" ry="12" fill="none" stroke="#fff0c9" stroke-width="4.5"/>
    </g>
    <circle cx="50" cy="52" r="26" fill="#ffc857"/>
    <path d="M27 40q23 8 46 0M25 60q25 7 50 0" fill="none" stroke="#f29b38" stroke-width="3.5"/>
    <circle cx="41" cy="46" r="3.3" fill="#3c1a2e"/><circle cx="59" cy="46" r="3.3" fill="#3c1a2e"/>
    <path d="M43 53q7 6 14 0" fill="none" stroke="#3c1a2e" stroke-width="2.8" stroke-linecap="round"/>
    <g transform="rotate(-16 50 52)">
      <path d="M6 52a44 12 0 0 0 88 0" fill="none" stroke="#fff0c9" stroke-width="4.5"/>
    </g>
    <circle cx="16" cy="20" r="2.2" fill="#fff"/><circle cx="84" cy="82" r="2.2" fill="#fff"/><circle cx="24" cy="86" r="1.6" fill="#fff"/>`],
];

let avatarInstance = 0;

export function avatarNode(profile, size = 96) {
  const index = isAvatar(profile?.avatar) ? profile.avatar : 0;
  const px = finite(size) && size > 0 ? size : 96;
  const [from, to, art] = AVATARS[index];
  // Each instance gets its own gradient id: a hidden duplicate id would blank every other copy.
  avatarInstance += 1;
  const gradient = `pf-avatar-bg-${avatarInstance}`;
  const node = document.createElement('span');
  node.className = 'pf-avatar';
  node.setAttribute('aria-hidden', 'true');
  node.dataset.avatar = String(index);
  Object.assign(node.style, {
    display: 'inline-block',
    flex: 'none',
    width: `${px}px`,
    height: `${px}px`,
    borderRadius: '12%',
    overflow: 'hidden',
    lineHeight: '0',
  });
  node.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <defs><linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#${gradient})"/>${art}</svg>`;
  return node;
}
