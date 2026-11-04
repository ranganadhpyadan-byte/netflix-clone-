import { h, icon } from '../dom.js';
import { navigate } from '../router.js';
import {
  addProfile,
  AVATAR_COUNT,
  AVATAR_NAMES,
  avatarNode,
  deleteProfile,
  getActiveProfile,
  getProfiles,
  isSignedIn,
  MAX_NAME_LENGTH,
  MAX_PROFILES,
  MIN_PROFILES,
  setActiveProfile,
  signOut,
  subscribe,
  updateProfile,
} from '../store.js';
import { logoMark } from '../ui/nav.js';

function pageFrame(headerAction) {
  const content = h('div', { class: 'pf-content' });
  const page = h('div', { class: 'pf-page' },
    h('header', { class: 'pf-header' }, logoMark(), headerAction),
    h('main', { class: 'pf-main' }, content),
  );
  return { page, content };
}

function nameLine(profile) {
  return h('span', { class: 'pf-name-line' },
    h('span', { class: 'pf-name' }, profile.name),
    profile.isKids && h('span', { class: 'badge pf-kids' }, 'Kids'),
  );
}

function addTile(onClick) {
  return h('li', {},
    h('button', { type: 'button', class: 'pf-tile', dataset: { pfTile: 'new' }, onClick },
      h('span', { class: 'pf-add-face' }, icon('plus', 48)),
      h('span', { class: 'pf-name-line' }, h('span', { class: 'pf-name' }, 'Add Profile')),
    ),
  );
}

/* ---------- Who's watching ---------- */

export function renderProfiles(container) {
  let leaving = false;
  const leave = (path) => {
    leaving = true;
    navigate(path);
  };

  const { page, content } = pageFrame(
    h('button', {
      type: 'button',
      class: 'pf-text-btn',
      onClick: () => {
        leaving = true;
        signOut();
        navigate('/');
      },
    }, 'Sign out'),
  );

  function choose(profile) {
    leaving = true;
    setActiveProfile(profile.id);
    navigate('/browse');
  }

  function draw() {
    const profiles = getProfiles();
    content.replaceChildren(
      h('h1', { class: 'pf-title' }, "Who's watching?"),
      h('ul', { class: 'pf-tiles' },
        profiles.map((profile) => h('li', {},
          h('button', { type: 'button', class: 'pf-tile', onClick: () => choose(profile) },
            avatarNode(profile, 160),
            nameLine(profile),
          ),
        )),
        profiles.length < MAX_PROFILES && addTile(() => leave('/profiles/manage?add=1')),
      ),
      h('div', { class: 'pf-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => leave('/profiles/manage') },
          icon('pencil', 18), 'Manage Profiles'),
      ),
    );
  }

  draw();
  container.replaceChildren(page);

  // Another tab can sign out or edit profiles while this one sits on the gate.
  const unsubscribe = subscribe(() => {
    if (leaving) return;
    if (!isSignedIn()) leave('/login');
    else draw();
  });
  return unsubscribe;
}

/* ---------- Manage ---------- */

export function renderManageProfiles(container, ctx) {
  // view: { mode: 'list', focus?: id } | { mode: 'edit', id: id|null } | { mode: 'confirm', id }
  let view = { mode: 'list' };
  let leaving = false;
  let mutating = false;

  const done = () => {
    leaving = true;
    navigate(getActiveProfile() ? '/browse' : '/profiles');
  };

  const { page, content } = pageFrame(null);

  function mutate(action) {
    mutating = true;
    try {
      return action();
    } finally {
      mutating = false;
    }
  }

  function findProfile(id) {
    return getProfiles().find((profile) => profile.id === id);
  }

  function show(next) {
    view = next;
    draw();
    focusForView();
  }

  function focusForView() {
    if (view.mode === 'list' && view.focus) {
      const target = content.querySelector(`[data-pf-tile="${CSS.escape(view.focus)}"]`);
      if (target) {
        target.focus();
        return;
      }
    }
    content.querySelector('h1, h2')?.focus();
  }

  function draw() {
    if (view.mode === 'edit') content.replaceChildren(editorView());
    else if (view.mode === 'confirm') content.replaceChildren(confirmView());
    else content.replaceChildren(...listView());
  }

  function listView() {
    const profiles = getProfiles();
    return [
      h('h1', { class: 'pf-title', tabIndex: -1 }, 'Manage Profiles'),
      h('ul', { class: 'pf-tiles' },
        profiles.map((profile) => h('li', {},
          h('button', {
            type: 'button',
            class: 'pf-tile pf-tile-edit',
            'aria-label': `Edit ${profile.name}`,
            dataset: { pfTile: profile.id },
            onClick: () => show({ mode: 'edit', id: profile.id }),
          },
          h('span', { class: 'pf-face-wrap' },
            avatarNode(profile, 160),
            h('span', { class: 'pf-edit-overlay' }, icon('pencil', 32)),
          ),
          nameLine(profile)),
        )),
        profiles.length < MAX_PROFILES && addTile(() => show({ mode: 'edit', id: null })),
      ),
      profiles.length >= MAX_PROFILES && h('p', { class: 'pf-note' }, `An account can have up to ${MAX_PROFILES} profiles.`),
      h('div', { class: 'pf-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onClick: done }, 'Done'),
      ),
    ];
  }

  function editorView() {
    const existing = view.id ? findProfile(view.id) : null;
    const taken = new Set(getProfiles().map((profile) => profile.avatar));
    let firstFree = 0;
    while (firstFree < AVATAR_COUNT - 1 && taken.has(firstFree)) firstFree += 1;
    let avatar = existing ? existing.avatar : firstFree;

    const preview = h('div', { class: 'pf-preview' }, avatarNode({ avatar }, 160));
    const error = h('p', { class: 'pf-error', id: 'pf-name-error', role: 'alert' });
    const nameInput = h('input', {
      class: 'pf-input',
      id: 'pf-name-input',
      type: 'text',
      value: existing ? existing.name : '',
      maxLength: MAX_NAME_LENGTH,
      autocomplete: 'off',
      'aria-describedby': 'pf-name-error',
    });
    const kidsInput = h('input', { class: 'sr-only', type: 'checkbox', checked: !!existing?.isKids });

    const backToList = () => show({ mode: 'list', focus: existing ? existing.id : 'new' });

    function showError(message) {
      error.textContent = message;
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
    }

    function save(event) {
      event.preventDefault();
      const name = nameInput.value.replace(/\s+/g, ' ').trim();
      if (!name) {
        showError('Enter a name for this profile.');
        return;
      }
      const clash = getProfiles().some((profile) => profile.id !== existing?.id && profile.name.toLowerCase() === name.toLowerCase());
      if (clash) {
        showError('Another profile already has that name.');
        return;
      }
      const fields = { name, avatar, isKids: kidsInput.checked };
      const saved = mutate(() => (existing ? updateProfile(existing.id, fields) : addProfile(fields)));
      if (!saved) {
        showError(existing ? 'This profile no longer exists.' : `An account can have up to ${MAX_PROFILES} profiles.`);
        return;
      }
      show({ mode: 'list', focus: saved.id });
    }

    const canDelete = existing && getProfiles().length > MIN_PROFILES;

    return h('form', {
      class: 'pf-editor',
      noValidate: true,
      onSubmit: save,
      onKeydown: (event) => {
        if (event.key === 'Escape') backToList();
      },
    },
    h('h1', { class: 'pf-title pf-title-left', tabIndex: -1 }, existing ? 'Edit Profile' : 'Add Profile'),
    h('div', { class: 'pf-editor-grid' },
      preview,
      h('div', { class: 'pf-fields' },
        h('div', { class: 'pf-field' },
          h('label', { class: 'pf-label', for: 'pf-name-input' }, 'Name'),
          nameInput,
          error,
        ),
        h('label', { class: 'pf-toggle' },
          kidsInput,
          h('span', { class: 'pf-switch' }),
          h('span', { class: 'pf-toggle-text' },
            h('span', { class: 'pf-toggle-title' }, 'Kids profile'),
            h('span', { class: 'pf-toggle-hint' }, 'Only shows titles rated for younger viewers.'),
          ),
        ),
        h('fieldset', { class: 'pf-picker' },
          h('legend', { class: 'pf-label' }, 'Avatar'),
          h('div', { class: 'pf-picker-grid' },
            Array.from({ length: AVATAR_COUNT }, (_, index) => h('label', { class: 'pf-pick' },
              h('input', {
                class: 'sr-only',
                type: 'radio',
                name: 'pf-avatar',
                value: String(index),
                checked: index === avatar,
                'aria-label': AVATAR_NAMES[index],
                onChange: () => {
                  avatar = index;
                  preview.replaceChildren(avatarNode({ avatar }, 160));
                },
              }),
              h('span', { class: 'pf-pick-face' },
                avatarNode({ avatar: index }, 72),
                h('span', { class: 'pf-pick-check' }, icon('check', 16)),
              ),
            )),
          ),
        ),
      ),
    ),
    h('div', { class: 'pf-actions pf-actions-left' },
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save'),
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: backToList }, 'Cancel'),
      canDelete && h('button', {
        type: 'button',
        class: 'btn pf-danger',
        onClick: () => show({ mode: 'confirm', id: existing.id }),
      }, 'Delete Profile'),
    ),
    existing && !canDelete && h('p', { class: 'pf-note pf-note-left' }, 'An account needs at least one profile, so this one cannot be deleted.'),
    );
  }

  function confirmView() {
    const profile = findProfile(view.id);
    const { id } = view;
    return h('section', { class: 'pf-confirm' },
      avatarNode(profile, 120),
      h('h1', { class: 'pf-title', tabIndex: -1 }, `Delete ${profile.name}?`),
      h('p', { class: 'pf-confirm-text' }, "This removes the profile's My List, ratings, watch history and settings. It cannot be undone."),
      h('div', { class: 'pf-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => show({ mode: 'edit', id }) }, 'Keep Profile'),
        h('button', {
          type: 'button',
          class: 'btn pf-danger',
          onClick: () => {
            mutate(() => deleteProfile(id));
            show({ mode: 'list' });
          },
        }, 'Delete Profile'),
      ),
    );
  }

  if (ctx?.query?.add && getProfiles().length < MAX_PROFILES) view = { mode: 'edit', id: null };
  draw();
  container.replaceChildren(page);
  if (view.mode === 'edit') content.querySelector('.pf-input')?.focus();

  // Changes made by this page redraw themselves. These come from another tab, and an open form is
  // left alone unless the profile it is editing has gone.
  const unsubscribe = subscribe(() => {
    if (leaving || mutating) return;
    if (!isSignedIn()) {
      leaving = true;
      navigate('/login');
      return;
    }
    if (view.mode === 'list') draw();
    else if (view.id && !findProfile(view.id)) show({ mode: 'list' });
  });
  return unsubscribe;
}
