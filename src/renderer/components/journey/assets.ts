// Sprites from the wojownik game (Tiny Swords by Pixel Frog). Generated: frame counts
// come from the strip sizes (square frames, frame size = image height).
/* eslint-disable import/no-unresolved, camelcase */

import hero_blue_idle from '../../../../assets/journey/hero/blue/idle.png';
import hero_blue_run from '../../../../assets/journey/hero/blue/run.png';
import hero_blue_attack1 from '../../../../assets/journey/hero/blue/attack1.png';
import hero_red_idle from '../../../../assets/journey/hero/red/idle.png';
import hero_red_run from '../../../../assets/journey/hero/red/run.png';
import hero_red_attack1 from '../../../../assets/journey/hero/red/attack1.png';
import hero_yellow_idle from '../../../../assets/journey/hero/yellow/idle.png';
import hero_yellow_run from '../../../../assets/journey/hero/yellow/run.png';
import hero_yellow_attack1 from '../../../../assets/journey/hero/yellow/attack1.png';
import hero_purple_idle from '../../../../assets/journey/hero/purple/idle.png';
import hero_purple_run from '../../../../assets/journey/hero/purple/run.png';
import hero_purple_attack1 from '../../../../assets/journey/hero/purple/attack1.png';
import hero_black_idle from '../../../../assets/journey/hero/black/idle.png';
import hero_black_run from '../../../../assets/journey/hero/black/run.png';
import hero_black_attack1 from '../../../../assets/journey/hero/black/attack1.png';
import enemy_bat from '../../../../assets/journey/enemy/bat.png';
import enemy_bear from '../../../../assets/journey/enemy/bear.png';
import enemy_gnoll from '../../../../assets/journey/enemy/gnoll.png';
import enemy_gnome from '../../../../assets/journey/enemy/gnome.png';
import enemy_harpoon from '../../../../assets/journey/enemy/harpoon.png';
import enemy_imp from '../../../../assets/journey/enemy/imp.png';
import enemy_lizard from '../../../../assets/journey/enemy/lizard.png';
import enemy_minotaur from '../../../../assets/journey/enemy/minotaur.png';
import enemy_paddle from '../../../../assets/journey/enemy/paddle.png';
import enemy_panda from '../../../../assets/journey/enemy/panda.png';
import enemy_shaman from '../../../../assets/journey/enemy/shaman.png';
import enemy_skull from '../../../../assets/journey/enemy/skull.png';
import enemy_slingshot from '../../../../assets/journey/enemy/slingshot.png';
import enemy_snake from '../../../../assets/journey/enemy/snake.png';
import enemy_spear from '../../../../assets/journey/enemy/spear.png';
import enemy_spider from '../../../../assets/journey/enemy/spider.png';
import enemy_thief from '../../../../assets/journey/enemy/thief.png';
import enemy_torch from '../../../../assets/journey/enemy/torch.png';
import enemy_troll from '../../../../assets/journey/enemy/troll.png';
import enemy_turtle from '../../../../assets/journey/enemy/turtle.png';
import deco_bush_1 from '../../../../assets/journey/deco/bush_1.png';
import deco_bush_2 from '../../../../assets/journey/deco/bush_2.png';
import deco_bush_3 from '../../../../assets/journey/deco/bush_3.png';
import deco_bush_4 from '../../../../assets/journey/deco/bush_4.png';
import deco_cloud_1 from '../../../../assets/journey/deco/cloud_1.png';
import deco_cloud_3 from '../../../../assets/journey/deco/cloud_3.png';
import deco_cloud_5 from '../../../../assets/journey/deco/cloud_5.png';
import deco_rock_1 from '../../../../assets/journey/deco/rock_1.png';
import deco_rock_2 from '../../../../assets/journey/deco/rock_2.png';
import deco_rock_3 from '../../../../assets/journey/deco/rock_3.png';
import deco_rock_4 from '../../../../assets/journey/deco/rock_4.png';
import deco_tree_1 from '../../../../assets/journey/deco/tree_1.png';
import deco_tree_2 from '../../../../assets/journey/deco/tree_2.png';
import deco_tree_3 from '../../../../assets/journey/deco/tree_3.png';
import deco_tree_4 from '../../../../assets/journey/deco/tree_4.png';
import icon_gold from '../../../../assets/journey/icons/gold.png';
import icon_meat from '../../../../assets/journey/icons/meat.png';
import icon_shield from '../../../../assets/journey/icons/shield.png';
import icon_sword from '../../../../assets/journey/icons/sword.png';
import ui_banner_s from '../../../../assets/journey/ui/banner_s.png';
import ui_paper_s from '../../../../assets/journey/ui/paper_s.png';
import ui_ribbon_red_s from '../../../../assets/journey/ui/ribbon_red_s.png';
import ui_ribbon_yellow_s from '../../../../assets/journey/ui/ribbon_yellow_s.png';
import ui_wood_s from '../../../../assets/journey/ui/wood_s.png';

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
): SpriteSheet => ({
  src,
  frameWidth,
  frameHeight,
  frames,
});

export const HERO: Record<
  string,
  { idle: SpriteSheet; run: SpriteSheet; attack: SpriteSheet }
> = {
  blue: {
    idle: sheet(hero_blue_idle, 192, 192, 8),
    run: sheet(hero_blue_run, 192, 192, 6),
    attack: sheet(hero_blue_attack1, 192, 192, 4),
  },
  red: {
    idle: sheet(hero_red_idle, 192, 192, 8),
    run: sheet(hero_red_run, 192, 192, 6),
    attack: sheet(hero_red_attack1, 192, 192, 4),
  },
  yellow: {
    idle: sheet(hero_yellow_idle, 192, 192, 8),
    run: sheet(hero_yellow_run, 192, 192, 6),
    attack: sheet(hero_yellow_attack1, 192, 192, 4),
  },
  purple: {
    idle: sheet(hero_purple_idle, 192, 192, 8),
    run: sheet(hero_purple_run, 192, 192, 6),
    attack: sheet(hero_purple_attack1, 192, 192, 4),
  },
  black: {
    idle: sheet(hero_black_idle, 192, 192, 8),
    run: sheet(hero_black_run, 192, 192, 6),
    attack: sheet(hero_black_attack1, 192, 192, 4),
  },
};

export const ENEMY: Record<string, SpriteSheet> = {
  bat: sheet(enemy_bat, 192, 192, 6),
  bear: sheet(enemy_bear, 256, 256, 8),
  gnoll: sheet(enemy_gnoll, 192, 192, 6),
  gnome: sheet(enemy_gnome, 192, 192, 8),
  harpoon: sheet(enemy_harpoon, 192, 192, 8),
  imp: sheet(enemy_imp, 192, 192, 8),
  lizard: sheet(enemy_lizard, 192, 192, 7),
  minotaur: sheet(enemy_minotaur, 320, 320, 16),
  paddle: sheet(enemy_paddle, 192, 192, 8),
  panda: sheet(enemy_panda, 256, 256, 10),
  shaman: sheet(enemy_shaman, 192, 192, 8),
  skull: sheet(enemy_skull, 192, 192, 8),
  slingshot: sheet(enemy_slingshot, 192, 192, 10),
  snake: sheet(enemy_snake, 192, 192, 8),
  spear: sheet(enemy_spear, 256, 256, 8),
  spider: sheet(enemy_spider, 192, 192, 8),
  thief: sheet(enemy_thief, 192, 192, 6),
  torch: sheet(enemy_torch, 192, 192, 8),
  troll: sheet(enemy_troll, 384, 384, 12),
  turtle: sheet(enemy_turtle, 320, 320, 10),
};

export const DECO: Record<string, SpriteSheet> = {
  bush_1: sheet(deco_bush_1, 128, 128, 8),
  bush_2: sheet(deco_bush_2, 128, 128, 8),
  bush_3: sheet(deco_bush_3, 128, 128, 8),
  bush_4: sheet(deco_bush_4, 128, 128, 8),
  cloud_1: sheet(deco_cloud_1, 576, 256, 1),
  cloud_3: sheet(deco_cloud_3, 576, 256, 1),
  cloud_5: sheet(deco_cloud_5, 576, 256, 1),
  rock_1: sheet(deco_rock_1, 64, 64, 1),
  rock_2: sheet(deco_rock_2, 64, 64, 1),
  rock_3: sheet(deco_rock_3, 64, 64, 1),
  rock_4: sheet(deco_rock_4, 64, 64, 1),
  tree_1: sheet(deco_tree_1, 192, 256, 8),
  tree_2: sheet(deco_tree_2, 192, 256, 8),
  tree_3: sheet(deco_tree_3, 192, 192, 8),
  tree_4: sheet(deco_tree_4, 192, 192, 8),
};

export const ICON: Record<string, SpriteSheet> = {
  gold: sheet(icon_gold, 64, 64, 1),
  meat: sheet(icon_meat, 64, 64, 1),
  shield: sheet(icon_shield, 64, 64, 1),
  sword: sheet(icon_sword, 64, 64, 1),
};

export const UI: Record<string, SpriteSheet> = {
  banner_s: sheet(ui_banner_s, 160, 160, 1),
  paper_s: sheet(ui_paper_s, 96, 96, 1),
  ribbon_red_s: sheet(ui_ribbon_red_s, 160, 64, 1),
  ribbon_yellow_s: sheet(ui_ribbon_yellow_s, 160, 64, 1),
  wood_s: sheet(ui_wood_s, 160, 160, 1),
};

// Where the feet are inside a frame (px from the top) and the size normalisation the game
// uses (EnemyArt.gd / Level.gd / Player.gd), so everything stands on the ground line.
export const HERO_FEET = 137;

export const ENEMY_ART: Record<string, { feet: number; scale: number }> = {
  gnome: { feet: 127, scale: 0.943 },
  lizard: { feet: 152, scale: 0.677 },
  snake: { feet: 123, scale: 0.966 },
  spider: { feet: 137, scale: 0.824 },
  slingshot: { feet: 137, scale: 1.015 },
  paddle: { feet: 136, scale: 1.151 },
  harpoon: { feet: 136, scale: 1.063 },
  torch: { feet: 133, scale: 1.176 },
  spear: { feet: 176, scale: 0.719 },
  gnoll: { feet: 135, scale: 1.12 },
  thief: { feet: 132, scale: 1.053 },
  skull: { feet: 130, scale: 1.151 },
  imp: { feet: 152, scale: 0.673 },
  bat: { feet: 143, scale: 0.647 },
  shaman: { feet: 137, scale: 1.048 },
  bear: { feet: 177, scale: 1.848 },
  turtle: { feet: 208, scale: 1.868 },
  panda: { feet: 172, scale: 2.021 },
  minotaur: { feet: 214, scale: 1.705 },
  troll: { feet: 297, scale: 1.185 },
};

export const DECO_FEET: Record<string, number> = {
  tree_1: 241,
  tree_2: 249,
  tree_3: 170,
  tree_4: 168,
  bush_1: 79,
  bush_2: 79,
  bush_3: 79,
  bush_4: 79,
  rock_1: 50,
  rock_2: 50,
  rock_3: 50,
  rock_4: 50,
};
