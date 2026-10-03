import { CONFIG, GEMS, GEM_BY_ID, RARITY, THROW_BONUS, TYPE_COLORS } from '../config.js';
import { save, persist, journalEntry, darkness } from '../state.js';
import { Sound, MUSIC_VOLUME, fadeMusic } from '../sound.js';
import { drawCritter, sparkle } from '../art.js';
import { text, pill, button, solidRoundRect } from '../ui.js';
import { TAU, clamp, dist, lerp, easeOutBack, easeOutBounce, mulberry32, hexInt } from '../util.js';

// Encounter layout, recomputed in create() for the current game size (landscape or portrait).
const R = 95, SCALE = R / 40;
let W, H, CX, CY, HEAD_Y, GROUND_Y, REST_X, REST_Y;
function layout() {
  ({ WIDTH: W, HEIGHT: H } = CONFIG);
  CX = W / 2; CY = Math.round(H * 0.42);
  HEAD_Y = Math.max(62, CY - 238); // header baseline: above the critter, never off-screen
  GROUND_Y = CY + 44 * SCALE;
  REST_X = W / 2; REST_Y = Math.min(H - 100, CY + 560);
}
const GEM_R = 30;            // on-screen gem radius at full size
const TEX_W = 420, TEX_H = 380, TEX_CX = 210, TEX_CY = 215; // live critter canvas
const WOBBLE_T = 0.95;

// Catch screen: flick a gem at the critter, land it in the ring, watch it pulse.
export default class EncounterScene extends Phaser.Scene {
  constructor() { super('Encounter'); }

  init(data) {
    this.c = data.critter;
    this.sp = data.critter.sp;
    this.biome = data.biome;
  }

  create() {
    layout();
    // Phaser reuses this scene instance for every encounter, so reset all per-encounter state here.
    this.finished = false; this.resultShown = false;
    this.bonus = null; this.fly = null; this.xpLines = null; this.xpTotal = 0;
    this.t = 0; this.stT = 0; this.state = 'intro';
    this.ringPhase = 0; this.ballScale = 1; this.critterScale = 0;
    this.gemType = GEMS.find(g => save.gems[g.id] > 0)?.id || 'spark';
    this.gemUsed = this.gemType;
    this.samples = [];
    journalEntry(this.sp.id).seen++;

    this.drawBackground();
    this.clouds = [0, 1, 2].map(i => this.add.image(Math.random() * W, GROUND_Y - 344 + i * 55, 'cloud')
      .setAlpha(Math.max(0, 0.9 - darkness() * 1.5)).setData('speed', 10 + i * 6));

    this.platform = this.add.graphics();
    this.platform.fillStyle(0xffffff, 0.28).fillEllipse(CX, GROUND_Y, R * 3.6, R * 0.8);
    this.shadow = this.add.graphics();

    // The critter is redrawn every frame into a canvas texture shown by a Phaser Image.
    this.critterTex = this.textures.exists('encCritter') ? this.textures.get('encCritter') : this.textures.createCanvas('encCritter', TEX_W, TEX_H);
    this.critter = this.add.image(CX, CY, 'encCritter').setOrigin(TEX_CX / TEX_W, TEX_CY / TEX_H).setScale(0);
    this.flash = this.add.graphics();
    this.ringG = this.add.graphics();
    this.gemShadow = this.add.graphics();
    this.gem = this.add.image(REST_X, REST_Y, `gem-${this.gemType}`);
    this.pulse = this.add.graphics();

    this.hitFx = this.add.particles(0, 0, 'spark', { speed: { min: 80, max: 260 }, lifespan: 600, scale: { start: 1, end: 0 }, tint: [0xffffff, 0xfff7c2, 0xbfefff], emitting: false });
    this.catchFx = this.add.particles(0, 0, 'spark', { speed: { min: 120, max: 340 }, gravityY: 120, lifespan: { min: 700, max: 1300 }, scale: { start: 1.6, end: 0 }, tint: [0xffe066, 0xfff7c2, 0xffffff, 0x7fe3ff], emitting: false });
    this.shardFx = this.add.particles(0, 0, 'shard', { speed: { min: 100, max: 320 }, gravityY: 400, lifespan: { min: 500, max: 900 }, rotate: { min: 0, max: 360 }, scale: { start: 1.2, end: 0.2 }, emitting: false });

    const dk = darkness();
    if (dk > 0) this.add.rectangle(0, 0, W, H, 0x0f143c, dk * 0.45).setOrigin(0);

    // Header
    const shadow = { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,.35)', blur: 8, fill: true };
    text(this, CX - 6, HEAD_Y - 4, 'PWR', 18, '#ffffff', '900', { shadow }).setOrigin(1, 1);
    text(this, CX, HEAD_Y, String(this.c.power), 36, '#ffffff', '900', { shadow }).setOrigin(0, 1);
    text(this, CX, HEAD_Y + 30, this.sp.name, 25, '#ffffff', '900', { shadow }).setOrigin(0.5);
    if (this.sp.rarity !== 'common') {
      const col = { uncommon: '#e2e8f0', rare: '#a5f3fc', legendary: '#fde047' }[this.sp.rarity];
      text(this, CX, HEAD_Y + 60, `★ ${RARITY[this.sp.rarity].label.toUpperCase()} ★`, 14, col, '900', { stroke: '#1e293b', strokeThickness: 4 }).setOrigin(0.5);
    }
    this.msg = text(this, CX, 0, '', 34, '#ffffff', '900', { stroke: '#1e1e3c', strokeThickness: 7 }).setOrigin(0.5).setAlpha(0).setDepth(50);
    this.hint = text(this, CX, REST_Y - 62, 'Drag the gem and flick it up at the critter!', 16, '#ffffff', '800', { shadow }).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });

    button(this, 70, 38, 112, 44, '🏃 Run', () => this.run());
    this.gemBtn = button(this, W - 120, H - 44, 210, 52, '', () => this.cycleGem(), { icon: `gem-${this.gemType}`, size: 15 });
    this.updateGemButton();

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.keyboard.on('keydown-ESC', () => this.run());

    this.cameras.main.fadeIn(350, 255, 255, 255);
    fadeMusic(this, MUSIC_VOLUME * 0.45); // quieter while catching; WorldScene restores it
  }

  drawBackground() {
    const key = 'encBg';
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      if (src.width !== W || src.height !== H) this.textures.remove(key); // screen size changed
    }
    const tex = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, W, H);
    const ctx = tex.getContext(), rng = mulberry32((Math.random() * 1e9) | 0);
    const hz = GROUND_Y - 44, dk = darkness(), b = this.biome;
    ctx.clearRect(0, 0, W, H);
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#6ec3f5'); g.addColorStop(1, '#e3f6ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
    if (dk > 0) {
      ctx.globalAlpha = dk / 0.6;
      g = ctx.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, '#0f1638'); g.addColorStop(1, '#3b4a80');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
      for (let i = 0; i < 40; i++) sparkle(ctx, rng() * W, rng() * hz * 0.8, 1.5 + rng() * 2.5, '#fff');
      ctx.globalAlpha = 1;
    }
    const deco = Array.from({ length: 14 }, () => ({ x: rng(), h: rng(), w: rng() }));
    if (b === 'shore') {
      ctx.fillStyle = '#4fb7ea'; ctx.fillRect(0, hz - 34, W, 36);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const x = rng() * W, y = hz - 26 + rng() * 20; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke(); }
    } else if (b === 'town') {
      for (const d of deco) {
        const w = 50 + d.w * 70, h = 50 + d.h * 110, x = d.x * W - w / 2;
        ctx.fillStyle = '#b6c3d9'; ctx.fillRect(x, hz - h, w, h + 2);
        ctx.fillStyle = 'rgba(255,248,200,.8)';
        for (let wy = hz - h + 10; wy < hz - 12; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 16) ctx.fillRect(wx, wy, 7, 9);
      }
    } else {
      ctx.fillStyle = b === 'park' ? '#3f8f4c' : '#7fbf73';
      for (const d of deco) {
        const r = b === 'park' ? 28 + d.w * 30 : 80 + d.w * 120;
        ctx.beginPath(); ctx.arc(d.x * W, hz + (b === 'park' ? -r * 0.6 : 10), r, 0, TAU); ctx.fill();
      }
    }
    const GROUND = { field: ['#a6e293', '#6fbf68'], park: ['#8fd884', '#4fa85a'], shore: ['#f6e9b8', '#e0cc84'], town: ['#b0dfa0', '#76bc6c'] };
    const [g0, g1] = GROUND[b] || GROUND.field;
    g = ctx.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, g0); g.addColorStop(1, g1);
    ctx.fillStyle = g; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = b === 'shore' ? 'rgba(160,130,60,.35)' : 'rgba(40,110,50,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = rng() * W, y = hz + 10 + rng() * (H - hz - 10), s = 4 + rng() * 6 * (y / H);
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x, y); ctx.lineTo(x + s, y - s * 1.2); ctx.stroke();
    }
    tex.refresh();
    this.add.image(0, 0, key).setOrigin(0);
  }

  // ---------------------------------------------------------------- Helpers
  setState(s) { this.state = s; this.stT = 0; }

  say(msg, color = '#ffffff') {
    this.tweens.killTweensOf(this.msg);
    this.msg.setText(msg).setColor(color).setAlpha(1).setY(CY - R * 1.6);
    this.tweens.add({ targets: this.msg, y: CY - R * 1.6 - 26, alpha: 0, delay: 700, duration: 900 });
  }

  ringRadius() { return R * (1.15 - 0.85 * this.ringPhase); }

  catchProb(gemId, ringMult = 1) {
    const base = RARITY[this.sp.rarity].catchRate * (1 - 0.35 * this.c.powerPct);
    return 1 - Math.pow(1 - base, GEM_BY_ID[gemId].mult * ringMult);
  }

  ensureGem() {
    if (save.gems[this.gemType] > 0) return true;
    const g = GEMS.find(g => save.gems[g.id] > 0);
    if (!g) return false;
    this.gemType = g.id; this.updateGemButton();
    return true;
  }

  updateGemButton() {
    const g = GEM_BY_ID[this.gemType];
    this.gemBtn.label.setText(`${g.name} ×${save.gems[g.id]}`);
    this.gemBtn.icon.setTexture(`gem-${g.id}`).setDisplaySize(42, 42);
    if (this.state === 'ready' || this.state === 'intro') this.gem.setTexture(`gem-${g.id}`);
  }

  cycleGem() {
    if (this.state !== 'ready' && this.state !== 'intro') return;
    const avail = GEMS.filter(g => save.gems[g.id] > 0);
    if (!avail.length) { this.say('Out of gems!', '#fecaca'); return; }
    const i = avail.findIndex(g => g.id === this.gemType);
    this.gemType = avail[(i + 1) % avail.length].id;
    Sound.play('click');
    this.updateGemButton();
  }

  run() {
    if (['ready', 'intro', 'drag'].includes(this.state)) this.finish('ran');
  }

  readyAgain() {
    this.gem.setVisible(true).setAlpha(1).setRotation(0).clearTint();
    this.ballScale = 1;
    this.setState('ready');
    this.gem.setTexture(`gem-${this.gemType}`);
    if (!this.ensureGem()) this.say('Out of gems! Spin a Supply Stop.', '#fecaca');
  }

  // ---------------------------------------------------------------- Input
  onDown(p) {
    if (this.state !== 'ready' || dist(p.x, p.y, REST_X, REST_Y) > 80) return;
    if (!this.ensureGem()) { this.say('Out of gems! Spin a Supply Stop.', '#fecaca'); return; }
    this.setState('drag');
    this.samples = [{ x: p.x, y: p.y, t: performance.now() }];
  }

  onMove(p) {
    if (this.state !== 'drag') return;
    this.gem.setPosition(p.x, p.y);
    const now = performance.now();
    this.samples.push({ x: p.x, y: p.y, t: now });
    while (this.samples.length > 2 && now - this.samples[0].t > 110) this.samples.shift();
  }

  onUp(p) {
    if (this.state !== 'drag') return;
    this.onMove(p);
    const a = this.samples[0], b = this.samples[this.samples.length - 1];
    const dt = Math.max((b.t - a.t) / 1000, 0.016);
    this.throwGem((b.x - a.x) / dt, (b.y - a.y) / dt, p.x, p.y);
  }

  // Flick speed decides reach; flick direction decides where it lands.
  throwGem(vx, vy, x, y) {
    const s = -vy;
    if (s < 260 || y < CY + R || !this.ensureGem()) { this.setState('ready'); return; }
    save.gems[this.gemType]--;
    save.throws++;
    this.gemUsed = this.gemType;
    this.updateGemButton();
    const need = (y - CY) * 2.4;
    const reach = s / Math.max(need, 200);
    const ax = x + (vx / s) * (y - CY);
    let pEnd = 1, short = false, over = false;
    if (reach < 0.7) { pEnd = Math.max(0.3, (reach / 0.7) * 0.8); short = true; }
    else if (reach > 4.2) { pEnd = 1.35; over = true; }
    const hit = !short && !over && Math.abs(ax - CX) < R * 0.95;
    this.fly = { sx: x, sy: y, ax, pEnd, dur: 0.6, arc: H * 0.13, spin: (vx / s) * 10 + 9, hit, short, over };
    this.hint.setVisible(save.throws < 3);
    this.setState('fly');
    Sound.play('throw');
  }

  // ---------------------------------------------------------------- Outcomes
  onHit() {
    const f = this.fly, ringR = this.ringRadius();
    let bonus = null;
    if (Math.abs(f.ax - CX) < ringR) {
      const q = ringR / R;
      bonus = q < 0.45 ? 'Perfect!' : q < 0.8 ? 'Great!' : 'Nice!';
    }
    this.bonus = bonus;
    const p = this.catchProb(this.gemUsed, bonus ? THROW_BONUS[bonus].mult : 1);
    const perPulse = Math.pow(p, 1 / 3);
    let n = 0;
    while (n < 3 && Math.random() < perPulse) n++;
    this.willCatch = n === 3;
    this.pulses = n;
    this.lastPulse = -1;
    if (bonus) this.say(bonus, '#fde047');
    this.hitFx.explode(18, this.gem.x, this.gem.y);
    this.critter.setTintFill(0xffffff);
    Sound.play('hit');
    this.setState('absorb');
  }

  breakOut() {
    this.setState('break');
    const g = GEM_BY_ID[this.gemUsed];
    this.shardFx.setParticleTint(hexInt(g.mid));
    this.shardFx.explode(18, this.gem.x, this.gem.y);
    this.hitFx.explode(10, this.gem.x, this.gem.y);
    this.gem.setVisible(false);
    this.critter.clearTint();
    this.say(['Oh no! It broke free!', 'Aww! It broke free!', 'Argh! Almost had it!'][this.pulses] || 'It broke free!');
    Sound.play('break');
  }

  caught() {
    this.setState('caught');
    const sp = this.sp, d = journalEntry(sp.id), first = d.caught === 0;
    d.caught++;
    save.caught.push({ id: sp.id, power: this.c.power, t: Date.now() });
    if (save.caught.length > 500) save.caught.shift();
    const lines = [['Caught!', 100]];
    if (RARITY[sp.rarity].xp) lines.push([`${RARITY[sp.rarity].label} critter`, RARITY[sp.rarity].xp]);
    if (this.bonus) lines.push([`${this.bonus.replace('!', '')} throw`, THROW_BONUS[this.bonus].xp]);
    if (first) lines.push(['New Field Journal entry!', 500]);
    this.xpLines = lines;
    this.gem.setTint(0xfff1b8);
    this.tweens.add({ targets: this.gem, scale: this.gem.scale * 1.25, duration: 160, yoyo: true });
    this.catchFx.explode(36, this.gem.x, this.gem.y);
    Sound.play('caught');
    persist();
  }

  showResult() {
    const sp = this.sp, total = this.xpLines.reduce((a, l) => a + l[1], 0);
    this.xpTotal = total;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x0a1423, 0.55).setOrigin(0).setInteractive();
    const pw = 420, ph = 550, px = CX - pw / 2, py = H / 2 - ph / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.25).fillRoundedRect(px, py + 10, pw, ph, 26);
    solidRoundRect(panel, px, py, pw, ph, 26, 0xffffff);
    const glow = this.add.graphics();
    glow.fillStyle(hexInt(TYPE_COLORS[sp.type]), 0.18).fillCircle(CX, py + 170, 110);
    const title = text(this, CX, py + 46, 'Caught!', 42, '#000', '900').setOrigin(0.5);
    const grad = title.context.createLinearGradient(0, 0, title.width, 0);
    grad.addColorStop(0, '#f59e0b'); grad.addColorStop(1, '#ec4899');
    title.setFill(grad);
    c.add([dim, panel, glow, title]);
    const ty = py + 300;
    c.add(text(this, CX, ty, sp.name, 28, '#0f172a', '900').setOrigin(0.5));
    c.add(text(this, CX, ty + 34, `PWR ${this.c.power}  ·  ${sp.type.toUpperCase()}`, 15, TYPE_COLORS[sp.type], '900').setOrigin(0.5));
    this.xpLines.forEach(([l, v], i) => c.add(text(this, CX, ty + 70 + i * 22, `${l}  +${v} XP`, 14, '#0f766e', '800').setOrigin(0.5)));
    c.add(text(this, CX, ty + 70 + this.xpLines.length * 22 + 4, `Total +${total} XP`, 16, '#1d4ed8', '900').setOrigin(0.5));
    c.add(button(this, CX, py + ph - 44, 160, 50, 'OK', () => this.finish('caught'), { fill: 0x2aa7c9, color: '#ffffff', size: 18 }));
    // The live critter image hops onto the card.
    this.critter.setDepth(101).clearTint().setAlpha(1).setPosition(CX, py + 190).setScale(0);
    this.tweens.add({ targets: this.critter, scale: 0.62, duration: 450, ease: 'Back.Out' });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.resultShown = true;
  }

  finish(outcome) {
    if (this.finished) return;
    this.finished = true;
    persist();
    this.scene.wake('UI');
    this.scene.wake('World', { outcome, critter: this.c, xp: outcome === 'caught' ? this.xpTotal : 0 });
    this.scene.stop();
  }

  // ---------------------------------------------------------------- Loop
  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt; this.stT += dt;
    for (const cl of this.clouds) { cl.x += cl.getData('speed') * dt; if (cl.x > W + 90) cl.x = -90; }
    this.ringPhase = (this.ringPhase + dt / 1.7) % 1;

    switch (this.state) {
      case 'intro':
        this.critterScale = easeOutBack(clamp(this.stT / 0.5, 0, 1));
        if (this.stT > 0.5) this.readyAgain();
        break;
      case 'ready':
        this.critterScale = 1;
        this.gem.setPosition(REST_X, REST_Y + Math.sin(this.t * 3) * 3).setRotation(Math.sin(this.t * 2) * 0.12);
        this.ballScale = 1;
        break;
      case 'fly': {
        const f = this.fly, u = clamp(this.stT / f.dur, 0, 1), p = u * f.pEnd;
        this.gem.setPosition(f.sx + (f.ax - f.sx) * p, f.sy + (CY - f.sy) * p - f.arc * 4 * u * (1 - u));
        this.ballScale = 1 - 0.32 * Math.min(p, 1.3);
        this.gem.rotation += dt * f.spin;
        if (u >= 1) {
          if (f.hit) this.onHit();
          else {
            this.setState('miss');
            this.missV = { vx: (f.ax - f.sx) * 0.4, vy: f.over ? -120 : -40 };
            this.say(f.short ? 'Too short!' : f.over ? 'Too far!' : 'Missed!', '#fecaca');
            Sound.play('miss');
          }
        }
        break;
      }
      case 'miss':
        this.missV.vy += 1500 * dt;
        this.gem.x += this.missV.vx * dt; this.gem.y += this.missV.vy * dt;
        this.gem.setAlpha(clamp(1 - this.stT / 0.7, 0, 1));
        if (this.stT > 0.75) this.readyAgain();
        break;
      case 'absorb':
        this.critterScale = 1 - clamp(this.stT / 0.4, 0, 1);
        this.gem.setPosition(CX, CY - R * 0.25);
        this.gem.rotation *= 0.85;
        if (this.stT > 0.55) this.setState('drop');
        break;
      case 'drop': {
        const k = clamp(this.stT / 0.55, 0, 1);
        this.gem.setRotation(0).setY(lerp(CY - R * 0.25, GROUND_Y - GEM_R * this.ballScale, easeOutBounce(k)));
        if (k >= 1) this.setState('pulse');
        break;
      }
      case 'pulse': {
        const idx = Math.floor(this.stT / WOBBLE_T), local = this.stT % WOBBLE_T;
        if (idx >= this.pulses) {
          this.gem.setRotation(0);
          if (this.stT >= Math.max(this.pulses * WOBBLE_T, 0.5)) (this.willCatch ? this.caught() : this.breakOut());
          break;
        }
        if (idx !== this.lastPulse) { this.lastPulse = idx; Sound.play('pulse'); }
        this.gem.setRotation(local < 0.55 ? Math.sin((local / 0.55) * TAU) * 0.4 * (idx % 2 ? -1 : 1) : 0);
        break;
      }
      case 'caught':
        if (this.stT > 1.3 && !this.resultShown) this.showResult();
        break;
      case 'break':
        this.critterScale = easeOutBack(clamp(this.stT / 0.35, 0, 1));
        if (this.stT > 0.7) {
          if (Math.random() < RARITY[this.sp.rarity].flee) { this.setState('fled'); this.say(`${this.sp.name} fled!`, '#fecaca'); Sound.play('flee'); }
          else this.readyAgain();
        }
        break;
      case 'fled':
        if (this.stT > 1.4) this.finish('fled');
        break;
    }
    this.draw();
  }

  draw() {
    // Live critter frame
    const ctx = this.critterTex.getContext();
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    drawCritter(ctx, this.sp, TEX_CX, TEX_CY, SCALE, this.t);
    this.critterTex.refresh();
    if (!this.resultShown) {
      const fled = this.state === 'fled';
      this.critter.setScale(this.critterScale)
        .setPosition(CX, CY + Math.sin(this.t * 2.4) * 4 - (fled ? this.stT * 140 : 0))
        .setAlpha(fled ? clamp(1 - this.stT / 0.9, 0, 1) : 1);
    }
    const cs = Math.max(this.resultShown ? 0 : this.critterScale, 0.01);
    this.shadow.clear().fillStyle(0x000000, 0.2).fillEllipse(CX, GROUND_Y, R * 2.1 * cs, R * 0.44 * cs);

    this.flash.clear();
    if (this.state === 'absorb') {
      const k = clamp(this.stT / 0.45, 0, 1);
      this.flash.fillStyle(0xffffff, 0.75 * (1 - k)).fillCircle(CX, CY, R * 1.4 * (1 - k * 0.6));
    }

    this.ringG.clear();
    if (['ready', 'drag', 'fly'].includes(this.state)) {
      const p = this.catchProb(this.gemType);
      const col = p >= 0.5 ? 0x4ade80 : p >= 0.3 ? 0xfacc15 : p >= 0.15 ? 0xfb923c : 0xf87171;
      const r = this.ringRadius();
      this.ringG.lineStyle(3, 0xffffff, 0.85).strokeCircle(CX, CY, R * 1.15);
      this.ringG.fillStyle(col, 0.16).fillCircle(CX, CY, r);
      this.ringG.lineStyle(5, col, 0.95).strokeCircle(CX, CY, r);
    }

    if (this.state === 'ready') this.gem.setVisible(save.gems[this.gemType] > 0);
    this.gem.setScale((GEM_R / 34) * this.ballScale);
    this.gemShadow.clear();
    this.pulse.clear();
    if (['drop', 'pulse', 'caught'].includes(this.state)) {
      const br = GEM_R * this.ballScale;
      this.gemShadow.fillStyle(0x000000, 0.25).fillEllipse(CX, GROUND_Y, br * 1.8, br * 0.6);
      if (this.state === 'pulse' && Math.floor(this.stT / WOBBLE_T) < this.pulses) {
        const k = (this.stT % WOBBLE_T) / WOBBLE_T;
        this.pulse.lineStyle(3, 0xffffff, 0.7 * (1 - k)).strokeCircle(this.gem.x, this.gem.y, br * (0.8 + k * 1.4));
      }
    }
    this.hint.setVisible(this.state === 'ready' && save.throws < 3 && save.gems[this.gemType] > 0);
  }
}

