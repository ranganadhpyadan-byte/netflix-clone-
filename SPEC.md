# Lumora: build contract

Lumora is a Netflix-style streaming site with its own brand. Vanilla ES modules, no dependencies,
no build step, no network requests at runtime (all art and "video" is generated in the browser).
Served statically with `python -m http.server 8080`.

## Hard rules

- Only create/edit the files your module owns. Never edit `SPEC.md`, `index.html`, `css/base.css`,
  `js/main.js`, `js/router.js`, `js/dom.js`, or another agent's files. If you need a change there,
  report it in your final message.
- Other modules are being written at the same time. Code to the APIs below, exactly as named. Do not
  write stubs for them or wait for them to exist.
- Brand: the name is "Lumora". Never use Netflix's name, logo, "N" mark, or its exact red (#e50914),
  and never use real film/series titles, real actors, or real people. All content is invented.
- Use the tokens in `css/base.css`; prefix all your CSS classes with your module prefix (below) so
  nothing collides. Every interactive element must be keyboard reachable with visible focus
  (`:focus-visible` is styled globally). Respect `prefers-reduced-motion`. Layouts must work from
  360px to 1920px without horizontal page scroll. Icons are inline SVG; no emoji.
- Use `h()` from `js/dom.js` or `textContent`; never interpolate user input into `innerHTML`.
- Check your JS with `node --check <file>` before finishing. Node treats `.js` as CommonJS here, so if
  it complains about ESM syntax copy to a temp `.mjs` in your scratch space and check that.

## File ownership

| # | Module | Files | CSS prefix |
|---|--------|-------|------------|
| 1 | Catalog | `js/data/catalog.js` | none |
| 2 | Art | `js/art.js` | none |
| 3 | Nav and footer | `js/ui/nav.js`, `css/nav.css` | `nav-`, `ft-` |
| 4 | Hero | `js/ui/hero.js`, `css/hero.css` | `hero-` |
| 5 | Rows and cards | `js/ui/rows.js`, `css/rows.css` | `row-`, `card-` |
| 6 | Details modal | `js/ui/details.js`, `css/details.css` | `dt-` |
| 7 | Player | `js/pages/player.js`, `css/player.css` | `pl-` |
| 8 | Browse and search pages | `js/pages/browse.js`, `css/browse.css` | `br-` |
| 9 | Store and profiles | `js/store.js`, `js/pages/profiles.js`, `css/profiles.css` | `pf-` |
| 10 | Landing, auth, account | `js/pages/public.js`, `css/public.css` | `pb-` |

`index.html` already links every CSS file above. `js/main.js` already imports every page.

## Shared helpers (exist already)

```js
// js/dom.js
h(tag, attrs, ...children)   // attrs: class, dataset, style (object), on* handlers, aria-*, booleans
icon(name, size = 24)        // SVG element. Names: play, pause, plus, check, thumb-up, thumb-down, heart,
                             // chevron-down, chevron-left, chevron-right, x, search, bell, info,
                             // volume, volume-mute, fullscreen, fullscreen-exit, back-10, forward-10,
                             // captions, speed, episodes, next, arrow-left, pencil, lock, user, gear
slugify(text)                // "Sci-Fi & Fantasy" -> "sci-fi-fantasy"
formatRuntime(minutes)       // 134 -> "2h 14m", 42 -> "42m"
formatClock(seconds)         // 3725 -> "1:02:05", 65 -> "1:05"

// js/router.js
navigate(path)               // navigate('/watch/abc?s=1&e=2')
```

Page contract: `renderX(container, ctx)`, where `ctx = { params, query }` (plain objects). May return a
cleanup function, called when the route changes. Clean up timers, listeners, and animation frames.

## Routes (handled in `js/main.js`)

| Route | Renderer | Shell | Guard |
|-------|----------|-------|-------|
| `/` | `renderLanding` (public.js) | none | signed in -> `/browse` |
| `/login`, `/signup` | `renderLogin`, `renderSignup` (public.js) | none | signed in -> `/browse` |
| `/profiles` | `renderProfiles` (profiles.js) | none | sign-in |
| `/profiles/manage` | `renderManageProfiles` (profiles.js) | none | sign-in |
| `/browse` | `renderHome` (browse.js) | nav + footer | sign-in + profile |
| `/series`, `/films` | `renderSeries`, `renderFilms` | nav + footer | sign-in + profile |
| `/new` | `renderNew` | nav + footer | sign-in + profile |
| `/my-list` | `renderMyList` | nav + footer | sign-in + profile |
| `/genre/:slug` | `renderGenre` | nav + footer | sign-in + profile |
| `/search?q=` | `renderSearch` | nav + footer | sign-in + profile |
| `/account` | `renderAccount` (public.js) | nav + footer | sign-in + profile |
| `/watch/:id?s=&e=` | `renderPlayer` (player.js) | none | sign-in + profile |

## Module APIs

### 1. `js/data/catalog.js`

```ts
Title = {
  id: string,               // url-safe slug
  name: string, tagline: string, synopsis: string,   // synopsis 2-3 sentences
  type: 'movie' | 'series',
  year: number,
  maturity: 'G'|'PG'|'PG-13'|'R'|'TV-Y'|'TV-PG'|'TV-14'|'TV-MA',
  match: number,            // 70-99
  runtimeMin: number,       // movies: film length. series: typical episode length
  seasons: [{ number, episodes: [{ number, title, synopsis, runtimeMin }] }], // [] for movies
  genres: string[],         // from GENRES
  moods: string[],          // e.g. 'Witty', 'Dark', 'Heartfelt'
  cast: string[], creators: string[],   // invented names
  palette: [string, string, string],    // hex: dark background, mid, bright accent
  motif: 'mountains'|'city'|'orbit'|'waves'|'forest'|'neon'|'desert'|'grid'|'aurora'|'storm',
  popularity: number,       // 0-100
  isNew: boolean, isOriginal: boolean,
  comingSoon: string|null,  // ISO date, null if streaming now
  subtitleLines: string[],  // 8+ invented lines of dialogue for the player's captions
}
TITLES: Title[]              // at least 72 titles: ~40 series, ~32 films, ~6 comingSoon
GENRES: string[]             // 14+ genres, including 'Kids & Family'
getTitle(id): Title|undefined
titlesByGenre(genre: string): Title[]     // popularity desc
genreFromSlug(slug: string): string|undefined
searchTitles(query: string): Title[]      // name, cast, creators, genres, moods; case-insensitive; best first
getSimilar(id: string, n = 12): Title[]
getTopTen(type?: 'movie'|'series'): Title[]   // length 10, excludes comingSoon
getComingSoon(): Title[]                  // date asc
getHomeRows(): { title: string, items: Title[], ranked?: boolean }[]  // 10+ curated rows, 10+ items each
isKidsSafe(title): boolean                // G, PG, TV-Y, TV-PG
```

`comingSoon` titles appear only in `getComingSoon()` and `searchTitles()`, not in rows.

### 2. `js/art.js`

```ts
artUrl(title, variant: 'poster'|'card'|'backdrop'): string
  // SVG data URI, cached. poster 2:3, card 16:9, backdrop 16:9 large. Original, rich, cinematic art from
  // palette + motif, deterministic per title.id, with the title name set as a designed logotype on poster
  // and card. Backdrop has no text. Different titles must look clearly different.
logoNode(title): HTMLElement   // the title's styled logotype for hero/details overlays
renderScene(ctx: CanvasRenderingContext2D, title, tSec: number, w: number, h: number): void
  // Draws one frame of an animated "film" for title at time tSec: continuous, deterministic, looks like
  // moving cinematography (parallax, light, particles), changes shots every ~12s with a cut. 60fps-capable.
```

### 3. `js/ui/nav.js`

```ts
renderNav(container): cleanup    // fixed top bar, transparent over content, solid after scrolling 40px.
  // Logo -> /browse. Links: Home, Series, Films, New & Popular, My List (active state from location.hash);
  // collapses to a "Browse" dropdown below 900px. Expanding search box navigates to /search?q= as you type
  // (debounced 250ms, uses replace-like repeat navigate) and empties back to /browse when cleared.
  // Notification bell dropdown from getComingSoon() + isNew titles (click -> openDetails).
  // Profile dropdown: profiles to switch (setActiveProfile), Manage Profiles, Account, Sign out (signOut then navigate('/')).
  // Kids profile: hides the bell, adds a "Kids" badge.
renderFooter(container): cleanup // Link columns (non-functional demo links are fine, use # with preventDefault),
  // a "demo project, not affiliated with any streaming service" line.
Also export logoMark(size?): HTMLElement  // the Lumora wordmark, reused by public.js, profiles.js and player.js.
```

### 4. `js/ui/hero.js`

```ts
createHero(title): { el: HTMLElement, destroy(): void }
  // Full-bleed billboard (~85vh, shorter on mobile). Backdrop image, crossfading after 2s to a live canvas
  // preview using renderScene unless settings.autoplayPreviews is false or reduced motion is on.
  // logoNode, tagline/synopsis, Play (navigate to /watch/id), More Info (openDetails), mute toggle, maturity badge
  // at the right edge. Gradient fades into page background. Pauses when scrolled off screen or tab hidden.
```

### 5. `js/ui/rows.js`

```ts
createRow({ title, items, ranked = false, progress = false }): HTMLElement
  // Paged horizontal carousel with hover-reveal chevrons, page indicator bars, wrap-around, drag/touch scroll,
  // keyboard support. Responsive card count: 6 (>=1400), 5, 4, 3, 2 (mobile). Lazy images.
  // ranked: big outlined rank numerals beside poster art (Top 10 style).
  // progress: red-free accent progress bar from store getProgress on the card; click resumes in player.
createCard(title, opts?): HTMLElement
  // Art plus, on desktop hover after 400ms delay, a scaled-up popover (portal to body, clamped to viewport edges)
  // with Play, +/check My List (toggleList), rating thumb menu (setRating), expand chevron (openDetails), match %,
  // maturity, runtime or seasons, and 3 moods. Touch/click on the card opens openDetails.
createGrid(items): HTMLElement    // responsive wrapping grid of createCard
```

### 6. `js/ui/details.js`

```ts
openDetails(id: string): void    // modal dialog over the current page; only one at a time; focus trapped; Esc,
  // backdrop click and X close; restores focus; locks body scroll. Hero with backdrop + logoNode, Play/Resume
  // (from getProgress), My List, rating. Meta: match, year, maturity, runtime/seasons, synopsis, cast, genres
  // (links to /genre/:slug which also close the modal), moods. Series: season select + episode list with art,
  // progress and click-to-play at /watch/id?s=&e=. "More Like This" grid (click swaps modal content).
  // "About" section. comingSoon titles: show the date and a "Remind Me" toggle (use toggleList) instead of Play.
closeDetails(): void
```

### 7. `js/pages/player.js`

```ts
renderPlayer(container, { params: {id}, query: {s, e} }): cleanup
  // Full-screen player. Canvas renderScene is the "video", with a virtual clock (duration = runtimeMin*60).
  // Controls auto-hide after 3s idle: back (history.back or /browse), play/pause, -10/+10, seek bar with
  // hover time and a thumbnail preview (small canvas), buffered-look bar, volume + mute, speed menu
  // (0.5-2x), captions toggle (subtitleLines cycled over time), episodes panel for series, next episode,
  // fullscreen, title display. Simple generative WebAudio ambient score tied to volume, started on the
  // first user gesture. Keyboard: space/k, arrows, f, m, c, n, Esc. Resumes from getProgress; saveProgress
  // every 5s and on exit; at end: next-episode countdown (settings.autoplayNext) or "Back to browse".
  // Skip-intro button during 0:05-0:35 of series episodes. Unknown id: friendly not-found screen.
```

### 8. `js/pages/browse.js`

```ts
renderHome, renderSeries, renderFilms, renderNew, renderMyList, renderGenre, renderSearch  // page contract
  // Home: createHero (random popular title) + createRow for Continue Watching (if any, progress: true) + My List
  // (if any) + getHomeRows, overlapping the hero bottom slightly. Rows render lazily as they near the viewport.
  // Series/Films: same, filtered by type, with a genre dropdown (navigates to /genre/:slug).
  // New & Popular: Coming Soon list with dates, New rows, top 10 rows (ranked).
  // My List: createGrid, live via subscribe; designed empty state.
  // Genre: heading, grid, sort select (popular, newest, A-Z). Unknown slug: friendly message.
  // Search: re-runs on query change; grid, "Explore titles related to:" chips, designed empty state, comingSoon included.
  // Kids profile (getActiveProfile().isKids): filter everything with isKidsSafe, including hero and search.
```

### 9. `js/store.js` (all localStorage, namespaced `lumora:`, try/catch, in-memory fallback)

```ts
isSignedIn(), signIn(email), signOut(), getAccount() // { email, plan, memberSince }, setPlan(planId)
PLANS  // [{ id:'basic'|'standard'|'premium', name, price, quality, screens }]
getProfiles(), getActiveProfile(), setActiveProfile(id), clearActiveProfile()
addProfile({ name, avatar, isKids }), updateProfile(id, patch), deleteProfile(id)
  // profile = { id, name, avatar: number 0-11, isKids }. signIn seeds 2 adult + 1 Kids profile. Max 5, min 1.
  // list, ratings, progress and settings below are per active profile.
getMyList(): string[], isInList(id), toggleList(id): boolean
getRating(id), setRating(id, 'up'|'down'|'love'|null)
getProgress(id), saveProgress(id, { season, episode, positionSec, durationSec }), clearProgress(id)
getContinueWatching(): [{ id, season, episode, positionSec, durationSec, updatedAt }]  // newest first, under 95%
getSettings(), setSettings(patch)  // { autoplayPreviews: true, autoplayNext: true, subtitles: false, muted: false, volume: 0.8 }
subscribe(fn): unsubscribe  // called after any change
avatarNode(profile, size = 96): HTMLElement  // generated original SVG avatar
```

Passwords are never stored. `signIn` takes only an email.

### `js/pages/profiles.js`

`renderProfiles`: "Who's watching?" gate, choosing sets the active profile then `navigate('/browse')`.
`renderManageProfiles`: add, rename, change avatar, Kids toggle, delete with confirmation.

### 10. `js/pages/public.js`

```ts
renderLanding  // Marketing page: logoMark, Sign In, hero with collage of artUrl posters, email capture to /signup?email=,
               // feature bands, trending row, FAQ accordion, footer. Original copy.
renderLogin, renderSignup
               // Demo auth. A permanent note says it is a demo: any email works, the password is not checked or stored,
               // do not use a real password. Validate email format. Signup picks a plan from PLANS with no payment
               // fields of any kind. Both then signIn(email) and navigate('/profiles').
renderAccount  // Membership details, change plan, playback settings (getSettings/setSettings), manage profiles, sign out.
```
