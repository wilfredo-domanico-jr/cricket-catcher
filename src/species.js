// The eight critters that roam the world.
import { drawEmberpup, drawDrizzlet, drawSproutling, drawZappit, drawPebblor, drawWispurr, drawGlimmerfin, drawAurorex } from './art.js';

export const SPECIES = [
  { id: 'emberpup',   name: 'Emberpup',   type: 'fire',     rarity: 'common',    basePower: 420,  biomes: { field: 1.2, town: 1.2, park: 0.5, shore: 0.2 }, draw: drawEmberpup,   desc: 'Its tail flame burns brighter when it is happy.' },
  { id: 'drizzlet',   name: 'Drizzlet',   type: 'water',    rarity: 'common',    basePower: 400,  biomes: { shore: 3, field: 0.3, park: 0.4, town: 0.2 },   draw: drawDrizzlet,   desc: 'Made mostly of morning dew. Loves puddles.' },
  { id: 'sproutling', name: 'Sproutling', type: 'grass',    rarity: 'common',    basePower: 380,  biomes: { park: 3, field: 1, town: 0.3, shore: 0.4 },     draw: drawSproutling, desc: 'Sunbathes all day so its sprout grows taller.' },
  { id: 'zappit',     name: 'Zappit',     type: 'electric', rarity: 'uncommon',  basePower: 560,  biomes: { town: 2.5, field: 0.6, park: 0.3, shore: 0.3 }, draw: drawZappit,     desc: 'Nibbles on power lines. Its ears crackle with static.' },
  { id: 'pebblor',    name: 'Pebblor',    type: 'rock',     rarity: 'uncommon',  basePower: 620,  biomes: { field: 1.5, town: 0.8, shore: 0.7, park: 0.4 }, draw: drawPebblor,    desc: 'Grumpy but loyal. Collects shiny pebbles.' },
  { id: 'wispurr',    name: 'Wispurr',    type: 'ghost',    rarity: 'rare',      basePower: 780,  biomes: { field: 1, town: 1, park: 1, shore: 1 }, nocturnal: true, draw: drawWispurr, desc: 'Purrs softly in the dark. Mostly seen at night.' },
  { id: 'glimmerfin', name: 'Glimmerfin', type: 'water',    rarity: 'rare',      basePower: 900,  biomes: { shore: 2.5, field: 0, town: 0, park: 0 },       draw: drawGlimmerfin, desc: 'Its scales shimmer through every colour of the lake.' },
  { id: 'aurorex',    name: 'Aurorex',    type: 'cosmic',   rarity: 'legendary', basePower: 2400, biomes: { field: 1, town: 1, park: 1, shore: 1 },         draw: drawAurorex,    desc: 'A mythical critter said to ride the northern lights.' },
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
