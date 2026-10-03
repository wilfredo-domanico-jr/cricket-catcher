import { getWorld } from '../world.js';
import { makeTextures } from '../textures.js';

// Generates the world and bakes every texture, then shows the title screen.
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    makeTextures(this, getWorld());
    this.scene.start('Title');
  }
}
