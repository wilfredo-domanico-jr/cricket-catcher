import { CONFIG } from './config.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import WorldScene from './scenes/WorldScene.js';
import EncounterScene from './scenes/EncounterScene.js';
import UIScene from './scenes/UIScene.js';

// Wait (briefly) for the web font so Phaser text renders with it.
try {
  await Promise.race([
    Promise.all(['700 16px Nunito', '800 16px Nunito', '900 16px Nunito'].map(f => document.fonts.load(f))),
    new Promise(r => setTimeout(r, 1500)),
  ]);
} catch (e) { /* fall back to system font */ }

// Pick a game size matching the screen's shape so there are no letterbox bars:
// the short side stays ~720 units and the long side stretches with the aspect ratio.
function fitSize() {
  const w = window.innerWidth, h = window.innerHeight;
  const short = Math.min(w, h) < 500 ? 640 : 720; // slightly larger UI on phones
  const ratio = Math.min(2.4, Math.max(4 / 3, Math.max(w, h) / Math.min(w, h)));
  const long = Math.round(short * ratio);
  return w >= h ? { width: long, height: short } : { width: short, height: long };
}
const initial = fitSize();
CONFIG.WIDTH = initial.width; CONFIG.HEIGHT = initial.height;

const config = {
  type: Phaser.AUTO,
  title: 'Cricket Catcher',
  parent: 'game-container',
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  backgroundColor: '#367f43',
  pixelArt: false,
  scene: [BootScene, TitleScene, WorldScene, EncounterScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// On rotate / resize, switch to the new size and rebuild the screens that lay themselves out.
// The catch screen is left alone mid-encounter and picks the new size up once it ends.
let resizeTimer = 0;
function applySize() {
  clearTimeout(resizeTimer);
  const { width, height } = fitSize();
  if (width === CONFIG.WIDTH && height === CONFIG.HEIGHT) return;
  if (game.scene.isActive('Encounter') || game.scene.isActive('Boot')) { resizeTimer = setTimeout(applySize, 500); return; }
  CONFIG.WIDTH = width; CONFIG.HEIGHT = height;
  game.scale.setGameSize(width, height);
  for (const key of ['Title', 'UI']) if (game.scene.isActive(key)) game.scene.getScene(key).scene.restart();
}
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(applySize, 150); });
