// Reusable Phaser UI pieces: text, pills, buttons, toasts.
import { FONT } from './config.js';

export function text(scene, x, y, str, size = 16, color = '#1f2937', weight = '800', extra = {}) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color, resolution: 2, ...extra,
  });
}

// Rounded rectangle centred on (0,0) inside a container.
export function pill(scene, w, h, fill = 0xffffff, alpha = 0.95, radius = h / 2) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.16).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  return g;
}

// A clickable rounded button. Returns the container; `container.label` is the text.
export function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const { fill = 0xffffff, color = '#1f2937', size = 15, icon = null } = opts;
  const c = scene.add.container(x, y);
  const bg = pill(scene, w, h, fill, 0.97);
  c.add(bg);
  let tx = 0;
  if (icon) {
    const img = scene.add.image(-w / 2 + h / 2 + 2, 0, icon).setDisplaySize(h - 10, h - 10);
    c.add(img); c.icon = img;
    tx = h / 2 - 4;
  }
  const t = text(scene, tx, 0, label, size, color, '800').setOrigin(0.5);
  c.add(t); c.label = t;
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => scene.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
  c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 100 }));
  c.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation(); scene.tweens.add({ targets: c, scale: 0.95, duration: 60, yoyo: true }); onClick(); });
  return c;
}

// Stack of fading notifications at the top centre of the screen.
export class Toaster {
  constructor(scene, x, y) { this.scene = scene; this.x = x; this.y = y; this.items = []; }
  show(msg, kind = '') {
    if (!msg) return;
    const s = this.scene;
    const fill = kind === 'good' ? 0x0f9f8f : kind === 'gold' ? 0xe0592a : 0x0f172a;
    const t = text(s, 0, 0, msg, 16, '#ffffff', '800').setOrigin(0.5);
    const w = t.width + 40;
    const c = s.add.container(this.x, this.y).setDepth(1000);
    c.add([pill(s, w, 38, fill, 0.92), t]);
    c.setAlpha(0).setScale(0.9);
    this.items.push(c);
    if (this.items.length > 4) this.drop(this.items[0]);
    this.layout();
    s.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    s.time.delayedCall(2500, () => this.drop(c));
  }
  drop(c) {
    if (!this.items.includes(c)) return;
    this.items = this.items.filter(i => i !== c);
    this.scene.tweens.add({ targets: c, alpha: 0, y: c.y - 12, duration: 300, onComplete: () => c.destroy() });
    this.layout();
  }
  layout() {
    this.items.forEach((c, i) => this.scene.tweens.add({ targets: c, y: this.y + i * 46, duration: 180 }));
  }
}

// Opaque rounded rect without seams: Phaser's fillRoundedRect can leave a 1px gap
// between its corner arcs and straight edges in WebGL, so fill the interior with plain rects too.
export function solidRoundRect(g, x, y, w, h, r, color) {
  g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, r);
  g.fillRect(x, y + r, w, h - 2 * r).fillRect(x + r, y, w - 2 * r, h);
  return g;
}
