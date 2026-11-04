import { formatClock, formatRuntime, h, icon } from '../dom.js';
import { navigate } from '../router.js';
import { renderScene } from '../art.js';
import { getTitle, isKidsSafe } from '../data/catalog.js';
import { getActiveProfile, getProgress, getSettings, saveProgress, setSettings } from '../store.js';
import { logoMark } from '../ui/nav.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 10;
const IDLE_MS = 3000;
const SAVE_EVERY_SEC = 5;
const INTRO_START = 5;
const INTRO_END = 35;
const CAPTION_CYCLE = 6;
const CAPTION_VISIBLE = 4.5;
const COUNTDOWN_SEC = 10;
const DOUBLE_TAP_MS = 320;
const MAX_CANVAS_WIDTH = 1920;

// Episode hops push history entries, so "back" has to skip them to leave the player.
let hops = 0;
let pendingHop = false;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const noop = () => {};
const episodeLabel = (season, episode) => `S${season}:E${episode}`;

function hashString(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function renderMessage(container, heading, body) {
  container.append(h('div', { class: 'pl-message' },
    logoMark(),
    h('h1', { class: 'pl-message-title' }, heading),
    h('p', { class: 'pl-message-body' }, body),
    h('button', { class: 'btn btn-primary', type: 'button', onClick: () => navigate('/browse') }, 'Back to browse'),
  ));
  return noop;
}

function flattenEpisodes(title) {
  const list = [];
  for (const season of title.seasons || []) {
    for (const episode of season.episodes || []) {
      list.push({ season: season.number, episode: episode.number, data: episode });
    }
  }
  return list;
}

function createAudio(seed) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  let ctx;
  try {
    ctx = new AudioCtor();
  } catch {
    return null;
  }

  const root = [110, 123.47, 130.81, 146.83, 164.81][seed % 5];
  const ratios = [1, 1.2, 1.333, 1.5, 1.8, 2, 2.4];
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.14;
  filter.connect(droneGain).connect(master);

  const sources = [];
  for (const [ratio, type, detune] of [[0.5, 'sine', 0], [0.75, 'triangle', 4], [1, 'sawtooth', -5], [1, 'sine', 7]]) {
    const osc = ctx.createOscillator();
    const voice = ctx.createGain();
    osc.type = type;
    osc.frequency.value = root * ratio;
    osc.detune.value = detune;
    voice.gain.value = type === 'sawtooth' ? 0.12 : 0.5;
    osc.connect(voice).connect(filter);
    osc.start();
    sources.push(osc);
  }

  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.05 + (seed % 7) * 0.01;
  lfoDepth.gain.value = 260;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();
  sources.push(lfo);

  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  delay.delayTime.value = 0.46;
  feedback.gain.value = 0.42;
  delay.connect(feedback).connect(delay);
  delay.connect(master);

  let noteTimer = 0;
  const playNote = () => {
    if (ctx.state !== 'running') return;
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = root * 2 * ratios[Math.floor(Math.random() * ratios.length)];
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.09, start + 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 3.6);
    osc.connect(env);
    env.connect(master);
    env.connect(delay);
    osc.start(start);
    osc.stop(start + 3.7);
  };
  const scheduleNote = () => {
    noteTimer = setTimeout(() => {
      playNote();
      scheduleNote();
    }, 1800 + Math.random() * 3400);
  };
  scheduleNote();

  return {
    setLevel(level) {
      master.gain.setTargetAtTime(level * level * 0.6, ctx.currentTime, 0.05);
    },
    resume() {
      if (ctx.state === 'suspended') ctx.resume().catch(noop);
    },
    suspend() {
      if (ctx.state === 'running') ctx.suspend().catch(noop);
    },
    close() {
      clearTimeout(noteTimer);
      for (const source of sources) {
        try { source.stop(); } catch { /* already stopped */ }
      }
      ctx.close().catch(noop);
    },
  };
}

export function renderPlayer(container, { params, query }) {
  const hopped = pendingHop;
  pendingHop = false;
  hops = hopped ? hops + 1 : 0;

  const title = getTitle(params.id);
  if (!title) {
    return renderMessage(container, 'We could not find that title',
      'It may have moved, or the link may be wrong. There is plenty more to watch.');
  }
  if (title.comingSoon) {
    return renderMessage(container, `${title.name} is not out yet`,
      'It will be ready to play on release day. Add it to your list from its details page.');
  }
  if (getActiveProfile()?.isKids && !isKidsSafe(title)) {
    return renderMessage(container, 'Not available on this profile',
      'This title is outside the ratings allowed on Kids profiles.');
  }

  /* ---------- What is playing ---------- */

  const episodes = flattenEpisodes(title);
  const isSeries = title.type === 'series' && episodes.length > 0;
  const saved = getProgress(title.id);

  let currentIndex = -1;
  if (isSeries) {
    const findIndex = (season, episode) => episodes.findIndex((ep) => ep.season === season && ep.episode === episode);
    const querySeason = parseInt(query?.s, 10);
    const queryEpisode = parseInt(query?.e, 10);
    if (Number.isFinite(querySeason)) currentIndex = findIndex(querySeason, Number.isFinite(queryEpisode) ? queryEpisode : 1);
    if (currentIndex < 0 && saved) currentIndex = findIndex(saved.season, saved.episode);
    if (currentIndex < 0) currentIndex = 0;
  }
  const current = isSeries ? episodes[currentIndex] : null;
  const next = isSeries ? episodes[currentIndex + 1] || null : null;
  const runtimeOf = (entry) => Math.max(60, (entry?.data?.runtimeMin || title.runtimeMin || 1) * 60);
  const duration = isSeries ? runtimeOf(current) : Math.max(60, (title.runtimeMin || 1) * 60);

  // Each episode gets its own scene seed and timeline, so episodes do not look alike.
  const sceneTitle = isSeries ? { ...title, id: `${title.id}-s${current.season}e${current.episode}` } : title;
  const sceneOffset = isSeries ? current.season * 1000 + current.episode * 137 : 0;
  const captionOffset = isSeries ? current.season * 3 + current.episode * 5 : 0;
  const captionLines = Array.isArray(title.subtitleLines) ? title.subtitleLines : [];

  const savedHere = saved && (!isSeries || (saved.season === current.season && saved.episode === current.episode));
  const resumeAt = savedHere && saved.positionSec < duration * 0.95 ? Math.max(0, saved.positionSec || 0) : 0;

  const settings = getSettings() || {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- State ---------- */

  let destroyed = false;
  let playing = !reducedMotion;
  let ended = false;
  let scrubbing = false;
  let rate = 1;
  let anchorPos = resumeAt;
  let anchorTime = performance.now();
  let volume = clamp(settings.volume ?? 0.8, 0, 1);
  let muted = Boolean(settings.muted);
  let captionsOn = Boolean(settings.subtitles);
  let uiVisible = true;
  let menuOpen = false;
  let panelOpen = false;
  let bufferedEnd = resumeAt + 8;
  let needsDraw = true;
  let thumbTime = null;
  let shownSecond = -1;
  let shownCaption = null;
  let skipShown = false;
  let audio = null;
  let raf = 0;
  let lastFrame = performance.now();
  let saveCounter = 0;
  let idleTimer = 0;
  let tapTimer = 0;
  let rippleTimer = 0;
  let volumeTimer = 0;
  let countdownTimer = 0;
  let stageDown = null;
  let lastTapTime = -Infinity;
  let lastTapSide = 0;
  let lastPointerType = 'mouse';

  const isRunning = () => playing && !scrubbing && !ended;
  const position = () => {
    const elapsed = isRunning() ? ((performance.now() - anchorTime) / 1000) * rate : 0;
    return Math.min(duration, anchorPos + elapsed);
  };
  // Must run before any change that affects isRunning() or rate.
  const reanchor = () => {
    anchorPos = position();
    anchorTime = performance.now();
  };

  /* ---------- DOM ---------- */

  const button = (cls, label, iconName, onClick, size = 26) => h('button', {
    class: `pl-btn ${cls}`, type: 'button', title: label, 'aria-label': label, onClick,
  }, icon(iconName, size));

  const setButton = (btn, label, iconName, size = 26) => {
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.replaceChildren(icon(iconName, size));
  };

  const canvas = h('canvas', { class: 'pl-canvas', 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = h('div', { class: 'pl-stage' });
  const caption = h('div', { class: 'pl-caption', hidden: true });
  const ripple = h('div', { class: 'pl-ripple', 'aria-hidden': 'true' });
  const skipBtn = h('button', { class: 'btn pl-skip', type: 'button', hidden: true, onClick: () => seekTo(INTRO_END) }, 'Skip Intro');
  const endLayer = h('div', { class: 'pl-end', hidden: true });

  const backBtn = button('pl-back', 'Back', 'arrow-left', goBack);
  const heading = h('div', { class: 'pl-heading' },
    h('h1', { class: 'pl-title' }, title.name),
    isSeries && h('p', { class: 'pl-subtitle' }, `${episodeLabel(current.season, current.episode)} ${current.data.title}`),
  );
  const bigPlay = h('button', { class: 'pl-bigplay', type: 'button', 'aria-label': 'Play', title: 'Play', hidden: true, onClick: () => play() }, icon('play', 44));

  const playBtn = button('pl-play', 'Pause', 'pause', () => togglePlay());
  const backTenBtn = button('pl-step', `Back ${SEEK_STEP} seconds`, 'back-10', () => seekBy(-SEEK_STEP));
  const forwardTenBtn = button('pl-step', `Forward ${SEEK_STEP} seconds`, 'forward-10', () => seekBy(SEEK_STEP));
  const muteBtn = button('pl-mute', 'Mute', 'volume', () => toggleMute());
  const volumeInput = h('input', {
    class: 'pl-volume', type: 'range', min: '0', max: '1', step: '0.01', value: String(volume), 'aria-label': 'Volume',
    onInput: (event) => setVolume(parseFloat(event.target.value)),
  });
  const timeLabel = h('span', { class: 'pl-time' });

  const seekBuffer = h('div', { class: 'pl-buffer' });
  const seekFill = h('div', { class: 'pl-fill' });
  const seekKnob = h('div', { class: 'pl-knob' });
  const thumbCanvas = h('canvas', { class: 'pl-thumb-canvas', width: 160, height: 90 });
  const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
  const thumbTimeLabel = h('span', { class: 'pl-thumb-time' });
  const thumb = h('div', { class: 'pl-thumb', hidden: true, 'aria-hidden': 'true' }, thumbCanvas, thumbTimeLabel);
  const seekBar = h('div', {
    class: 'pl-seek', role: 'slider', tabindex: '0', 'aria-label': 'Seek',
    'aria-valuemin': '0', 'aria-valuemax': String(Math.floor(duration)),
  }, h('div', { class: 'pl-track' }, seekBuffer, seekFill), seekKnob, thumb);

  const speedItems = SPEEDS.map((speed) => h('button', {
    class: 'pl-menu-item', type: 'button', role: 'menuitemradio', dataset: { speed: String(speed) },
    onClick: (event) => {
      setRate(speed);
      closeMenu(event.detail === 0);
    },
  }, `${speed}x`));
  const speedMenu = h('div', { class: 'pl-menu', role: 'menu', 'aria-label': 'Playback speed', hidden: true }, speedItems);
  const speedBtn = button('pl-speed', 'Playback speed', 'speed', (event) => {
    if (menuOpen) {
      closeMenu(event.detail === 0);
      return;
    }
    closePanel(false);
    menuOpen = true;
    speedMenu.hidden = false;
    speedBtn.setAttribute('aria-expanded', 'true');
    wake();
    if (event.detail === 0) speedItems.find((item) => item.getAttribute('aria-checked') === 'true')?.focus();
  });
  speedBtn.setAttribute('aria-haspopup', 'menu');
  speedBtn.setAttribute('aria-expanded', 'false');

  const captionsBtn = button('pl-captions', 'Captions', 'captions', () => toggleCaptions());
  const nextBtn = next ? button('pl-next', `Next episode: ${next.data.title}`, 'next', () => goNext()) : null;

  const episodeList = h('div', { class: 'pl-episodes' });
  const panelClose = button('pl-panel-close', 'Close episodes', 'x', (event) => closePanel(event.detail === 0), 22);
  const seasonSelect = isSeries && title.seasons.length > 1 ? h('select', {
    class: 'pl-season', 'aria-label': 'Season',
    onChange: (event) => renderEpisodeList(parseInt(event.target.value, 10)),
  }, title.seasons.map((season) => h('option', {
    value: String(season.number), selected: season.number === current.season,
  }, `Season ${season.number}`))) : null;
  const panel = h('aside', { class: 'pl-panel', 'aria-label': 'Episodes', hidden: true },
    h('div', { class: 'pl-panel-head' },
      seasonSelect || h('h2', { class: 'pl-panel-title' }, 'Episodes'),
      panelClose,
    ),
    episodeList,
  );
  const episodesBtn = isSeries ? button('pl-episodes-btn', 'Episodes', 'episodes', (event) => {
    if (panelOpen) {
      closePanel(event.detail === 0);
      return;
    }
    closeMenu(false);
    panelOpen = true;
    panel.hidden = false;
    episodesBtn.setAttribute('aria-expanded', 'true');
    wake();
    const active = episodeList.querySelector('[aria-current]') || episodeList.querySelector('button');
    active?.scrollIntoView({ block: 'nearest' });
    if (event.detail === 0) active?.focus();
  }) : null;
  episodesBtn?.setAttribute('aria-expanded', 'false');

  const canFullscreen = typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
  const fullscreenBtn = canFullscreen ? button('pl-fullscreen', 'Fullscreen', 'fullscreen', () => toggleFullscreen()) : null;

  const controls = h('div', { class: 'pl-controls' },
    h('div', { class: 'pl-top' }, backBtn, heading),
    bigPlay,
    h('div', { class: 'pl-bottom' },
      h('div', { class: 'pl-seek-row' }, seekBar, timeLabel),
      h('div', { class: 'pl-buttons' },
        h('div', { class: 'pl-group' }, playBtn, backTenBtn, forwardTenBtn, muteBtn, volumeInput),
        h('div', { class: 'pl-group' },
          h('div', { class: 'pl-menu-wrap' }, speedBtn, speedMenu),
          captionsBtn, episodesBtn, nextBtn, fullscreenBtn,
        ),
      ),
    ),
  );

  const rootEl = h('div', { class: 'pl-root is-ui', tabindex: '-1', role: 'region', 'aria-label': `${title.name} player` },
    canvas, stage, caption, skipBtn, ripple, endLayer, controls, panel);

  /* ---------- Drawing ---------- */

  function sizeCanvas() {
    const rect = rootEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, MAX_CANVAS_WIDTH / rect.width);
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    needsDraw = true;
  }

  function drawFrame(pos) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderScene(ctx, sceneTitle, sceneOffset + pos, canvas.width, canvas.height);
  }

  function drawThumb() {
    thumbCtx.setTransform(1, 0, 0, 1, 0, 0);
    renderScene(thumbCtx, sceneTitle, sceneOffset + thumbTime, thumbCanvas.width, thumbCanvas.height);
  }

  function syncTimeline(pos) {
    const ratio = duration ? pos / duration : 0;
    seekFill.style.transform = `scaleX(${ratio})`;
    seekKnob.style.left = `${ratio * 100}%`;
    seekBuffer.style.transform = `scaleX(${Math.min(1, bufferedEnd / duration)})`;

    const second = Math.floor(pos);
    if (second !== shownSecond) {
      shownSecond = second;
      const text = `${formatClock(second)} / ${formatClock(duration)}`;
      timeLabel.textContent = text;
      seekBar.setAttribute('aria-valuenow', String(second));
      seekBar.setAttribute('aria-valuetext', text);
    }

    const showSkip = isSeries && !ended && duration > INTRO_END && pos >= INTRO_START && pos < INTRO_END;
    if (showSkip !== skipShown) {
      skipShown = showSkip;
      if (!showSkip && document.activeElement === skipBtn) rootEl.focus({ preventScroll: true });
      skipBtn.hidden = !showSkip;
    }

    let line = null;
    if (captionsOn && !ended && captionLines.length && pos % CAPTION_CYCLE < CAPTION_VISIBLE) {
      line = captionLines[(Math.floor(pos / CAPTION_CYCLE) + captionOffset) % captionLines.length];
    }
    if (line !== shownCaption) {
      shownCaption = line;
      caption.hidden = line === null;
      caption.textContent = line || '';
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - lastFrame) / 1000, 0, 1);
    lastFrame = now;
    const pos = position();
    if (!scrubbing && !ended && pos >= duration) {
      finish();
      return;
    }
    if (bufferedEnd < duration) bufferedEnd = Math.max(bufferedEnd, Math.min(pos + 120, bufferedEnd + dt * 4));
    syncTimeline(pos);
    if (thumbTime !== null && !thumb.hidden && thumb.dataset.dirty) {
      delete thumb.dataset.dirty;
      drawThumb();
    }
    if (isRunning() || needsDraw) {
      needsDraw = false;
      drawFrame(pos);
    }
  }

  /* ---------- Controls visibility ---------- */

  const canAutoHide = () => playing && !ended && !menuOpen && !panelOpen && !scrubbing;

  function setUi(visible) {
    uiVisible = visible;
    rootEl.classList.toggle('is-ui', visible);
    if (!visible) clearTimeout(idleTimer);
  }

  function wake() {
    setUi(true);
    clearTimeout(idleTimer);
    if (canAutoHide()) {
      idleTimer = setTimeout(() => {
        if (canAutoHide()) setUi(false);
      }, IDLE_MS);
    }
  }

  /* ---------- Playback ---------- */

  function syncPlayState() {
    setButton(playBtn, playing ? 'Pause' : 'Play', playing ? 'pause' : 'play');
    bigPlay.hidden = playing || ended;
    if (audio) {
      if (playing) audio.resume();
      else audio.suspend();
    }
  }

  function play() {
    if (ended) {
      hideEnd();
      ended = false;
      anchorPos = 0;
      needsDraw = true;
    }
    reanchor();
    playing = true;
    syncPlayState();
    wake();
  }

  function pause() {
    reanchor();
    playing = false;
    syncPlayState();
    needsDraw = true;
    wake();
  }

  function togglePlay() {
    if (playing) pause();
    else play();
  }

  function seekTo(target) {
    const value = clamp(target, 0, duration);
    anchorPos = value;
    anchorTime = performance.now();
    if (ended && value < duration - 0.25) {
      ended = false;
      hideEnd();
      syncPlayState();
    }
    if (value > bufferedEnd || value < bufferedEnd - 300) bufferedEnd = value + 8;
    needsDraw = true;
    syncTimeline(value);
    wake();
  }

  function seekBy(delta) {
    seekTo(position() + delta);
  }

  function setRate(next) {
    reanchor();
    rate = next;
    for (const item of speedItems) {
      item.setAttribute('aria-checked', String(parseFloat(item.dataset.speed) === rate));
    }
    const label = `Playback speed, ${rate}x`;
    speedBtn.title = label;
    speedBtn.setAttribute('aria-label', label);
  }

  /* ---------- Sound ---------- */

  function syncVolume() {
    const silent = muted || volume === 0;
    setButton(muteBtn, silent ? 'Unmute' : 'Mute', silent ? 'volume-mute' : 'volume');
    const shown = muted ? 0 : volume;
    if (parseFloat(volumeInput.value) !== shown) volumeInput.value = String(shown);
    volumeInput.style.setProperty('--pl-vol', `${shown * 100}%`);
    audio?.setLevel(muted ? 0 : volume);
  }

  function persistVolume() {
    clearTimeout(volumeTimer);
    volumeTimer = 0;
    setSettings({ volume, muted });
  }

  function queuePersistVolume() {
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(persistVolume, 300);
  }

  function setVolume(value) {
    volume = clamp(value, 0, 1);
    muted = false;
    syncVolume();
    queuePersistVolume();
    wake();
  }

  function toggleMute() {
    if (!muted && volume === 0) volume = 0.5;
    else muted = !muted;
    syncVolume();
    queuePersistVolume();
    wake();
  }

  function ensureAudio() {
    if (!audio) {
      audio = createAudio(hashString(title.id));
      syncVolume();
    }
    if (!audio) return;
    if (playing) audio.resume();
    else audio.suspend();
  }

  function onGesture() {
    ensureAudio();
  }

  /* ---------- Captions, fullscreen ---------- */

  function syncCaptions() {
    captionsBtn.classList.toggle('is-on', captionsOn);
    captionsBtn.setAttribute('aria-pressed', String(captionsOn));
    captionsBtn.hidden = captionLines.length === 0;
  }

  function toggleCaptions() {
    captionsOn = !captionsOn;
    syncCaptions();
    setSettings({ subtitles: captionsOn });
    wake();
  }

  function toggleFullscreen() {
    if (!canFullscreen) return;
    if (document.fullscreenElement) document.exitFullscreen()?.catch?.(noop);
    else rootEl.requestFullscreen()?.catch?.(noop);
    wake();
  }

  function onFullscreenChange() {
    if (!fullscreenBtn) return;
    const active = Boolean(document.fullscreenElement);
    setButton(fullscreenBtn, active ? 'Exit fullscreen' : 'Fullscreen', active ? 'fullscreen-exit' : 'fullscreen');
  }

  /* ---------- Menu and panel ---------- */

  function closeMenu(restoreFocus) {
    if (!menuOpen) return;
    menuOpen = false;
    speedMenu.hidden = true;
    speedBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) speedBtn.focus();
    wake();
  }

  function closePanel(restoreFocus) {
    if (!panelOpen) return;
    panelOpen = false;
    panel.hidden = true;
    episodesBtn?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) episodesBtn?.focus();
    wake();
  }

  function renderEpisodeList(seasonNumber) {
    const season = title.seasons.find((item) => item.number === seasonNumber);
    episodeList.replaceChildren(...(season?.episodes || []).map((episode) => {
      const isCurrent = season.number === current.season && episode.number === current.episode;
      return h('button', {
        class: 'pl-episode', type: 'button', 'aria-current': isCurrent ? 'true' : null,
        onClick: (event) => {
          if (isCurrent) closePanel(event.detail === 0);
          else goToEpisode(season.number, episode.number);
        },
      },
        h('span', { class: 'pl-episode-num' }, String(episode.number)),
        h('span', { class: 'pl-episode-body' },
          h('span', { class: 'pl-episode-head' },
            h('span', { class: 'pl-episode-title' }, episode.title),
            h('span', { class: 'pl-episode-time' }, formatRuntime(episode.runtimeMin || title.runtimeMin || 1)),
          ),
          episode.synopsis && h('span', { class: 'pl-episode-text' }, episode.synopsis),
        ),
      );
    }));
  }

  /* ---------- Navigation ---------- */

  function goToEpisode(season, episode) {
    pendingHop = true;
    navigate(`/watch/${encodeURIComponent(title.id)}?s=${season}&e=${episode}`);
  }

  function goNext() {
    if (next) goToEpisode(next.season, next.episode);
  }

  function goBack() {
    const depth = hops + 1;
    if (history.length > depth) history.go(-depth);
    else navigate('/browse');
  }

  /* ---------- End of playback ---------- */

  function hideEnd() {
    clearInterval(countdownTimer);
    countdownTimer = 0;
    endLayer.hidden = true;
    endLayer.replaceChildren();
  }

  function showEnd() {
    hideEnd();
    const toBrowse = () => navigate('/browse');
    let card;
    let primary;

    if (next) {
      primary = h('button', { class: 'btn btn-primary', type: 'button', onClick: goNext }, icon('play', 20), 'Play next');
      const browseBtn = h('button', { class: 'btn btn-secondary', type: 'button', onClick: toBrowse }, 'Back to browse');
      const actions = h('div', { class: 'pl-end-actions' }, primary, browseBtn);
      card = h('div', { class: 'pl-end-card' },
        h('p', { class: 'pl-end-kicker' }, 'Up next'),
        h('h2', { class: 'pl-end-title' }, `${episodeLabel(next.season, next.episode)} ${next.data.title}`),
        next.data.synopsis && h('p', { class: 'pl-end-text' }, next.data.synopsis),
      );
      if (getSettings()?.autoplayNext !== false) {
        let remaining = COUNTDOWN_SEC;
        const counter = h('p', { class: 'pl-end-count' }, `Starting in ${remaining}s`);
        const cancelBtn = h('button', {
          class: 'btn btn-secondary', type: 'button',
          onClick: () => {
            clearInterval(countdownTimer);
            countdownTimer = 0;
            counter.remove();
            cancelBtn.remove();
            primary.focus();
          },
        }, 'Cancel');
        actions.append(cancelBtn);
        card.append(counter);
        countdownTimer = setInterval(() => {
          remaining -= 1;
          counter.textContent = `Starting in ${remaining}s`;
          if (remaining <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = 0;
            goNext();
          }
        }, 1000);
      }
      card.append(actions);
    } else {
      primary = h('button', { class: 'btn btn-primary', type: 'button', onClick: toBrowse }, 'Back to browse');
      card = h('div', { class: 'pl-end-card' },
        h('p', { class: 'pl-end-kicker' }, 'Finished'),
        h('h2', { class: 'pl-end-title' }, title.name),
        h('div', { class: 'pl-end-actions' },
          primary,
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => play() }, 'Watch again'),
        ),
      );
    }
    endLayer.append(card);
    endLayer.hidden = false;
    primary.focus({ preventScroll: true });
  }

  function finish() {
    reanchor();
    anchorPos = duration;
    ended = true;
    playing = false;
    syncPlayState();
    syncTimeline(duration);
    closeMenu(false);
    closePanel(false);
    saveNow();
    showEnd();
    wake();
  }

  /* ---------- Progress ---------- */

  function saveNow() {
    if (ended && next) {
      // Finished: Continue Watching should offer the next episode.
      saveProgress(title.id, { season: next.season, episode: next.episode, positionSec: 0, durationSec: runtimeOf(next) });
      return;
    }
    const pos = position();
    if (pos < 3) return;
    saveProgress(title.id, {
      season: isSeries ? current.season : null,
      episode: isSeries ? current.episode : null,
      positionSec: Math.floor(pos),
      durationSec: duration,
    });
  }

  function onSlowTick() {
    // rAF stops in hidden tabs, so the end of the film is also detected here.
    if (!scrubbing && !ended && position() >= duration) {
      finish();
      return;
    }
    if (!isRunning()) return;
    saveCounter += 1;
    if (saveCounter >= SAVE_EVERY_SEC) {
      saveCounter = 0;
      saveNow();
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') saveNow();
  }

  /* ---------- Seek bar ---------- */

  function pointerRatio(event) {
    const rect = seekBar.getBoundingClientRect();
    return rect.width ? clamp((event.clientX - rect.left) / rect.width, 0, 1) : 0;
  }

  function showThumb(ratio) {
    thumbTime = ratio * duration;
    thumb.hidden = false;
    thumb.dataset.dirty = '1';
    thumbTimeLabel.textContent = formatClock(thumbTime);
    const barWidth = seekBar.getBoundingClientRect().width;
    const half = thumb.offsetWidth / 2;
    const center = clamp(ratio * barWidth, Math.min(half, barWidth / 2), Math.max(barWidth - half, barWidth / 2));
    thumb.style.left = `${center}px`;
  }

  function hideThumb() {
    thumb.hidden = true;
    thumbTime = null;
  }

  seekBar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    seekBar.setPointerCapture?.(event.pointerId);
    reanchor();
    scrubbing = true;
    const ratio = pointerRatio(event);
    seekTo(ratio * duration);
    showThumb(ratio);
  });
  seekBar.addEventListener('pointermove', (event) => {
    const ratio = pointerRatio(event);
    if (scrubbing) {
      seekTo(ratio * duration);
      showThumb(ratio);
    } else if (event.pointerType === 'mouse') {
      showThumb(ratio);
    }
  });
  const endScrub = (event) => {
    if (!scrubbing) return;
    anchorTime = performance.now();
    scrubbing = false;
    if (event.pointerType !== 'mouse') hideThumb();
    wake();
  };
  seekBar.addEventListener('pointerup', endScrub);
  seekBar.addEventListener('pointercancel', endScrub);
  seekBar.addEventListener('pointerleave', () => {
    if (!scrubbing) hideThumb();
  });

  /* ---------- Stage: click, tap, double tap ---------- */

  function showRipple(side) {
    ripple.classList.remove('is-left', 'is-right');
    ripple.classList.add(side < 0 ? 'is-left' : 'is-right', 'is-on');
    ripple.replaceChildren(icon(side < 0 ? 'back-10' : 'forward-10', 40));
    clearTimeout(rippleTimer);
    rippleTimer = setTimeout(() => ripple.classList.remove('is-on'), 600);
  }

  stage.addEventListener('pointerdown', (event) => {
    lastPointerType = event.pointerType;
    stageDown = { x: event.clientX, y: event.clientY, dismiss: menuOpen || panelOpen };
  });
  stage.addEventListener('pointercancel', () => {
    stageDown = null;
  });
  stage.addEventListener('pointerup', (event) => {
    const down = stageDown;
    stageDown = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12) return;
    if (down.dismiss) return;

    if (event.pointerType === 'mouse') {
      if (event.button === 0 && !ended) togglePlay();
      return;
    }

    const now = performance.now();
    const rect = stage.getBoundingClientRect();
    const side = event.clientX - rect.left < rect.width / 2 ? -1 : 1;
    clearTimeout(tapTimer);
    if (now - lastTapTime < DOUBLE_TAP_MS && side === lastTapSide) {
      tapTimer = 0;
      lastTapTime = now;
      const wasVisible = uiVisible;
      seekBy(side * SEEK_STEP);
      if (!wasVisible) setUi(false);
      showRipple(side);
      return;
    }
    lastTapTime = now;
    lastTapSide = side;
    tapTimer = setTimeout(() => {
      tapTimer = 0;
      if (uiVisible) setUi(false);
      else wake();
    }, DOUBLE_TAP_MS);
  });
  stage.addEventListener('dblclick', () => {
    if (lastPointerType === 'mouse') toggleFullscreen();
  });

  /* ---------- Root pointer and click ---------- */

  rootEl.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') wake();
  });
  rootEl.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && canAutoHide()) setUi(false);
  });
  rootEl.addEventListener('pointerdown', (event) => {
    if (controls.contains(event.target) || panel.contains(event.target)) wake();
    if (menuOpen && !speedMenu.contains(event.target) && !speedBtn.contains(event.target)) closeMenu(false);
    if (panelOpen && !panel.contains(event.target) && !episodesBtn?.contains(event.target)) closePanel(false);
  });
  // After a mouse click, hand focus back so space and arrows drive the player, not that button.
  rootEl.addEventListener('click', (event) => {
    if (event.detail > 0 && event.target.closest?.('button') && !endLayer.contains(event.target)) {
      rootEl.focus({ preventScroll: true });
    }
  });

  /* ---------- Keyboard ---------- */

  function moveFocusWithin(holder, target, step) {
    const items = [...holder.querySelectorAll('button')].filter((item) => !item.hidden);
    if (!items.length) return;
    const index = items.indexOf(target);
    items[(index + step + items.length) % items.length].focus();
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { target } = event;
    const key = event.key;
    wake();

    if (key === 'Escape') {
      event.preventDefault();
      if (menuOpen) closeMenu(true);
      else if (panelOpen) closePanel(true);
      else if (document.fullscreenElement) document.exitFullscreen()?.catch?.(noop);
      else goBack();
      return;
    }

    const tag = target?.tagName;
    if (tag === 'SELECT') return;
    if (tag === 'INPUT' && key.startsWith('Arrow')) return;
    const holder = target?.closest?.('.pl-menu, .pl-panel');
    if (holder && (key === 'ArrowUp' || key === 'ArrowDown')) {
      event.preventDefault();
      moveFocusWithin(holder, target, key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (tag === 'BUTTON' && (key === ' ' || key === 'Enter')) return;

    const lower = key.toLowerCase();
    const handled = (fn) => {
      event.preventDefault();
      fn();
    };
    switch (lower) {
      case 'arrowleft': handled(() => seekBy(-SEEK_STEP)); return;
      case 'arrowright': handled(() => seekBy(SEEK_STEP)); return;
      case 'arrowup': handled(() => setVolume((muted ? 0 : volume) + 0.05)); return;
      case 'arrowdown': handled(() => setVolume((muted ? 0 : volume) - 0.05)); return;
      case 'home':
        if (target === seekBar) handled(() => seekTo(0));
        return;
      case 'end':
        if (target === seekBar) handled(() => seekTo(duration));
        return;
      default:
    }
    if (event.repeat) return;
    switch (lower) {
      case ' ':
      case 'k': handled(togglePlay); break;
      case 'f': handled(toggleFullscreen); break;
      case 'm': handled(toggleMute); break;
      case 'c': if (captionLines.length) handled(toggleCaptions); break;
      case 'n': if (next) handled(goNext); break;
      default:
    }
  }

  /* ---------- Mount ---------- */

  container.append(rootEl);
  const previousTitle = document.title;
  document.title = `${title.name} | Lumora`;

  if (isSeries) renderEpisodeList(current.season);
  setRate(1);
  syncCaptions();
  syncVolume();
  syncPlayState();
  sizeCanvas();
  syncTimeline(anchorPos);

  const resizeObserver = new ResizeObserver(sizeCanvas);
  resizeObserver.observe(rootEl);

  const gestureEvents = ['pointerdown', 'pointerup', 'touchend', 'keydown'];
  for (const name of gestureEvents) window.addEventListener(name, onGesture, true);
  // In-app navigation already counts as a gesture, so the score can start with the film.
  if (navigator.userActivation?.hasBeenActive) ensureAudio();

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', saveNow);

  const slowInterval = setInterval(onSlowTick, 1000);
  anchorTime = performance.now();
  raf = requestAnimationFrame(frame);
  rootEl.focus({ preventScroll: true });
  wake();

  return function cleanup() {
    if (destroyed) return;
    destroyed = true;

    saveNow();
    cancelAnimationFrame(raf);
    clearInterval(slowInterval);
    clearInterval(countdownTimer);
    clearTimeout(idleTimer);
    clearTimeout(tapTimer);
    clearTimeout(rippleTimer);
    if (volumeTimer) persistVolume();
    resizeObserver.disconnect();

    for (const name of gestureEvents) window.removeEventListener(name, onGesture, true);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', saveNow);

    if (document.fullscreenElement) document.exitFullscreen()?.catch?.(noop);
    audio?.close();
    audio = null;
    document.title = previousTitle;
  };
}
