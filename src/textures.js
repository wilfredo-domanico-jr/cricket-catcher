// Bakes all procedural art into Phaser textures, spritesheets and animations.
// No image files are loaded — everything here is drawn with Canvas 2D at boot.
import { GEMS } from './config.js';
import { SPECIES } from './species.js';
import { LOOP, drawCritter, drawGem, drawCube, drawTrainer, sparkle } from './art.js';
import { TAU } from './util.js';

// Map critter frames: 72x72, critter centre at (36, 40), feet at y≈59.
export const CRIT_FRAME = 72;
export const CRIT_ORIGIN_Y = 59 / 72;
const CRIT_FRAMES = 32;

// Trainer frames: 48x64, feet at (24, 58).
export const TRAINER_ORIGIN_Y = 58 / 64;

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext());
  tex.refresh();
  return tex;
}

// Draws `count` frames into a grid and registers each cell as a numbered frame.
function sheet(scene, key, fw, fh, count, cols, drawFrame) {
  const rows = Math.ceil(count / cols);
  const tex = canvasTex(scene, key, fw * cols, fh * rows, ctx => {
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.translate((i % cols) * fw, Math.floor(i / cols) * fh);
      ctx.beginPath(); ctx.rect(0, 0, fw, fh); ctx.clip();
      drawFrame(ctx, i);
      ctx.restore();
    }
  });
  for (let i = 0; i < count; i++) tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh);
  return tex;
}

function anim(scene, key, texKey, frames, frameRate) {
  if (scene.anims.exists(key)) return;
  scene.anims.create({ key, frames: frames.map(f => ({ key: texKey, frame: f })), frameRate, repeat: -1 });
}
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

export function makeTextures(scene, world) {
  // World map + minimap
  scene.textures.addCanvas('world', world.canvas);
  scene.textures.addCanvas('mini', world.mini);

  // Critter spritesheets (one looping idle animation each) + static portraits
  for (const sp of SPECIES) {
    sheet(scene, `crit-${sp.id}`, CRIT_FRAME, CRIT_FRAME, CRIT_FRAMES, 8, (ctx, i) =>
      drawCritter(ctx, sp, 36, 40, 0.42, (i / CRIT_FRAMES) * LOOP));
    anim(scene, `idle-${sp.id}`, `crit-${sp.id}`, range(0, CRIT_FRAMES), CRIT_FRAMES / LOOP);
    canvasTex(scene, `portrait-${sp.id}`, 180, 180, ctx => drawCritter(ctx, sp, 90, 98, 1.05, 0.5));
  }

  // Trainer: 8 walk frames + 8 idle frames
  sheet(scene, 'trainer', 48, 64, 16, 8, (ctx, i) => {
    ctx.translate(24, 58);
    const p = ((i % 8) / 8) * TAU;
    if (i < 8) drawTrainer(ctx, Math.sin(p), Math.abs(Math.cos(p)) * 2);
    else drawTrainer(ctx, 0, Math.sin(p) * 0.6);
  });
  anim(scene, 'trainer-walk', 'trainer', range(0, 8), 15);
  anim(scene, 'trainer-idle', 'trainer', range(8, 16), 3);

  // Supply-stop cube spinning (a quarter turn loops seamlessly)
  const cubeCols = { ready: ['#a5efff', '#3cc6f0', '#1f9ed1'], cool: ['#e3c7ff', '#b06cf0', '#8a4fd0'] };
  for (const [name, cols] of Object.entries(cubeCols)) {
    sheet(scene, `cube-${name}`, 40, 40, 24, 8, (ctx, i) => drawCube(ctx, 20, 20, 10, (i / 24) * (Math.PI / 2), cols));
    anim(scene, `cube-${name}`, `cube-${name}`, range(0, 24), 18);
  }
  canvasTex(scene, 'stopBase', 30, 50, ctx => {
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(15, 44, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.ellipse(15, 44, 9, 3.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(15, 44); ctx.lineTo(15, 10); ctx.stroke();
  });

  // Capture gems (96px, radius 38) for the bag, buttons and throwing
  for (const g of GEMS) canvasTex(scene, `gem-${g.id}`, 96, 96, ctx => drawGem(ctx, 48, 48, 34, g));

  // Small effect textures
  canvasTex(scene, 'glow', 64, 64, ctx => {
    const gr = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(127,227,255,.6)'); gr.addColorStop(1, 'rgba(127,227,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'shadow', 32, 12, ctx => {
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(16, 6, 15, 5, 0, 0, TAU); ctx.fill();
  });
  canvasTex(scene, 'spark', 16, 16, ctx => sparkle(ctx, 8, 8, 7, '#ffffff'));
  canvasTex(scene, 'dot', 10, 10, ctx => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, 5, 4, 0, TAU); ctx.fill(); });
  canvasTex(scene, 'shard', 12, 12, ctx => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(11, 6); ctx.lineTo(6, 12); ctx.lineTo(1, 6); ctx.closePath(); ctx.fill();
  });
  canvasTex(scene, 'wave', 16, 8, ctx => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(8, 8, 6, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  });
  canvasTex(scene, 'ring', 230, 230, ctx => {
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(115, 115, 110, 0, TAU); ctx.fill();
    ctx.setLineDash([8, 10]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
  });
  canvasTex(scene, 'marker', 44, 22, ctx => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(22, 11, 19, 8.5, 0, 0, TAU); ctx.stroke();
  });
  canvasTex(scene, 'cloud', 140, 70, ctx => {
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.beginPath(); ctx.arc(40, 44, 22, 0, TAU); ctx.arc(66, 34, 26, 0, TAU); ctx.arc(94, 44, 20, 0, TAU); ctx.fill();
  });
  // Night vignette: alpha ramps from 0.2 near the trainer to 1 at the edge (scaled up at runtime).
  canvasTex(scene, 'night', 512, 512, ctx => {
    const gr = ctx.createRadialGradient(256, 256, 7, 256, 256, 91);
    gr.addColorStop(0, 'rgba(12,18,52,.2)'); gr.addColorStop(1, 'rgba(12,18,52,1)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 512, 512);
  });
}
