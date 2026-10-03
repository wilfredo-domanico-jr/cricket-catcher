import { CONFIG, GEMS, RARITY, TYPE_COLORS, TOUCH } from '../config.js';
import { SPECIES, SPECIES_BY_ID } from '../species.js';
import { save, persist, xpNeeded, isNight } from '../state.js';
import { Sound, setMuted } from '../sound.js';
import { text, pill, button, Toaster, solidRoundRect } from '../ui.js';
import { hexInt } from '../util.js';

let W, H; // current game size, read in create()
const MM = 150; // minimap size

// Explore HUD (trainer card, gem bag, minimap, toasts) and the Field Journal.
export default class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    ({ WIDTH: W, HEIGHT: H } = CONFIG);
    this.worldScene = this.scene.get('World');
    this.zones = [];
    this.journalOpen = false;

    this.buildTrainerCard();
    this.buildButtons();
    this.buildBag();
    this.buildMinimap();
    this.stats = this.add.container(14, H - 82);
    this.statsBg = this.add.graphics();
    this.statsText = text(this, 14, 0, '', 13, '#334155', '800').setOrigin(0, 0.5);
    this.stats.add([this.statsBg, this.statsText]);
    // Keyboard hint along the bottom, only where it fits between the gem bag and the minimap.
    if (!TOUCH && W >= 1100) {
      const help = text(this, W / 2, H - 24, 'WASD / arrows or click to walk · click critters & stops', 12, '#ffffff', '700').setOrigin(0.5);
      this.add.graphics().fillStyle(0x0f172a, 0.55).fillRoundedRect(W / 2 - help.width / 2 - 14, H - 38, help.width + 28, 28, 14);
      help.setDepth(1);
    }

    this.toaster = new Toaster(this, W / 2, 96);
    this.game.events.on('toast', this.toaster.show, this.toaster);
    this.game.events.on('gems', this.bumpBag, this);
    this.events.once('shutdown', () => {
      this.game.events.off('toast', this.toaster.show, this.toaster);
      this.game.events.off('gems', this.bumpBag, this);
    });
    this.input.keyboard.on('keydown-ESC', () => this.closeJournal());
    this.input.keyboard.on('keydown-J', () => (this.journalOpen ? this.closeJournal() : this.openJournal()));
    this.refreshTimer = 0;
    this.refresh();
  }

  // Screen-space rectangles the world scene should not treat as map clicks.
  blocks(x, y) {
    if (!this.sys.isActive() && !this.sys.isSleeping()) return false;
    return this.journalOpen || this.zones.some(r => r.contains(x, y));
  }
  zone(x, y, w, h) { this.zones.push(new Phaser.Geom.Rectangle(x, y, w, h)); }

  // ---------------------------------------------------------------- HUD pieces
  buildTrainerCard() {
    const x = 14, y = 14, w = 280, h = 60;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.16).fillRoundedRect(x, y + 4, w, h, h / 2);
    g.fillStyle(0xffffff, 0.95).fillRoundedRect(x, y, w, h, h / 2);
    g.fillStyle(0x2aa7c9, 1).fillCircle(x + 30, y + 30, 23);
    g.lineStyle(3, 0xffffff, 1).strokeCircle(x + 30, y + 30, 23);
    text(this, x + 30, y + 19, 'LV', 9, '#ffffff', '900').setOrigin(0.5);
    this.lvlText = text(this, x + 30, y + 34, '1', 19, '#ffffff', '900').setOrigin(0.5);
    text(this, x + 64, y + 13, 'Trainer', 12, '#334155', '800');
    this.xpText = text(this, x + w - 18, y + 13, '', 12, '#334155', '800').setOrigin(1, 0);
    this.xpBar = this.add.graphics();
    this.xpBarRect = { x: x + 64, y: y + 35, w: w - 82, h: 10 };
    this.zone(x, y, w, h);
  }

  buildButtons() {
    button(this, W - 14 - 74, 38, 148, 44, '📖 Journal', () => { Sound.play('click'); this.openJournal(); });
    this.muteBtn = button(this, W - 14 - 74 - 104, 38, 44, 44, save.muted ? '🔇' : '🔊', () => {
      save.muted = !save.muted;
      setMuted(this, save.muted);
      this.muteBtn.label.setText(save.muted ? '🔇' : '🔊');
      persist();
    }, { size: 18 });
    this.zone(W - 14 - 148 - 60, 14, 208, 50);
  }

  buildBag() {
    this.chips = {};
    GEMS.forEach((g, i) => {
      const x = 14 + 52 + i * 112, y = H - 34;
      const c = this.add.container(x, y);
      const icon = this.add.image(-30, 0, `gem-${g.id}`).setScale(0.4);
      const count = text(this, 4, 0, '0', 17, '#1f2937', '900').setOrigin(0, 0.5);
      c.add([pill(this, 104, 44), icon, count]);
      this.chips[g.id] = { c, count };
    });
    this.zone(14, H - 58, 340, 50);
  }

  bumpBag(got) {
    for (const g of GEMS) if (got[g.id]) this.tweens.add({ targets: this.chips[g.id].c, scale: 1.18, duration: 140, yoyo: true });
  }

  buildMinimap() {
    const x = W - 14 - MM, y = H - 14 - MM;
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.25).fillRoundedRect(x - 4, y, MM + 8, MM + 8, 24);
    solidRoundRect(frame, x - 4, y - 4, MM + 8, MM + 8, 24, 0xffffff);
    const maskShape = this.make.graphics({ add: false }).fillStyle(0xffffff).fillRoundedRect(x, y, MM, MM, 20);
    const mask = maskShape.createGeometryMask();
    this.add.image(x, y, 'mini').setOrigin(0).setDisplaySize(MM, MM).setMask(mask);
    this.mm = this.add.graphics().setMask(mask);
    this.mmPos = { x, y };
    this.zone(x - 4, y - 4, MM + 8, MM + 8);
  }

  drawMinimap(time) {
    const ws = this.worldScene, g = this.mm, { x, y } = this.mmPos, k = MM / ws.world.size;
    const cam = ws.cameras.main, p = ws.player;
    g.clear();
    g.lineStyle(1.5, 0xffffff, 0.9).strokeRect(x + cam.scrollX * k, y + cam.scrollY * k, cam.width * k, cam.height * k);
    const now = Date.now();
    for (const s of ws.stops) g.fillStyle(now >= s.ready ? 0x22b8f0 : 0xa855f7, 1).fillRect(x + s.x * k - 2.5, y + s.y * k - 2.5, 5, 5);
    for (const c of ws.critters) g.fillStyle(hexInt(TYPE_COLORS[c.sp.type]), 1).fillCircle(x + c.x * k, y + c.y * k, 2.4);
    const pulse = 3.5 + Math.sin(time / 200) * 1.2;
    g.fillStyle(0xef4444, 0.35).fillCircle(x + p.x * k, y + p.y * k, pulse + 3);
    g.fillStyle(0xef4444, 1).fillCircle(x + p.x * k, y + p.y * k, 3.5);
    g.lineStyle(1.5, 0xffffff, 1).strokeCircle(x + p.x * k, y + p.y * k, 3.5);
  }

  refresh() {
    this.lvlText.setText(String(save.level));
    const need = xpNeeded(save.level);
    this.xpText.setText(`${save.xp} / ${need} XP`);
    const b = this.xpBarRect;
    this.xpBar.clear()
      .fillStyle(0xe2e8f0, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 5)
      .fillStyle(0x2aa7c9, 1).fillRoundedRect(b.x, b.y, Math.max(b.h, (b.w * save.xp) / need), b.h, 5);
    for (const g of GEMS) {
      const n = save.gems[g.id];
      this.chips[g.id].count.setText(String(n));
      this.chips[g.id].c.setAlpha(n > 0 ? 1 : 0.45);
    }
    const caughtSpecies = SPECIES.filter(s => save.journal[s.id]?.caught).length;
    this.statsText.setText(`🚶 ${(save.dist / 4000).toFixed(2)} km  ·  ${isNight() ? '🌙 Night' : '☀️ Day'}  ·  📖 ${caughtSpecies}/${SPECIES.length}`);
    const w = this.statsText.width + 28;
    this.statsBg.clear().fillStyle(0x000000, 0.12).fillRoundedRect(0, -14, w, 32, 16).fillStyle(0xffffff, 0.9).fillRoundedRect(0, -16, w, 32, 16);
  }

  update(time, delta) {
    if ((this.refreshTimer += delta) > 250) { this.refreshTimer = 0; this.refresh(); }
    this.drawMinimap(time);
  }

  // ---------------------------------------------------------------- Field Journal
  openJournal() {
    if (this.journalOpen) return;
    this.journalOpen = true;
    this.worldScene.player.stop();
    const c = this.journal = this.add.container(0, 0).setDepth(500);
    const dim = this.add.rectangle(0, 0, W, H, 0x0a1423, 0.55).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.closeJournal());
    c.add(dim);

    // 4 species columns on wide screens, 3 on narrow (portrait) ones; the panel grows to fit.
    const cw = 178, ch = 176, gap = 12, cols = W >= 880 ? 4 : 3, rows = Math.ceil(SPECIES.length / cols);
    const mineCols = cols === 4 ? 3 : 2, mineRows = Math.ceil(6 / mineCols);
    const pw = cols === 4 ? 820 : 600, ph = 94 + rows * (ch + gap) + 6 + 32 + mineRows * 50 + 10;
    const px = (W - pw) / 2, py = Math.max(10, (H - ph) / 2);
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.25).fillRoundedRect(px, py + 10, pw, ph, 26);
    solidRoundRect(panel, px, py, pw, ph, 26, 0xffffff);
    const blocker = this.add.zone(px, py, pw, ph).setOrigin(0).setInteractive(); // swallow clicks on the panel
    c.add([panel, blocker]);

    const caughtSpecies = SPECIES.filter(s => save.journal[s.id]?.caught).length;
    c.add(text(this, px + 28, py + 22, 'Field Journal', 30, '#0f172a', '900'));
    c.add(text(this, px + 30, py + 62, `${caughtSpecies} / ${SPECIES.length} species caught`, 14, '#64748b', '700'));
    c.add(button(this, px + pw - 44, py + 42, 44, 44, '✕', () => this.closeJournal(), { size: 18, fill: 0xf1f5f9 }));

    const gx = px + (pw - (cw * cols + gap * (cols - 1))) / 2, gy = py + 94;
    SPECIES.forEach((sp, i) => {
      const d = save.journal[sp.id] || { seen: 0, caught: 0 };
      const mode = d.caught ? 'caught' : d.seen ? 'seen' : 'unseen';
      const x = gx + (i % cols) * (cw + gap), y = gy + Math.floor(i / cols) * (ch + gap);
      const card = this.add.graphics();
      solidRoundRect(card, x, y, cw, ch, 18, mode === 'caught' ? 0xecfdf5 : 0xf1f5f9);
      if (mode === 'caught') card.lineStyle(2, 0xa7f3d0, 1).strokeRoundedRect(x, y, cw, ch, 18);
      const img = this.add.image(x + cw / 2, y + 70, `portrait-${sp.id}`).setScale(0.68);
      if (mode !== 'caught') img.setTintFill(mode === 'seen' ? 0x94a3b8 : 0x1e293b);
      c.add([card, img,
        text(this, x + 12, y + 10, `#${String(i + 1).padStart(3, '0')}`, 11, '#94a3b8', '800'),
        text(this, x + cw / 2, y + 128, mode === 'unseen' ? '???' : sp.name, 15, mode === 'unseen' ? '#94a3b8' : '#0f172a', '900').setOrigin(0.5),
        text(this, x + cw / 2, y + 147, mode === 'caught' ? `Caught ×${d.caught}` : mode === 'seen' ? `Seen ×${d.seen}` : sp.rarity === 'legendary' ? 'Legendary' : '—', 11, '#64748b', '700').setOrigin(0.5),
      ]);
      if (mode !== 'unseen') c.add(this.badge(x + cw - 14, y + 16, sp.type, 1, 0));
    });

    const ly = gy + rows * (ch + gap) + 6;
    c.add(text(this, px + 30, ly, `My Critters (${save.caught.length})`, 18, '#0f172a', '900'));
    const mine = [...save.caught].sort((a, b) => b.power - a.power).slice(0, 6);
    if (!mine.length) c.add(text(this, px + 30, ly + 34, 'No critters yet — go catch some!', 14, '#94a3b8', '700'));
    mine.forEach((m, i) => {
      const sp = SPECIES_BY_ID[m.id];
      if (!sp) return;
      const x = px + (pw - mineCols * 256 + 12) / 2 + (i % mineCols) * 256, y = ly + 32 + Math.floor(i / mineCols) * 50;
      const row = solidRoundRect(this.add.graphics(), x, y, 244, 42, 14, 0xf8fafc);
      c.add([row, this.add.image(x + 24, y + 21, `portrait-${sp.id}`).setScale(0.24),
        text(this, x + 48, y + 21, sp.name, 14, '#0f172a', '900').setOrigin(0, 0.5),
        text(this, x + 232, y + 21, `PWR ${m.power}`, 14, '#2a7fc9', '900').setOrigin(1, 0.5)]);
    });

    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  }

  badge(x, y, type, ox = 0.5, oy = 0.5) {
    const t = text(this, 0, 0, type.toUpperCase(), 10, '#ffffff', '900').setOrigin(0.5);
    const w = t.width + 16, b = this.add.container(x - (ox - 0.5) * w, y - (oy - 0.5) * 20);
    const g = this.add.graphics().fillStyle(hexInt(TYPE_COLORS[type]), 1).fillRoundedRect(-w / 2, -10, w, 20, 10);
    b.add([g, t]);
    return b;
  }

  closeJournal() {
    if (!this.journalOpen) return;
    const c = this.journal;
    this.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() });
    this.time.delayedCall(50, () => { this.journalOpen = false; });
  }
}
