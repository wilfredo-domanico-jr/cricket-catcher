import { CONFIG, GEMS, RARITY } from '../config.js';
import { SPECIES } from '../species.js';
import { T, getWorld } from '../world.js';
import { Player } from '../player.js';
import { save, persist, addXP, shared, darkness, isNight } from '../state.js';
import { Sound, MUSIC_VOLUME, fadeMusic } from '../sound.js';
import { CRIT_ORIGIN_Y } from '../textures.js';
import { clamp, dist, rand, randInt, weightedPick } from '../util.js';

// The open world: trainer, wild critters, supply stops, day/night.
export default class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  create() {
    this.world = getWorld();
    const TS = CONFIG.TILE, W = this.world;

    this.add.image(0, 0, 'world').setOrigin(0).setDepth(0);
    this.addWaterSparkles();

    this.ring = this.add.image(0, 0, 'ring').setDepth(2);
    this.marker = this.add.image(0, 0, 'marker').setDepth(3).setVisible(false);
    this.tweens.add({ targets: this.marker, scale: { from: 0.3, to: 1.2 }, alpha: { from: 1, to: 0 }, duration: 700, repeat: -1 });

    this.player = new Player(this, save.px ?? (W.spawn.x + 0.5) * TS, save.py ?? (W.spawn.y + 0.5) * TS);
    this.stops = W.stopTiles.map((p, i) => this.makeStop((p.x + 0.5) * TS, (p.y + 0.5) * TS, i));
    this.stopRings = this.add.graphics().setDepth(1e5);
    this.critters = [];
    this.pending = null; // { type: 'critter' | 'stop', ref } — walk there, then interact

    this.leafFx = this.add.particles(0, 0, 'dot', {
      speed: { min: 40, max: 120 }, angle: { min: 200, max: 340 }, gravityY: 160,
      lifespan: { min: 400, max: 800 }, scale: { start: 0.9, end: 0 }, tint: [0x7ed957, 0x4caf50, 0xb6f29a], emitting: false,
    }).setDepth(1e5);
    this.spinFx = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 240 }, angle: { min: 200, max: 340 }, gravityY: 420,
      lifespan: { min: 600, max: 1100 }, scale: { start: 1, end: 0 }, tint: [0x7fe3ff, 0xffffff, 0xffd23f, 0xff9a3c], emitting: false,
    }).setDepth(1e5);

    this.night = this.add.image(0, 0, 'night').setDisplaySize(3600, 3600).setDepth(1e6).setAlpha(0);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W.size, W.size);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.fadeIn(300, 255, 255, 255);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', () => { this.steering = false; });
    this.events.on('wake', this.onEncounterEnd, this);

    this.time.addEvent({ delay: CONFIG.SPAWN_INTERVAL * 1000, loop: true, callback: () => this.trySpawn() });
    for (let i = 0; i < 7; i++) this.trySpawn(150, 520);
    this.saveTimer = 0;

    this.scene.launch('UI');
    this.time.delayedCall(400, () => this.game.events.emit('toast',
      save.caught.length ? `Welcome back, Trainer! (Level ${save.level})` : 'Click a wild critter to try catching it!', 'good'));
  }

  get ui() { return this.scene.get('UI'); }

  // ---------------------------------------------------------------- Scenery
  addWaterSparkles() {
    const W = this.world, TS = CONFIG.TILE;
    for (let y = 0; y < W.N; y++) for (let x = 0; x < W.N; x++) {
      if (W.get(x, y) !== T.WATER) continue;
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (h % 3) continue;
      const img = this.add.image(x * TS + 12 + (h % 18), y * TS + 12 + ((h >> 5) % 18), 'wave').setAlpha(0).setDepth(1);
      this.tweens.add({ targets: img, alpha: 0.6, duration: 900 + (h % 700), yoyo: true, repeat: -1, delay: h % 2000, ease: 'Sine.InOut' });
    }
  }

  makeStop(x, y, id) {
    const s = { id, x, y, ready: save.stops[id] || 0, wasReady: null };
    s.glow = this.add.image(x, y - 46, 'glow').setDepth(y + 9);
    s.base = this.add.image(x, y, 'stopBase').setOrigin(0.5, 44 / 50).setDepth(y + 9);
    s.cube = this.add.sprite(x, y - 46, 'cube-ready').setDepth(y + 10);
    s.cube.play({ key: 'cube-ready', startFrame: id % 24 });
    this.tweens.add({ targets: [s.cube, s.glow], y: y - 49, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: id * 90 });
    this.tweens.add({ targets: s.glow, alpha: { from: 0.6, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    return s;
  }

  // ---------------------------------------------------------------- Critters
  chooseSpecies(biome) {
    return weightedPick(SPECIES, sp => {
      const r = RARITY[sp.rarity];
      if (r.minLevel && save.level < r.minLevel) return 0;
      let w = r.weight * (biome in sp.biomes ? sp.biomes[biome] : 0.15);
      if (sp.nocturnal) w *= isNight() ? 4 : 0.35;
      return w;
    });
  }

  trySpawn(minD = 190, maxD = 620) {
    if (this.critters.length >= CONFIG.MAX_CRITTERS) return;
    const W = this.world, p = this.player;
    for (let tries = 0; tries < 14; tries++) {
      const a = rand(0, Math.PI * 2), d = rand(minD, maxD);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!W.walkable(x, y) || !W.walkable(x - 14, y) || !W.walkable(x + 14, y) || !W.walkable(x, y - 20)) continue;
      if (this.critters.some(c => dist(c.x, c.y, x, y) < 80) || this.stops.some(s => dist(s.x, s.y, x, y) < 60)) continue;
      const sp = this.chooseSpecies(W.biomeAt(x, y));
      if (sp) { this.spawnCritter(sp, x, y); return; }
    }
  }

  spawnCritter(sp, x, y) {
    const f = rand(0.35, 1);
    const c = {
      sp, x, y,
      power: Math.max(10, Math.round(sp.basePower * f * (0.85 + 0.05 * save.level))),
      powerPct: (f - 0.35) / 0.65,
      age: 0, life: rand(100, 170), fade: 0,
    };
    c.shadow = this.add.image(x, y, 'shadow').setDepth(y + 8).setScale(0);
    c.sprite = this.add.sprite(x, y, `crit-${sp.id}`).setOrigin(0.5, CRIT_ORIGIN_Y).setDepth(y + 10).setScale(0);
    c.sprite.play({ key: `idle-${sp.id}`, startFrame: randInt(0, 31) });
    this.tweens.add({ targets: [c.sprite, c.shadow], scale: 1, duration: 450, ease: 'Back.Out' });
    this.tweens.add({ targets: c.sprite, y: y - 5, duration: 380 + rand(0, 120), yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: rand(0, 400) });
    if (sp.rarity === 'rare' || sp.rarity === 'legendary') {
      c.aura = this.add.particles(x, y - 20, 'spark', {
        speed: { min: 4, max: 18 }, lifespan: 900, frequency: 200, scale: { start: 0.6, end: 0 },
        tint: sp.rarity === 'legendary' ? 0xffe066 : 0xc7f9ff,
        emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 24) },
      }).setDepth(y + 11);
    }
    this.leafFx.explode(10, x, y - 10);
    this.critters.push(c);
  }

  removeCritter(c) {
    this.tweens.killTweensOf(c.sprite);
    c.sprite.destroy(); c.shadow.destroy(); c.aura?.destroy();
    this.critters = this.critters.filter(o => o !== c);
  }

  // ---------------------------------------------------------------- Interaction
  entityAt(wx, wy) {
    let best = null, bd = 34;
    for (const c of this.critters) { const d = dist(wx, wy, c.x, c.y - 18); if (d < bd) { bd = d; best = { type: 'critter', ref: c }; } }
    for (const s of this.stops) {
      const d = Math.min(dist(wx, wy, s.x, s.y - 46), dist(wx, wy, s.x, s.y - 16) + 6);
      if (d < bd) { bd = d; best = { type: 'stop', ref: s }; }
    }
    return best;
  }

  interact(hit) {
    this.pending = null; this.player.stop();
    hit.type === 'critter' ? this.startEncounter(hit.ref) : this.spinStop(hit.ref);
  }

  onPointerDown(p) {
    Sound.init(this.sound.context);
    if (this.ui?.blocks(p.x, p.y)) return;
    const hit = this.entityAt(p.worldX, p.worldY);
    if (hit) {
      Sound.play('click');
      if (dist(this.player.x, this.player.y, hit.ref.x, hit.ref.y) <= CONFIG.INTERACT_RANGE) this.interact(hit);
      else { this.pending = hit; if (!this.player.goTo(hit.ref.x, hit.ref.y)) this.pending = null; }
      this.steering = false;
      return;
    }
    this.pending = null;
    this.player.goTo(p.worldX, p.worldY);
    this.steering = true;
    this.steerTile = -1;
  }

  onPointerMove(p) {
    if (this.steering && p.isDown) {
      // Hold to keep walking toward the pointer; only re-path when it crosses into a new tile.
      const tile = Math.floor(p.worldY / CONFIG.TILE) * CONFIG.N + Math.floor(p.worldX / CONFIG.TILE);
      if (tile !== this.steerTile || !this.player.target) { this.steerTile = tile; this.player.goTo(p.worldX, p.worldY); }
      else { this.player.target.x = p.worldX; this.player.target.y = p.worldY; }
      return;
    }
    const over = !this.ui?.blocks(p.x, p.y) && this.entityAt(p.worldX, p.worldY);
    this.input.setDefaultCursor(over ? 'pointer' : 'default');
  }

  spinStop(s) {
    const now = Date.now();
    if (now < s.ready) { this.game.events.emit('toast', `Supply Stop recharging… ${Math.ceil((s.ready - now) / 1000)}s`); return; }
    const got = { spark: randInt(3, 5), glow: 0, star: 0 };
    if (save.level >= 2 && Math.random() < 0.6) got.glow = randInt(1, 2);
    if (save.level >= 4 && Math.random() < 0.35) got.star = 1;
    const parts = [];
    for (const g of GEMS) if (got[g.id]) { save.gems[g.id] += got[g.id]; parts.push(`+${got[g.id]} ${g.name}${got[g.id] > 1 ? 's' : ''}`); }
    s.ready = now + CONFIG.STOP_COOLDOWN * 1000;
    save.stops[s.id] = s.ready;
    s.cube.anims.timeScale = 7;
    this.tweens.add({ targets: s.cube.anims, timeScale: 1, duration: 1400, ease: 'Cubic.Out' });
    this.spinFx.explode(22, s.x, s.y - 46);
    Sound.play('spin');
    this.game.events.emit('toast', parts.join(' · '), 'good');
    this.game.events.emit('gems', got);
    addXP(this.game, 50);
  }

  startEncounter(c) {
    this.player.stop();
    this.pending = null; this.steering = false;
    this.input.setDefaultCursor('default');
    Sound.play('encounter');
    this.scene.sleep('UI');
    this.scene.launch('Encounter', { critter: c, biome: this.world.biomeAt(c.x, c.y) });
    this.scene.sleep();
  }

  // Called when the Encounter scene wakes us with its result.
  onEncounterEnd(sys, data) {
    if (!data) return;
    fadeMusic(this, MUSIC_VOLUME);
    const { outcome, critter, xp } = data;
    if (outcome === 'caught' || outcome === 'fled') this.removeCritter(critter);
    if (outcome === 'ran') this.game.events.emit('toast', 'You got away safely.');
    if (outcome === 'fled') this.game.events.emit('toast', `${critter.sp.name} fled…`);
    if (xp) addXP(this.game, xp);
    this.input.keyboard.resetKeys();
    this.persistPosition();
  }

  persistPosition() { save.px = this.player.x; save.py = this.player.y; persist(); }

  // ---------------------------------------------------------------- Loop
  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    shared.clock += dt;
    const p = this.player, k = this.keys;
    const frozen = this.ui?.journalOpen;
    const dx = frozen ? 0 : (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown);
    const dy = frozen ? 0 : (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    if (dx || dy) this.pending = null;
    save.dist += p.update(dt, dx, dy);

    if (this.pending) {
      const ref = this.pending.ref;
      if (this.pending.type === 'critter' && !this.critters.includes(ref)) this.pending = null;
      else if (dist(p.x, p.y, ref.x, ref.y) <= CONFIG.INTERACT_RANGE * 0.9) { this.interact(this.pending); return; }
      else if (!p.target) this.pending = null;
    }

    for (const c of [...this.critters]) {
      c.age += dt;
      const far = dist(c.x, c.y, p.x, p.y) > 1300;
      if ((c.age > c.life || far) && this.pending?.ref !== c) c.fade += dt;
      if (c.fade > 0) {
        const a = clamp(1 - c.fade / 0.6, 0, 1);
        c.sprite.setAlpha(a); c.shadow.setAlpha(a); c.aura?.setAlpha(a);
        if (a <= 0) this.removeCritter(c);
      }
    }

    const now = Date.now();
    this.stopRings.clear();
    for (const s of this.stops) {
      const ready = now >= s.ready;
      if (ready !== s.wasReady) {
        s.wasReady = ready;
        s.cube.play({ key: ready ? 'cube-ready' : 'cube-cool', startFrame: Math.max(0, (s.cube.anims.currentFrame?.index ?? 1) - 1) });
        s.glow.setVisible(ready);
      }
      const near = dist(p.x, p.y, s.x, s.y) <= CONFIG.INTERACT_RANGE;
      s.cube.setScale(near && ready ? 1.15 : 1);
      if (!ready) {
        const k2 = clamp((s.ready - now) / (CONFIG.STOP_COOLDOWN * 1000), 0, 1);
        this.stopRings.lineStyle(3, 0xffffff, 0.85).beginPath()
          .arc(s.x, s.cube.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k2)).strokePath();
      } else if (near) {
        this.stopRings.lineStyle(3, 0x7fe3ff, 0.5 + Math.sin(time / 200) * 0.3).strokeEllipse(s.x, s.y, 44, 16);
      }
    }

    this.ring.setPosition(p.x, p.y);
    this.ring.rotation += dt * 0.15;
    this.marker.setVisible(!!p.target && !this.steering);
    if (p.target) this.marker.setPosition(p.target.x, p.target.y);

    const dk = darkness();
    this.night.setPosition(p.x, p.y - 20).setAlpha(dk);

    if ((this.saveTimer += dt) > 5) { this.saveTimer = 0; this.persistPosition(); }
  }
}
