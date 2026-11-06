// Sprites from the wojownik game (Tiny Swords by Pixel Frog), used as assistant
// characters: the blue warrior and every monster. Frame counts come from the strip sizes
// (square frames, frame size = image height); top / feet are where the drawing starts and
// ends inside a frame (px), so every character can be shown at the same height.
/* eslint-disable import/no-unresolved, camelcase */

import hero_idle from '../../../../assets/journey/hero/blue/idle.png';
import hero_attack from '../../../../assets/journey/hero/blue/attack1.png';
import monster_bat from '../../../../assets/journey/enemy/bat.png';
import monster_bear from '../../../../assets/journey/enemy/bear.png';
import monster_gnoll from '../../../../assets/journey/enemy/gnoll.png';
import monster_gnome from '../../../../assets/journey/enemy/gnome.png';
import monster_harpoon from '../../../../assets/journey/enemy/harpoon.png';
import monster_imp from '../../../../assets/journey/enemy/imp.png';
import monster_lizard from '../../../../assets/journey/enemy/lizard.png';
import monster_minotaur from '../../../../assets/journey/enemy/minotaur.png';
import monster_paddle from '../../../../assets/journey/enemy/paddle.png';
import monster_panda from '../../../../assets/journey/enemy/panda.png';
import monster_shaman from '../../../../assets/journey/enemy/shaman.png';
import monster_skull from '../../../../assets/journey/enemy/skull.png';
import monster_slingshot from '../../../../assets/journey/enemy/slingshot.png';
import monster_snake from '../../../../assets/journey/enemy/snake.png';
import monster_spear from '../../../../assets/journey/enemy/spear.png';
import monster_spider from '../../../../assets/journey/enemy/spider.png';
import monster_thief from '../../../../assets/journey/enemy/thief.png';
import monster_torch from '../../../../assets/journey/enemy/torch.png';
import monster_troll from '../../../../assets/journey/enemy/troll.png';
import monster_turtle from '../../../../assets/journey/enemy/turtle.png';

export interface SpriteSheet {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
}

const sheet = (
  src: string,
  frameWidth: number,
  frameHeight: number,
  frames: number,
): SpriteSheet => ({ src, frameWidth, frameHeight, frames });

export const HERO = {
  idle: sheet(hero_idle, 192, 192, 8),
  attack: sheet(hero_attack, 192, 192, 4),
};
export const HERO_TOP = 48;
export const HERO_FEET = 137;

export interface MonsterArt {
  sheet: SpriteSheet;
  top: number;
  feet: number;
  width: number; // widest the drawing gets (px), so wide ones (bear, turtle) still fit
}

export const MONSTERS: Record<string, MonsterArt> = {
  bat: {
    sheet: sheet(monster_bat, 192, 192, 6),
    top: 41,
    feet: 143,
    width: 133,
  },
  bear: {
    sheet: sheet(monster_bear, 256, 256, 8),
    top: 85,
    feet: 177,
    width: 119,
  },
  gnoll: {
    sheet: sheet(monster_gnoll, 192, 192, 6),
    top: 60,
    feet: 135,
    width: 104,
  },
  gnome: {
    sheet: sheet(monster_gnome, 192, 192, 8),
    top: 57,
    feet: 127,
    width: 78,
  },
  harpoon: {
    sheet: sheet(monster_harpoon, 192, 192, 8),
    top: 57,
    feet: 136,
    width: 75,
  },
  imp: {
    sheet: sheet(monster_imp, 192, 192, 8),
    top: 48,
    feet: 152,
    width: 88,
  },
  lizard: {
    sheet: sheet(monster_lizard, 192, 192, 7),
    top: 25,
    feet: 152,
    width: 81,
  },
  minotaur: {
    sheet: sheet(monster_minotaur, 320, 320, 16),
    top: 85,
    feet: 214,
    width: 150,
  },
  paddle: {
    sheet: sheet(monster_paddle, 192, 192, 8),
    top: 63,
    feet: 136,
    width: 105,
  },
  panda: {
    sheet: sheet(monster_panda, 256, 256, 10),
    top: 78,
    feet: 172,
    width: 113,
  },
  shaman: {
    sheet: sheet(monster_shaman, 192, 192, 8),
    top: 53,
    feet: 137,
    width: 103,
  },
  skull: {
    sheet: sheet(monster_skull, 192, 192, 8),
    top: 57,
    feet: 130,
    width: 74,
  },
  slingshot: {
    sheet: sheet(monster_slingshot, 192, 192, 10),
    top: 72,
    feet: 137,
    width: 65,
  },
  snake: {
    sheet: sheet(monster_snake, 192, 192, 8),
    top: 65,
    feet: 123,
    width: 112,
  },
  spear: {
    sheet: sheet(monster_spear, 256, 256, 8),
    top: 48,
    feet: 176,
    width: 102,
  },
  spider: {
    sheet: sheet(monster_spider, 192, 192, 8),
    top: 52,
    feet: 137,
    width: 92,
  },
  thief: {
    sheet: sheet(monster_thief, 192, 192, 6),
    top: 56,
    feet: 132,
    width: 77,
  },
  torch: {
    sheet: sheet(monster_torch, 192, 192, 8),
    top: 65,
    feet: 133,
    width: 77,
  },
  troll: {
    sheet: sheet(monster_troll, 384, 384, 12),
    top: 86,
    feet: 297,
    width: 170,
  },
  turtle: {
    sheet: sheet(monster_turtle, 320, 320, 10),
    top: 117,
    feet: 208,
    width: 148,
  },
};

export type MonsterId = keyof typeof MONSTERS;
