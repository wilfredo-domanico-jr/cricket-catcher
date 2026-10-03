import { CONFIG } from '../config.js';
import { SPECIES } from '../species.js';
import { save } from '../state.js';
import { Sound } from '../sound.js';
import { text, button, solidRoundRect } from '../ui.js';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { WIDTH: W, HEIGHT: H } = CONFIG;
    // Slowly drifting, darkened view of the real world map behind the menu
    const bg = this.add.image(0, 0, 'world').setOrigin(0);
    this.tweens.add({ targets: bg, x: -900, y: -500, duration: 60000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.add.rectangle(0, 0, W, H, 0x0a1423, 0.55).setOrigin(0);

    const pw = 640, ph = 560, px = W / 2, py = H / 2 + 6;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.25).fillRoundedRect(px - pw / 2, py - ph / 2 + 10, pw, ph, 28);
    solidRoundRect(panel, px - pw / 2, py - ph / 2, pw, ph, 28, 0xffffff);

    // Critter parade
    SPECIES.slice(0, 6).forEach((sp, i) => {
      const x = px - 250 + i * 100, y = py - 210;
      this.add.image(x, y + 46, 'shadow').setScale(1.9, 1.3);
      const img = this.add.image(x, y, `portrait-${sp.id}`).setScale(0.62);
      this.tweens.add({ targets: img, y: y - 14, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.Out', delay: i * 140 });
    });

    const title = text(this, px, py - 118, 'Cricket Catcher', 54, '#000', '900').setOrigin(0.5);
    const grad = title.context.createLinearGradient(0, 0, title.width, 0);
    grad.addColorStop(0, '#f97316'); grad.addColorStop(0.5, '#ec4899'); grad.addColorStop(1, '#3b82f6');
    title.setFill(grad);
    text(this, px, py - 72, "A tiny open world full of wild critters. Go catch 'em!", 17, '#475569', '700').setOrigin(0.5);

    const tips = [
      'Walk with WASD / arrow keys, or click & hold on the map',
      'Click a critter, then drag and flick a gem up at it',
      'Land inside the shrinking ring for Nice / Great / Perfect bonuses',
      'Spin blue Supply Stops to collect more gems',
      'Some critters only appear near water, in the park, or at night…',
    ];
    tips.forEach((tip, i) => {
      const y = py - 26 + i * 40;
      solidRoundRect(this.add.graphics(), px - 250, y - 16, 500, 32, 10, 0xf1f5f9);
      text(this, px - 236, y, tip, 14, '#334155', '700').setOrigin(0, 0.5);
    });

    const label = save.caught.length || save.level > 1 ? 'Continue Adventure' : 'Start Adventure';
    button(this, px, py + 218, 260, 54, label, () => this.start(), { fill: 0x2aa7c9, color: '#ffffff', size: 19 });
    this.input.keyboard.once('keydown-ENTER', () => this.start());
  }

  start() {
    if (this.starting) return;
    this.starting = true;
    Sound.init(this.sound.context);
    Sound.play('spin');
    this.cameras.main.fadeOut(250, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
