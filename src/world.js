// Procedural world: seeded tile map (park, lakes, town, forest) rendered once to a canvas.
import { CONFIG } from './config.js';
import { TAU, lerp, mulberry32, shade, rr } from './util.js';

export const T = { GRASS: 0, ROAD: 1, WATER: 2, SAND: 3, PARK: 4, TREE: 5, BUILDING: 6, PATH: 7, FLOWERS: 8 };
export const SOLID = [false, false, true, false, false, true, true, false, false];
const GROUND_HSL = { [T.GRASS]: [104, 52, 66], [T.PARK]: [118, 42, 58], [T.SAND]: [47, 72, 80] };
const ROOFS = ['#ef8a6f', '#79aee0', '#f3c36b', '#b59ae0', '#8fd0b5', '#f29fc0'];

export class World {
  constructor(seed) {
    this.N = CONFIG.N; this.TS = CONFIG.TILE; this.size = this.N * this.TS;
    this.rng = mulberry32(seed);
    this.tiles = new Uint8Array(this.N * this.N);
    this.biomes = new Array(this.N * this.N).fill('field');
    this.buildings = [];
    this.generate();
    this.render();
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.N || y >= this.N ? T.TREE : this.tiles[y * this.N + x]; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.N && y < this.N) this.tiles[y * this.N + x] = t; }
  tileAt(px, py) { return this.get(Math.floor(px / this.TS), Math.floor(py / this.TS)); }
  walkable(px, py) { return !SOLID[this.tileAt(px, py)]; }
  biomeAt(px, py) {
    const x = Math.floor(px / this.TS), y = Math.floor(py / this.TS);
    return x < 0 || y < 0 || x >= this.N || y >= this.N ? 'field' : this.biomes[y * this.N + x];
  }
  inTown(x, y) { const t = this.town; return x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1; }

  // BFS over the tile grid (8-way, no corner cutting). Returns tile-centre waypoints or null.
  findPath(sx, sy, tx, ty) {
    const N = this.N, TS = this.TS;
    const s = [Math.floor(sx / TS), Math.floor(sy / TS)], g = [Math.floor(tx / TS), Math.floor(ty / TS)];
    const free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !SOLID[this.tiles[y * N + x]];
    if (!free(g[0], g[1])) return null;
    const prev = new Int32Array(N * N).fill(-1), start = s[1] * N + s[0], goal = g[1] * N + g[0];
    prev[start] = start;
    const queue = [start];
    for (let qi = 0; qi < queue.length && prev[goal] < 0; qi++) {
      const cur = queue[qi], cx = cur % N, cy = (cur / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy, ni = ny * N + nx;
        if (!free(nx, ny) || prev[ni] >= 0) continue;
        if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue;
        prev[ni] = cur; queue.push(ni);
      }
    }
    if (prev[goal] < 0) return null;
    const pts = [];
    for (let i = goal; i !== start; i = prev[i]) pts.push({ x: (i % N + 0.5) * TS, y: (((i / N) | 0) + 0.5) * TS });
    return pts.reverse();
  }

  // smooth value noise on a coarse grid (wraps, so any coordinate works)
  noise(cell) {
    const g = 32, vals = Array.from({ length: g * g }, () => this.rng());
    const v = (a, b) => vals[(((b % g) + g) % g) * g + (((a % g) + g) % g)];
    return (x, y) => {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return lerp(lerp(v(ix, iy), v(ix + 1, iy), sx), lerp(v(ix, iy + 1), v(ix + 1, iy + 1), sx), sy);
    };
  }

  generate() {
    const N = this.N, r = this.rng, nA = this.noise(7), nB = this.noise(3);
    this.lakes = [{ x: 57, y: 17, r: 9 }, { x: 13, y: 59, r: 6 }];
    this.park = { x: 20, y: 19, r: 13 };
    this.town = { x0: 38, y0: 40, x1: 66, y1: 61 };
    this.spawn = { x: 30, y: 37 };
    const P = this.park, TW = this.town;

    // lakes + park
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let t = T.GRASS;
      for (const L of this.lakes) if (Math.hypot(x - L.x, y - L.y) / L.r + (nB(x, y) - 0.5) * 0.5 < 1) t = T.WATER;
      if (t === T.GRASS && Math.hypot(x - P.x, y - P.y) / P.r + (nA(x, y) - 0.5) * 0.35 < 1) t = T.PARK;
      this.tiles[y * N + x] = t;
    }
    // forest clumps in open fields
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if (this.get(x, y) === T.GRASS && !this.inTown(x, y) && nA(x * 1.7 + 40, y * 1.7 + 40) > 0.64 && r() < 0.55) this.set(x, y, T.TREE);
    // dense forest around the map edge
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.min(x, y, N - 1 - x, N - 1 - y);
      if ((d < 2 || (d < 4 && nB(x, y) > 0.45)) && this.get(x, y) !== T.WATER) this.set(x, y, T.TREE);
    }
    // park trees + ring path + spur paths
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.get(x, y) === T.PARK && r() < 0.11) this.set(x, y, T.TREE);
      if (Math.abs(Math.hypot(x - P.x, y - P.y) - 7) < 0.75) this.set(x, y, T.PATH);
    }
    for (let y = P.y; y <= 34; y++) this.set(P.x, y, T.PATH);
    for (let x = P.x; x <= 34; x++) this.set(x, P.y, T.PATH);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.set(P.x + dx, P.y + dy, T.PATH);
    // main roads
    for (let i = 2; i < N - 2; i++) { this.set(i, 34, T.ROAD); this.set(34, i, T.ROAD); }
    // town grid
    for (let y = TW.y0; y <= TW.y1; y++) for (let x = TW.x0; x <= TW.x1; x++) this.set(x, y, T.GRASS);
    for (let x = TW.x0; x <= TW.x1; x += 7) for (let y = TW.y0; y <= TW.y1; y++) this.set(x, y, T.ROAD);
    for (let y = TW.y0; y <= TW.y1; y += 7) for (let x = TW.x0; x <= TW.x1; x++) this.set(x, y, T.ROAD);
    for (let x = 34; x <= TW.x0; x++) this.set(x, TW.y0, T.ROAD);
    for (let y = 34; y <= TW.y0; y++) this.set(52, y, T.ROAD);
    for (let lx = TW.x0; lx < TW.x1; lx += 7) for (let ly = TW.y0; ly < TW.y1; ly += 7) {
      if (r() < 0.2) { // little plaza with flowers and a tree
        for (let y = ly + 1; y <= ly + 6; y++) for (let x = lx + 1; x <= lx + 6; x++) if (r() < 0.25) this.set(x, y, T.FLOWERS);
        this.set(lx + 3 + (r() * 2 | 0), ly + 3 + (r() * 2 | 0), T.TREE);
        continue;
      }
      const bw = 2 + (r() * 3 | 0), bh = 2 + (r() * 3 | 0);
      const bx = lx + 2 + (r() * (5 - bw) | 0), by = ly + 2 + (r() * (5 - bh) | 0);
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) this.set(x, y, T.BUILDING);
      this.buildings.push({ x: bx, y: by, w: bw, h: bh, color: ROOFS[(r() * ROOFS.length) | 0] });
    }
    // flowers
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = this.get(x, y);
      if ((t === T.GRASS || t === T.PARK) && r() < 0.035) this.set(x, y, T.FLOWERS);
    }
    // sandy shores
    const isWater = (x, y) => this.get(x, y) === T.WATER;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = this.get(x, y);
      if (t === T.WATER || t === T.ROAD) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (isWater(x + dx, y + dy)) { near = true; break; }
      if (near) this.set(x, y, T.SAND);
    }
    // keep the spawn clear
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const t = this.get(this.spawn.x + dx, this.spawn.y + dy);
      if (SOLID[t]) this.set(this.spawn.x + dx, this.spawn.y + dy, T.GRASS);
    }
    // biomes
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let b = 'field', shore = false;
      for (let dy = -3; dy <= 3 && !shore; dy++) for (let dx = -3; dx <= 3; dx++) if (isWater(x + dx, y + dy)) { shore = true; break; }
      if (shore) b = 'shore';
      else if (Math.hypot(x - P.x, y - P.y) < P.r + 1) b = 'park';
      else if (this.inTown(x, y)) b = 'town';
      this.biomes[y * N + x] = b;
    }
    // supply stops
    const pts = [{ x: P.x, y: P.y }, { x: this.spawn.x + 3, y: this.spawn.y - 2 }];
    for (let tries = 0; pts.length < 16 && tries < 4000; tries++) {
      const x = 3 + ((r() * (N - 6)) | 0), y = 3 + ((r() * (N - 6)) | 0);
      const t = this.get(x, y);
      if (SOLID[t] || t === T.ROAD) continue;
      if (pts.some(p => Math.hypot(p.x - x, p.y - y) < 9)) continue;
      pts.push({ x, y });
    }
    this.stopTiles = pts;
  }

  render() {
    const TS = this.TS, N = this.N, r = mulberry32(99), nT = this.noise(4);
    const c = document.createElement('canvas');
    c.width = c.height = this.size;
    const g = c.getContext('2d');
    const groundOf = (x, y) => {
      const t = this.get(x, y);
      if (t === T.WATER) return T.SAND;
      if (t === T.TREE || t === T.FLOWERS || t === T.BUILDING || t === T.ROAD || t === T.PATH)
        return this.biomes[y * N + x] === 'park' ? T.PARK : T.GRASS;
      return t;
    };
    // ground
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const base = groundOf(x, y), [h, s, l] = GROUND_HSL[base];
      g.fillStyle = `hsl(${h},${s}%,${l + (nT(x, y) - 0.5) * 7 + (r() - 0.5) * 1.5}%)`;
      g.fillRect(x * TS, y * TS, TS + 1, TS + 1);
      if (base !== T.SAND && r() < 0.55) {
        g.strokeStyle = `hsla(${h},${s}%,${l - 14}%,.55)`; g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          const px = x * TS + r() * TS, py = y * TS + r() * TS;
          g.beginPath(); g.moveTo(px - 3, py - 4); g.lineTo(px, py); g.lineTo(px + 3, py - 4); g.stroke();
        }
      }
    }
    const each = (type, fn) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.get(x, y) === type) fn(x * TS, y * TS, x, y); };
    const disc = (px, py, rad) => { g.beginPath(); g.arc(px + TS / 2, py + TS / 2, rad, 0, TAU); g.fill(); };
    // dirt paths (rounded)
    const pathPass = rad => each(T.PATH, (px, py, x, y) => {
      disc(px, py, rad);
      // bridge to neighbouring path tiles so the trail reads as one smooth ribbon
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        if (this.get(x + dx, y + dy) !== T.PATH) continue;
        g.save(); g.translate(px + TS / 2, py + TS / 2); g.rotate(Math.atan2(dy, dx));
        g.fillRect(0, -rad, Math.hypot(dx, dy) * TS, rad * 2); g.restore();
      }
    });
    g.fillStyle = '#cdb27a'; pathPass(TS * 0.42);
    g.fillStyle = '#e8d3a0'; pathPass(TS * 0.32);
    // roads (outlined)
    g.fillStyle = '#d6cca2'; each(T.ROAD, (px, py) => g.fillRect(px - 4, py - 4, TS + 8, TS + 8));
    g.fillStyle = '#f7f3df'; each(T.ROAD, (px, py) => g.fillRect(px, py, TS, TS));
    // water (rounded blobs with a foam edge)
    g.fillStyle = '#c6efff'; each(T.WATER, (px, py) => disc(px, py, TS * 0.8));
    g.fillStyle = '#56bdf0'; each(T.WATER, (px, py) => disc(px, py, TS * 0.68));
    g.fillStyle = '#3ea6e2';
    each(T.WATER, (px, py, x, y) => {
      if ([[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]].every(([dx, dy]) => this.get(x + dx, y + dy) === T.WATER)) disc(px, py, TS * 0.62);
    });
    // flowers
    const FL = ['#ff7eb6', '#ffd23f', '#ffffff', '#b28dff', '#ff8a5c'];
    each(T.FLOWERS, (px, py) => {
      for (let k = 0; k < 4; k++) {
        const fx = px + 6 + r() * (TS - 12), fy = py + 6 + r() * (TS - 12);
        g.fillStyle = FL[(r() * FL.length) | 0];
        for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(fx + Math.cos(p * TAU / 5) * 2.6, fy + Math.sin(p * TAU / 5) * 2.6, 2.1, 0, TAU); g.fill(); }
        g.fillStyle = '#ffe680'; g.beginPath(); g.arc(fx, fy, 1.6, 0, TAU); g.fill();
      }
    });
    // buildings
    for (const b of this.buildings) {
      const X = b.x * TS + 3, Y = b.y * TS + 2, W = b.w * TS - 6, H = b.h * TS - 4;
      g.fillStyle = 'rgba(0,0,0,.18)'; rr(g, X + 7, Y + 9, W, H, 8); g.fill();
      g.fillStyle = shade(b.color, -45); rr(g, X, Y + H - 18, W, 18, 6); g.fill();
      g.fillStyle = '#fff3b0';
      for (let wx = X + 8; wx < X + W - 12; wx += 16) g.fillRect(wx, Y + H - 13, 8, 7);
      g.fillStyle = b.color; rr(g, X, Y, W, H - 14, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, X, Y, W, (H - 14) / 2, 8); g.fill();
      g.strokeStyle = shade(b.color, -30); g.lineWidth = 2;
      g.beginPath(); g.moveTo(X + 8, Y + (H - 14) / 2); g.lineTo(X + W - 8, Y + (H - 14) / 2); g.stroke();
      rr(g, X, Y, W, H - 14, 8); g.stroke();
    }
    // trees (row by row so lower ones overlap upper ones)
    each(T.TREE, (px, py) => {
      const cx = px + TS / 2 + (r() - 0.5) * 6, cy = py + TS / 2 + (r() - 0.5) * 6, rad = TS * 0.52 + r() * 5;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(cx + 5, cy + 9, rad, rad * 0.7, 0, 0, TAU); g.fill();
      g.fillStyle = '#367f43'; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
      g.fillStyle = '#48a052';
      for (let k = 0; k < 3; k++) { const a = r() * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * rad * 0.35, cy + Math.sin(a) * rad * 0.35 - 2, rad * 0.62, 0, TAU); g.fill(); }
      g.fillStyle = '#6cc46f'; g.beginPath(); g.arc(cx - rad * 0.3, cy - rad * 0.35, rad * 0.32, 0, TAU); g.fill();
    });
    this.canvas = c;
    const m = document.createElement('canvas');
    m.width = m.height = 300;
    m.getContext('2d').drawImage(c, 0, 0, 300, 300);
    this.mini = m;
  }
}

let instance = null;
export const getWorld = () => (instance ||= new World(1337));
