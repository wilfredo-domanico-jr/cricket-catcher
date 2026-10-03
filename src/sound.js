// Tiny WebAudio synth — every sound effect is generated, no audio files.
export const Sound = {
  ctx: null,
  muted: false,
  init(ctx) {
    if (ctx) this.ctx = ctx;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f, d, type = 'sine', vol = 0.12, to = null, delay = 0) {
    const ac = this.ctx, t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(ac.destination);
    o.start(t0); o.stop(t0 + d + 0.03);
  },
  play(name) {
    if (this.muted || !this.ctx) return;
    const s = this;
    switch (name) {
      case 'click': s.tone(880, 0.05, 'square', 0.03); break;
      case 'spin': [523, 659, 784, 1047].forEach((f, i) => s.tone(f, 0.14, 'triangle', 0.1, null, i * 0.06)); break;
      case 'encounter': s.tone(330, 0.18, 'sawtooth', 0.04, 660); s.tone(660, 0.22, 'triangle', 0.08, 990, 0.14); break;
      case 'throw': s.tone(260, 0.3, 'sine', 0.12, 900); break;
      case 'hit': s.tone(180, 0.1, 'square', 0.06, 90); s.tone(1200, 0.25, 'sine', 0.05, 2400, 0.05); break;
      case 'pulse': s.tone(420, 0.16, 'triangle', 0.12, 300); break;
      case 'caught': [784, 988, 1175, 1568].forEach((f, i) => s.tone(f, 0.2, 'triangle', 0.1, null, i * 0.09)); break;
      case 'break': s.tone(1400, 0.25, 'triangle', 0.06, 300); s.tone(520, 0.3, 'sawtooth', 0.04, 120); break;
      case 'flee': s.tone(700, 0.5, 'sine', 0.08, 180); break;
      case 'miss': s.tone(320, 0.2, 'sine', 0.06, 160); break;
      case 'levelup': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => s.tone(f, 0.16, 'square', 0.04, null, i * 0.08)); break;
    }
  },
};

// ---------------------------------------------------------------- Background music
// Played through Phaser's sound manager; muted together with the sound effects.
export const MUSIC_KEY = 'bgm';
export const MUSIC_VOLUME = 0.35;

export function startMusic(scene) {
  const sm = scene.sound;
  sm.mute = Sound.muted;
  const music = sm.get(MUSIC_KEY) || sm.add(MUSIC_KEY, { loop: true, volume: MUSIC_VOLUME });
  if (!music.isPlaying) music.play();
}

// Smoothly change the music volume (e.g. quieter during catch encounters).
export function fadeMusic(scene, volume, duration = 600) {
  const music = scene.sound.get(MUSIC_KEY);
  if (music) scene.tweens.add({ targets: music, volume, duration });
}

export function setMuted(scene, muted) {
  Sound.muted = muted;
  scene.sound.mute = muted;
}
