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

new Phaser.Game(config);
