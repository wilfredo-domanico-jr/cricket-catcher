// Procedural art: every critter, gem, cube and the trainer are drawn with
// Canvas 2D paths. textures.js bakes these into Phaser spritesheets.
import { TAU, shade, rr } from './util.js';

// All critter animation loops every LOOP seconds, so baked spritesheets loop seamlessly.
export const LOOP = 3.2;
const W = TAU / LOOP;
const osc = (t, n, ph = 0) => Math.sin(t * W * n + ph);
const phase = (t, n = 1, off = 0) => (((t / LOOP) * n + off) % 1 + 1) % 1;

export const OUT = '#2d2340';

function shape(ctx, fill, build, stroke = true) {
  ctx.beginPath(); build();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) ctx.stroke();
}
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
function radial(ctx, x, y, r, c0, c1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
}
export function sparkle(ctx, x, y, s, color = '#fff') {
  if (s <= 0.2) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

function face(ctx, t, o = {}) {
  const { y = 0, gap = 14, r = 6, mouth = 'smile', cheeks = null, stern = false, eye = '#2a2238', blinkOff = 0 } = o;
  const blink = ((t + blinkOff) % LOOP) < 0.14;
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = s * gap;
    if (blink) {
      ctx.strokeStyle = eye; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(ex - r, y); ctx.quadraticCurveTo(ex, y + r * 0.6, ex + r, y); ctx.stroke();
    } else {
      ctx.fillStyle = eye;
      ctx.beginPath(); ctx.ellipse(ex, y, r * 0.85, r * 1.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - r * 0.28, y - r * 0.42, r * 0.36, 0, TAU); ctx.fill();
    }
    if (stern) {
      ctx.strokeStyle = eye; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ex + s * r * 1.3, y - r * 2.0); ctx.lineTo(ex - s * r * 0.9, y - r * 1.35); ctx.stroke();
    }
    if (cheeks) {
      ctx.fillStyle = cheeks;
      ctx.beginPath(); ctx.ellipse(s * (gap + r + 4), y + r + 3, r * 0.95, r * 0.62, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = eye; ctx.lineWidth = 2.6;
  const my = y + r + 4;
  ctx.beginPath();
  if (mouth === 'smile') {
    ctx.arc(0, my - 3, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (mouth === 'open') {
    ctx.moveTo(-5, my - 1); ctx.quadraticCurveTo(0, my + 9, 5, my - 1); ctx.closePath();
    ctx.fillStyle = '#c2364a'; ctx.fill(); ctx.stroke();
  } else if (mouth === 'w') {
    ctx.arc(-3.2, my - 2, 3.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.moveTo(6.2, my - 1);
    ctx.arc(3.2, my - 2, 3.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.moveTo(-5, my); ctx.lineTo(5, my); ctx.stroke();
  }
  ctx.restore();
}

function flame(ctx, w, h, outer, inner) {
  const path = (w, h) => {
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w * 0.6, -h * 0.55, w * 1.2, -h * 0.1, 0, h * 0.3);
    ctx.bezierCurveTo(-w * 1.2, -h * 0.1, -w * 0.6, -h * 0.55, 0, -h);
  };
  path(w, h); ctx.fillStyle = outer; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(0, h * 0.12); path(w * 0.55, h * 0.6); ctx.fillStyle = inner; ctx.fill(); ctx.restore();
}

function feet(ctx, color, y = 38, gap = 17) {
  for (const s of [-1, 1]) shape(ctx, color, () => ell(ctx, s * gap, y, 10, 6));
}

// ---------------------------------------------------------------- Species
// Each draws in a ~100x100 unit space centred on (0,0); feet sit near y=44.

export function drawEmberpup(ctx, t) {
  ctx.save(); ctx.translate(32, 14); ctx.rotate(0.9 + osc(t, 2) * 0.12);
  flame(ctx, 13, 30 + osc(t, 7) * 3, '#ff5a2a', '#ffd23f');
  ctx.restore();
  for (const s of [-1, 1]) {
    shape(ctx, '#e8642c', () => { ctx.moveTo(s * 12, -24); ctx.lineTo(s * 32, -50); ctx.lineTo(s * 37, -12); ctx.closePath(); });
    shape(ctx, '#ffb38a', () => { ctx.moveTo(s * 19, -24); ctx.lineTo(s * 30, -41); ctx.lineTo(s * 32, -19); ctx.closePath(); }, false);
  }
  feet(ctx, '#e8642c');
  shape(ctx, radial(ctx, 0, 5, 42, '#ffc58a', '#ef6c2a'), () => ell(ctx, 0, 6, 38, 34));
  shape(ctx, '#fff1d6', () => ell(ctx, 0, 23, 19, 13), false);
  face(ctx, t, { y: -1, gap: 14, r: 6, cheeks: 'rgba(255,80,80,.45)', mouth: 'open' });
  shape(ctx, OUT, () => ell(ctx, 0, 5, 3.2, 2.2), false);
}

export function drawDrizzlet(ctx, t) {
  for (const s of [-1, 1]) shape(ctx, '#5bbcff', () => ell(ctx, s * 38, 22, 12, 7, s * (0.5 + osc(t, 3) * 0.15)));
  shape(ctx, radial(ctx, 0, 10, 48, '#e0f6ff', '#3a9cf0'), () => {
    ctx.moveTo(0, -50);
    ctx.bezierCurveTo(16, -30, 38, -12, 38, 12);
    ctx.arc(0, 12, 38, 0, Math.PI, false);
    ctx.bezierCurveTo(-38, -12, -16, -30, 0, -50);
    ctx.closePath();
  });
  shape(ctx, 'rgba(255,255,255,.75)', () => ell(ctx, -15, -12, 5, 10, 0.5), false);
  face(ctx, t, { y: 12, gap: 13, r: 6, cheeks: 'rgba(255,120,170,.5)', mouth: 'smile', blinkOff: 1.3 });
}

export function drawSproutling(ctx, t) {
  ctx.save(); ctx.translate(0, -20); ctx.rotate(osc(t, 1) * 0.18);
  ctx.lineWidth = 4; ctx.strokeStyle = '#3d8a3a';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -10, 0, -20); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  for (const s of [-1, 1]) {
    shape(ctx, s < 0 ? '#6fdc6a' : '#55c95a', () => ell(ctx, s * 14, -24, 15, 7, -s * 0.5));
    ctx.save(); ctx.strokeStyle = 'rgba(30,90,40,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s * 3, -21); ctx.lineTo(s * 24, -29); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  feet(ctx, '#3fae5a', 40, 16);
  shape(ctx, radial(ctx, 0, 10, 42, '#c2f7a8', '#3fae5a'), () => ell(ctx, 0, 10, 37, 33));
  ctx.fillStyle = 'rgba(40,120,60,.3)';
  for (const [x, y, a, b] of [[-23, 0, 4, 3], [24, 6, 5, 3.5], [17, 26, 3, 2], [-15, 28, 3.5, 2.5]]) { ctx.beginPath(); ell(ctx, x, y, a, b); ctx.fill(); }
  face(ctx, t, { y: 9, gap: 13, r: 6, cheeks: 'rgba(255,120,150,.5)', mouth: 'smile', blinkOff: 2.1 });
}

export function drawZappit(ctx, t) {
  shape(ctx, '#f5c518', () => {
    ctx.moveTo(26, 24); ctx.lineTo(48, 10); ctx.lineTo(41, 4); ctx.lineTo(60, -16);
    ctx.lineTo(34, 0); ctx.lineTo(41, 6); ctx.lineTo(22, 15); ctx.closePath();
  });
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 14, -20); ctx.rotate(s * (0.28 + osc(t, 2, s) * 0.07)); ctx.scale(s, 1);
    shape(ctx, '#ffd93b', () => {
      ctx.moveTo(-7, 2); ctx.lineTo(-9, -22); ctx.lineTo(-2, -20); ctx.lineTo(-6, -46);
      ctx.lineTo(9, -16); ctx.lineTo(2, -18); ctx.lineTo(7, 2); ctx.closePath();
    });
    shape(ctx, '#3a2f1a', () => { ctx.moveTo(-6, -46); ctx.lineTo(-4.8, -38); ctx.lineTo(-1.5, -37); ctx.closePath(); }, false);
    ctx.restore();
  }
  feet(ctx, '#f2b705', 39, 16);
  shape(ctx, radial(ctx, 0, 10, 42, '#fff7a8', '#f2b705'), () => ell(ctx, 0, 10, 36, 32));
  face(ctx, t, { y: 7, gap: 13, r: 6, cheeks: 'rgba(255,70,70,.8)', mouth: 'w', blinkOff: 0.8 });
  if (phase(t, 2) < 0.12) {
    ctx.save(); ctx.strokeStyle = '#fff27a'; ctx.lineWidth = 3;
    for (const [x, y, s] of [[-50, -14, 1], [50, -28, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6 * s, y + 6); ctx.lineTo(x, y + 10); ctx.lineTo(x + 6 * s, y + 18); ctx.stroke();
    }
    ctx.restore();
  }
}

const PEB = [1, 0.86, 1.04, 0.9, 1.06, 0.88, 1.02, 0.93, 1.05, 0.9];
export function drawPebblor(ctx, t) {
  const pebbles = [0, 1].map(i => t * W + i * Math.PI);
  const pebble = a => shape(ctx, '#9c907f', () => ell(ctx, Math.cos(a) * 54, -4 + Math.sin(a) * 14, 7, 5.5, 0.3));
  pebbles.filter(a => Math.sin(a) < 0).forEach(pebble);
  shape(ctx, radial(ctx, 0, 6, 46, '#e0d9cc', '#7d7264'), () => {
    for (let i = 0; i < PEB.length; i++) {
      const a = (i / PEB.length) * TAU - Math.PI / 2, r = 40 * PEB[i];
      const x = Math.cos(a) * r, y = 6 + Math.sin(a) * r * 0.92;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  });
  ctx.save(); ctx.strokeStyle = 'rgba(60,50,40,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-26, 22); ctx.lineTo(-17, 15); ctx.lineTo(-19, 7);
  ctx.moveTo(22, -10); ctx.lineTo(29, -1); ctx.lineTo(24, 8); ctx.stroke(); ctx.restore();
  shape(ctx, '#7cc56a', () => ell(ctx, -4, -27, 18, 8, -0.15));
  ctx.fillStyle = '#a7e08f'; ctx.beginPath(); ell(ctx, -9, -29, 5, 2.5, -0.2); ctx.fill();
  face(ctx, t, { y: 7, gap: 14, r: 5, stern: true, mouth: 'flat', blinkOff: 0.6 });
  pebbles.filter(a => Math.sin(a) >= 0).forEach(pebble);
}

export function drawWispurr(ctx, t) {
  ctx.translate(0, -6 + osc(t, 1) * 5);
  for (let i = 0; i < 3; i++) {
    const a = t * W + (i * TAU) / 3;
    ctx.fillStyle = `rgba(160,120,255,${0.35 + 0.25 * osc(t, 2, i)})`;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 52, Math.sin(a) * 16 - 10, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efe7ff';
    ctx.beginPath(); ctx.arc(Math.cos(a) * 52, Math.sin(a) * 16 - 10, 2.6, 0, TAU); ctx.fill();
  }
  ctx.save(); ctx.globalAlpha *= 0.94;
  for (const s of [-1, 1]) shape(ctx, '#9a74e8', () => { ctx.moveTo(s * 12, -27); ctx.lineTo(s * 30, -52); ctx.lineTo(s * 34, -16); ctx.closePath(); });
  shape(ctx, radial(ctx, 0, 0, 48, '#ede2ff', '#7a52d1'), () => {
    ctx.moveTo(-34, 0);
    ctx.arc(0, 0, 34, Math.PI, 0, false);
    ctx.lineTo(34, 30);
    for (let i = 0; i < 4; i++) {
      const x0 = 34 - i * 17;
      ctx.quadraticCurveTo(x0 - 8.5, 42 + osc(t, 2, i * 1.7) * 4, x0 - 17, 30);
    }
    ctx.closePath();
  });
  ctx.restore();
  const blink = ((t + 2.4) % LOOP) < 0.14;
  for (const s of [-1, 1]) {
    if (blink) {
      ctx.save(); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(s * 13 - 7, 2); ctx.lineTo(s * 13 + 7, 2); ctx.stroke(); ctx.restore();
    } else {
      shape(ctx, '#ffe66b', () => ell(ctx, s * 13, 2, 7.5, 6.5));
      shape(ctx, OUT, () => ell(ctx, s * 13, 2, 1.8, 5), false);
    }
  }
  ctx.save(); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-3.2, 12, 3.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.moveTo(6.2, 13); ctx.arc(3.2, 12, 3.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,150,210,.45)';
  for (const s of [-1, 1]) { ctx.beginPath(); ell(ctx, s * 24, 11, 5, 3); ctx.fill(); }
}

export function drawGlimmerfin(ctx, t) {
  const hue = 175 + osc(t, 1) * 25;
  ctx.save(); ctx.translate(-34, 2); ctx.rotate(osc(t, 3) * 0.25);
  shape(ctx, `hsl(${hue + 120},85%,75%)`, () => { ctx.moveTo(4, 0); ctx.lineTo(-26, -24); ctx.quadraticCurveTo(-16, 0, -26, 24); ctx.closePath(); });
  ctx.restore();
  shape(ctx, `hsl(${hue + 90},80%,72%)`, () => { ctx.moveTo(-16, -20); ctx.quadraticCurveTo(0, -48, 22, -38); ctx.quadraticCurveTo(14, -28, 16, -20); ctx.closePath(); });
  const g = ctx.createLinearGradient(0, -28, 0, 28);
  g.addColorStop(0, `hsl(${hue},85%,68%)`); g.addColorStop(1, `hsl(${hue + 130},85%,80%)`);
  shape(ctx, g, () => ell(ctx, 0, 2, 40, 27));
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-16 + i * 11, 5, 7, -0.5 * Math.PI, 0.5 * Math.PI); ctx.stroke(); }
  ctx.restore();
  shape(ctx, `hsl(${hue + 120},85%,82%)`, () => ell(ctx, 2, 15, 10, 5, 0.6 + osc(t, 3) * 0.2));
  shape(ctx, '#fff', () => ell(ctx, 20, -6, 9, 9));
  if (((t + 1.1) % LOOP) < 0.14) {
    ctx.save(); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(27, -5); ctx.stroke(); ctx.restore();
  } else {
    shape(ctx, OUT, () => ell(ctx, 22, -5, 5, 5.5), false);
    shape(ctx, '#fff', () => ell(ctx, 20, -8, 1.8, 1.8), false);
  }
  ctx.save(); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(33, 8, 4, 0.2 * Math.PI, 0.9 * Math.PI); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,130,190,.5)'; ctx.beginPath(); ell(ctx, 26, 8, 4, 2.5); ctx.fill();
  [[-32, -34], [36, -30], [-6, 40]].forEach(([x, y], i) => sparkle(ctx, x, y, Math.sin(phase(t, 2, i / 3) * Math.PI) * 7));
}

export function drawAurorex(ctx, t) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `hsla(${(phase(t) * 360 + i * 110) % 360},90%,70%,.6)`;
    ctx.lineWidth = 5;
    const a0 = t * W * (i === 2 ? 2 : 1) * (i === 1 ? -1 : 1) + i * 2;
    ctx.beginPath(); ctx.arc(0, 4, 52 + i * 7, a0, a0 + Math.PI * 1.2); ctx.stroke();
  }
  ctx.restore();
  const flap = 0.85 + osc(t, 2) * 0.15;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 26, 2); ctx.scale(s, flap);
    shape(ctx, 'rgba(205,232,255,.9)', () => {
      ctx.moveTo(0, -4); ctx.quadraticCurveTo(30, -42, 48, -32); ctx.quadraticCurveTo(36, -18, 42, -6);
      ctx.quadraticCurveTo(26, -4, 30, 8); ctx.quadraticCurveTo(16, 6, 0, 12); ctx.closePath();
    });
    ctx.restore();
  }
  const crystal = (x, h, w) => shape(ctx, '#86e3ff', () => { ctx.moveTo(x, -26 - h); ctx.lineTo(x + w, -26); ctx.lineTo(x, -18); ctx.lineTo(x - w, -26); ctx.closePath(); });
  crystal(-15, 14, 6); crystal(15, 14, 6); crystal(0, 26, 7);
  shape(ctx, radial(ctx, 0, 6, 46, '#ffffff', '#9fc0ff'), () => ell(ctx, 0, 8, 34, 36));
  shape(ctx, 'rgba(255,255,255,.7)', () => ell(ctx, 0, 24, 17, 13), false);
  const glow = 0.6 + 0.4 * osc(t, 2);
  ctx.save(); ctx.shadowColor = '#ff7ad9'; ctx.shadowBlur = 14 * glow;
  shape(ctx, '#ff7ad9', () => { ctx.moveTo(0, 21); ctx.lineTo(6, 27); ctx.lineTo(0, 33); ctx.lineTo(-6, 27); ctx.closePath(); });
  ctx.restore();
  face(ctx, t, { y: 3, gap: 13, r: 6, eye: '#26336e', mouth: 'smile', cheeks: 'rgba(255,150,220,.45)', blinkOff: 0.4 });
  [[-44, -40], [46, -18], [-40, 30], [40, 40]].forEach(([x, y], i) => sparkle(ctx, x, y, Math.sin(phase(t, 2, i / 4) * Math.PI) * 7, '#fff7c2'));
}

export function drawCritter(ctx, sp, x, y, scale, t) {
  if (scale <= 0.001) return;
  ctx.save();
  ctx.translate(x, y);
  const sq = 1 + osc(t, 2) * 0.025;
  ctx.scale(scale / sq, scale * sq);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  sp.draw(ctx, t);
  ctx.restore();
}

// ---------------------------------------------------------------- Capture gem
// A faceted hexagonal crystal: lit facets top-left, shadowed bottom-right.
export function drawGem(ctx, x, y, r, gem) {
  ctx.save();
  ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.45);
  halo.addColorStop(0, `rgba(${gem.glow},.45)`); halo.addColorStop(1, `rgba(${gem.glow},0)`);
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, TAU); ctx.fill();
  const outer = [], inner = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    outer.push([Math.cos(a) * r * 0.88, Math.sin(a) * r]);
    inner.push([Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.46 - r * 0.06]);
  }
  const facet = [gem.light, gem.mid, shade(gem.dark, 10), gem.dark, gem.mid, gem.light];
  for (let k = 0; k < 6; k++) {
    const n = (k + 1) % 6;
    ctx.beginPath();
    ctx.moveTo(...outer[k]); ctx.lineTo(...outer[n]); ctx.lineTo(...inner[n]); ctx.lineTo(...inner[k]); ctx.closePath();
    ctx.fillStyle = facet[k]; ctx.fill();
  }
  ctx.beginPath(); inner.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath();
  const top = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.4);
  top.addColorStop(0, '#ffffff'); top.addColorStop(1, gem.mid);
  ctx.fillStyle = top; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, r * 0.04);
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(...outer[k]); ctx.lineTo(...inner[k]); ctx.stroke(); }
  ctx.beginPath(); outer.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath();
  ctx.strokeStyle = gem.dark; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.stroke();
  if (gem.star) {
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? r * 0.12 : r * 0.28;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad - r * 0.06);
    }
    ctx.closePath(); ctx.fill();
  }
  sparkle(ctx, -r * 0.34, -r * 0.5, r * 0.2, 'rgba(255,255,255,.95)');
  ctx.restore();
}

// ---------------------------------------------------------------- Supply-stop cube
const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const CUBE_F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [1, 2, 6, 5], [0, 3, 7, 4]];
const CUBE_SHADE = [1, 1, 0, 2, 2, 2];
export function drawCube(ctx, cx, cy, s, ang, cols) {
  const tilt = 0.55, ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(tilt), st = Math.sin(tilt);
  const P = CUBE_V.map(([x, y, z]) => {
    const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
    return [cx + x1 * s, cy + (y * ct - z1 * st) * s, y * st + z1 * ct];
  });
  CUBE_F.map((f, i) => ({ f, i, z: f.reduce((a, k) => a + P[k][2], 0) / 4 }))
    .sort((a, b) => b.z - a.z)
    .forEach(({ f, i }) => {
      ctx.beginPath();
      f.forEach((k, j) => (j ? ctx.lineTo(P[k][0], P[k][1]) : ctx.moveTo(P[k][0], P[k][1])));
      ctx.closePath();
      ctx.fillStyle = cols[CUBE_SHADE[i]]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2; ctx.stroke();
    });
}

// ---------------------------------------------------------------- Trainer
// Faces right; feet at (0,0). walk in [-1,1] swings limbs, bob lifts the body.
export function drawTrainer(c, walk, bob) {
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, TAU); c.fill();
  c.fillStyle = '#2f3b66';
  rr(c, -6 + walk * 2.5, -15, 5, 13, 2); c.fill();
  rr(c, 1 - walk * 2.5, -15, 5, 13, 2); c.fill();
  c.fillStyle = '#1f2937';
  rr(c, -7 + walk * 2.5, -4, 7, 4, 2); c.fill();
  rr(c, 0 - walk * 2.5, -4, 7, 4, 2); c.fill();
  c.translate(0, -bob);
  c.fillStyle = '#f59e0b'; rr(c, -12, -31, 8, 14, 3); c.fill();
  c.fillStyle = '#2a9df4'; rr(c, -8, -32, 16, 19, 6); c.fill();
  c.fillStyle = '#fff'; c.fillRect(-8, -24, 16, 3);
  c.save(); c.translate(1, -29); c.rotate(walk * 0.6);
  c.fillStyle = '#2a9df4'; rr(c, -2.5, 0, 5, 10, 2.5); c.fill();
  c.fillStyle = '#ffd9b8'; c.beginPath(); c.arc(0, 11, 2.6, 0, TAU); c.fill();
  c.restore();
  c.fillStyle = '#4a2f20'; c.beginPath(); c.arc(-1, -40, 9.5, 0, TAU); c.fill();
  c.fillStyle = '#ffd9b8'; c.beginPath(); c.arc(1, -40, 8.5, 0, TAU); c.fill();
  c.fillStyle = '#1f2937'; c.beginPath(); c.arc(5, -40, 1.5, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,120,120,.5)'; c.beginPath(); c.arc(4, -36.5, 2, 0, TAU); c.fill();
  c.fillStyle = '#16a34a'; c.beginPath(); c.arc(0, -42, 9.6, Math.PI, TAU); c.fill();
  rr(c, 2, -44, 11, 3.5, 2); c.fill();
  c.fillStyle = '#fde047'; c.beginPath(); c.arc(-1, -46, 2.4, 0, TAU); c.fill();
}
