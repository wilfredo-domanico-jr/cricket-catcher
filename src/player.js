// The trainer: movement, collision and click-to-walk pathfinding.
import { CONFIG } from './config.js';
import { dist, lerp } from './util.js';
import { TRAINER_ORIGIN_Y } from './textures.js';

const FOOTPRINT = [[-9, 0], [9, 0], [0, -6], [0, 5], [-6, -4], [6, -4], [-6, 4], [6, 4]];

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.dir = 1; this.moving = false; this.stuck = 0;
    this.target = null; this.path = [];
    this.sprite = scene.add.sprite(x, y, 'trainer', 8).setOrigin(0.5, TRAINER_ORIGIN_Y);
    this.sprite.play('trainer-idle');
  }
  get world() { return this.scene.world; }

  fits(nx, ny) { return FOOTPRINT.every(([ox, oy]) => this.world.walkable(nx + ox, ny + oy)); }

  clearLine(ax, ay, bx, by) {
    const steps = Math.ceil(dist(ax, ay, bx, by) / 8);
    for (let i = 1; i <= steps; i++) if (!this.fits(lerp(ax, bx, i / steps), lerp(ay, by, i / steps))) return false;
    return true;
  }

  // Walk to (x, y), routing around trees, water and buildings. Returns false if unreachable.
  goTo(x, y) {
    if (this.clearLine(this.x, this.y, x, y)) { this.target = { x, y }; this.path = []; return true; }
    const path = this.world.findPath(this.x, this.y, x, y);
    if (!path) { this.stop(); return false; }
    path[path.length - 1] = { x, y };
    // string-pull: skip waypoints we can already see past
    const out = [];
    let from = { x: this.x, y: this.y };
    for (let i = 0; i < path.length;) {
      let j = path.length - 1;
      while (j > i && !this.clearLine(from.x, from.y, path[j].x, path[j].y)) j--;
      out.push(path[j]); from = path[j]; i = j + 1;
    }
    this.target = { x, y };
    this.path = out;
    return true;
  }

  stop() { this.target = null; this.path = []; }

  // dx/dy come from the keyboard; returns distance moved this frame.
  update(dt, dx, dy) {
    if (dx || dy) this.stop();
    else if (this.target) {
      while (this.path.length > 1 && dist(this.x, this.y, this.path[0].x, this.path[0].y) < 6) this.path.shift();
      const wp = this.path[0] || this.target;
      const d = dist(this.x, this.y, wp.x, wp.y);
      if (d < 4) { if (this.path.length) this.path.shift(); else this.stop(); }
      else { dx = (wp.x - this.x) / d; dy = (wp.y - this.y) / d; }
    }
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    let moved = 0;
    if (this.moving) {
      dx /= len; dy /= len;
      if (Math.abs(dx) > 0.15) this.dir = dx > 0 ? 1 : -1;
      const step = CONFIG.PLAYER_SPEED * dt, ox = this.x, oy = this.y;
      if (this.fits(this.x + dx * step, this.y)) this.x += dx * step;
      if (this.fits(this.x, this.y + dy * step)) this.y += dy * step;
      moved = Math.hypot(this.x - ox, this.y - oy);
      if (moved < step * 0.2) { this.stuck += dt; if (this.stuck > 0.25) this.stop(); }
      else this.stuck = 0;
    }
    this.sync();
    return moved;
  }

  sync() {
    const s = this.sprite;
    s.setPosition(this.x, this.y).setDepth(this.y + 10).setFlipX(this.dir < 0);
    const key = this.moving ? 'trainer-walk' : 'trainer-idle';
    if (s.anims.currentAnim?.key !== key) s.play(key);
  }
}
