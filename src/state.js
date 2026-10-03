// Persistent save data + shared runtime state (day/night clock).
import { CONFIG, GEMS, RARITY } from './config.js';
import { clamp, TAU } from './util.js';
import { Sound } from './sound.js';

const DEFAULT_SAVE = () => ({
  xp: 0, level: 1,
  gems: { spark: 15, glow: 3, star: 1 },
  journal: {}, caught: [], dist: 0, throws: 0,
  px: null, py: null, stops: {}, muted: false,
});

function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw), d = DEFAULT_SAVE();
      return { ...d, ...s, gems: { ...d.gems, ...(s.gems || {}) } };
    }
  } catch (e) { /* storage blocked or corrupt — start fresh */ }
  return DEFAULT_SAVE();
}

export const save = loadSave();
Sound.muted = save.muted;

export function persist() {
  try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

export const journalEntry = id => (save.journal[id] ||= { seen: 0, caught: 0 });
export const xpNeeded = lvl => 300 + 200 * (lvl - 1);
export const totalGems = () => GEMS.reduce((a, g) => a + save.gems[g.id], 0);

// Adds XP, handles level-ups and announces them through game-wide 'toast' events.
export function addXP(game, n) {
  save.xp += n;
  while (save.xp >= xpNeeded(save.level)) {
    save.xp -= xpNeeded(save.level);
    save.level++;
    const reward = { spark: 6, glow: save.level >= 3 ? 3 : 0, star: save.level >= 5 ? 2 : 0 };
    for (const k in reward) save.gems[k] += reward[k];
    Sound.play('levelup');
    game.events.emit('toast', `🎉 Level up! You are now level ${save.level}`, 'gold');
    game.events.emit('toast', GEMS.filter(g => reward[g.id]).map(g => `+${reward[g.id]} ${g.name}s`).join(' · '), 'good');
    if (save.level === RARITY.legendary.minLevel) {
      setTimeout(() => game.events.emit('toast', '✨ Rumours say a legendary critter now roams…', 'gold'), 900);
    }
  }
  persist();
}

// Day/night clock (seconds of explore time). Starts at noon.
export const shared = { clock: 0 };
export const darkness = () => {
  const d = (shared.clock % CONFIG.DAY_LENGTH) / CONFIG.DAY_LENGTH;
  return clamp((0.15 - Math.cos(d * TAU)) / 1.15, 0, 1) * 0.6;
};
export const isNight = () => darkness() > 0.25;
