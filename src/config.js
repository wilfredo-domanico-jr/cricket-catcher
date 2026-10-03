// Game-wide tuning and data tables.
export const CONFIG = {
  WIDTH: 1280,           // game size adapts to the screen's shape at startup / on resize (see main.js)
  HEIGHT: 720,
  TILE: 40,
  N: 75,                 // world is N x N tiles (3000 x 3000 px)
  PLAYER_SPEED: 190,
  INTERACT_RANGE: 110,
  MAX_CRITTERS: 12,
  SPAWN_INTERVAL: 1.3,   // seconds between spawn attempts
  DAY_LENGTH: 240,       // seconds for a full day/night cycle
  STOP_COOLDOWN: 60,
  SAVE_KEY: 'cricketCatcher.v1',
};

// Phones / tablets: tweak wording ("tap" not "click") and hide keyboard hints.
export const TOUCH = window.matchMedia('(pointer: coarse)').matches;

export const FONT = 'Nunito, "Segoe UI", Arial, sans-serif';

export const TYPE_COLORS = {
  fire: '#f97316', water: '#3b82f6', grass: '#22c55e', electric: '#eab308',
  rock: '#a16207', ghost: '#8b5cf6', cosmic: '#06b6d4',
};

export const RARITY = {
  common:    { weight: 10,  catchRate: 0.5,  flee: 0.08, xp: 0,   label: 'Common' },
  uncommon:  { weight: 5.5, catchRate: 0.32, flee: 0.12, xp: 50,  label: 'Uncommon' },
  rare:      { weight: 1.2, catchRate: 0.18, flee: 0.20, xp: 150, label: 'Rare' },
  legendary: { weight: 0.3, catchRate: 0.07, flee: 0.05, xp: 500, label: 'Legendary', minLevel: 3 },
};

// Capture gems: thrown crystals that seal a critter in light.
export const GEMS = [
  { id: 'spark', name: 'Spark Gem', mult: 1,   light: '#ffe2b8', mid: '#ff9a3c', dark: '#c2410c', glow: '255,170,80' },
  { id: 'glow',  name: 'Glow Gem',  mult: 1.5, light: '#c9f6ff', mid: '#22c3e6', dark: '#0e7490', glow: '80,220,255' },
  { id: 'star',  name: 'Star Gem',  mult: 2,   light: '#f3e1ff', mid: '#a855f7', dark: '#6b21a8', glow: '200,140,255', star: true },
];
export const GEM_BY_ID = Object.fromEntries(GEMS.map(g => [g.id, g]));

export const THROW_BONUS = {
  'Nice!':    { mult: 1.3, xp: 10 },
  'Great!':   { mult: 1.7, xp: 50 },
  'Perfect!': { mult: 2.0, xp: 100 },
};
