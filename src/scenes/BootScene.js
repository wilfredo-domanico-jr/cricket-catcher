import { getWorld } from '../world.js';
import { makeTextures } from '../textures.js';
import { MUSIC_KEY } from '../sound.js';

// Loads the music, generates the world and bakes every texture, then shows the title screen.
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.audio(MUSIC_KEY, 'assets/music/retro-game.mp3');
  }
  create() {
    makeTextures(this, getWorld());
    this.scene.start('Title');
  }
}
