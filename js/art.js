// Lumora art engine. All key art and "film" footage is generated here.
//
// A motif function produces a scene: a back-to-front list of layers made of vector items, plus
// animated fx entries. The same scene description is serialized to SVG for artUrl() and rasterized
// to cached offscreen canvases for renderScene(), so stills and footage share one visual language.

import { h } from './dom.js';

/* ------------------------------------------------------------------ utilities */

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (v, m) => ((v % m) + m) % m;
const ease = (t) => t * t * (3 - 2 * t);
const rnd2 = (a, b) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function hash(str) {
  let x = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995);
  return (x ^ (x >>> 15)) >>> 0;
}

function R(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.r = (a, b) => a + f() * (b - a);
  f.i = (a, b) => Math.floor(f.r(a, b + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.ok = (p) => f() < p;
  return f;
}

function noise1(seed) {
  const r = R(seed);
  const table = Array.from({ length: 256 }, () => r());
  const at = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    return lerp(table[i & 255], table[(i + 1) & 255], ease(f));
  };
  return (x, oct = 3, ridged = false) => {
    let sum = 0;
    let amp = 1;
    let tot = 0;
    let fr = 1;
    for (let o = 0; o < oct; o++) {
      let n = at(x * fr + o * 17.3);
      if (ridged) n = 1 - Math.abs(2 * n - 1);
      sum += n * amp;
      tot += amp;
      amp *= 0.5;
      fr *= 2.05;
    }
    return sum / tot;
  };
}

/* ------------------------------------------------------------------ colour */

function rgb(c) {
  let s = String(c).replace('#', '');
  if (s.length === 3) s = s.replace(/./g, '$&$&');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hx = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const x = rgb(a);
  const y = rgb(b);
  return hx([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
};
const lum = (c) => {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
function hue(c, deg, sat = 1, light = 1) {
  const [r0, g0, b0] = rgb(c).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const d = max - min;
  let H = 0;
  if (d) {
    if (max === r0) H = ((g0 - b0) / d + 6) % 6;
    else if (max === g0) H = (b0 - r0) / d + 2;
    else H = (r0 - g0) / d + 4;
  }
  const L = clamp(((max + min) / 2) * light);
  const S = clamp((d ? d / (1 - Math.abs(max + min - 1)) : 0) * sat);
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const hh = mod(H + deg / 60, 6);
  const X = C * (1 - Math.abs((hh % 2) - 1));
  const m = L - C / 2;
  const t = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(hh)];
  return hx(t.map((v) => (v + m) * 255));
}

const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c));

function derive(palette, seed) {
  const r = R(seed ^ 0x51ed27);
  const pal = Array.isArray(palette) ? palette : [];
  let d = isHex(pal[0]) ? pal[0] : '#0b1020';
  let m = isHex(pal[1]) ? pal[1] : '#34507a';
  let a = isHex(pal[2]) ? pal[2] : '#ffc46b';
  if (lum(d) > 0.18) d = mix(d, '#04050a', 0.65);
  if (lum(a) < 0.42) a = mix(a, '#ffffff', 0.35);
  if (Math.abs(lum(m) - lum(d)) < 0.06) m = mix(d, a, 0.35);
  m = hue(m, r.r(-9, 9));
  a = hue(a, r.r(-7, 7), 1.08);
  return {
    d,
    m,
    a,
    k: mix(d, '#02030a', 0.6),
    ink: mix(d, '#010208', 0.84),
    hz: mix(m, a, 0.5),
    rim: mix(a, '#ffffff', 0.45),
    alt: hue(a, r.pick([150, -150, 180, -42, 48, 120]), 1, 1),
  };
}

/* ------------------------------------------------------------------ paths and layers */

const n0 = (v) => Math.round(v);
const n1 = (v) => Math.round(v * 10) / 10;
const poly = (pts, close = true) =>
  'M' + pts.map((p) => n0(p[0]) + ' ' + n0(p[1])).join(' ') + (close ? 'Z' : '');
const rectP = (x, y, w, ht) => `M${n0(x)} ${n0(y)}h${n0(w)}v${n0(ht)}h${n0(-w)}Z`;
const ellP = (x, y, rx, ry = rx) => {
  const a = n1(rx);
  const b = n1(ry);
  return `M${n1(x - rx)} ${n1(y)}a${a} ${b} 0 1 0 ${n1(2 * rx)} 0a${a} ${b} 0 1 0 ${n1(-2 * rx)} 0Z`;
};
function smooth(pts, close = false) {
  let d = `M${n0(pts[0][0])} ${n0(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${n0(pts[i][0])} ${n0(pts[i][1])} ${n0(mx)} ${n0(my)}`;
  }
  const last = pts[pts.length - 1];
  d += `L${n0(last[0])} ${n0(last[1])}`;
  return d + (close ? 'Z' : '');
}

const vg = (y1, y2, stops) => ({ k: 'l', x1: 0, y1, x2: 0, y2, stops });
const lg = (x1, y1, x2, y2, stops) => ({ k: 'l', x1, y1, x2, y2, stops });
const rg = (cx, cy, r, stops) => ({ k: 'r', cx, cy, r, stops });

const P = (d, fill, op) => ({ d, fill, op });
const S = (d, stroke, sw, op, cap) => ({ d, stroke, sw, op, cap });
const L = (items, o = {}) => ({ items: Array.isArray(items) ? items : [items], depth: 0.5, ...o });

const ridgePts = (W, base, amp, r, { fr = 3, oct = 4, ridged = false, step = 16 } = {}) => {
  const nz = noise1(r.i(0, 1e9));
  const off = r.r(0, 200);
  const pts = [];
  for (let x = -step; x <= W + step; x += step) {
    pts.push([x, base - amp * (nz((x / W) * fr + off, oct, ridged) - 0.3)]);
  }
  return pts;
};
const closeDown = (pts, H) =>
  [[pts[0][0], H + 4], ...pts, [pts[pts.length - 1][0], H + 4]];
const ridgeY = (pts, x) => {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const a = pts[i - 1];
      const b = pts[i];
      return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1));
    }
  }
  return pts[pts.length - 1][1];
};

// Transforms an absolute-coordinate path authored in figure space (y up from feet, height 100).
const tf = (path, x, y, s, flip = 1) => {
  let isX = true;
  return path.replace(/-?\d+(\.\d+)?/g, (m) => {
    const v = parseFloat(m);
    const out = isX ? x + v * s * flip : y + v * s;
    isX = !isX;
    return String(n1(out));
  });
};

const FIG = {
  stand:
    'M-3 -88Q-7 -88 -7 -93Q-7 -100 0 -100Q7 -100 7 -93Q7 -88 3 -88L3 -84Q12 -82 14 -74L16 -44L12 -44L10 -68L9 -42L11 0L3 0L1 -36L-1 -36L-3 0L-11 0L-9 -42L-10 -68L-12 -44L-16 -44L-14 -74Q-12 -82 -3 -84Z',
  coat:
    'M-3 -88Q-7 -88 -7 -93Q-7 -100 0 -100Q7 -100 7 -93Q7 -88 3 -88L3 -84Q12 -82 14 -74L19 -24Q10 -20 8 -22L9 0L2 0L1 -22L-1 -22L-2 0L-9 0L-8 -22Q-10 -20 -21 -26L-14 -74Q-12 -82 -3 -84Z',
  cloak:
    'M0 -100Q9 -100 10 -88Q11 -80 15 -72L23 -5Q10 1 0 0Q-10 1 -23 -5L-15 -72Q-11 -80 -10 -88Q-9 -100 0 -100Z',
  umbrella:
    'M-44 -96Q-40 -128 0 -130Q40 -128 44 -96Q33 -102 22 -96Q11 -102 0 -96Q-11 -102 -22 -96Q-33 -102 -44 -96ZM-3 -86Q-7 -86 -7 -90Q-7 -97 0 -97Q7 -97 7 -90Q7 -86 3 -86L3 -82Q12 -80 14 -72L19 -24Q10 -20 8 -22L9 0L2 0L1 -22L-1 -22L-2 0L-9 0L-8 -22Q-10 -20 -21 -26L-14 -72Q-12 -80 -3 -82Z',
  back:
    'M-60 0Q-62 -28 -42 -36Q-24 -42 -16 -46Q-13 -50 -13 -56Q-24 -66 -24 -80Q-24 -100 0 -100Q24 -100 24 -80Q24 -66 13 -56Q13 -50 16 -46Q24 -42 42 -36Q62 -28 60 0Z',
  hood:
    'M-66 0Q-64 -30 -44 -40Q-34 -46 -30 -60Q-34 -100 0 -100Q34 -100 30 -60Q34 -46 44 -40Q64 -30 66 0Z',
  profile:
    'M-42 0Q-44 -22 -30 -30Q-20 -35 -16 -42L-16 -50Q-30 -58 -30 -78Q-30 -100 -4 -100Q18 -100 22 -82Q23 -76 24 -74L31 -64Q32 -61 26 -60L27 -55Q28 -53 25 -52Q27 -49 25 -47Q24 -41 14 -41L6 -42L6 -34Q24 -30 40 -22Q50 -16 50 0Z',
};

const figure = (kind, x, y, ht, flip = 1) => tf(FIG[kind], x, y, ht / 100, flip);

const starsItems = (r, W, yMax, count, color) => {
  const groups = [[], [], []];
  for (let i = 0; i < count; i++) {
    const y = Math.pow(r(), 1.5) * yMax;
    groups[r.ok(0.72) ? 0 : r.ok(0.75) ? 1 : 2].push(`M${n0(r() * W)} ${n0(y)}h.1`);
  }
  return groups.map((g, i) => S(g.join(''), color, [1, 1.7, 2.6][i], [0.55, 0.8, 1][i], 'round'));
};

const skyL = (c, stops) => L(P(rectP(-5, -5, c.W + 10, c.H + 10), vg(0, c.H, stops)), { depth: 0.04, sky: true });

const glowL = (x, y, rad, color, op = 1, o = {}) =>
  L(P(ellP(x, y, rad), rg(x, y, rad, [[0, color, op], [0.35, color, op * 0.42], [1, color, 0]])), {
    blend: 'screen',
    depth: 0.1,
    ...o,
  });

const discItems = (x, y, rad, a, b) => [P(ellP(x, y, rad), vg(y - rad, y + rad, [[0, a], [1, b]]))];

function scatter(r, count, W, H, y0 = 0) {
  return Array.from({ length: count }, () => ({
    x: r() * W,
    y: y0 + r() * (H - y0),
    z: r.r(0.45, 1),
    ph: r() * TAU,
  }));
}

const fogBand = (c, r, y, color, op, count = 4, thick = 1) => {
  const { W, u } = c;
  const items = [];
  for (let i = 0; i < count; i++) {
    const x = W * r.r(0.12, 0.88);
    items.push(P(ellP(x, y + r.r(-3, 3) * u, W * r.r(0.16, 0.3), u * r.r(2.5, 6) * thick), color, op * r.r(0.6, 1)));
  }
  return L(items, { blur: u * 2.6, blend: 'screen', drift: r.r(-14, 14) || 6 });
};

const raysItems = (c, r, x, y, count, len, color, op, aMin = 0, aMax = Math.PI) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = r.r(aMin, aMax);
    const sp = r.r(0.02, 0.07);
    const e = len * r.r(0.7, 1.2);
    out.push(
      P(
        poly([[x, y], [x + Math.cos(a - sp) * e, y + Math.sin(a - sp) * e], [x + Math.cos(a + sp) * e, y + Math.sin(a + sp) * e]]),
        rg(x, y, e, [[0, color, op], [1, color, 0]]),
      ),
    );
  }
  return out;
};

function peak(c, r, x, top, base, hw, body, lit, snow, dir = 1) {
  const pts = (x0, y0, x1, y1, seg, j) => {
    const out = [];
    for (let i = 1; i <= seg; i++) {
      const t = i / seg;
      out.push([lerp(x0, x1, t) + r.r(-j, j), lerp(y0, y1, t) + r.r(-j, j) * 0.8]);
    }
    return out;
  };
  const jit = hw * 0.05;
  const left = pts(x, top, x - hw, base, 11, jit);
  const right = pts(x, top, x + hw, base, 11, jit);
  const crease = pts(x, top, x + dir * hw * 0.16, base, 9, jit * 1.5);
  const items = [
    P(poly([[x, top], ...right, [x + hw, base + 500], [x - hw, base + 500], ...left.slice().reverse()]), vg(top, base, [[0, mix(body, lit, 0.1)], [1, body]])),
  ];
  const side = dir > 0 ? right : left;
  items.push(
    P(poly([[x, top], ...side, ...crease.slice().reverse()]), vg(top, base, [[0, lit, 0.95], [0.45, lit, 0.32], [1, lit, 0]])),
  );
  for (let i = 0; i < 6; i++) {
    const t = r.r(0.12, 0.62);
    const sx = lerp(x, x - dir * hw, t) * 1;
    const sy = lerp(top, base, t);
    const w2 = hw * r.r(0.04, 0.12);
    items.push(P(poly([[sx, sy], [sx + dir * w2, sy + w2 * r.r(1.2, 3)], [sx - dir * w2 * 0.2, sy + w2 * r.r(2.5, 5)]]), lit, r.r(0.1, 0.28)));
  }
  const capH = (base - top) * r.r(0.17, 0.27);
  const capSide = (s) => {
    const out = [];
    const seg = 6;
    for (let i = 1; i <= seg; i++) {
      const t = i / seg;
      out.push([x + s * hw * ((capH * t) / (base - top)), top + capH * t * (i % 2 ? 1 : 0.68)]);
    }
    return out;
  };
  items.push(P(poly([[x, top], ...capSide(1), ...capSide(-1).reverse()]), vg(top, top + capH, [[0, snow, 0.96], [1, snow, 0.35]])));
  return items;
}

/* ------------------------------------------------------------------ motifs */

function mountains(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const night = v === 2;
  const out = [];
  out.push(
    skyL(
      c,
      night
        ? [[0, p.k], [0.45, p.d], [hz / H, mix(p.m, p.a, 0.22)], [1, p.m]]
        : [[0, p.d], [hz / H * 0.6, p.m], [hz / H, p.hz], [Math.min(1, hz / H + 0.08), p.rim], [1, p.hz]],
    ),
  );
  if (night) out.push(L(starsItems(r, W, hz, c.detail * 170, p.rim), { depth: 0.06 }));
  const dr = u * (c.discK || r.r(9, 20));
  const dx = c.fx + W * r.r(-0.13, 0.13);
  const dy = hz - H * r.r(0.1, 0.3);
  out.push(glowL(dx, dy, dr * 6, p.a, night ? 0.45 : 0.75, { depth: 0.07 }));
  out.push(L(discItems(dx, dy, dr, p.rim, night ? mix(p.a, p.m, 0.2) : p.a), { depth: 0.08, op: night ? 0.95 : 1 }));
  out.push(L(raysItems(c, r, dx, dy, 7, H * 0.9, p.rim, 0.13, 0.2, Math.PI - 0.2), { depth: 0.09, blur: u * 0.9, blend: 'screen', pulse: { type: 'sin', min: 0.65, max: 1, f: 0.3, ph: r() * TAU } }));

  const streak = [];
  for (let i = 0; i < 5; i++) {
    streak.push(P(ellP(W * r.r(0.12, 0.88), hz - H * r.r(0.04, 0.42), W * r.r(0.12, 0.34), u * r.r(0.4, 1.6)), p.rim, r.r(0.1, 0.32)));
  }
  out.push(L(streak, { depth: 0.12, blur: u * 0.7, drift: r.r(2, 7) * (r.ok(0.5) ? 1 : -1) }));

  const lightDir = dx > c.fx ? 1 : -1;
  const far = mix(p.hz, p.m, 0.55);
  const pts0 = ridgePts(W, hz - u * 2, u * 22, r, { fr: 5, ridged: true, step: c.step });
  out.push(L(P(poly(closeDown(pts0, H)), vg(hz - u * 24, hz + u * 16, [[0, mix(far, p.rim, 0.12)], [1, p.hz]])), { depth: 0.16 }));

  const body = mix(p.d, p.m, 0.55);
  const top = Math.max(H * 0.08, hz - H * r.r(0.26, 0.4));
  const hw = Math.min(W * 0.46, (hz - top) * r.r(1, 1.5));
  out.push(L(peak(c, r, c.fx, top, hz + u * 12, hw, body, mix(p.a, p.rim, 0.3), '#ffffff', lightDir), { depth: 0.24 }));
  const sideX = c.fx + (r.ok(0.5) ? 1 : -1) * hw * r.r(0.8, 1.15);
  out.push(L(peak(c, r, sideX, top + (hz - top) * r.r(0.25, 0.45), hz + u * 14, hw * 0.62, mix(body, p.d, 0.25), mix(p.a, p.rim, 0.1), p.rim, lightDir), { depth: 0.3 }));
  out.push(fogBand(c, r, hz + u * 5, p.hz, 0.75, 5, v === 1 ? 2.4 : 1.2));

  const layers = 3;
  let near;
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const col = mix(mix(p.m, p.d, 0.55), p.ink, t);
    const base = lerp(hz + u * 8, Math.min(H * 0.92, hz + H * 0.3), Math.pow(t, 0.8));
    const pts = ridgePts(W, base, u * lerp(16, 22, t), r, { fr: lerp(5, 2.4, t), ridged: k < 2, step: c.step });
    near = pts;
    out.push(L(P(poly(closeDown(pts, H)), vg(base - u * 18, base + u * 22, [[0, col], [1, mix(col, p.hz, 0.28 * (1 - t))]])), { depth: lerp(0.42, 1.05, t) }));
    if (k < layers - 1) out.push(fogBand(c, r, base + u * 8, p.hz, 0.42 * (1 - t) + 0.14, 4));
  }
  if (c.figures !== false) {
    const fx0 = clamp(c.fx + W * r.r(-0.12, 0.12), W * 0.1, W * 0.9);
    const fy = ridgeY(near, fx0) + 2;
    const fh = u * r.r(7, 12);
    const kind = r.pick(['coat', 'cloak', 'stand']);
    const items = [P(figure(kind, fx0, fy, fh, lightDir), p.ink)];
    if (r.ok(0.4)) items.push(P(figure(r.pick(['stand', 'coat']), fx0 - fh * 0.42, fy + 1, fh * 0.84, -lightDir), p.ink));
    out.push(L(items, { depth: 1.05 }));
  }
  out.push({ fx: 'snow', depth: 1.1, pts: scatter(r, c.film ? 90 : 40, W, H), color: '#ffffff', s: u * 0.3, v: u * r.r(1.4, 3), vx: u * r.r(-2.2, 2.2), op: night ? 0.55 : 0.32 });
  if (!night) out.push({ fx: 'birds', depth: 0.3, n: r.i(3, 6), x: r() * W, y: hz - H * r.r(0.08, 0.26), v: u * r.r(1, 2.2), s: u * 0.8, color: p.ink });
  return out;
}

function skyline(r, W, base, minH, maxH, wMin, wMax, detail = 1) {
  const blds = [];
  let x = -wMin;
  let d = '';
  while (x < W + wMin) {
    const w = r.r(wMin, wMax);
    const ht = lerp(minH, maxH, Math.pow(r(), 1.6));
    blds.push({ x, w, ht, top: base - ht });
    const y = base - ht;
    const style = r();
    if (detail && style < 0.22) {
      const sw = w * r.r(0.28, 0.6);
      const sh = ht * r.r(0.05, 0.14);
      d += `M${n0(x)} ${n0(base + 400)}V${n0(y)}H${n0(x + (w - sw) / 2)}V${n0(y - sh)}H${n0(x + (w + sw) / 2)}V${n0(y)}H${n0(x + w)}V${n0(base + 400)}Z`;
      if (r.ok(0.5)) d += `M${n0(x + w / 2 - 1)} ${n0(y - sh)}v${n0(-ht * 0.16)}h2v${n0(ht * 0.16)}Z`;
    } else if (detail && style < 0.4) {
      d += `M${n0(x)} ${n0(base + 400)}V${n0(y + w * 0.3)}L${n0(x + w)} ${n0(y)}V${n0(base + 400)}Z`;
    } else {
      d += `M${n0(x)} ${n0(base + 400)}V${n0(y)}H${n0(x + w)}V${n0(base + 400)}Z`;
      if (detail && style > 0.85) d += rectP(x + w * 0.15, y - ht * 0.03, w * 0.22, ht * 0.03);
    }
    x += w + r.r(-wMin * 0.15, wMin * 0.2);
  }
  return { d, blds };
}

function windows(r, blds, base, cell, prob, budget) {
  const paths = ['', ''];
  const lit = [];
  let used = 0;
  for (const b of blds) {
    const cols = Math.floor((b.w - cell) / (cell * 1.45));
    if (cols < 1) continue;
    const pr = prob * r.r(0.4, 1.4);
    for (let row = 1; row * cell * 1.9 < b.ht && used < budget; row++) {
      if (r.ok(0.14)) continue;
      for (let col = 0; col < cols; col++) {
        if (!r.ok(pr)) continue;
        const x = b.x + cell * 0.8 + col * cell * 1.45;
        const y = b.top + row * cell * 1.9;
        if (y > base) continue;
        paths[r.ok(0.8) ? 0 : 1] += `M${n0(x)} ${n0(y)}h${n0(cell)}`;
        used++;
        if (lit.length < 42 && r.ok(0.16)) lit.push({ x, y, w: cell, ph: r() * 90 });
      }
    }
  }
  return { paths, lit };
}

function city(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const out = [];
  out.push(skyL(c, [[0, p.k], [hz / H * 0.55, p.d], [hz / H * 0.92, mix(p.m, p.a, 0.32)], [1, p.m]]));
  if (v === 1) return cityCanyon(c, out);
  if (r.ok(0.45)) out.push(L(starsItems(r, W, hz * 0.6, c.detail * 70, p.rim), { depth: 0.05 }));
  const dx = c.fx + W * r.r(-0.16, 0.16);
  const dy = hz - H * r.r(0.16, 0.34);
  const dr = u * (c.discK || r.r(10, 22));
  out.push(glowL(dx, dy, dr * 5, p.a, 0.6, { depth: 0.06 }));
  out.push(L(discItems(dx, dy, dr, p.rim, p.a), { depth: 0.07 }));
  out.push(glowL(c.fx, hz, W * 0.6, p.alt, 0.25, { depth: 0.08 }));
  for (let i = 0; i < 3; i++) {
    const bx = W * r.r(0.08, 0.92);
    out.push({
      fx: 'beam', depth: 0.2, x: bx, y: hz + u * 4, len: H * r.r(0.65, 1.05), spread: 0.035,
      a0: -Math.PI / 2 + r.r(-0.5, 0.5), amp: r.r(0.15, 0.4), f: r.r(0.1, 0.32), ph: r() * TAU, color: i ? p.rim : p.alt, op: 0.22,
    });
  }
  const far = skyline(r, W, hz + u * 8, H * 0.1, H * 0.34, u * 4, u * 9, 1);
  out.push(L(P(far.d, vg(hz - H * 0.3, hz + u * 8, [[0, mix(p.m, p.hz, 0.25)], [1, p.hz]])), { depth: 0.22 }));
  out.push(fogBand(c, r, hz + u * 7, p.hz, 0.6, 4));
  const mid = skyline(r, W, hz + u * 16, H * 0.12, H * 0.46, u * 6, u * 14, 1);
  const midCol = mix(p.d, p.m, 0.22);
  const wMid = windows(r, mid.blds, hz + u * 16, Math.max(2, u * 0.62), 0.34, c.detail * 230);
  out.push(L([
    P(mid.d, vg(hz - H * 0.4, hz + u * 20, [[0, midCol], [1, mix(midCol, p.hz, 0.55)]])),
    S(wMid.paths[0], p.a, u * 0.75, 0.85),
    S(wMid.paths[1], p.rim, u * 0.75, 0.9),
  ], { depth: 0.45 }));
  out.push({ fx: 'twinkle', depth: 0.45, pts: wMid.lit, color: p.rim, h: u * 0.75 });
  out.push(fogBand(c, r, hz + u * 18, p.hz, 0.34, 3));
  const near = skyline(r, W, hz + H * 0.24, H * 0.1, H * 0.36, u * 9, u * 20, 1);
  const wNear = windows(r, near.blds, hz + H * 0.24, Math.max(3, u * 0.95), 0.2, c.detail * 110);
  out.push(L([
    P(near.d, p.ink),
    S(wNear.paths[0], mix(p.a, p.alt, 0.25), u * 1.05, 0.72),
    S(wNear.paths[1], p.alt, u * 1.05, 0.65),
  ], { depth: 0.78 }));
  if (v === 2) {
    const rt = hz + H * r.r(0.24, 0.33);
    const rx = clamp(c.fx + W * r.r(-0.12, 0.12), W * 0.12, W * 0.88);
    const fh = u * r.r(13, 20);
    out.push(L([
      P(rectP(-20, rt, W + 40, H), p.ink),
      S(`M-20 ${n0(rt)}H${W + 20}`, p.a, 1.5, 0.7),
      P(figure(r.pick(['coat', 'cloak', 'stand']), rx, rt + 1, fh, 1), p.ink),
      S(figure('coat', rx, rt + 1, fh, 1), p.a, 1, 0.3),
    ], { depth: 1.1 }));
  } else {
    out.push(L(P(rectP(-20, hz + H * 0.24, W + 40, H), vg(hz + H * 0.2, H, [[0, p.ink], [1, '#000000']])), { depth: 0.9 }));
  }
  out.push({ fx: 'motes', depth: 1, pts: scatter(r, c.film ? 22 : 10, W, H, hz - H * 0.1), color: p.a, s: u * 0.8, v: u * 0.3, vx: u * 0.8, op: 0.5 });
  return out;
}

function cityCanyon(c, out) {
  const { W, H, r, p, hz, u } = c;
  const vx = c.fx;
  const vy = hz;
  out.push(glowL(vx, vy, H * 0.9, p.a, 0.85, { depth: 0.05 }));
  out.push(L(P(ellP(vx, vy, u * 5), p.rim), { depth: 0.05, blur: u * 1.4 }));
  const sides = [-1, 1];
  const layers = [];
  for (let i = 0; i < 9; i++) {
    const d2 = lerp(11, 1, Math.pow(i / 8, 0.8));
    const d1 = Math.max(0.75, d2 * 0.72);
    for (const s of sides) {
      const street = W * r.r(0.17, 0.25);
      const ht = H * r.r(0.75, 1.9);
      const x1 = vx + (s * street) / d1;
      const x2 = vx + (s * street) / d2;
      const y1 = vy - ht / d1;
      const y2 = vy - ht / d2;
      const gr = H * 0.3;
      const t = 1 - (i + 1) / 10;
      const col = mix(mix(p.ink, p.d, 0.5), mix(p.m, p.hz, 0.6), Math.pow(t, 1.3));
      const items = [
        P(poly([[x1, y1], [x2, y2], [x2, vy + gr / d2], [x1, vy + gr / d1]]), lg(x2, 0, x1, 0, [[0, mix(col, p.a, 0.2 + 0.5 * t)], [1, col]])),
        P(rectP(s > 0 ? x2 : -20, y2, s > 0 ? W + 20 - x2 : x2 + 20, H), col),
      ];
      let segs = '';
      let alt = '';
      const rows = c.detail > 0.8 ? 7 : 5;
      for (let row = 1; row <= rows; row++) {
        const hh = (ht + gr) * (row / (rows + 1)) - gr;
        for (let k = 0; k < 6; k++) {
          if (!r.ok(0.3)) continue;
          const a = (k + 0.15) / 6;
          const b = (k + 0.75) / 6;
          const inv = (q) => 1 / lerp(1 / d2, 1 / d1, q);
          const dA = inv(a);
          const dB = inv(b);
          const seg = `M${n0(vx + (s * street) / dA)} ${n0(vy - hh / dA)}L${n0(vx + (s * street) / dB)} ${n0(vy - hh / dB)}`;
          if (r.ok(0.8)) segs += seg;
          else alt += seg;
        }
      }
      if (segs) items.push(S(segs, p.a, Math.max(1, u * 0.6 / Math.sqrt(d2)), 0.75));
      if (alt) items.push(S(alt, p.alt, Math.max(1, u * 0.6 / Math.sqrt(d2)), 0.8));
      layers.push(...items);
    }
  }
  out.push(L(layers, { depth: 0.55 }));
  const road = [[vx - W * 0.02, vy], [vx + W * 0.02, vy], [vx + W * 0.7, H + 10], [vx - W * 0.7, H + 10]];
  out.push(L(P(poly(road), vg(vy, H, [[0, mix(p.a, p.hz, 0.4), 0.9], [0.18, p.d], [1, p.ink]])), { depth: 0.6 }));
  out.push(L(P(poly([[vx - u * 1.5, vy], [vx + u * 1.5, vy], [vx + W * 0.1, H], [vx - W * 0.1, H]]), vg(vy, H, [[0, p.rim, 0.7], [1, p.a, 0]])), { depth: 0.6, blur: u, blend: 'screen', pulse: { type: 'sin', min: 0.7, max: 1, f: 0.5, ph: 1 } }));
  out.push(fogBand(c, r, vy + u * 2, p.a, 0.55, 3));
  if (c.figures !== false) {
    const fh = u * r.r(14, 24);
    const fy = vy + (H - vy) * r.r(0.42, 0.62);
    out.push(L(P(figure(r.pick(['coat', 'stand', 'umbrella']), vx + W * r.r(-0.03, 0.03), fy, fh, 1), p.ink), { depth: 0.9 }));
  }
  out.push({ fx: 'traffic', depth: 0.65, vx, vy, n: 7, H, W, color: p.alt, color2: p.rim, seed: r() * 90 });
  out.push({ fx: 'rain', depth: 1.1, pts: scatter(r, c.film ? 90 : 45, W, H), color: p.rim, w: Math.max(1, u * 0.12), dx: u * 0.5, dy: u * 3.4, v: u * 90, vx: u * 12, op: 0.2 });
  return out;
}

const glyphBox = (r, x, y, w, ht, cols) => {
  let d = '';
  const count = Math.max(2, Math.floor(ht / (w * 1.25)));
  for (let i = 0; i < count; i++) {
    const yy = y + (ht / count) * i + (ht / count) * 0.14;
    const hh = (ht / count) * 0.72;
    const k = r.i(0, cols - 1);
    if (k === 0) d += `M${n0(x)} ${n0(yy)}h${n0(w)}v${n0(hh)}h${n0(-w)}Z`;
    else if (k === 1) d += `M${n0(x)} ${n0(yy)}h${n0(w)}M${n0(x + w / 2)} ${n0(yy)}v${n0(hh)}M${n0(x)} ${n0(yy + hh)}h${n0(w)}`;
    else if (k === 2) d += `M${n0(x)} ${n0(yy + hh)}L${n0(x + w / 2)} ${n0(yy)}L${n0(x + w)} ${n0(yy + hh)}`;
    else d += `M${n0(x)} ${n0(yy)}v${n0(hh)}h${n0(w)}v${n0(-hh)}`;
  }
  return d;
};

function neon(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const hot = mix(p.a, '#ffffff', 0.15);
  const cold = p.alt;
  const out = [];
  out.push(skyL(c, [[0, p.k], [0.5, p.d], [hz / H, mix(p.d, p.m, 0.45)], [1, p.k]]));

  const floorY = hz + H * 0.14;
  const floor = (x, col, op, wide) =>
    P(poly([[x - wide, floorY], [x + wide, floorY], [x + wide * 1.5, H + 5], [x - wide * 1.5, H + 5]]), vg(floorY, H, [[0, col, op], [1, col, 0]]));

  if (v === 1) {
    out.push(glowL(c.fx, floorY - H * 0.22, H * 0.68, hot, 0.5, { depth: 0.1 }));
    const cy = floorY - H * r.r(0.2, 0.27);
    const rad = Math.min(W * 0.34, H * 0.27);
    const shape = r.i(0, 2);
    let d;
    if (shape === 0) d = ellP(c.fx, cy, rad);
    else if (shape === 1) d = poly([[c.fx, cy - rad * 1.12], [c.fx + rad * 1.05, cy + rad * 0.72], [c.fx - rad * 1.05, cy + rad * 0.72]]);
    else d = rectP(c.fx - rad * 0.72, cy - rad, rad * 1.44, rad * 2);
    const flick = { type: 'flicker', seed: r() * 90 };
    out.push(L(S(d, hot, u * 2.6, 0.95), { depth: 0.3, blur: u * 2.2, blend: 'screen', pulse: flick }));
    out.push(L(S(d, '#ffffff', u * 0.65, 1), { depth: 0.3, pulse: flick }));
    const inner = shape === 0 ? ellP(c.fx, cy, rad * 0.8) : null;
    if (inner) {
      out.push(L(S(inner, cold, u * 1.8, 0.9), { depth: 0.3, blur: u * 1.5, blend: 'screen' }));
      out.push(L(S(inner, mix(cold, '#ffffff', 0.6), u * 0.45, 1), { depth: 0.3 }));
    }
    out.push(L(S(d, hot, u * 1.5, 0.42), { depth: 0.3, blur: u * 2.4, blend: 'screen', flipY: floorY + u * 2, pulse: flick }));
  } else if (v === 0) {
    const bL = c.fx - W * r.r(0.16, 0.22);
    const bR = c.fx + W * r.r(0.16, 0.22);
    out.push(glowL(c.fx, floorY - H * 0.16, H * 0.5, cold, 0.55, { depth: 0.1 }));
    const back = skyline(r, W, floorY, H * 0.22, H * 0.56, u * 7, u * 15, 1);
    out.push(L(P(back.d, mix(p.d, p.m, 0.25)), { depth: 0.2 }));
    out.push(L(P(`M-20 -20H${n0(bL)}V${n0(floorY)}H-20ZM${n0(bR)} -20H${W + 20}V${n0(floorY)}H${n0(bR)}Z`, mix(p.ink, p.d, 0.6)), { depth: 0.65 }));
    const signs = [];
    const glow = [];
    const reflect = [];
    const wash = [];
    const addSign = (x, y, w, ht, col) => {
      const box = rectP(x - u, y - u, w + u * 2, ht + u * 2);
      signs.push(P(box, mix(p.ink, col, 0.14)));
      const gly = glyphBox(r, x, y, w, ht, 4);
      signs.push(S(box, col, u * 0.3, 0.95));
      signs.push(S(gly, mix(col, '#ffffff', 0.6), u * 0.5, 1));
      glow.push(S(gly, col, u * 1.5, 0.95), S(box, col, u * 1.2, 0.8));
      reflect.push(floor(x + w / 2, col, 0.55, w * 1.4));
      wash.push(P(ellP(x + w / 2, y + ht / 2, w * 3.4 + u * 4, ht * 0.8), col, 0.42));
    };
    for (let i = 0, y = hz * r.r(0.15, 0.3); i < 3; i++) {
      const w = u * r.r(4.5, 8);
      const ht = H * r.r(0.2, 0.36);
      const x = bL - w - u * r.r(1.5, 2.5) - i * W * 0.09;
      if (x > 0) addSign(x, y + i * H * 0.09, w, ht, i % 2 ? cold : hot);
      const w2 = u * r.r(4.5, 8);
      const x2 = bR + u * r.r(1.5, 2.5) + i * W * 0.09;
      if (x2 + w2 < W) addSign(x2, y + (i + 1) * H * 0.07, w2, H * r.r(0.2, 0.36), i % 2 ? hot : cold);
    }
    out.push(L(wash, { depth: 0.65, blur: u * 5, blend: 'screen', pulse: { type: 'sin', min: 0.82, max: 1, f: 0.5, ph: 0 } }));
    out.push(L(glow, { depth: 0.65, blur: u * 1.7, blend: 'screen', pulse: { type: 'flicker', seed: r() * 90 } }));
    out.push(L(signs, { depth: 0.65 }));
    out.push({ reflect: true, layer: L(reflect, { depth: 0.65, blur: u * 1.4, blend: 'screen', pulse: { type: 'flicker', seed: r() * 90 } }) });
  } else {
    const bokeh = [];
    for (let i = 0; i < (c.film ? 34 : 24); i++) {
      const col = r.pick([hot, cold, p.m, p.rim]);
      bokeh.push(P(ellP(r() * W, r.r(0.05, 0.86) * floorY, u * r.r(1.5, 9)), col, r.r(0.2, 0.8)));
    }
    out.push(L(bokeh, { depth: 0.2, blur: u * 0.5, blend: 'screen', pulse: { type: 'sin', min: 0.8, max: 1, f: 0.6, ph: 1 } }));
  }

  const ground = [P(rectP(-20, floorY, W + 40, H), vg(floorY, H, [[0, mix(p.d, p.m, 0.3)], [1, p.ink]]))];
  // The ground sits behind reflections, so it goes under the neon glow rather than on top of it.
  const reflectAt = out.findIndex((l) => l.reflect);
  const groundAt = v === 1 ? 1 : v === 2 ? out.length : reflectAt;
  out.splice(groundAt, 0, L(ground, { depth: 0.65 }));
  for (let i = 0; i < out.length; i++) if (out[i].reflect) out[i] = out[i].layer;

  const puddles = [];
  for (let i = 0; i < 6; i++) {
    puddles.push(P(ellP(W * r.r(0.05, 0.95), lerp(floorY + u * 4, H, r()), W * r.r(0.06, 0.2), u * r.r(0.5, 1.4)), r.pick([hot, cold]), r.r(0.1, 0.32)));
  }
  out.push(L(puddles, { depth: 0.8, blur: u * 0.5, blend: 'screen' }));

  if (v === 2) {
    const fh = H * r.r(0.46, 0.6);
    const fx0 = c.fx;
    const kind = r.pick(['back', 'hood', 'profile']);
    const path = figure(kind, fx0, H + 2, fh, r.ok(0.5) ? 1 : -1);
    out.push(L(S(path, hot, u * 1.5, 0.75), { depth: 0.95, blur: u * 1.1, blend: 'screen' }));
    out.push(L(P(path, p.ink), { depth: 0.95 }));
  } else if (c.figures !== false) {
    const fy = floorY + (H - floorY) * r.r(0.22, 0.42);
    const fh = u * r.r(20, 30);
    const kind = r.pick(['umbrella', 'coat', 'cloak']);
    out.push(L(P(figure(kind, c.fx, fy, fh, 1), '#020208'), { depth: 0.85 }));
    out.push(L(P(ellP(c.fx, fy + u * 0.4, fh * 0.4, u * 0.9), '#000000', 0.6), { depth: 0.85, blur: u * 0.4 }));
  }
  out.push({ fx: 'rain', depth: 1.15, pts: scatter(r, c.film ? 130 : 56, W, H), color: mix(p.rim, '#ffffff', 0.4), w: Math.max(1, u * 0.1), dx: u * 0.3, dy: u * 3, v: u * 95, vx: u * 8, op: 0.3 });
  return out;
}

function orbit(c) {
  const { W, H, r, p, u } = c;
  const v = c.variant % 3;
  const out = [];
  out.push(skyL(c, [[0, '#02030a'], [0.6, mix(p.k, '#02030a', 0.3)], [1, p.k]]));
  const neb = [];
  for (let i = 0; i < 7; i++) {
    neb.push(P(ellP(W * r.r(0.1, 0.9), H * r.r(0.05, 0.9), W * r.r(0.1, 0.34), H * r.r(0.05, 0.2)), r.pick([p.m, p.alt, p.m, p.a]), r.r(0.12, 0.34)));
  }
  out.push(L(neb, { depth: 0.04, blur: u * 7, blend: 'screen' }));
  out.push(L(starsItems(r, W, H, c.detail * 300, '#ffffff'), { depth: 0.06 }));
  out.push({ fx: 'stars', depth: 0.08, pts: scatter(r, c.film ? 34 : 0, W, H), color: p.rim, s: u * 0.8 });

  if (v === 2) {
    const rad = Math.min(W, H) * r.r(0.28, 0.36);
    const cx = c.fx + W * r.r(-0.08, 0.08);
    const cy = Math.min(c.hz, H * 0.62) - rad * r.r(0.1, 0.6);
    out.push(glowL(cx, cy, rad * 3.1, p.a, 0.5, { depth: 0.1 }));
    out.push(L(raysItems(c, r, cx, cy, 14, rad * 2.7, p.rim, 0.42, 0, TAU), { depth: 0.12, blur: u * 0.8, blend: 'screen', pulse: { type: 'sin', min: 0.65, max: 1, f: 0.35, ph: 0 } }));
    out.push(L(P(ellP(cx, cy, rad * 1.02), p.rim), { depth: 0.14, blur: u * 1.3 }));
    const fa = r() * TAU;
    out.push(L(P(ellP(cx + Math.cos(fa) * rad, cy + Math.sin(fa) * rad, u * 2.6), '#ffffff'), { depth: 0.14, blur: u * 0.7, pulse: { type: 'sin', min: 0.75, max: 1, f: 0.5, ph: 2 } }));
    out.push(L(P(ellP(cx, cy, rad), '#010206'), { depth: 0.15 }));
    const base = H * r.r(0.86, 0.95);
    const surf = ridgePts(W, base, u * 8, r, { fr: 3, ridged: true, step: c.step });
    out.push(L(P(poly(closeDown(surf, H)), vg(base - u * 8, H, [[0, mix(p.ink, p.a, 0.14)], [1, '#010206']])), { depth: 0.85 }));
    if (c.figures !== false) out.push(L(P(figure('stand', c.fx + W * r.r(-0.08, 0.08), ridgeY(surf, c.fx) + 2, u * r.r(7, 11), 1), '#010206'), { depth: 0.85 }));
  } else if (v === 1) {
    const rad = Math.min(W, H) * r.r(0.25, 0.34);
    const cx = c.fx;
    const cy = H * r.r(0.32, 0.5);
    const tilt = r.r(-0.42, 0.42);
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const ring = (k, front) => {
      const rx = rad * k;
      const ry = rx * 0.24;
      const pts = [];
      for (let i = 0; i <= 26; i++) {
        const a = (front ? 0 : Math.PI) + (i / 26) * Math.PI;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
      }
      return smooth(pts);
    };
    const ringCol = mix(p.a, p.rim, 0.4);
    const ringItems = (front) => [
      S(ring(1.72, front), ringCol, rad * 0.2, 0.34),
      S(ring(1.5, front), p.rim, rad * 0.05, 0.55),
      S(ring(1.97, front), mix(ringCol, p.m, 0.4), rad * 0.11, 0.5),
    ];
    out.push(glowL(cx, cy, rad * 2.8, p.m, 0.8, { depth: 0.1 }));
    out.push(L(ringItems(false), { depth: 0.2 }));
    const lx = cx - rad * 0.55 * (c.lightDir || 1);
    const ly = cy - rad * 0.5;
    const bands = [P(ellP(cx, cy, rad), rg(lx, ly, rad * 1.9, [[0, p.rim], [0.3, p.a], [0.62, mix(p.m, p.a, 0.2)], [1, '#02030a']]))];
    for (let i = 0; i < 11; i++) {
      const y0 = r.r(-0.92, 0.92);
      const yy = cy + rad * y0;
      const half = Math.sqrt(1 - y0 * y0) * rad;
      const th = rad * r.r(0.015, 0.075);
      const bow = rad * 0.1;
      bands.push(P(`M${n0(cx - half)} ${n0(yy)}Q${n0(cx)} ${n0(yy + bow)} ${n0(cx + half)} ${n0(yy)}Q${n0(cx)} ${n0(yy + bow + th * 2)} ${n0(cx - half)} ${n0(yy)}Z`, r.pick([p.d, p.m, p.rim]), r.r(0.1, 0.3)));
    }
    bands.push(P(ellP(cx, cy, rad), rg(lx, ly, rad * 2.1, [[0, '#000000', 0], [0.58, '#000000', 0], [1, '#000000', 0.94]])));
    out.push(L(bands, { depth: 0.22 }));
    out.push(L(ringItems(true), { depth: 0.22 }));
    out.push(L(P(ellP(W * r.r(0.1, 0.9), H * r.r(0.15, 0.85), u * r.r(1.5, 3.5)), mix(p.rim, p.m, 0.3)), { depth: 0.34 }));
    const moons = u * r.r(5, 10);
    const mx = cx + rad * r.r(1.7, 2.3) * (cx > W / 2 ? -1 : 1);
    const my = cy + rad * r.r(0.7, 1.3);
    out.push(L([P(ellP(mx, my, moons), rg(mx - moons * 0.5, my - moons * 0.5, moons * 2, [[0, p.rim], [0.5, p.m], [1, '#02030a']]))], { depth: 0.5 }));
    out.push(L(P(figure('stand', W * r.r(0.15, 0.85), H * r.r(0.55, 0.78), u * r.r(3, 5.5), 1), '#010206'), { depth: 0.8 }));
  } else {
    const rad = Math.max(W, H) * r.r(0.9, 1.5);
    const cx = c.fx + W * r.r(-0.2, 0.2);
    const rimY = c.hz + H * r.r(-0.02, 0.1);
    const cy = rimY + rad;
    out.push(L(P(ellP(cx, cy, rad + u * 7), p.a), { depth: 0.16, blur: u * 4.4, blend: 'screen', op: 0.7 }));
    out.push(L(P(ellP(cx, cy, rad + u * 1.8), p.rim), { depth: 0.17, blur: u * 1.4, blend: 'screen', op: 0.9 }));
    const sa = -Math.PI / 2 + r.r(-0.22, 0.22);
    const sx = cx + Math.cos(sa) * rad;
    const sy = cy + Math.sin(sa) * rad;
    out.push(glowL(sx, sy, u * 34, p.rim, 0.9, { depth: 0.17 }));
    out.push(L(P(ellP(sx, sy, u * 2.6), '#ffffff'), { depth: 0.17, blur: u * 0.7 }));
    out.push(L(S(`M${n0(sx - W * 0.5)} ${n0(sy)}H${n0(sx + W * 0.5)}`, p.rim, u * 0.35, 0.8), { depth: 0.17, blur: u * 0.3, blend: 'screen', pulse: { type: 'sin', min: 0.5, max: 1, f: 0.4, ph: 2 } }));
    const surf = [P(ellP(cx, cy, rad), vg(rimY, rimY + H * 0.42, [[0, mix(p.m, p.a, 0.2)], [0.08, mix(p.d, p.m, 0.4)], [1, '#02030a']]))];
    const nz = [];
    for (let i = 0; i < 12; i++) {
      const yy = rimY + H * Math.pow(r(), 1.4) * 0.48 + u * 2;
      const x0 = W * r.r(0, 0.9);
      nz.push(P(ellP(x0, yy, W * r.r(0.05, 0.22), u * r.r(0.3, 1.3)), r.pick([p.rim, p.m, p.a]), r.r(0.06, 0.2)));
    }
    out.push(L(surf, { depth: 0.2 }));
    out.push(L(nz, { depth: 0.2, blur: u * 0.5, drift: r.r(2, 5) }));
    const sc = r.r(0.75, 1.3) * u;
    const shipX = W * r.r(0.15, 0.85);
    const shipY = H * r.r(0.14, 0.42);
    const ship = `M${n0(shipX - 7 * sc)} ${n1(shipY)}L${n1(shipX + 8 * sc)} ${n1(shipY - sc * 0.7)}L${n1(shipX + 10 * sc)} ${n1(shipY)}L${n1(shipX + 8 * sc)} ${n1(shipY + sc * 0.7)}ZM${n1(shipX - 3 * sc)} ${n1(shipY)}L${n1(shipX - 6 * sc)} ${n1(shipY - 3.4 * sc)}L${n1(shipX - 1 * sc)} ${n1(shipY)}L${n1(shipX - 6 * sc)} ${n1(shipY + 3.4 * sc)}Z`;
    out.push(L([P(ship, '#04060e'), S(`M${n1(shipX - 7 * sc)} ${n1(shipY - sc * 0.1)}L${n1(shipX + 9 * sc)} ${n1(shipY - sc * 0.8)}`, p.rim, 1, 0.8)], { depth: 0.55, drift: u * 0.5 }));
    const fr = H * r.r(0.42, 0.62);
    if (c.figures !== false && r.ok(0.6)) {
      const edge = cx > W / 2 ? W * r.r(0.06, 0.28) : W * r.r(0.72, 0.94);
      const path = figure(r.pick(['hood', 'back']), edge, H + 2, fr * 0.72, 1);
      out.push(L(S(path, p.a, u * 1.1, 0.8), { depth: 1.05, blur: u * 0.8, blend: 'screen' }));
      out.push(L(P(path, '#010206'), { depth: 1.05 }));
    }
  }
  out.push({ fx: 'comet', depth: 0.18, seed: r() * 90, W, H, color: p.rim, u });
  out.push({ fx: 'motes', depth: 1, pts: scatter(r, c.film ? 16 : 6, W, H), color: p.rim, s: u * 0.45, v: 0, vx: u * 1.2, op: 0.4 });
  return out;
}

function waveBand(band, W, t, step) {
  const pts = [];
  for (let x = -step; x <= W + step; x += step) {
    const y =
      band.y +
      band.amp *
        (Math.sin(x / band.wl + band.ph + t * band.sp) +
          0.45 * Math.sin(x / (band.wl * 0.41) + band.ph * 2.3 - t * band.sp * 1.3) +
          0.18 * Math.sin(x / (band.wl * 0.17) + band.ph * 3.1 + t * band.sp * 1.8));
    pts.push([x, y]);
  }
  return pts;
}

function waves(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const out = [];
  if (v === 2) return underwater(c, out);
  out.push(skyL(c, [[0, p.d], [hz / H * 0.56, p.m], [hz / H * 0.92, p.hz], [hz / H, p.rim], [1, p.m]]));
  const sx = c.fx + W * r.r(-0.1, 0.1);
  const dr = u * (c.discK || r.r(9, 19));
  const sy = hz - dr * r.r(0.2, 1.3);
  out.push(glowL(sx, sy, dr * 6.6, p.a, 0.8, { depth: 0.05 }));
  out.push(L(discItems(sx, sy, dr, p.rim, p.a), { depth: 0.06 }));
  const cl = [];
  for (let i = 0; i < 9; i++) {
    const y = hz - H * Math.pow(r(), 1.3) * 0.46 - u * 2;
    cl.push(P(ellP(W * r.r(0.1, 0.9), y, W * r.r(0.08, 0.3), u * r.r(0.5, 2)), r.ok(0.6) ? mix(p.d, p.m, 0.5) : p.rim, r.r(0.3, 0.72)));
  }
  out.push(L(cl, { depth: 0.1, blur: u * 0.8, drift: r.r(2, 7) }));

  out.push(L(P(rectP(-20, hz, W + 40, H), vg(hz, H, [[0, p.hz], [0.14, mix(p.m, p.hz, 0.35)], [0.55, p.d], [1, p.k]])), { depth: 0.16 }));
  out.push(L(P(poly([[sx - dr * 0.9, hz], [sx + dr * 0.9, hz], [sx + dr * 3, H], [sx - dr * 3, H]]), vg(hz, H, [[0, p.rim, 0.95], [1, p.a, 0.12]])), { depth: 0.2, blur: u * 1.1, blend: 'screen' }));
  out.push({ fx: 'glitter', depth: 0.3, pts: Array.from({ length: c.film ? 80 : 44 }, () => {
    const t = Math.pow(r(), 1.5);
    return { x: sx + r.r(-1, 1) * (dr * 0.9 + t * dr * 2.5), y: lerp(hz + 2, H, t), w: u * lerp(0.7, 4, t), ph: r() * TAU };
  }), color: p.rim });

  const count = 6;
  const bands = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const y = lerp(hz + (H - hz) * 0.16, H * 0.97, Math.pow(t, 1.25));
    const col = mix(mix(p.m, p.d, 0.5), p.ink, 0.25 + t * 0.75);
    bands.push({
      y, amp: u * lerp(0.35, 3, t), wl: u * lerp(4, 16, t), sp: lerp(0.5, 0.95, t) * (r.ok(0.5) ? 1 : -1), ph: r() * TAU,
      fill: vg(y - u * 2, y + (H - y) * 0.7, [[0, mix(col, p.hz, 0.34)], [0.16, col], [1, mix(col, p.ink, 0.6)]]),
      crest: mix(p.rim, col, 0.45), crestOp: lerp(0.12, 0.3, t), crestW: Math.max(1, u * lerp(0.14, 0.6, t)), depth: lerp(0.35, 1.15, t),
    });
  }
  const boatBand = bands[Math.floor(count * 0.5)];
  const boatAt = clamp(c.fx + W * r.r(-0.18, 0.18), W * 0.1, W * 0.9);
  const bs = u * r.r(0.75, 1.6);
  const boat = (x, y) => `M${n1(x - 8 * bs)} ${n1(y - 1 * bs)}L${n1(x + 8 * bs)} ${n1(y - 1 * bs)}L${n1(x + 5.5 * bs)} ${n1(y + 2 * bs)}L${n1(x - 5.5 * bs)} ${n1(y + 2 * bs)}ZM${n1(x - 0.3 * bs)} ${n1(y - 1 * bs)}V${n1(y - 19 * bs)}L${n1(x - 7.5 * bs)} ${n1(y - 3 * bs)}L${n1(x - 0.3 * bs)} ${n1(y - 3 * bs)}ZM${n1(x + 0.7 * bs)} ${n1(y - 17 * bs)}L${n1(x + 7 * bs)} ${n1(y - 3 * bs)}L${n1(x + 0.7 * bs)} ${n1(y - 3 * bs)}Z`;
  if (v === 1) {
    const side = c.fx > W / 2 ? 1 : -1;
    const ex = side > 0 ? W * 0.3 : W * 0.7;
    const baseY = hz + u * 12;
    const cliff = [];
    const nz = noise1(r.i(0, 1e9));
    const lx = side > 0 ? -20 : W + 20;
    const hx0 = lerp(lx, ex, 0.5);
    const topY = hz - H * r.r(0.15, 0.25);
    for (let t = 0; t <= 1.001; t += 0.05) {
      const x = lerp(lx, ex, t);
      cliff.push([x, topY + (t > 0.75 ? ((t - 0.75) / 0.25) ** 1.2 * (baseY - topY) : 0) + nz(t * 7) * u * 3.5]);
    }
    const lhx = hx0 + (ex - hx0) * 0.5;
    const lhy = ridgeY(side > 0 ? cliff : cliff.slice().reverse(), lhx);
    const lhh = H * r.r(0.15, 0.22);
    const lw = u * 2;
    const beacon = [lhx, lhy - lhh - lw * 0.8];
    out.push(L([
      P(poly([...cliff, [ex, H], [lx, H]]), vg(topY, baseY + u * 10, [[0, p.d], [1, p.ink]])),
      P(poly([[lhx - lw, lhy + 2], [lhx - lw * 0.65, lhy - lhh], [lhx + lw * 0.65, lhy - lhh], [lhx + lw, lhy + 2]]), p.ink),
      P(rectP(lhx - lw * 0.9, lhy - lhh - u * 0.5, lw * 1.8, u * 0.5), p.ink),
      P(poly([[lhx - lw * 0.6, lhy - lhh - lw * 1.6], [lhx, lhy - lhh - lw * 2.5], [lhx + lw * 0.6, lhy - lhh - lw * 1.6]]), p.ink),
      P(rectP(lhx - lw * 0.5, lhy - lhh - lw * 1.6, lw, lw * 1.1), p.rim),
    ], { depth: 0.36 }));
    out.push(glowL(beacon[0], beacon[1], u * 15, p.rim, 0.9, { depth: 0.36 }));
    for (const s of [0, Math.PI]) {
      out.push({ fx: 'beam', depth: 0.36, x: beacon[0], y: beacon[1], len: W * 0.9, spread: 0.055, a0: s + r.r(-0.1, 0.1), amp: 0.55, f: 0.14, ph: 0, color: p.rim, op: 0.4 });
    }
  } else {
    out.push({ fx: 'boat', depth: 0.65, path: boat, band: boatBand, x: boatAt, color: p.ink, W });
  }
  out.push({ fx: 'waves', depth: 0.75, bands, W });
  out.push({ fx: 'birds', depth: 0.3, n: r.i(3, 7), x: r() * W, y: hz - H * r.r(0.1, 0.3), v: u * r.r(1, 2.2), s: u * 0.8, color: p.ink });
  return out;
}

function underwater(c, out) {
  const { W, H, r, p, u } = c;
  const top = mix(p.a, p.rim, 0.25);
  out.push(skyL(c, [[0, top], [0.12, mix(p.m, p.a, 0.5)], [0.45, p.m], [0.78, p.d], [1, p.k]]));
  const lx = c.fx;
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const x = lx + W * r.r(-0.65, 0.65);
    const wd = W * r.r(0.02, 0.09);
    const dx = (x - lx) * 1.1;
    rays.push(P(poly([[x - wd * 0.5, -10], [x + wd * 0.5, -10], [x + dx + wd * 2, H * 0.95], [x + dx - wd * 2, H * 0.95]]), vg(0, H * 0.95, [[0, p.rim, r.r(0.3, 0.6)], [1, p.rim, 0]])));
  }
  out.push(glowL(lx, -H * 0.02, W * 0.8, p.rim, 0.8, { depth: 0.04 }));
  out.push(L(rays, { depth: 0.1, blur: u * 1.2, blend: 'screen', sway: { a: u * 4, f: 0.3, ph: 0 }, pulse: { type: 'sin', min: 0.65, max: 1, f: 0.45, ph: r() * TAU } }));
  const caustic = [];
  for (let i = 0; i < 8; i++) caustic.push(P(ellP(W * r.r(0.1, 0.9), r.r(2, 12) * u, W * r.r(0.08, 0.26), u * r.r(0.4, 1.2)), '#ffffff', r.r(0.2, 0.55)));
  out.push(L(caustic, { depth: 0.12, blur: u * 0.6, drift: r.r(4, 12) }));
  const whaleLike = r.ok(0.55);
  if (whaleLike) {
    const s = u * r.r(0.75, 1.45);
    const x = W * r.r(0.25, 0.75);
    const y = H * r.r(0.26, 0.46);
    const f = r.ok(0.5) ? 1 : -1;
    const q = (a, b) => `${n0(x + a * s * f)} ${n0(y + b * s)}`;
    const body = `M${q(-46, 2)}Q${q(-30, -13)} ${q(-4, -12)}Q${q(22, -10)} ${q(38, -2)}Q${q(44, -9)} ${q(54, -13)}Q${q(52, -3)} ${q(58, 6)}Q${q(47, 6)} ${q(38, 3)}Q${q(16, 12)} ${q(-4, 10)}Q${q(-8, 22)} ${q(-22, 28)}Q${q(-21, 16)} ${q(-18, 8)}Q${q(-34, 8)} ${q(-46, 2)}Z`;
    out.push(L(P(body, mix(p.d, p.m, 0.42)), { depth: 0.32, blur: u * 0.3, drift: u * 0.45 * f }));
  } else {
    const fish = [];
    const cx0 = W * r.r(0.2, 0.8);
    const cy0 = H * r.r(0.3, 0.55);
    for (let i = 0; i < 44; i++) {
      const a = r() * TAU;
      const dd = Math.pow(r(), 0.6) * u * 22;
      const x = cx0 + Math.cos(a) * dd * 1.5;
      const y = cy0 + Math.sin(a) * dd * 0.72;
      const sz = u * r.r(0.5, 0.95);
      fish.push(`M${n1(x - sz)} ${n1(y)}Q${n1(x)} ${n1(y - sz * 0.5)} ${n1(x + sz)} ${n1(y)}Q${n1(x)} ${n1(y + sz * 0.5)} ${n1(x - sz)} ${n1(y)}Z`);
    }
    out.push(L(P(fish.join(''), mix(p.d, p.m, 0.28)), { depth: 0.32, drift: u * 0.65 }));
  }
  const seaBase = H * r.r(0.82, 0.9);
  const reef = ridgePts(W, seaBase, u * 12, r, { fr: 6, ridged: true, step: c.step });
  out.push(L(P(poly(closeDown(reef, H)), vg(seaBase - u * 12, H, [[0, mix(p.d, p.m, 0.2)], [1, p.ink]])), { depth: 0.6 }));
  if (c.figures !== false) {
    const dx = clamp(c.fx + W * r.r(-0.1, 0.1), W * 0.14, W * 0.86);
    const dy = H * r.r(0.55, 0.68);
    const fh = u * r.r(16, 25);
    out.push(L(P(figure('stand', dx, dy, fh, 1), p.ink), { depth: 0.84, sway: { a: u, f: 0.5, ph: 1 } }));
  }
  out.push({ fx: 'bubbles', depth: 0.95, pts: scatter(r, c.film ? 42 : 20, W, H), color: p.rim, s: u * 0.75, v: u * 5 });
  return out;
}

function pine(r, x, base, ht, tiers) {
  const hw = ht * r.r(0.15, 0.24);
  const right = [];
  const left = [];
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers;
    const y = base - ht + ht * t * 0.94;
    const w = hw * Math.pow(t, 0.9);
    right.push([x + w * r.r(0.85, 1.1), y], [x + w * r.r(0.32, 0.55), y - ht * 0.012]);
    left.unshift([x - w * r.r(0.32, 0.55), y - ht * 0.012], [x - w * r.r(0.85, 1.1), y]);
  }
  return poly([[x, base - ht], ...right, [x + hw * 0.1, base], [x - hw * 0.1, base], ...left]);
}

function forest(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const out = [];
  out.push(skyL(c, [[0, p.d], [hz / H * 0.55, p.m], [hz / H * 0.95, p.hz], [1, mix(p.hz, p.rim, 0.5)]]));
  const lx = c.fx;
  const ly = hz - H * r.r(0.08, 0.26);
  const dr = u * (c.discK || r.r(9, 18));
  out.push(glowL(lx, ly, dr * 7, p.rim, 0.8, { depth: 0.05 }));
  if (v !== 1) out.push(L(discItems(lx, ly, dr, '#ffffff', p.rim), { depth: 0.06, op: 0.92 }));
  if (v !== 1) out.push(L(starsItems(r, W, ly - dr * 2, c.detail * 70, p.rim), { depth: 0.05, op: 0.8 }));

  if (v === 1) {
    out.push(L(raysItems(c, r, lx, ly, 15, H * 1.3, p.rim, 0.4, 0.3, Math.PI - 0.3), { depth: 0.2, blur: u * 1.1, blend: 'screen', pulse: { type: 'sin', min: 0.6, max: 1, f: 0.28, ph: r() * TAU }, sway: { a: u * 1.2, f: 0.21, ph: 0 } }));
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      const col = mix(mix(p.m, p.hz, 0.25), p.ink, t);
      const w0 = u * lerp(1.2, 6.5, t);
      let d = '';
      let x = -w0 + r.r(0, W * 0.08);
      while (x < W + w0) {
        const skip = Math.abs(x - lx) < W * lerp(0.03, 0.16, t);
        if (!skip) {
          const wd = w0 * r.r(0.65, 1.25);
          const lean = r.r(-1.5, 1.5) * u * t;
          d += poly([[x - wd * 0.48 + lean, -10], [x + wd * 0.48 + lean, -10], [x + wd * 0.7, H], [x - wd * 0.7, H]]);
          for (let b = r.i(0, 3); b > 0; b--) {
            const by = H * r.r(0.04, 0.52);
            const s = r.ok(0.5) ? 1 : -1;
            const ln = u * r.r(6, 21) * lerp(0.6, 1.3, t);
            d += poly([[x, by], [x + s * ln, by - ln * r.r(0.32, 0.7)], [x + s * ln * 0.95, by - ln * 0.7], [x, by - u * 1.3]]);
          }
        }
        x += W * lerp(0.05, 0.19, t) * r.r(0.65, 1.3);
      }
      out.push(L(P(d, col), { depth: lerp(0.28, 1.05, t) }));
      if (k < 3) out.push(fogBand(c, r, hz + (H - hz) * lerp(0.25, 0.65, t), p.hz, 0.5 - t * 0.2, 4, 2));
    }
    const gy = hz + H * r.r(0.17, 0.25);
    const gr = ridgePts(W, gy, u * 7, r, { fr: 2.5, step: c.step * 1.5 });
    out.push(L(P(poly(closeDown(gr, H)), p.ink), { depth: 1.05 }));
    if (c.figures !== false) out.push(L(P(figure(r.pick(['cloak', 'coat']), clamp(lx, W * 0.1, W * 0.9), ridgeY(gr, lx) + 2, u * r.r(11, 17), 1), p.ink), { depth: 1.05 }));
  } else {
    const n = 4;
    const road = v === 2;
    const roadW = (t) => lerp(W * 0.003, W * 0.42, t);
    let lastGround;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const col = mix(mix(p.m, p.hz, 0.45), p.ink, Math.pow(t, 0.75));
      const base = lerp(hz + u * 2, H * 0.9, Math.pow(t, 1.4));
      const gr = ridgePts(W, base, u * lerp(3, 8, t), r, { fr: 3, oct: 2, step: c.step * 2 });
      lastGround = gr;
      const items = [P(poly(closeDown(gr, H)), col)];
      const ht = u * lerp(9, 42, Math.pow(t, 1.25));
      const tiers = [3, 4, 5, 7][k];
      let x = -ht * 0.2;
      let d = '';
      const lim = c.detail * [34, 24, 15, 9][k];
      let made = 0;
      while (x < W + ht * 0.2 && made < lim * 1.6) {
        const gap = road && Math.abs(x - lx) < roadW(t) * 0.75;
        if (!gap && !(k === n - 1 && Math.abs(x - lx) < W * 0.14)) {
          d += pine(r, x, ridgeY(gr, x) + 2, ht * r.r(0.7, 1.25), tiers);
          made++;
        }
        x += ht * r.r(0.16, 0.42) * (k === n - 1 ? 1.45 : 1);
      }
      items.push(P(d, col));
      out.push(L(items, { depth: lerp(0.22, 1.05, t) }));
      if (k < n - 1) out.push(fogBand(c, r, base + u * lerp(1, 7, t), p.hz, 0.72 - t * 0.35, 4, 1.5));
    }
    if (road) {
      const base = hz + u * 2;
      out.push(L(P(poly([[lx - u * 0.5, base], [lx + u * 0.5, base], [lx + W * 0.34, H + 4], [lx - W * 0.34, H + 4]]), vg(base, H, [[0, p.rim, 0.85], [0.3, p.hz, 0.42], [1, p.ink, 1]])), { depth: 0.85 }));
      if (c.figures !== false) {
        const fh = u * r.r(14, 22);
        out.push(L(P(figure(r.pick(['stand', 'coat', 'cloak']), lx, lerp(base, H, r.r(0.5, 0.66)), fh, 1), p.ink), { depth: 0.95 }));
      }
    } else if (c.figures !== false) {
      const fx0 = clamp(lx + W * r.r(-0.04, 0.04), W * 0.1, W * 0.9);
      const fh = u * r.r(8, 15);
      out.push(L(P(figure(r.pick(['cloak', 'coat', 'stand']), fx0, ridgeY(lastGround, fx0) + 2, fh, 1), p.ink), { depth: 1.05 }));
    }
  }
  const frame = [];
  for (const s of [0, W]) {
    const nb = c.detail > 0.8 ? 3 : 2;
    for (let i = 0; i < nb; i++) {
      const x = s + (s ? -1 : 1) * u * r.r(-2, 8);
      const dep = u * r.r(16, 36);
      frame.push(P(pine(r, x, -2 + dep, dep, 5), p.ink));
    }
  }
  if (v === 0) out.push(L(frame, { depth: 1.1 }));
  out.push({ fx: 'motes', depth: 0.9, pts: scatter(r, c.film ? 38 : 16, W, H, hz * 0.5), color: mix(p.a, p.rim, 0.3), s: u * 0.7, v: u * 0.4, vx: u * 0.5, op: 0.85 });
  return out;
}

function desert(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const night = v === 2;
  const out = [];
  out.push(
    skyL(
      c,
      night
        ? [[0, p.k], [hz / H * 0.6, p.d], [hz / H, mix(p.m, p.a, 0.2)], [1, p.d]]
        : [[0, mix(p.d, p.m, 0.4)], [hz / H * 0.55, p.m], [hz / H * 0.88, p.hz], [hz / H, p.rim], [1, p.a]],
    ),
  );
  if (night) out.push(L(starsItems(r, W, hz, c.detail * 300, '#ffffff'), { depth: 0.04 }));
  const dr = u * (c.discK || r.r(13, 28));
  const sx = c.fx + W * r.r(-0.08, 0.08);
  const sy = night ? hz - H * r.r(0.25, 0.42) : hz - dr * r.r(0.35, 1.1);
  out.push(glowL(sx, sy, dr * 4.4, p.a, night ? 0.3 : 0.85, { depth: 0.05 }));
  out.push(L(discItems(sx, sy, dr * (night ? 0.5 : 1), '#ffffff', night ? p.rim : p.a), { depth: 0.06 }));
  const hazeC = [];
  for (let i = 0; i < 6; i++) hazeC.push(P(ellP(W * r.r(0.1, 0.9), hz - u * r.r(1, 16), W * r.r(0.12, 0.34), u * r.r(0.25, 1)), p.d, r.r(0.2, 0.5)));
  if (!night) out.push(L(hazeC, { depth: 0.08, blur: u * 0.3, drift: r.r(1, 3) }));

  if (v === 1) {
    const mes = (x, wd, ht, col) => {
      const top = hz - ht;
      const tw = wd * r.r(0.48, 0.72);
      const pts = [[x - wd / 2, hz + u * 3], [x - tw / 2 - wd * 0.06, hz - ht * 0.3], [x - tw / 2, top + ht * 0.16], [x - tw / 2 + u * 0.4, top]];
      for (let i = 1; i < 6; i++) pts.push([x - tw / 2 + (tw * i) / 6, top + r.r(-0.5, 0.5) * u]);
      pts.push([x + tw / 2 - u * 0.4, top], [x + tw / 2, top + ht * 0.2], [x + tw / 2 + wd * 0.07, hz - ht * 0.28], [x + wd / 2, hz + u * 3]);
      return P(poly(pts), vg(top, hz + u * 3, [[0, col], [1, mix(col, p.a, 0.32)]]));
    };
    const farM = [];
    for (let i = 0; i < 3; i++) farM.push(mes(W * r.r(0.05, 0.95), u * r.r(18, 34), H * r.r(0.07, 0.14), mix(p.m, p.hz, 0.5)));
    out.push(L(farM, { depth: 0.14 }));
    const nearM = [mes(c.fx + W * r.r(0.2, 0.4) * (r.ok(0.5) ? 1 : -1), u * r.r(32, 52), H * r.r(0.17, 0.34), mix(p.d, p.m, 0.4))];
    nearM.push(mes(c.fx + W * r.r(-0.06, 0.06) - W * 0.36, u * r.r(22, 42), H * r.r(0.12, 0.25), mix(p.d, p.m, 0.3)));
    out.push(L(nearM, { depth: 0.26 }));
  }

  const count = 5;
  let front;
  for (let k = 0; k < count; k++) {
    const t = k / (count - 1);
    const base = lerp(hz + u * 1.5, H * 0.9, Math.pow(t, 1.15));
    const amp = u * lerp(5, 22, t);
    const nz = noise1(r.i(0, 1e9));
    const off = r.r(0, 90);
    const pts = [];
    const stp = W / lerp(26, 18, t);
    const fr = lerp(5, 1.6, t);
    for (let x = -stp; x <= W + stp; x += stp) pts.push([x, base - amp * (nz((x / W) * fr + off, 2) - 0.45) * 2]);
    front = pts;
    const shade = mix(mix(p.m, p.a, night ? 0.1 : 0.5), night ? p.k : p.d, Math.pow(t, 0.7));
    const lit = mix(shade, p.rim, night ? lerp(0.42, 0.2, t) : lerp(0.55, 0.28, t));
    const items = [P(smooth(closeDown(pts, H), true), vg(base - amp, base + amp * 2.4, [[0, lit], [0.32, shade], [1, mix(shade, p.ink, 0.42)]]))];
    const cr = [];
    for (let i = 1; i < pts.length - 2; i++) {
      const a = pts[i];
      const down = (Math.sin((i * 0.8) + off) * 0.5 + 0.5) * amp * 2.4;
      cr.push([a[0] + down * 0.8, a[1] + down]);
    }
    if (cr.length > 2) {
      const sh = [...pts.slice(1, pts.length - 2), ...cr.slice().reverse()];
      items.push(P(smooth(sh, true), mix(shade, p.ink, 0.72), night ? 0.42 : 0.32));
    }
    const rip = [];
    if (t > 0.3) {
      const nr = c.detail * 7;
      for (let i = 0; i < nr; i++) {
        const x = r() * W;
        const y = ridgeY(pts, x) + r.r(0.1, 1) * amp * 1.5;
        const ln = W * r.r(0.02, 0.09);
        rip.push(`M${n0(x - ln)} ${n0(y)}Q${n0(x)} ${n0(y - u * 0.7)} ${n0(x + ln)} ${n0(y)}`);
      }
      items.push(S(rip.join(''), mix(shade, lit, 0.5), Math.max(0.8, u * 0.12), 0.5));
    }
    out.push(L(items, { depth: lerp(0.18, 1.1, t) }));
    if (k < 2) out.push(fogBand(c, r, base + u * 2.5, p.hz, 0.42, 3, 0.8));
  }
  if (c.figures !== false) {
    const cx0 = clamp(c.fx + W * r.r(-0.16, 0.16), W * 0.12, W * 0.88);
    const items = [];
    const num = r.ok(0.45) ? r.i(3, 5) : r.i(1, 2);
    const fh = u * r.r(5, 11);
    for (let i = 0; i < num; i++) {
      const x = cx0 + i * fh * 0.56;
      items.push(P(figure(r.pick(['cloak', 'coat']), x, ridgeY(front, x) + 2, fh * r.r(0.9, 1.05), 1), p.ink));
    }
    out.push(L(items, { depth: 1.1 }));
  }
  out.push({ fx: 'sand', depth: 1.1, pts: scatter(r, c.film ? 42 : 0, W, H, hz), color: night ? p.rim : mix(p.a, p.rim, 0.4), u, v: u * 26, H });
  out.push({ fx: 'motes', depth: 1, pts: scatter(r, c.film ? 18 : 8, W, H, hz - u * 8), color: p.rim, s: u * 0.3, v: -u * 0.2, vx: u * 3.6, op: 0.45 });
  return out;
}

const gridHoriz = (f, t) => {
  const { W, H, hzY, n } = f;
  let d = '';
  const frac = mod(t * f.speed, 1);
  for (let i = 0; i < n; i++) {
    const q = Math.pow((i + frac) / n, 2.6);
    const y = hzY + (H - hzY) * q;
    d += `M-20 ${n1(y)}H${W + 20}`;
  }
  return d;
};

function grid(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const out = [];
  if (v === 1) return gridTunnel(c, out);
  out.push(skyL(c, [[0, p.k], [hz / H * 0.55, p.d], [hz / H * 0.94, mix(p.m, p.alt, 0.22)], [hz / H, mix(p.m, p.a, 0.45)], [1, p.k]]));
  out.push(L(starsItems(r, W, hz * 0.85, c.detail * 120, '#ffffff'), { depth: 0.05 }));
  const dr = Math.min(W * 0.34, u * (c.discK || r.r(18, 28)));
  const sx = c.fx;
  const sy = hz - dr * r.r(0.28, 0.6);
  out.push(glowL(sx, sy, dr * 3.3, p.a, 0.7, { depth: 0.07 }));
  let sliced = '';
  const slices = 8;
  const clipY = (yy) => {
    const q = (yy - sy) / dr;
    return Math.sqrt(Math.max(0, 1 - q * q)) * dr;
  };
  let y = sy - dr;
  for (let i = 0; i < slices; i++) {
    const t = i / slices;
    const th = (dr * 2 * (1 - t * 0.55)) / slices;
    const seg = 7;
    const left = [];
    const right = [];
    for (let k = 0; k <= seg; k++) {
      const yy = y + (th * k) / seg;
      const hw = clipY(Math.min(yy, sy + dr));
      left.push([sx - hw, yy]);
      right.push([sx + hw, yy]);
    }
    sliced += poly([...left, ...right.reverse()]);
    y += th + (dr * 2 * t * 0.55) / slices;
  }
  out.push(L(P(sliced, vg(sy - dr, sy + dr, [[0, p.rim], [0.5, p.a], [1, p.alt]])), { depth: 0.08 }));

  if (v === 0) {
    for (let k = 0; k < 2; k++) {
      const pts = [];
      const hh = u * (k ? 13 : 22);
      const nz = noise1(r.i(0, 1e9));
      const off = r.r(0, 200);
      const stp = W / 18;
      for (let x = -stp; x <= W + stp; x += stp) {
        const edge = clamp(Math.abs(x - sx) / (W * 0.48));
        pts.push([x, hz - nz(x / W * 6 + off, 2, true) * hh * edge * 1.15 - u]);
      }
      let wire = '';
      for (let i = 1; i < pts.length - 1; i++) {
        const b = [pts[i][0] + r.r(-2, 2) * u, hz];
        wire += `M${n0(pts[i][0])} ${n0(pts[i][1])}L${n0(b[0])} ${n0(b[1])}L${n0(pts[i + 1][0])} ${n0(pts[i + 1][1])}`;
      }
      const col = k ? p.a : p.alt;
      out.push(L([
        P(poly(closeDown(pts, hz + 2)), mix(p.k, col, 0.1)),
        S(wire, col, Math.max(1, u * 0.14), 0.4),
        S(poly(pts, false), mix(col, '#ffffff', 0.25), Math.max(1, u * 0.28), 0.95),
      ], { depth: k ? 0.3 : 0.2 }));
    }
  } else {
    const items = [];
    const glow = [];
    const towers = c.detail > 0.8 ? 14 : 10;
    for (let i = 0; i < towers; i++) {
      const t = Math.pow((i + 0.5) / towers, 1.5);
      const s = r.ok(0.5) ? 1 : -1;
      const gx = sx + s * W * (r.r(0.08, 0.2) + t * 0.46);
      const ww = u * lerp(1.5, 8, t);
      const hh = H * r.r(0.16, 0.5) * lerp(0.35, 1, t);
      const base = hz + (H - hz) * t * 0.56;
      items.push(P(rectP(gx - ww, base - hh, ww * 2, hh), vg(base - hh, base, [[0, mix(p.k, p.alt, 0.36)], [1, p.ink]])));
      items.push(S(`M${n0(gx - ww)} ${n0(base)}V${n0(base - hh)}H${n0(gx + ww)}V${n0(base)}`, r.pick([p.a, p.alt, p.rim]), Math.max(1, u * 0.2), 0.95));
      glow.push(S(`M${n0(gx - ww)} ${n0(base - hh)}H${n0(gx + ww)}`, p.alt, u * 0.9, 0.9));
    }
    out.push(L(glow, { depth: 0.34, blur: u * 1, blend: 'screen', pulse: { type: 'sin', min: 0.5, max: 1, f: 0.7, ph: 1 } }));
    out.push(L(items, { depth: 0.34 }));
  }
  const col = c.gridCol || p.alt;
  out.push(L(P(rectP(-20, hz, W + 40, H), vg(hz, H, [[0, mix(p.k, col, 0.26)], [0.22, p.k], [1, '#010208']])), { depth: 0.3 }));
  let verts = '';
  const vn = 19;
  for (let i = -vn; i <= vn; i++) {
    const xb = sx + (i / vn) * W * 1.6;
    verts += `M${n0(sx + (i / vn) * W * 0.05)} ${n0(hz)}L${n0(xb)} ${H + 10}`;
  }
  const lw = Math.max(1, u * 0.2);
  out.push(L(S(verts, col, lw * 2.8, 0.45), { depth: 0.5, blur: u * 0.7, blend: 'screen' }));
  out.push(L(S(verts, mix(col, '#ffffff', 0.25), lw, 0.8), { depth: 0.5 }));
  out.push({ fx: 'gridfloor', depth: 0.5, W, H, hzY: hz, n: 13, speed: r.r(0.35, 0.8), color: col, lw });
  out.push(L(P(rectP(-20, hz - u * 2, W + 40, u * 5), p.a), { depth: 0.1, blur: u * 1.5, blend: 'screen', op: 0.55 }));
  if (c.figures !== false && r.ok(0.75)) {
    const fh = u * r.r(13, 26);
    const fy = hz + (H - hz) * r.r(0.34, 0.6);
    const fx0 = sx + r.r(-0.05, 0.05) * W;
    const kind = r.pick(['stand', 'coat', 'cloak']);
    out.push(L([
      P(ellP(fx0, fy + u * 0.3, fh * 0.42, u * 0.8), col, 0.7),
    ], { depth: 0.72, blur: u * 0.5, blend: 'screen' }));
    out.push(L(P(figure(kind, fx0, fy, fh, 1), '#010208'), { depth: 0.72 }));
  }
  out.push({ fx: 'motes', depth: 0.8, pts: scatter(r, c.film ? 28 : 10, W, H), color: p.rim, s: u * 0.45, v: -u * 0.8, vx: 0, op: 0.7 });
  return out;
}

function gridTunnel(c, out) {
  const { W, H, r, p, u } = c;
  const vx = c.fx;
  const vy = c.hz - H * 0.04;
  out.push(skyL(c, [[0, p.k], [1, '#010208']]));
  out.push(glowL(vx, vy, Math.max(W, H) * 0.6, p.a, 0.95, { depth: 0.02 }));
  out.push(L(P(ellP(vx, vy, u * 8), '#ffffff'), { depth: 0.02, blur: u * 3 }));
  const rays = [];
  const corners = [[-20, -20], [W + 20, -20], [W + 20, H + 20], [-20, H + 20]];
  const stepsEach = 7;
  for (let side = 0; side < 4; side++) {
    const a = corners[side];
    const b = corners[(side + 1) % 4];
    for (let i = 0; i <= stepsEach; i++) {
      const t = i / stepsEach;
      const x = lerp(a[0], b[0], t);
      const y = lerp(a[1], b[1], t);
      rays.push(`M${n0(lerp(vx, x, 0.06))} ${n0(lerp(vy, y, 0.06))}L${n0(x)} ${n0(y)}`);
    }
  }
  const walls = rays.join('');
  out.push(L(S(walls, p.alt, Math.max(1, u * 0.5), 0.5), { depth: 0.4, blur: u * 0.6, blend: 'screen' }));
  out.push(L(S(walls, mix(p.alt, '#ffffff', 0.3), Math.max(1, u * 0.14), 0.8), { depth: 0.4 }));
  out.push({ fx: 'tunnel', depth: 0.4, W, H, vx, vy, n: 9, speed: r.r(0.2, 0.42), color: p.a, color2: p.alt, u });
  if (c.figures !== false) {
    const fy = lerp(vy, H, r.r(0.58, 0.74));
    const fh = (fy - vy) * r.r(1.1, 1.45);
    const kind = r.pick(['stand', 'coat', 'cloak']);
    const path = figure(kind, vx, fy, fh, 1);
    out.push(L(P(path, '#010208'), { depth: 0.8 }));
    out.push(L(P(ellP(vx, fy, fh * 0.32, u * 0.8), p.a, 0.9), { depth: 0.8, blur: u * 0.5, blend: 'screen' }));
  }
  out.push({ fx: 'motes', depth: 0.8, pts: scatter(r, c.film ? 24 : 8, W, H), color: p.rim, s: u * 0.45, v: 0, vx: 0, op: 0.7 });
  return out;
}

function auroraRibbon(c, r, base, color, color2, height) {
  const { W, u } = c;
  const nz = noise1(r.i(0, 1e9));
  const off = r.r(0, 50);
  const seg = c.film ? 66 : 44;
  const lowPts = [];
  const hiPts = [];
  let rays = '';
  let fine = '';
  for (let i = 0; i <= seg; i++) {
    const x = (i / seg) * W;
    const y = base + (nz(i * 0.05 + off, 3) - 0.5) * height * 1.5;
    const ht = height * (0.55 + nz(i * 0.13 + off + 9, 2) * 0.85);
    lowPts.push([x, y]);
    if (i % 2 === 0) hiPts.push([x + u * 3, y - ht * 0.8]);
    const seg2 = `M${n0(x + r.r(-4, 4))} ${n0(y)}L${n0(x + r.r(0, 6) + u * 2.5)} ${n0(y - ht * r.r(0.45, 1.1))}`;
    if (r.ok(0.62)) rays += seg2;
    else fine += seg2;
  }
  const top = base - height * 1.5;
  const stops = (a) => [[0, color2, 0], [0.42, color2, 0.5 * a], [0.84, color, a], [1, '#ffffff', a * 0.9]];
  const grad = vg(top, base + height * 0.42, stops(0.85));
  return {
    body: [P(smooth([...lowPts.filter((_, i) => i % 2 === 0), ...hiPts.reverse()], true), vg(top, base + height * 0.42, stops(0.42)))],
    rays: [S(rays, grad, Math.max(1, u * 0.85)), S(fine, grad, Math.max(1, u * 0.3))],
    edge: [S(smooth(lowPts), color, u * 0.7, 0.8)],
  };
}

function aurora(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const out = [];
  const auroraA = mix(p.a, '#ffffff', 0.08);
  const auroraB = p.alt;
  out.push(skyL(c, [[0, '#02030a'], [hz / H * 0.6, p.k], [hz / H, mix(p.d, p.m, 0.6)], [1, p.k]]));
  out.push(L(starsItems(r, W, hz, c.detail * 300, '#ffffff'), { depth: 0.05 }));
  out.push({ fx: 'stars', depth: 0.06, pts: scatter(r, c.film ? 26 : 0, W, hz), color: '#ffffff', s: u * 0.7 });
  const ribbons = [];
  const count = c.detail > 0.8 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const base = hz - H * lerp(0.08, 0.3, i / Math.max(1, count - 1)) + r.r(-1, 1) * u * 3;
    const col = i === 1 ? auroraB : auroraA;
    const col2 = i === 1 ? auroraA : auroraB;
    ribbons.push(auroraRibbon(c, r, base, col, col2, H * r.r(0.22, 0.36)));
  }
  const skyLayers = [];
  ribbons.forEach((rb, i) => {
    const pulse = { type: 'sin', min: 0.55, max: 1, f: r.r(0.18, 0.42), ph: r() * TAU };
    const sway = { a: u * r.r(3, 9), f: r.r(0.07, 0.17), ph: r() * TAU };
    skyLayers.push(L(rb.body, { depth: 0.1 + i * 0.03, blur: u * 2, blend: 'screen', pulse, sway }));
    skyLayers.push(L(rb.rays, { depth: 0.1 + i * 0.03, blur: u * 0.22, blend: 'screen', pulse, sway }));
    skyLayers.push(L(rb.edge, { depth: 0.1 + i * 0.03, blur: u * 0.5, blend: 'screen', pulse, sway }));
  });
  out.push(...skyLayers);

  if (v === 0) {
    const far = ridgePts(W, hz - u, u * 18, r, { fr: 4, ridged: true, step: c.step });
    const farD = poly(closeDown(far, hz + 1));
    const mCol = mix(p.d, p.m, 0.28);
    out.push(L(P(rectP(-20, hz, W + 40, H), vg(hz, H, [[0, mix(p.d, p.m, 0.55)], [1, p.k]])), { depth: 0.2 }));
    skyLayers.forEach((l) => out.push({ ...l, flipY: hz, op: (l.op === undefined ? 1 : l.op) * 0.55 }));
    out.push(L(P(farD, p.ink), { depth: 0.2, flipY: hz, op: 0.7 }));
    out.push(L(P(farD, vg(hz - u * 22, hz, [[0, mCol], [1, p.ink]])), { depth: 0.2 }));
    const strk = [];
    for (let i = 0; i < 7; i++) strk.push(P(ellP(W * r.r(0.08, 0.92), lerp(hz + u, H, r()), W * r.r(0.08, 0.3), u * r.r(0.12, 0.42)), '#ffffff', r.r(0.06, 0.2)));
    out.push(L(strk, { depth: 0.3, blur: u * 0.2, drift: u * 0.25 }));
    if (c.figures !== false) {
      const bx = clamp(c.fx + W * r.r(-0.14, 0.14), W * 0.12, W * 0.88);
      const by = hz + (H - hz) * r.r(0.55, 0.72);
      const fh = u * r.r(10, 18);
      out.push(L(P(figure(r.pick(['coat', 'cloak', 'stand']), bx, by, fh, 1), p.ink), { depth: 0.8 }));
      out.push(L(P(figure('coat', bx, by, fh, 1), auroraA, 0.3), { depth: 0.8, flipY: by + 1, blur: u * 0.3 }));
    }
  } else {
    const far = ridgePts(W, hz, u * 22, r, { fr: 3.5, ridged: true, step: c.step });
    out.push(L(P(poly(closeDown(far, H)), vg(hz - u * 22, hz + u * 16, [[0, mix(mix(p.d, p.m, 0.4), auroraA, 0.14)], [1, p.d]])), { depth: 0.2 }));
    out.push(fogBand(c, r, hz + u * 8, auroraA, 0.2, 4));
    const snow = ridgePts(W, hz + H * 0.17, u * 8, r, { fr: 2.3, oct: 3, step: c.step * 1.5 });
    const snowCol = mix(p.d, auroraA, 0.2);
    out.push(L(P(poly(closeDown(snow, H)), vg(hz + H * 0.08, H, [[0, snowCol], [0.5, mix(p.d, p.k, 0.3)], [1, p.ink]])), { depth: 0.6 }));
    if (v === 1) {
      const cx0 = clamp(c.fx + W * r.r(-0.1, 0.1), W * 0.1, W * 0.9);
      const cy0 = ridgeY(snow, cx0) + u;
      const cs = u * r.r(0.9, 1.5);
      const cabin = `M${n1(cx0 - 7 * cs)} ${n1(cy0)}V${n1(cy0 - 5 * cs)}L${n1(cx0)} ${n1(cy0 - 10.5 * cs)}L${n1(cx0 + 7 * cs)} ${n1(cy0 - 5 * cs)}V${n1(cy0)}Z`;
      const win = rectP(cx0 - cs * 1.6, cy0 - cs * 3.8, cs * 3.2, cs * 2.4);
      out.push(L(P(ellP(cx0, cy0 - cs * 2.8, cs * 18), p.a, 0.34), { depth: 0.6, blur: u * 2.6, blend: 'screen' }));
      out.push(L([P(cabin, p.ink), P(win, mix(p.rim, '#ffd28a', 0.65))], { depth: 0.6 }));
      out.push(L(P(ellP(cx0, cy0 + cs * 4, cs * 12, cs * 2.4), mix(p.rim, '#ffd28a', 0.6), 0.32), { depth: 0.62, blur: u * 0.8, blend: 'screen' }));
    }
    const fg = [];
    const fgBase = H * 0.97;
    let d = '';
    let x = -u * 6;
    while (x < W + u * 6) {
      if (Math.abs(x - c.fx) > W * 0.2) d += pine(r, x, fgBase, u * r.r(20, 42), 6);
      x += u * r.r(8, 18);
    }
    fg.push(P(d, p.ink), P(rectP(-20, fgBase - 2, W + 40, H), p.ink));
    out.push(L(fg, { depth: 1.05 }));
    if (v === 2 && c.figures !== false) {
      const fh = u * r.r(12, 18);
      const fx0 = c.fx + W * r.r(-0.07, 0.07);
      out.push(L(P(figure(r.pick(['coat', 'cloak', 'stand']), fx0, ridgeY(snow, fx0) + 2, fh, 1), p.ink), { depth: 0.6 }));
    }
  }
  out.push({ fx: 'snow', depth: 1, pts: scatter(r, c.film ? 42 : 18, W, H), color: '#ffffff', s: u * 0.22, v: u * 0.9, vx: u * 0.5, op: 0.35 });
  return out;
}

function boltPaths(r, x0, y0, x1, y1, wild, depth = 0) {
  const pts = [[x0, y0]];
  const seg = 12;
  for (let i = 1; i < seg; i++) {
    const t = i / seg;
    pts.push([lerp(x0, x1, t) + r.r(-1, 1) * wild, lerp(y0, y1, t) + r.r(-0.3, 0.3) * wild]);
  }
  pts.push([x1, y1]);
  let d = poly(pts, false);
  if (depth < 2) {
    const br = r.i(1, 2);
    for (let i = 0; i < br; i++) {
      const k = r.i(2, seg - 3);
      const p0 = pts[k];
      const len = (y1 - y0) * r.r(0.2, 0.45);
      d += boltPaths(r, p0[0], p0[1], p0[0] + r.r(-1, 1) * len * 0.8, p0[1] + len, wild * 0.5, depth + 1);
    }
  }
  return d;
}

function storm(c) {
  const { W, H, r, p, hz, u } = c;
  const v = c.variant % 3;
  const out = [];
  const lit = mix(p.m, p.rim, 0.42);
  const dark = mix(p.d, p.k, 0.55);
  const horizonLight = v === 2 ? mix(p.a, p.rim, 0.25) : mix(p.m, p.a, 0.6);
  out.push(skyL(c, [[0, p.k], [hz / H * 0.56, dark], [hz / H * 0.9, p.m], [hz / H, horizonLight], [1, p.k]]));
  out.push(glowL(c.fx, hz, W * 0.58, p.a, 0.55, { depth: 0.05 }));

  // Layered cloud decks seen from below: billowed lower edges, periodic in W so drift wraps cleanly.
  const rows = [
    { y: hz * 0.74, ht: H * 0.13, d: 0.08, blur: u * 0.7, glow: 0.72, k: [3, 7, 13] },
    { y: hz * 0.5, ht: H * 0.16, d: 0.14, blur: u * 0.5, glow: 0.42, k: [2, 5, 11] },
    { y: hz * 0.26, ht: H * 0.18, d: 0.22, blur: u * 0.35, glow: 0.2, k: [2, 4, 9] },
  ];
  rows.forEach((row) => {
    const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    const pts = [];
    const seg = c.detail > 0.8 ? 64 : 48;
    for (let i = -1; i <= seg + 1; i++) {
      const q = i / seg;
      const low = Math.sin(TAU * row.k[0] * q + ph[0]) * 0.22;
      const mid = Math.abs(Math.sin(Math.PI * row.k[1] * q + ph[1])) * 0.3;
      const fine = Math.abs(Math.sin(Math.PI * row.k[2] * q + ph[2])) * 0.14;
      pts.push([q * W, row.y + row.ht * (low + mid + fine)]);
    }
    const edge = mix(mix(dark, p.m, 0.55), lit, row.glow);
    const body = vg(row.y - row.ht * 1.3, row.y + row.ht, [[0, mix(p.k, dark, 0.5)], [0.7, mix(dark, edge, 0.4)], [1, edge]]);
    const puffs = [];
    for (let i = 0; i < 9; i++) {
      const q = (i + r()) / 9;
      const px = q * W;
      const py = ridgeY(pts, px) - row.ht * r.r(0.25, 0.8);
      const pr = row.ht * r.r(0.25, 0.6);
      puffs.push(ellP(px, py, pr * 1.5, pr));
    }
    const items = [
      P(smooth([[-W * 0.02, -20], ...pts, [W * 1.02, -20]], true), body),
      P(puffs.join(''), p.k, 0.34),
    ];
    const drift = (u * 0.6 + r() * u * 0.7) * (r.ok(0.8) ? 1 : -1);
    out.push(L(items, { depth: row.d, blur: row.blur * 1.5, drift }));
    out.push(L(S(smooth(pts), lit, u * 2.6, 0.2 + row.glow * 0.4), { depth: row.d, blur: u * 1.5, blend: 'screen', drift }));
  });
  const uplight = [];
  for (let i = 0; i < 6; i++) uplight.push(P(ellP(W * r.r(0.1, 0.9), hz * r.r(0.45, 0.82), W * r.r(0.08, 0.2), H * r.r(0.03, 0.08)), p.a, r.r(0.14, 0.3)));
  out.push(L(uplight, { depth: 0.2, blur: u * 3.4, blend: 'screen', pulse: { type: 'bolt', seed: c.boltSeed || 1, floor: 0.1, gain: 1.4 } }));

  const boltX = c.fx + W * r.r(-0.2, 0.2);
  const groundY = hz + H * 0.03;
  const bolt = boltPaths(r, boltX + r.r(-0.06, 0.06) * W, hz * r.r(0.32, 0.5), boltX, groundY, u * 2.4);
  const seed = r() * 1000;
  const flash = { type: 'bolt', seed };
  out.push(L(S(bolt, p.alt, u * 1.7, 0.9), { depth: 0.3, blur: u * 1.7, blend: 'screen', pulse: flash }));
  out.push(L(S(bolt, '#ffffff', Math.max(1.2, u * 0.32), 1), { depth: 0.3, pulse: flash }));
  out.push(L(P(ellP(boltX, hz * 0.45, W * 0.36, H * 0.2), p.rim, 0.45), { depth: 0.25, blur: u * 5, blend: 'screen', pulse: flash, filmOnly: true }));

  if (v === 1) {
    out.push(L(P(rectP(-20, hz, W + 40, H), vg(hz, H, [[0, mix(p.m, p.hz, 0.4)], [0.25, p.d], [1, p.k]])), { depth: 0.3 }));
    const bands = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const y = lerp(hz + (H - hz) * 0.12, H * 0.96, t);
      const col = mix(mix(p.d, p.m, 0.3), p.ink, 0.25 + t * 0.75);
      bands.push({
        y, amp: u * lerp(0.9, 6, t), wl: u * lerp(5, 19, t), sp: lerp(0.8, 1.35, t), ph: r() * TAU,
        fill: vg(y - u * 5, y + (H - y) * 0.7, [[0, mix(col, p.hz, 0.3)], [0.2, col], [1, p.ink]]),
        crest: mix(p.rim, col, 0.35), crestOp: lerp(0.14, 0.34, t), crestW: Math.max(1, u * lerp(0.2, 0.7, t)), depth: lerp(0.4, 1.15, t),
      });
    }
    const s = u * r.r(0.8, 1.35);
    const shipX = clamp(c.fx + W * r.r(-0.2, 0.2), W * 0.12, W * 0.88);
    const ship = (x, y) => `M${n1(x - 13 * s)} ${n1(y - 3 * s)}L${n1(x + 16 * s)} ${n1(y - 6 * s)}L${n1(x + 11 * s)} ${n1(y + 3 * s)}L${n1(x - 11 * s)} ${n1(y + 3 * s)}ZM${n1(x - 4 * s)} ${n1(y - 4 * s)}V${n1(y - 10 * s)}H${n1(x + 3 * s)}V${n1(y - 4 * s)}ZM${n1(x - 0.5 * s)} ${n1(y - 10 * s)}V${n1(y - 17 * s)}H${n1(x + 0.5 * s)}V${n1(y - 10 * s)}Z`;
    out.push({ fx: 'boat', depth: 0.65, path: ship, band: bands[2], x: shipX, color: p.ink, W });
    out.push({ fx: 'waves', depth: 0.75, bands, W });
  } else {
    const far = ridgePts(W, hz + u, u * 6, r, { fr: 4, oct: 3, step: c.step * 1.5 });
    out.push(L(P(poly(closeDown(far, H)), mix(p.d, p.m, 0.28)), { depth: 0.36 }));
    const near = ridgePts(W, hz + H * 0.16, u * 8, r, { fr: 2, oct: 3, step: c.step * 1.5 });
    const furrows = [];
    for (let i = -11; i <= 11; i++) {
      furrows.push(`M${n0(c.fx + i * W * 0.012)} ${n0(hz + H * 0.16)}L${n0(c.fx + i * W * 0.14)} ${H + 5}`);
    }
    const grounds = [
      P(poly(closeDown(near, H)), vg(hz + H * 0.1, H, [[0, mix(p.d, p.hz, 0.22)], [1, p.ink]])),
      S(furrows.join(''), p.ink, Math.max(1, u * 0.4), 0.45),
    ];
    const ax = clamp(c.fx + W * r.r(-0.25, 0.25), W * 0.12, W * 0.88);
    const ay = ridgeY(near, ax) + 2;
    if (v === 0) {
      const treeH = u * r.r(15, 26);
      let d = poly([[ax - treeH * 0.04, ay], [ax - treeH * 0.02, ay - treeH * 0.5], [ax + treeH * 0.02, ay - treeH * 0.5], [ax + treeH * 0.05, ay]]);
      const br = (x, y, a, len, dep) => {
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len;
        d += poly([[x - len * 0.05, y], [ex, ey], [x + len * 0.05, y]]);
        if (dep > 0) {
          br(ex, ey, a - r.r(0.25, 0.65), len * r.r(0.55, 0.8), dep - 1);
          br(ex, ey, a + r.r(0.25, 0.65), len * r.r(0.55, 0.8), dep - 1);
        }
      };
      br(ax, ay - treeH * 0.48, -Math.PI / 2, treeH * 0.3, 4);
      grounds.push(P(d, p.ink));
      if (c.figures !== false) grounds.push(P(figure(r.pick(['coat', 'cloak']), ax + treeH * 0.55, ridgeY(near, ax + treeH * 0.55) + 2, u * 7, 1), p.ink));
    } else {
      const s = u * r.r(0.8, 1.4);
      const house = `M${n1(ax - 12 * s)} ${n1(ay)}V${n1(ay - 8 * s)}L${n1(ax - 4 * s)} ${n1(ay - 15 * s)}L${n1(ax + 4 * s)} ${n1(ay - 8 * s)}H${n1(ax + 12 * s)}V${n1(ay)}Z`;
      const silo = `M${n1(ax + 14 * s)} ${n1(ay)}V${n1(ay - 19 * s)}Q${n1(ax + 18 * s)} ${n1(ay - 24 * s)} ${n1(ax + 22 * s)} ${n1(ay - 19 * s)}V${n1(ay)}Z`;
      grounds.push(P(house + silo, p.ink), P(rectP(ax - 8 * s, ay - 5 * s, 2.6 * s, 2.6 * s), mix(p.rim, '#ffc06a', 0.7)));
    }
    out.push(L(grounds, { depth: 0.75 }));
  }
  out.push({ fx: 'flash', depth: 0, seed, color: p.rim, W, H });
  out.push({ fx: 'rain', depth: 1.15, pts: scatter(r, c.film ? 150 : 62, W, H), color: mix(p.rim, '#ffffff', 0.35), w: Math.max(1, u * 0.11), dx: -u * 1.1, dy: u * 3.6, v: u * 105, vx: -u * 28, op: 0.32 });
  return out;
}

const MOTIFS = { mountains, city, orbit, waves, forest, neon, desert, grid, aurora, storm };
const MOTIF_KEYS = Object.keys(MOTIFS);

function compose(title, W, H, opts) {
  const id = String(title && title.id != null ? title.id : title && title.name ? title.name : 'lumora');
  const seed = hash(id);
  const name = title && MOTIFS[title.motif] ? title.motif : MOTIF_KEYS[seed % MOTIF_KEYS.length];
  const shotSeed = opts.seed === undefined ? seed : hash(`${id}#${opts.seed}`);
  const r = R(shotSeed ^ 0x9e3779b9);
  const c = {
    W, H, r,
    p: derive(title && title.palette, seed),
    u: Math.min(W, H) / 100,
    hz: H * opts.hz,
    fx: W * opts.fx,
    variant: opts.variant,
    film: !!opts.film,
    detail: opts.detail === undefined ? 1 : opts.detail,
    step: Math.max(8, W / (opts.pts || 70)),
    figures: opts.figures,
    discK: opts.discK,
    lightDir: r.ok(0.5) ? 1 : -1,
  };
  return { c, layers: MOTIFS[name](c).filter(Boolean), name };
}

/* ------------------------------------------------------------------ fx (animated; pure functions of t) */

const sprites = new Map();
function sprite(color) {
  let s = sprites.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 32;
  const g = s.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  const [a, b, d] = rgb(color);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, `rgba(${a},${b},${d},.85)`);
  grad.addColorStop(0.5, `rgba(${a},${b},${d},.18)`);
  grad.addColorStop(1, `rgba(${a},${b},${d},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  sprites.set(color, s);
  return s;
}

function boltLevel(t, seed) {
  const period = 4.7;
  const k = Math.floor(t / period);
  let best = 0;
  for (let j = k - 1; j <= k; j++) {
    if (rnd2(j, seed) < 0.3) continue;
    const at = j * period + rnd2(j, seed + 1) * (period - 1);
    const dt = t - at;
    if (dt < 0 || dt > 1.1) continue;
    const a = Math.exp(-dt * 9);
    const again = dt > 0.16 ? Math.exp(-(dt - 0.16) * 11) * 0.8 : 0;
    best = Math.max(best, a, again);
  }
  return best;
}

function pulseAlpha(pu, t) {
  if (!pu) return 1;
  if (pu.type === 'sin') return lerp(pu.min, pu.max, 0.5 + 0.5 * Math.sin(t * pu.f * TAU + pu.ph));
  if (pu.type === 'flicker') {
    const k = Math.floor(t * 11);
    const q = rnd2(k, pu.seed);
    const base = 0.88 + 0.12 * Math.sin(t * 7 + pu.seed);
    return q < 0.045 ? 0.22 : q < 0.09 ? 0.6 : base;
  }
  if (pu.type === 'bolt') return Math.min(1, (pu.floor || 0) + boltLevel(t, pu.seed) * (pu.gain || 1));
  return 1;
}

function paint(g, spec) {
  if (typeof spec === 'string') return spec;
  let gr;
  if (spec.k === 'l') gr = g.createLinearGradient(spec.x1, spec.y1, spec.x2, spec.y2);
  else gr = g.createRadialGradient(spec.cx, spec.cy, 0, spec.cx, spec.cy, spec.r);
  for (const [off, col, a = 1] of spec.stops) {
    const [x, y, z] = rgb(col);
    gr.addColorStop(clamp(off), `rgba(${x},${y},${z},${a})`);
  }
  return gr;
}

const FX = {
  rain(g, f, t, W, H) {
    g.strokeStyle = f.color;
    g.lineWidth = f.w;
    g.globalAlpha = f.op;
    g.beginPath();
    for (const q of f.pts) {
      const y = mod(q.y + f.v * q.z * t, H + 40) - 20;
      const x = mod(q.x + f.vx * q.z * t, W);
      g.moveTo(x, y);
      g.lineTo(x + f.dx * q.z, y + f.dy * q.z);
    }
    g.stroke();
  },
  snow(g, f, t, W, H) {
    g.fillStyle = f.color;
    g.globalAlpha = f.op;
    for (const q of f.pts) {
      const y = mod(q.y + f.v * q.z * t, H);
      const x = mod(q.x + f.vx * q.z * t + Math.sin(t * 0.7 + q.ph) * f.s * 8, W);
      const s = f.s * q.z * 2;
      g.fillRect(x, y, s, s);
    }
  },
  motes(g, f, t, W, H) {
    g.globalCompositeOperation = 'lighter';
    const spr = sprite(f.color);
    for (const q of f.pts) {
      const y = mod(q.y + f.v * q.z * t + Math.sin(t * 0.5 + q.ph) * f.s * 6, H);
      const x = mod(q.x + f.vx * q.z * t + Math.cos(t * 0.37 + q.ph) * f.s * 8, W);
      g.globalAlpha = f.op * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9 + q.ph * 3), 2));
      const s = f.s * 4 * q.z;
      g.drawImage(spr, x - s, y - s, s * 2, s * 2);
    }
  },
  stars(g, f, t) {
    g.globalCompositeOperation = 'lighter';
    const spr = sprite(f.color);
    for (const q of f.pts) {
      g.globalAlpha = 0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.sin(t * (0.6 + q.z * 1.6) + q.ph), 3);
      const s = f.s * 2.4 * q.z;
      g.drawImage(spr, q.x - s, q.y - s, s * 2, s * 2);
    }
  },
  twinkle(g, f, t) {
    g.fillStyle = f.color;
    for (const q of f.pts) {
      const on = rnd2(Math.floor(t / 1.8 + q.ph), q.ph);
      g.globalAlpha = on < 0.45 ? 0 : 0.9;
      if (on >= 0.45) g.fillRect(q.x, q.y - f.h / 2, q.w, f.h);
    }
  },
  glitter(g, f, t) {
    g.fillStyle = f.color;
    for (const q of f.pts) {
      const a = Math.sin(t * 2.6 + q.ph * 5);
      if (a < 0.1) continue;
      g.globalAlpha = a;
      g.fillRect(q.x + Math.sin(t + q.ph) * q.w, q.y, q.w, Math.max(1, q.w * 0.14));
    }
  },
  bubbles(g, f, t, W, H) {
    g.strokeStyle = f.color;
    g.lineWidth = Math.max(0.7, f.s * 0.2);
    g.globalAlpha = 0.5;
    g.beginPath();
    for (const q of f.pts) {
      const y = mod(q.y - f.v * q.z * t, H);
      const x = q.x + Math.sin(t * 1.1 + q.ph) * f.s * 2;
      const s = f.s * q.z;
      g.moveTo(x + s, y);
      g.arc(x, y, s, 0, TAU);
    }
    g.stroke();
  },
  sand(g, f, t, W) {
    g.strokeStyle = f.color;
    g.lineWidth = Math.max(0.8, f.u * 0.1);
    g.globalAlpha = 0.34;
    g.beginPath();
    for (const q of f.pts) {
      const x = mod(q.x + f.v * q.z * t, W + 200) - 100;
      const y = q.y + Math.sin(t * 2 + q.ph) * f.u * 0.5;
      const ln = f.u * 5 * q.z;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + ln / 2, y - f.u * 0.3, x + ln, y);
    }
    g.stroke();
  },
  birds(g, f, t, W) {
    g.strokeStyle = f.color;
    g.lineWidth = Math.max(0.9, f.s * 0.2);
    g.globalAlpha = 0.9;
    g.beginPath();
    for (let i = 0; i < f.n; i++) {
      const x = mod(f.x + f.v * t + (i % 2 ? i * f.s * 3.4 : -i * f.s * 2.2), W + 200) - 100;
      const y = f.y + (i % 3) * f.s * 2.6 + Math.sin(t * 0.8 + i) * f.s;
      const wing = Math.sin(t * 5 + i * 2) * f.s * 0.7;
      g.moveTo(x - f.s * 1.6, y - wing);
      g.quadraticCurveTo(x - f.s * 0.5, y - wing * 0.4, x, y);
      g.quadraticCurveTo(x + f.s * 0.5, y - wing * 0.4, x + f.s * 1.6, y - wing);
    }
    g.stroke();
  },
  beam(g, f, t) {
    if (!f.g) {
      f.g = paint(g, lg(0, 0, f.len, 0, [[0, f.color, 0.9], [0.5, f.color, 0.24], [1, f.color, 0]]));
    }
    g.globalCompositeOperation = 'lighter';
    g.translate(f.x, f.y);
    g.rotate(f.a0 + Math.sin(t * f.f * TAU + f.ph) * f.amp);
    g.fillStyle = f.g;
    for (let i = 3; i > 0; i--) {
      g.globalAlpha = f.op * 0.45;
      const s = f.spread * (i / 3) * f.len;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(f.len, -s);
      g.lineTo(f.len, s);
      g.fill();
    }
  },
  waves(g, f, t) {
    for (const b of f.bands) {
      if (!b.gr) b.gr = paint(g, b.fill);
      const step = Math.max(14, f.W / 54);
      const pts = waveBand(b, f.W, t, step);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.save();
      g.globalAlpha = b.crestOp;
      g.strokeStyle = b.crest;
      g.lineWidth = b.crestW;
      g.stroke();
      g.restore();
      g.lineTo(f.W + step, b.y + 2000);
      g.lineTo(-step, b.y + 2000);
      g.closePath();
      g.fillStyle = b.gr;
      g.fill();
    }
  },
  boat(g, f, t) {
    const b = f.band;
    const pts = waveBand(b, f.W, t, f.W / 60);
    const i = clamp(Math.round((f.x / f.W) * 60) + 1, 1, pts.length - 2);
    const tilt = Math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0]);
    const y = pts[i][1];
    g.translate(f.x, y);
    g.rotate(tilt * 0.8);
    g.translate(-f.x, -y);
    g.fillStyle = f.color;
    if (!f.cache) f.cache = new Path2D(f.path(f.x, b.y));
    g.translate(0, y - b.y);
    g.fill(f.cache);
  },
  gridfloor(g, f, t) {
    const d = new Path2D(gridHoriz(f, t));
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = f.color;
    g.globalAlpha = 0.3;
    g.lineWidth = f.lw * 3;
    g.stroke(d);
    g.globalAlpha = 0.95;
    g.lineWidth = f.lw;
    g.stroke(d);
  },
  tunnel(g, f, t) {
    const frac = mod(t * f.speed, 1);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < f.n; i++) {
      const q = Math.pow((i + frac) / f.n, 2.8);
      const x0 = lerp(f.vx, -20, q);
      const x1 = lerp(f.vx, f.W + 20, q);
      const y0 = lerp(f.vy, -20, q);
      const y1 = lerp(f.vy, f.H + 20, q);
      g.strokeStyle = i % 3 === 0 ? f.color : f.color2;
      g.globalAlpha = clamp(q * 2) * 0.32;
      g.lineWidth = f.u * 1.1 * q + 0.8;
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.globalAlpha = clamp(q * 3) * 0.95;
      g.lineWidth = f.u * 0.3 * q + 0.5;
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
  },
  traffic(g, f, t) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < f.n; i++) {
      const seedI = i * 7.13 + f.seed;
      const q = Math.pow(mod(t * (0.1 + rnd2(i, 3) * 0.1) + rnd2(i, f.seed), 1), 2.5);
      const lane = (i % 2 ? 1 : -1) * (0.12 + rnd2(i, 9) * 0.25);
      const x = f.vx + lane * f.W * q;
      const y = lerp(f.vy, f.H, q);
      const s = 3 + 44 * q;
      g.globalAlpha = clamp(q * 6) * 0.9;
      g.drawImage(sprite(rnd2(seedI, 1) > 0.5 ? f.color : f.color2), x - s, y - s, s * 2, s * 2);
    }
  },
  comet(g, f, t) {
    const period = 9;
    const k = Math.floor(t / period);
    if (rnd2(k, f.seed) < 0.35) return;
    const q = (t - k * period - 1) / 1.6;
    if (q < 0 || q > 1) return;
    const x = lerp(rnd2(k, 3) * f.W, rnd2(k, 4) * f.W, q);
    const y = lerp(rnd2(k, 5) * f.H * 0.4, rnd2(k, 6) * f.H * 0.7, q);
    const x2 = lerp(rnd2(k, 3) * f.W, rnd2(k, 4) * f.W, q - 0.12);
    const y2 = lerp(rnd2(k, 5) * f.H * 0.4, rnd2(k, 6) * f.H * 0.7, q - 0.12);
    g.strokeStyle = f.color;
    g.lineWidth = f.u * 0.22;
    g.globalAlpha = Math.sin(q * Math.PI) * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
  },
  flash(g, f, t) {
    const a = boltLevel(t, f.seed);
    if (a < 0.01) return;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a * 0.5;
    g.fillStyle = f.color;
    g.fillRect(-20, -20, f.W + 40, f.H + 40);
  },
};

// Static renditions of fx used for still art.
const FX_STILL = {
  rain(f, c) {
    let d = '';
    const list = f.pts;
    for (const q of list) d += `M${n0(q.x)} ${n0(q.y)}l${n1(f.dx * q.z)} ${n1(f.dy * q.z)}`;
    return L(S(d, f.color, f.w, f.op), { depth: f.depth });
  },
  snow(f) {
    let d = '';
    for (const q of f.pts) d += `M${n0(q.x)} ${n0(q.y)}h.1`;
    return L(S(d, f.color, f.s * 1.8, f.op, 'round'), { depth: f.depth });
  },
  motes(f) {
    let d = '';
    for (const q of f.pts) d += `M${n0(q.x)} ${n0(q.y)}h.1`;
    return L([S(d, f.color, f.s * 3, f.op * 0.3, 'round'), S(d, f.color, f.s, f.op, 'round')], { depth: f.depth, blend: 'screen' });
  },
  glitter(f) {
    let d = '';
    for (const q of f.pts) d += `M${n0(q.x)} ${n0(q.y)}h${n1(q.w)}`;
    return L(S(d, f.color, 1.2, 0.85), { depth: f.depth });
  },
  bubbles(f) {
    let d = '';
    for (const q of f.pts) d += ellP(q.x, q.y, f.s * q.z);
    return L(S(d, f.color, Math.max(0.7, f.s * 0.2), 0.5), { depth: f.depth });
  },
  birds(f) {
    let d = '';
    for (let i = 0; i < f.n; i++) {
      const x = f.x + (i % 2 ? i * f.s * 3.4 : -i * f.s * 2.2);
      const y = f.y + (i % 3) * f.s * 2.6;
      d += `M${n1(x - f.s * 1.6)} ${n1(y - f.s * 0.5)}Q${n1(x - f.s * 0.5)} ${n1(y - f.s * 0.2)} ${n1(x)} ${n1(y)}Q${n1(x + f.s * 0.5)} ${n1(y - f.s * 0.2)} ${n1(x + f.s * 1.6)} ${n1(y - f.s * 0.5)}`;
    }
    return L(S(d, f.color, Math.max(0.9, f.s * 0.2), 0.9, 'round'), { depth: f.depth });
  },
  beam(f) {
    const a = f.a0 + Math.sin(f.ph) * f.amp;
    const s = f.spread * f.len;
    const ex = f.x + Math.cos(a) * f.len;
    const ey = f.y + Math.sin(a) * f.len;
    const nx = -Math.sin(a) * s;
    const ny = Math.cos(a) * s;
    return L(P(poly([[f.x, f.y], [ex + nx, ey + ny], [ex - nx, ey - ny]]), rg(f.x, f.y, f.len, [[0, f.color, f.op * 1.8], [0.6, f.color, f.op * 0.5], [1, f.color, 0]])), { depth: f.depth, blend: 'screen', blur: f.len * 0.006 });
  },
  waves(f) {
    const step = f.W / 34;
    const items = [];
    for (const b of f.bands) {
      const pts = waveBand(b, f.W, 0, step);
      const crest = smooth(pts);
      items.push(P(`${crest}L${n0(f.W + step)} ${n0(b.y + 3000)}L${n0(-step)} ${n0(b.y + 3000)}Z`, b.fill));
      items.push(S(crest, b.crest, b.crestW, b.crestOp));
    }
    return L(items, { depth: f.depth });
  },
  boat(f) {
    return L(P(f.path(f.x, waveBand(f.band, f.W, 0, f.W / 60)[clamp(Math.round((f.x / f.W) * 60) + 1, 1, 60)][1]), f.color), { depth: f.depth });
  },
  gridfloor(f) {
    const d = gridHoriz(f, 0);
    return L([S(d, f.color, f.lw * 3, 0.3), S(d, mix(f.color, '#ffffff', 0.25), f.lw, 0.9)], { depth: f.depth });
  },
  tunnel(f) {
    const items = [];
    for (let i = 0; i < f.n; i++) {
      const q = Math.pow((i + 0.4) / f.n, 2.8);
      const x0 = lerp(f.vx, -20, q);
      const x1 = lerp(f.vx, f.W + 20, q);
      const y0 = lerp(f.vy, -20, q);
      const y1 = lerp(f.vy, f.H + 20, q);
      const d = rectP(x0, y0, x1 - x0, y1 - y0);
      const col = i % 3 === 0 ? f.color : f.color2;
      items.push(S(d, col, f.u * 1.2 * q + 0.8, clamp(q * 2) * 0.32), S(d, mix(col, '#ffffff', 0.25), f.u * 0.3 * q + 0.5, clamp(q * 3) * 0.95));
    }
    return L(items, { depth: f.depth });
  },
};

/* ------------------------------------------------------------------ SVG serialization */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7e]/g, (ch) => `&#${ch.codePointAt(0)};`);

const num = (v) => String(Math.round(v * 100) / 100).replace(/^0\./, '.').replace(/^-0\./, '-.');

function createDefs(prefix = '') {
  const defs = [];
  const grads = new Map();
  const blurs = new Map();
  return {
    grad(spec) {
      if (typeof spec === 'string') return spec;
      const key = JSON.stringify(spec);
      let id = grads.get(key);
      if (!id) {
        id = `${prefix}g${grads.size}`;
        grads.set(key, id);
        const stops = spec.stops
          .map(([o, col, a = 1]) => `<stop offset="${num(clamp(o))}" stop-color="${col}"${a < 1 ? ` stop-opacity="${num(a)}"` : ''}/>`)
          .join('');
        if (spec.k === 'l') {
          defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(spec.x1)}" y1="${num(spec.y1)}" x2="${num(spec.x2)}" y2="${num(spec.y2)}">${stops}</linearGradient>`);
        } else {
          defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(spec.cx)}" cy="${num(spec.cy)}" r="${num(spec.r)}">${stops}</radialGradient>`);
        }
      }
      return `url(#${id})`;
    },
    blur(amount, W, H) {
      const v = Math.max(0.4, Math.round(amount * 2) / 2);
      let id = blurs.get(v);
      if (!id) {
        id = `${prefix}b${blurs.size}`;
        blurs.set(v, id);
        defs.push(`<filter id="${id}" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}"><feGaussianBlur stdDeviation="${v}"/></filter>`);
      }
      return `url(#${id})`;
    },
    add(str) {
      defs.push(str);
    },
    toString() {
      return defs.length ? `<defs>${defs.join('')}</defs>` : '';
    },
  };
}

function layerSvg(layer, defs, W, H) {
  const attrs = [];
  if (layer.blur) attrs.push(`filter="${defs.blur(layer.blur, W, H)}"`);
  if (layer.op !== undefined && layer.op < 1) attrs.push(`opacity="${num(layer.op)}"`);
  if (layer.flipY !== undefined) attrs.push(`transform="matrix(1 0 0 -1 0 ${num(layer.flipY * 2)})"`);
  if (layer.blend) attrs.push(`style="mix-blend-mode:screen"`);
  const inner = layer.items
    .filter((it) => it.d && it.op !== 0)
    .map((it) => {
      const o = it.op !== undefined && it.op < 1 ? ` opacity="${num(it.op)}"` : '';
      if (it.stroke) {
        return `<path d="${it.d}" fill="none" stroke="${defs.grad(it.stroke)}" stroke-width="${num(it.sw)}"${it.cap ? ` stroke-linecap="${it.cap}"` : ''}${o}/>`;
      }
      return `<path d="${it.d}" fill="${defs.grad(it.fill)}"${o}/>`;
    })
    .join('');
  if (!inner) return '';
  return attrs.length ? `<g ${attrs.join(' ')}>${inner}</g>` : inner;
}

function stillLayers(layers, c) {
  const out = [];
  for (const layer of layers) {
    if (layer.fx) {
      const make = FX_STILL[layer.fx];
      if (make) {
        const l = make(layer, c);
        if (l) out.push(l);
      }
    } else if (layer.items && !layer.filmOnly) {
      out.push(layer);
    }
  }
  return out;
}

const grainSvg = (defs, seed, W, H, op) => {
  defs.add(`<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed % 97}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 .9 0 0 0 -.2"/></filter>`);
  return `<rect width="${W}" height="${H}" filter="url(#n)" opacity="${op}" style="mix-blend-mode:overlay"/>`;
};

const vignetteSvg = (defs, W, H, ink, strength) => {
  defs.add(`<radialGradient id="v" cx=".5" cy=".46" r=".72"><stop offset=".52" stop-color="${ink}" stop-opacity="0"/><stop offset="1" stop-color="${ink}" stop-opacity="${strength}"/></radialGradient>`);
  return `<rect width="${W}" height="${H}" fill="url(#v)"/>`;
};

/* ------------------------------------------------------------------ logotypes */

const FONTS = [
  { f: "Didot,'Bodoni MT','Bodoni 72','Playfair Display',Georgia,serif", w: 400, u: 0.76, l: 0.5, tags: 'serif', cases: ['upper', 'title'], tr: [0.02, 0.1, 0.2] },
  { f: "Georgia,'Times New Roman',serif", w: 700, u: 0.74, l: 0.54, tags: 'serif', cases: ['upper', 'title', 'caps'], tr: [0.02, 0.08] },
  { f: "'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", w: 400, u: 0.72, l: 0.5, tags: 'serif', cases: ['upper', 'caps', 'title'], tr: [0.06, 0.18] },
  { f: "'Times New Roman',Times,serif", w: 400, u: 0.7, l: 0.46, italic: 1, tags: 'serif', cases: ['title'], tr: [0, 0.02] },
  { f: "Impact,Haettenschweiler,'Arial Narrow Bold','Franklin Gothic Heavy',sans-serif", w: 400, u: 0.54, l: 0.5, tags: 'heavy', cases: ['upper'], tr: [0, 0.02, 0.05] },
  { f: "'Arial Black','Helvetica Neue',Arial,sans-serif", w: 900, u: 0.8, l: 0.66, tags: 'heavy', cases: ['upper', 'lower', 'title'], tr: [-0.02, 0, 0.02] },
  { f: "'Franklin Gothic Medium','Arial Narrow',Arial,sans-serif", w: 700, u: 0.6, l: 0.5, tags: 'sans', cases: ['upper', 'title'], tr: [0, 0.04, 0.12] },
  { f: "'Century Gothic',Futura,'Avenir Next',Avenir,'Segoe UI',sans-serif", w: 400, u: 0.72, l: 0.56, tags: 'sans', cases: ['upper', 'lower'], tr: [0.16, 0.3, 0.42] },
  { f: "'Century Gothic',Futura,'Avenir Next',Avenir,'Segoe UI',sans-serif", w: 700, u: 0.72, l: 0.58, tags: 'kid sans', cases: ['upper', 'lower', 'title'], tr: [0, 0.05, 0.1] },
  { f: "'Segoe UI',Helvetica,Arial,sans-serif", w: 300, u: 0.64, l: 0.52, tags: 'sans', cases: ['upper', 'lower'], tr: [0.24, 0.4] },
  { f: "'Trebuchet MS','Gill Sans',Verdana,sans-serif", w: 700, u: 0.66, l: 0.54, tags: 'kid sans', cases: ['upper', 'title'], tr: [0, 0.06, 0.14] },
  { f: "'Courier New',Courier,monospace", w: 700, u: 0.6, l: 0.6, tags: 'mono', cases: ['upper', 'lower'], tr: [0, 0.08, 0.2] },
  { f: "Rockwell,'Roboto Slab','Courier New',serif", w: 700, u: 0.72, l: 0.54, tags: 'kid serif', cases: ['upper', 'title'], tr: [0, 0.04, 0.1] },
  { f: "Copperplate,'Copperplate Gothic Bold','Perpetua Titling MT',Georgia,serif", w: 400, u: 0.82, l: 0.72, tags: 'serif', cases: ['upper'], tr: [0.03, 0.1, 0.2] },
  { f: "'Segoe Script','Brush Script MT','Snell Roundhand',cursive", w: 700, u: 0.74, l: 0.58, tags: 'kid script', cases: ['title'], tr: [0] },
];

const SMALL = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'at', 'on', 'to', 'for', 'by', '&']);

const charAdv = (ch, font, upperMode) => {
  if (ch === ' ') return 0.3;
  if (/[iIl1.,:'!|]/.test(ch)) return (upperMode ? font.u : font.l) * 0.58;
  if (/[mwMW]/.test(ch)) return (ch === ch.toUpperCase() ? font.u : font.l) * 1.32;
  if (/[A-Z0-9]/.test(ch)) return font.u;
  return font.l;
};

const lineUnits = (text, font, track, capMode) => {
  let sum = 0;
  const chars = [...text];
  chars.forEach((ch, i) => {
    let a = charAdv(ch, font, text === text.toUpperCase());
    if (capMode && (i === 0 || chars[i - 1] === ' ')) a *= 1.36;
    sum += a;
  });
  return sum + track * Math.max(0, chars.length - 1);
};

function logoStyle(title) {
  const id = String(title.id || title.name || 'lumora');
  const r = R(hash(`${id}:logo`));
  const kid = (title.genres || []).includes('Kids & Family');
  const pool = kid ? FONTS.filter((f) => f.tags.includes('kid')) : FONTS.filter((f) => !f.tags.includes('script'));
  const font = r.pick(pool);
  const kase = r.pick(font.cases);
  const track = r.pick(font.tr);
  const heavy = font.tags.includes('heavy') || font.w >= 700;
  const effects = heavy
    ? ['solid', 'grad', 'grad', 'chrome', 'extrude', 'outline', 'glow', 'shadow']
    : ['solid', 'solid', 'grad', 'glow', 'shadow', 'chrome'];
  return {
    font,
    kase,
    track,
    effect: r.pick(effects),
    lock: r.pick(['just', 'just', 'uniform', 'uniform', 'stair']),
    rule: r.pick(['none', 'none', 'none', 'above', 'below', 'flank']),
    place: r(),
    align: r(),
    r,
  };
}

const applyCase = (text, kase) => {
  if (kase === 'upper' || kase === 'caps') return text.toUpperCase();
  if (kase === 'lower') return text.toLowerCase();
  return text;
};

function breakLines(words, maxLines) {
  const n = words.length;
  if (n <= 1 || maxLines <= 1) return [words.join(' ')];
  let best = null;
  const rec = (start, left, cur) => {
    if (left === 1) {
      const next = [...cur, words.slice(start).join(' ')];
      let score = Math.max(...next.map((l) => l.length)) + next.length * 1.4;
      next.slice(0, -1).forEach((l) => {
        if (SMALL.has(l.split(' ').pop().toLowerCase())) score += 1.5;
      });
      if (!best || score < best.score) best = { score, next };
      return;
    }
    for (let e = start + 1; e <= n - left + 1; e++) rec(e, left - 1, [...cur, words.slice(start, e).join(' ')]);
  };
  rec(0, Math.min(maxLines, n), []);
  return best.next;
}

function layoutLogo(title, style, { maxW, maxH, maxLines, sizeCap }) {
  const raw = String(title.name || '').trim() || 'Untitled';
  const { font, kase, track, lock } = style;
  const capMode = kase === 'caps';
  const display = applyCase(raw, kase);
  const dwords = display.split(/\s+/);
  const total = raw.length;
  const lim = Math.min(maxLines, dwords.length);
  const count = total <= (maxW / sizeCap > 5 ? 16 : 10) ? 1 : total <= 26 ? Math.min(2, lim) : Math.min(3, lim);
  const lines = breakLines(dwords, count);
  const lineTr = track;
  const unitW = lines.map((l) => lineUnits(l, font, lineTr, capMode));
  let sizes;
  if (lock === 'just' && lines.length > 1) {
    sizes = unitW.map((u) => Math.min(maxW / u, sizeCap * 1.2));
    const isSmall = lines.map((l) => SMALL.has(l.toLowerCase()));
    sizes = sizes.map((s, i) => (isSmall[i] ? Math.min(s, sizeCap * 0.42) : s));
  } else if (lock === 'stair' && lines.length > 1) {
    const big = Math.min(maxW / Math.max(...unitW), sizeCap);
    sizes = lines.map((_, i) => big * (i === 0 ? 1 : 1));
  } else {
    const s = Math.min(maxW / Math.max(...unitW), sizeCap);
    sizes = lines.map(() => s);
  }
  const lineH = (s) => s * (kase === 'upper' || kase === 'caps' ? 0.96 : 1.1);
  let height = sizes.reduce((a, s) => a + lineH(s), 0);
  if (height > maxH) {
    const q = maxH / height;
    sizes = sizes.map((s) => s * q);
    height = maxH;
  }
  return {
    lines: lines.map((text, i) => ({ text, size: sizes[i], width: unitW[i] * sizes[i] })),
    lineH,
    height,
    width: Math.max(...lines.map((_, i) => unitW[i] * sizes[i])),
    capMode,
  };
}

function logoMarkup(title, style, layout, x, topY, anchor, defs, colors) {
  const { font, track, effect } = style;
  const { lines, capMode } = layout;
  const fam = `font-family="${font.f}" font-weight="${font.w}"${font.italic ? ' font-style="italic"' : ''}`;
  const base = [];
  let y = topY;
  const stepX = (i) => (style.lock === 'stair' && lines.length > 1 ? i * lines[0].size * 0.42 * (anchor === 'end' ? -1 : 1) : 0);
  const rows = lines.map((line, i) => {
    const lh = layout.lineH(line.size);
    const baseline = y + lh * 0.82;
    y += lh;
    return { ...line, baseline, x: x + (anchor === 'middle' ? 0 : stepX(i)) };
  });
  const top = topY;
  const bot = y;
  const textTag = (row, extra) => {
    const chars = [...row.text];
    let inner;
    if (capMode) {
      inner = '';
      chars.forEach((ch, k) => {
        const big = k === 0 || chars[k - 1] === ' ';
        inner += big ? `<tspan font-size="${num(row.size * 1.36)}">${esc(ch)}</tspan>` : esc(ch);
      });
    } else {
      inner = esc(row.text);
    }
    const sp = track ? ` letter-spacing="${num(track * row.size)}"` : '';
    return `<text ${fam} x="${num(row.x)}" y="${num(row.baseline)}" font-size="${num(row.size)}" text-anchor="${anchor}" textLength="${num(row.width)}" lengthAdjust="spacingAndGlyphs"${sp} ${extra}>${inner}</text>`;
  };
  const all = (extra) => rows.map((row) => textTag(row, extra)).join('');
  const pre = defs.prefix || '';
  let fill = colors.text;
  if (effect === 'grad') {
    fill = defs.grad(vg(top, bot, [[0, '#ffffff'], [1, colors.accent]]));
  } else if (effect === 'chrome') {
    fill = defs.grad(vg(top, bot, [[0, '#ffffff'], [0.46, mix(colors.accent, '#ffffff', 0.55)], [0.5, mix(colors.accent, '#000000', 0.25)], [0.62, colors.accent], [1, '#ffffff']]));
  }
  const size0 = lines[0].size;
  if (effect === 'glow') {
    defs.add(`<filter id="${pre}lg" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${num(Math.max(2, size0 * 0.08))}"/></filter>`);
    base.push(`<g filter="url(#${pre}lg)">${all(`fill="${colors.accent}"`)}</g>`);
    base.push(`<g filter="url(#${pre}lg)" opacity=".6">${all(`fill="${colors.accent}"`)}</g>`);
  } else if (effect === 'shadow') {
    defs.add(`<filter id="${pre}ls" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${num(Math.max(1.5, size0 * 0.05))}"/></filter>`);
    base.push(`<g filter="url(#${pre}ls)" opacity=".85" transform="translate(0 ${num(size0 * 0.04)})">${all(`fill="#000"`)}</g>`);
  } else if (effect === 'extrude') {
    const d = Math.max(1.2, size0 * 0.022);
    for (let i = 5; i > 0; i--) {
      base.push(`<g transform="translate(${num(d * i)} ${num(d * i)})">${all(`fill="${mix(colors.accent, '#000000', (i / 5) * 0.45)}"`)}</g>`);
    }
  }
  if (effect === 'outline') {
    base.push(all(`fill="${colors.text}" fill-opacity=".12" stroke="${colors.text}" stroke-width="${num(Math.max(1, size0 * 0.022))}" paint-order="stroke"`));
  } else {
    base.push(all(`fill="${fill}"`));
  }

  const w = layout.width;
  const leftX = anchor === 'middle' ? x - w / 2 : x;
  const rule = style.rule;
  const ruleW = Math.max(1, size0 * 0.024);
  if (rule === 'above') {
    base.unshift(`<path d="M${num(leftX)} ${num(top - size0 * 0.2)}h${num(w)}" stroke="${colors.accent}" stroke-width="${num(ruleW)}"/>`);
  } else if (rule === 'below') {
    base.push(`<path d="M${num(leftX)} ${num(bot + size0 * 0.12)}h${num(w)}" stroke="${colors.accent}" stroke-width="${num(ruleW)}"/>`);
  } else if (rule === 'flank' && anchor === 'middle') {
    const gx = w * 0.08;
    const y0 = top - size0 * 0.2;
    base.unshift(`<path d="M${num(leftX + w * 0.5 - gx * 3)} ${num(y0)}h${num(gx * 2.3)}M${num(leftX + w * 0.5 + gx * 0.7)} ${num(y0)}h${num(gx * 2.3)}" stroke="${colors.accent}" stroke-width="${num(ruleW)}"/><circle cx="${num(leftX + w * 0.5)}" cy="${num(y0)}" r="${num(ruleW * 1.5)}" fill="${colors.accent}"/>`);
  }
  return { svg: base.join(''), bottom: bot, top };
}

const logoColors = (p) => {
  const accent = lum(p.a) < 0.3 ? mix(p.a, '#ffffff', 0.4) : p.a;
  return { text: mix('#ffffff', p.rim, 0.14), accent };
};

/* ------------------------------------------------------------------ artUrl */

const cache = new Map();

const VARIANTS = {
  poster: { W: 600, H: 900, pts: 66, detail: 1 },
  card: { W: 640, H: 360, pts: 62, detail: 0.72 },
  backdrop: { W: 1280, H: 720, pts: 90, detail: 1 },
};

function smallText(text, x, y, size, anchor, fill, track, op = 1) {
  return `<text x="${num(x)}" y="${num(y)}" font-family="'Segoe UI',Helvetica,Arial,sans-serif" font-weight="600" font-size="${num(size)}" letter-spacing="${num(size * track)}" text-anchor="${anchor}" fill="${fill}"${op < 1 ? ` opacity="${num(op)}"` : ''}>${esc(text)}</text>`;
}

function buildArt(title, variant) {
  const spec = VARIANTS[variant] || VARIANTS.poster;
  const { W, H } = spec;
  const id = String(title && title.id != null ? title.id : (title && title.name) || 'lumora');
  const seed = hash(id);
  const lay = R(hash(`${id}:${variant}`));
  const style = logoStyle(title || {});
  const defs = createDefs();

  let placeKey = 'bottom';
  if (variant === 'poster') {
    placeKey = style.place < 0.64 ? 'bottom' : style.place < 0.88 ? 'top' : 'center';
  } else if (variant === 'card') {
    placeKey = style.place < 0.56 ? 'left' : style.place < 0.8 ? 'bottom' : 'centerline';
  }
  let hzF;
  let fxF;
  if (variant === 'backdrop') {
    hzF = lay.r(0.58, 0.74);
    fxF = lay.r(0.6, 0.76);
  } else if (variant === 'card') {
    hzF = lay.r(0.56, 0.76);
    fxF = placeKey === 'left' ? lay.r(0.62, 0.76) : lay.r(0.4, 0.6);
  } else {
    hzF = placeKey === 'top' ? lay.r(0.66, 0.78) : placeKey === 'center' ? lay.r(0.62, 0.72) : lay.r(0.52, 0.62);
    fxF = lay.r(0.34, 0.66);
  }
  const device = variant === 'poster' ? lay.pick(['none', 'none', 'none', 'frame', 'frame', 'bigdisc', 'bigdisc', 'wash', 'band']) : variant === 'card' ? lay.pick(['none', 'none', 'wash']) : 'none';
  const { c, layers } = compose(title || {}, W, H, {
    variant: seed % 3,
    hz: hzF,
    fx: fxF,
    pts: spec.pts,
    detail: spec.detail,
    discK: device === 'bigdisc' ? lay.r(26, 34) : undefined,
    seed: variant === 'poster' ? undefined : `${variant}`,
  });
  const body = stillLayers(layers, c).map((l) => layerSvg(l, defs, W, H)).join('');
  const { p } = c;
  const parts = [body];

  if (device === 'wash') {
    parts.push(`<rect width="${W}" height="${H}" fill="${p.a}" opacity=".16" style="mix-blend-mode:soft-light"/>`);
  }

  let logo = '';
  if (title && variant !== 'backdrop') {
    const colors = logoColors(p);
    const poster = variant === 'poster';
    const maxW = W * (poster ? 0.82 : placeKey === 'left' ? 0.54 : 0.74);
    const sizeCap = poster ? H * 0.17 : H * 0.26;
    const layout = layoutLogo(title, style, {
      maxW,
      maxH: poster ? H * 0.33 : H * 0.56,
      maxLines: poster ? 4 : 3,
      sizeCap,
    });
    const anchorMid = poster ? style.align < 0.68 : placeKey !== 'left';
    const anchor = anchorMid ? 'middle' : 'start';
    const x = anchorMid ? W / 2 : poster ? W * 0.09 : W * 0.065;
    const pad = H * (poster ? 0.09 : 0.11);
    let y;
    let scrim;
    if (placeKey === 'top') {
      y = pad;
      scrim = vg(0, Math.min(H, y + layout.height + H * 0.28), [[0, p.ink, 0.9], [0.55, p.ink, 0.55], [1, p.ink, 0]]);
    } else if (placeKey === 'center') {
      y = H * 0.5 - layout.height / 2 - H * 0.04;
      scrim = rg(W / 2, H * 0.47, W * 0.8, [[0, p.ink, 0.55], [1, p.ink, 0]]);
    } else if (placeKey === 'centerline') {
      y = H * 0.5 - layout.height / 2;
      scrim = rg(W / 2, H * 0.5, W * 0.66, [[0, p.ink, 0.66], [1, p.ink, 0]]);
    } else {
      y = H - pad - layout.height - (poster ? H * 0.05 : 0);
      scrim = vg(Math.max(0, y - H * 0.28), H, [[0, p.ink, 0], [0.45, p.ink, 0.72], [1, p.ink, 0.97]]);
    }
    parts.push(`<rect width="${W}" height="${H}" fill="${defs.grad(scrim)}"/>`);
    if (placeKey === 'left') {
      parts.push(`<rect width="${W * 0.72}" height="${H}" fill="${defs.grad(lg(0, 0, W * 0.72, 0, [[0, p.ink, 0.72], [1, p.ink, 0]]))}"/>`);
    }
    if (device === 'band') {
      const bandTop = placeKey === 'top' ? 0 : y - H * 0.05;
      const bandH = placeKey === 'top' ? y + layout.height + H * 0.05 : H - bandTop;
      parts.push(`<rect y="${num(bandTop)}" width="${W}" height="${num(bandH)}" fill="${mix(p.ink, p.m, 0.3)}"/><path d="M0 ${num(placeKey === 'top' ? bandH : bandTop)}H${W}" stroke="${p.a}" stroke-width="3"/>`);
    }
    const mark = logoMarkup(title, style, layout, x, y, anchor, defs, colors);
    logo = mark.svg;

    if (poster && title.tagline) {
      const tag = String(title.tagline).toUpperCase();
      const fs = W * 0.0195;
      const usable = W * 0.84;
      const trk = 0.16;
      const est = tag.length * fs * (0.62 + trk);
      const fontS = est > usable ? Math.max(W * 0.0145, (fs * usable) / est) : fs;
      if (tag.length * fontS * (0.62 + trk) <= usable * 1.02) {
        const ty = placeKey === 'top' ? mark.bottom + H * 0.033 : mark.bottom + H * 0.044;
        logo += smallText(tag, anchorMid ? W / 2 : x, ty, fontS, anchorMid ? 'middle' : 'start', colors.text, trk, 0.82);
      }
    }
    if (title.isOriginal) {
      if (poster) {
        const ty = placeKey === 'top' ? H - H * 0.04 : H * 0.05;
        logo += smallText('A LUMORA ORIGINAL', W / 2, ty, W * 0.021, 'middle', colors.text, 0.42, 0.9);
      } else {
        logo += smallText('LUMORA ORIGINAL', W * 0.065, H * 0.11, W * 0.0185, 'start', colors.text, 0.32, 0.92);
      }
    }
  }

  parts.push(vignetteSvg(defs, W, H, '#000000', variant === 'backdrop' ? 0.55 : 0.68));
  if (logo) parts.push(logo);
  if (device === 'frame') {
    const m = W * 0.035;
    parts.push(`<rect x="${m}" y="${m}" width="${W - m * 2}" height="${H - m * 2}" fill="none" stroke="${mix(p.a, '#ffffff', 0.35)}" stroke-width="1.5" opacity=".8"/>`);
  }
  parts.push(grainSvg(defs, seed, W, H, variant === 'backdrop' ? 0.34 : 0.42));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}${parts.join('')}</svg>`;
}

export function artUrl(title, variant = 'poster') {
  const key = `${title && title.id}|${variant}`;
  let url = cache.get(key);
  if (!url) {
    const svg = buildArt(title || {}, variant);
    // SVG output is ASCII-only: esc() turns non-ASCII into character references.
    url = `data:image/svg+xml;base64,${btoa(svg)}`;
    cache.set(key, url);
  }
  return url;
}

/* ------------------------------------------------------------------ logoNode */

let logoCounter = 0;

export function logoNode(title) {
  const t = title || {};
  const style = logoStyle(t);
  const W = 800;
  const layout = layoutLogo(t, { ...style, lock: style.lock === 'stair' ? 'uniform' : style.lock }, {
    maxW: W * 0.96,
    maxH: 460,
    maxLines: 3,
    sizeCap: 190,
  });
  const defs = createDefs(`al${++logoCounter}-`);
  defs.prefix = `al${logoCounter}-`;
  const p = derive(t.palette, hash(String(t.id || t.name || 'lumora')));
  const pad = Math.max(10, layout.lines[0].size * 0.26);
  const safeStyle = { ...style, lock: style.lock === 'stair' ? 'uniform' : style.lock };
  const mark = logoMarkup(t, safeStyle, layout, 4, pad, 'start', defs, logoColors(p));
  const height = Math.ceil(mark.bottom + pad);
  const width = Math.ceil(layout.width + 24);
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMinYMid meet" aria-hidden="true" focusable="false" style="display:block;overflow:visible;height:auto;max-height:inherit">${defs}${mark.svg}</svg>`;
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = document.importNode(doc.documentElement, true);
  return h(
    'div',
    {
      role: 'img',
      'aria-label': String(t.name || ''),
      style: {
        display: 'block',
        width: '100%',
        maxWidth: `${Math.min(620, Math.round(width * 0.8))}px`,
        filter: 'drop-shadow(0 2px 14px rgba(0,0,0,.55))',
      },
    },
    svg,
  );
}

/* ------------------------------------------------------------------ film */

const plans = new Map();
const CAMS = ['panL', 'panR', 'push', 'pull', 'crane', 'orbit'];
const OVER_X = 1.26;
const OVER_Y = 1.2;

function planFor(title) {
  const id = String(title && title.id != null ? title.id : (title && title.name) || 'lumora');
  let plan = plans.get(id);
  if (plan) return plan;
  const seed = hash(id);
  const r = R(seed ^ 0xc0ffee);
  const shots = [];
  let start = 0;
  const count = 8;
  const baseVar = seed % 3;
  const camOrder = [...CAMS].sort(() => r() - 0.5);
  for (let i = 0; i < count; i++) {
    const dur = r.r(9.5, 14.5);
    shots.push({
      i,
      start,
      dur,
      variant: (baseVar + i) % 3,
      cam: camOrder[i % camOrder.length],
      hz: r.r(0.5, 0.76),
      fx: r.r(0.3, 0.7),
      defocus: i % 4 === 3,
      close: i % 4 === 3 ? r.pick(['back', 'hood', 'profile']) : null,
      closeSide: r.ok(0.5) ? 1 : -1,
      ph: r() * TAU,
    });
    start += dur;
  }
  plan = { id, shots, total: start, seed };
  plans.set(id, plan);
  return plan;
}

const filterOK = (() => {
  let v;
  return (g) => {
    if (v === undefined) v = typeof g.filter === 'string';
    return v;
  };
})();

function drawItems(g, layer) {
  for (const it of layer.items) {
    if (!it.d || it.op === 0) continue;
    const path = new Path2D(it.d);
    g.globalAlpha = it.op === undefined ? 1 : it.op;
    if (it.stroke) {
      g.strokeStyle = paint(g, it.stroke);
      g.lineWidth = it.sw;
      g.lineCap = it.cap || 'butt';
      g.stroke(path);
    } else {
      g.fillStyle = paint(g, it.fill);
      g.fill(path);
    }
  }
  g.globalAlpha = 1;
}

function bakeLayer(g, layer, s, W, H) {
  g.save();
  const xf = layer.flipY !== undefined;
  const apply = (ct) => {
    if (xf) {
      ct.translate(0, layer.flipY * 2);
      ct.scale(1, -1);
    }
  };
  g.globalAlpha = 1;
  if (layer.blur && layer.blur * s > 0.6) {
    const px = layer.blur * s;
    if (filterOK(g)) {
      g.filter = `blur(${px.toFixed(1)}px)`;
      apply(g);
      drawItems(g, layer);
      g.filter = 'none';
    } else {
      const down = Math.max(2, px * 0.75);
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(2, Math.ceil((W * s) / down));
      tmp.height = Math.max(2, Math.ceil((H * s) / down));
      const t = tmp.getContext('2d');
      t.scale(s / down, s / down);
      apply(t);
      drawItems(t, layer);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingQuality = 'high';
      g.drawImage(tmp, 0, 0, g.canvas.width, g.canvas.height);
    }
  } else {
    apply(g);
    drawItems(g, layer);
  }
  g.restore();
}

function rasterCanvas(cw, ch) {
  const can = document.createElement('canvas');
  can.width = Math.max(2, Math.ceil(cw));
  can.height = Math.max(2, Math.ceil(ch));
  return can;
}

// Consecutive layers that move identically are flattened to one bitmap to reduce overdraw.
function groupLayers(layers) {
  const groups = [];
  const movable = (l) => l.drift || l.pulse || l.sway;
  for (const layer of layers) {
    if (layer.fx) {
      groups.push({ fx: layer, depth: layer.depth === undefined ? 1 : layer.depth });
      continue;
    }
    if (!layer.items) continue;
    const prev = groups[groups.length - 1];
    if (prev && !prev.fx && !movable(layer) && !movable(prev.layers[0]) && prev.depth === layer.depth && !prev.blend && !layer.blend && (layer.op === undefined || layer.op === 1)) {
      prev.layers.push(layer);
      prev.soft = prev.soft && (layer.sky || (layer.blur || 0) > 2);
    } else {
      groups.push({ layers: [layer], depth: layer.depth, blend: layer.blend, soft: !!(layer.sky || (layer.blur || 0) > 2), drift: layer.drift, pulse: layer.pulse, sway: layer.sway, op: layer.op });
    }
  }
  return groups;
}

const shotCache = new Map();
let shotBytes = 0;
const MAX_BYTES = 170 * 1024 * 1024;

function closeFigureLayers(c, shot) {
  const { W, H, u, p } = c;
  const kind = shot.close;
  const ht = H * 0.72;
  const fx0 = W * (shot.closeSide > 0 ? 0.68 : 0.32);
  const path = figure(kind, fx0, H * 1.02, ht, shot.closeSide > 0 ? -1 : 1);
  return [
    L(S(path, p.a, u * 1.5, 0.75), { depth: 0.9, blur: u * 1.2, blend: 'screen', pulse: { type: 'sin', min: 0.7, max: 1, f: 0.2, ph: shot.ph } }),
    L(P(path, p.ink), { depth: 0.9 }),
    L(S(path, p.rim, Math.max(1, u * 0.2), 0.5), { depth: 0.9 }),
  ];
}

function buildShot(title, shot, vw, vh, scale, key) {
  const W = Math.ceil(vw * OVER_X);
  const H = Math.ceil(vh * OVER_Y);
  const { c, layers } = compose(title, W, H, {
    variant: shot.variant,
    hz: shot.hz,
    fx: shot.fx,
    film: true,
    detail: 1,
    pts: 90,
    seed: `shot${shot.i}`,
    figures: shot.close ? false : undefined,
  });
  let list = layers;
  if (shot.close) {
    list = list.map((l) => (l.fx ? l : { ...l, blur: Math.max(l.blur || 0, c.u * 0.65) }));
    list = [...list.filter((l) => !(l.fx === 'rain' || l.fx === 'snow' || l.fx === 'motes')), ...closeFigureLayers(c, shot), ...list.filter((l) => l.fx === 'rain' || l.fx === 'snow' || l.fx === 'motes')];
  }
  const groups = groupLayers(list);
  const entry = { key, W, H, vw, vh, scale, groups, bytes: 0, next: 0, used: 0, c };
  return entry;
}

function bakeGroup(entry, group) {
  if (group.fx || group.canvas) return;
  const s = entry.scale * (group.soft ? 0.55 : 1);
  const can = rasterCanvas(entry.W * s, entry.H * s);
  const g = can.getContext('2d');
  g.scale(s, s);
  for (const layer of group.layers) {
    g.save();
    bakeLayer(g, layer, s, entry.W, entry.H);
    g.restore();
  }
  group.canvas = can;
  const bytes = can.width * can.height * 4;
  entry.bytes += bytes;
  shotBytes += bytes;
}

function evict(keep) {
  if (shotBytes <= MAX_BYTES) return;
  const all = [...shotCache.values()].sort((a, b) => a.used - b.used);
  for (const e of all) {
    if (shotBytes <= MAX_BYTES) break;
    if (e === keep) continue;
    shotBytes -= e.bytes;
    shotCache.delete(e.key);
  }
}

const buckets = [340, 680, 1100, 1500];
let useClock = 0;

function shotEntry(title, plan, shot, pxW, w, h) {
  const bucket = buckets.find((b) => b >= pxW) || buckets[buckets.length - 1];
  const asp = Math.round((h / w) * 16) / 16;
  const key = `${plan.id}|${shot.i}|${bucket}|${asp}`;
  let e = shotCache.get(key);
  if (!e) {
    const vw = 1280;
    const vh = Math.round(vw * asp);
    e = buildShot(title, shot, vw, vh, bucket / vw, key);
    shotCache.set(key, e);
  }
  e.used = ++useClock;
  return e;
}

function finishBake(e, budget = Infinity) {
  while (e.next < e.groups.length && budget > 0) {
    const group = e.groups[e.next++];
    if (!group.fx && !group.canvas) {
      bakeGroup(e, group);
      budget--;
    }
  }
}

function cameraFor(shot, u, t, W, vw) {
  const k = ease(u);
  const reach = Math.min(92, (W - vw) * 0.3);
  let x = 0;
  let y = 0;
  let z = 1.02;
  switch (shot.cam) {
    case 'panL': x = lerp(reach, -reach, k); z = 1.04; break;
    case 'panR': x = lerp(-reach, reach, k); z = 1.04; break;
    case 'push': z = lerp(1.02, 1.2, u); x = (shot.fx - 0.5) * 80 * u; break;
    case 'pull': z = lerp(1.2, 1.03, u); x = (shot.fx - 0.5) * 80 * (1 - u); break;
    case 'crane': y = lerp(38, -38, k); z = 1.06; break;
    default: x = Math.sin(u * Math.PI * 2 + shot.ph) * reach * 0.6; y = Math.cos(u * Math.PI * 2 + shot.ph) * 18; z = 1.07;
  }
  x += Math.sin(t * 0.61 + shot.ph) * 2.2 + Math.sin(t * 1.27 + shot.ph * 2) * 1.1;
  y += Math.sin(t * 0.83 + shot.ph * 3) * 1.6;
  return { x, y, z };
}

let noiseTile;
function grain(ctx, t, w, h, strength = 0.07) {
  if (!noiseTile) {
    noiseTile = document.createElement('canvas');
    noiseTile.width = noiseTile.height = 192;
    const g = noiseTile.getContext('2d');
    const img = g.createImageData(192, 192);
    const r = R(90210);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.pow(r(), 2.6) * 255;
    }
    g.putImageData(img, 0, 0);
  }
  const k = Math.floor(t * 24);
  const ox = -Math.floor(rnd2(k, 1) * 192);
  const oy = -Math.floor(rnd2(k, 2) * 192);
  ctx.globalAlpha = strength;
  const scale = Math.max(1, w / 900);
  const size = 192 * scale;
  for (let y = oy; y < h; y += size) {
    for (let x = ox; x < w; x += size) ctx.drawImage(noiseTile, x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function vignette(ctx, w, h) {
  const rad = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(w / 2, h * 0.48, rad * 0.45, w / 2, h * 0.48, rad);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawGroup(ctx, e, group, cam, t, w, h, sc0) {
  const depth = group.depth === undefined ? 1 : group.depth;
  const z = 1 + (cam.z - 1) * Math.min(1.25, depth + 0.1);
  const sc = sc0 * z;
  const dw = e.W * sc;
  const dh = e.H * sc;
  const maxX = (dw - w) / 2;
  const maxY = (dh - h) / 2;
  let ox = -cam.x * depth * sc;
  let oy = -cam.y * depth * sc;
  ox = clamp(ox, -maxX, maxX);
  oy = clamp(oy, -maxY, maxY);
  const x0 = (w - dw) / 2 + ox;
  const y0 = (h - dh) / 2 + oy;

  if (group.fx) {
    const f = group.fx;
    const draw = FX[f.fx];
    if (!draw) return;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.scale(sc, sc);
    draw(ctx, f, t, e.W, e.H);
    ctx.restore();
    return;
  }
  if (!group.canvas) bakeGroup(e, group);
  let alpha = group.op === undefined ? 1 : group.op;
  alpha *= pulseAlpha(group.pulse, t);
  if (alpha <= 0.004) return;
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = group.blend ? 'screen' : 'source-over';
  let sway = 0;
  if (group.sway) sway = Math.sin(t * group.sway.f * TAU + group.sway.ph) * group.sway.a * sc;
  if (group.drift) {
    const off = mod(t * group.drift * sc, dw);
    ctx.drawImage(group.canvas, x0 + off, y0, dw, dh);
    ctx.drawImage(group.canvas, x0 + off - dw, y0, dw, dh);
  } else {
    ctx.drawImage(group.canvas, x0 + sway, y0, dw, dh);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function renderScene(ctx, title, tSec, w, h) {
  if (!(w > 0 && h > 0)) return;
  const t = Math.max(0, Number(tSec) || 0);
  const plan = planFor(title);
  const local = t % plan.total;
  let shot = plan.shots[0];
  for (const s of plan.shots) if (local >= s.start) shot = s;
  const lt = local - shot.start;

  let pxW = w;
  if (ctx.getTransform) pxW = w * Math.abs(ctx.getTransform().a || 1);
  const e = shotEntry(title, plan, shot, pxW, w, h);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const sc0 = w / e.vw;
  const cam = cameraFor(shot, clamp(lt / shot.dur), t, e.W, e.vw);
  for (const group of e.groups) drawGroup(ctx, e, group, cam, t, w, h, sc0);

  vignette(ctx, w, h);
  grain(ctx, t, w, h);
  ctx.restore();

  // Warm the next shot gradually so the cut does not cause a visible hitch.
  if (shot.dur - lt < 2.2) {
    const nx = plan.shots[(shot.i + 1) % plan.shots.length];
    const ne = shotEntry(title, plan, nx, pxW, w, h);
    finishBake(ne, 1);
  }
  evict(e);
}
