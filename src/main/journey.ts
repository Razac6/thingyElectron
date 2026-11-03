// "Szlak Wojownika" - an optional board game on top of the app. One game = one sprint:
// a freshly generated trail through one of the five lands of the wojownik game (its
// lands, enemies, items and blacksmith rules), ending with that land's boss. Finished work
// earns dice rolls (bigger tasks, more rolls; running over the estimate costs a step); the
// warrior walks that many tiles and whatever is on the tile he lands on happens - treasure,
// gold, a camp or a skirmish. Gear found on the way (or upgraded at the blacksmith) is what
// beats the boss. When the sprint ends a new game starts: next land, new map, new loot.
// Achievements drop chests.
//
// Pure functions - db.ts stores the state, main.ts wires the triggers.

export type Slot = 'weapon' | 'armor' | 'shield';

export interface ItemDef {
  name: string;
  slot: Slot;
  tier: number;
  damage?: number;
  speed?: number;
  hp?: number;
  defense?: number;
  block?: number;
  color?: string; // armour colours the warrior
}

export const ITEMS: Record<string, ItemDef> = {
  sword_1: {
    name: 'Zardzewiały miecz',
    slot: 'weapon',
    tier: 1,
    damage: 10,
    speed: 1.0,
  },
  dagger_1: { name: 'Sztylet', slot: 'weapon', tier: 1, damage: 7, speed: 1.4 },
  sword_2: {
    name: 'Żelazny miecz',
    slot: 'weapon',
    tier: 2,
    damage: 16,
    speed: 1.0,
  },
  axe_2: {
    name: 'Ciężki topór',
    slot: 'weapon',
    tier: 2,
    damage: 22,
    speed: 0.75,
  },
  sword_3: {
    name: 'Stalowy miecz',
    slot: 'weapon',
    tier: 3,
    damage: 25,
    speed: 1.05,
  },
  dagger_3: {
    name: 'Ostrze cienia',
    slot: 'weapon',
    tier: 3,
    damage: 17,
    speed: 1.5,
  },
  sword_4: {
    name: 'Miecz rycerski',
    slot: 'weapon',
    tier: 4,
    damage: 36,
    speed: 1.1,
  },
  axe_4: {
    name: 'Topór wodza',
    slot: 'weapon',
    tier: 4,
    damage: 50,
    speed: 0.8,
  },
  sword_5: {
    name: 'Pogromca trolli',
    slot: 'weapon',
    tier: 5,
    damage: 52,
    speed: 1.2,
  },
  armor_1: {
    name: 'Skórzana kurta',
    slot: 'armor',
    tier: 1,
    hp: 0,
    defense: 0,
    color: 'blue',
  },
  armor_2: {
    name: 'Kolczuga',
    slot: 'armor',
    tier: 2,
    hp: 30,
    defense: 0.08,
    color: 'red',
  },
  armor_3: {
    name: 'Złota zbroja',
    slot: 'armor',
    tier: 3,
    hp: 65,
    defense: 0.15,
    color: 'yellow',
  },
  armor_4: {
    name: 'Zbroja maga',
    slot: 'armor',
    tier: 4,
    hp: 110,
    defense: 0.22,
    color: 'purple',
  },
  armor_5: {
    name: 'Czarna płyta',
    slot: 'armor',
    tier: 5,
    hp: 170,
    defense: 0.3,
    color: 'black',
  },
  shield_1: { name: 'Deska', slot: 'shield', tier: 1, block: 0.45 },
  shield_2: { name: 'Puklerz', slot: 'shield', tier: 2, block: 0.55 },
  shield_3: { name: 'Tarcza strażnika', slot: 'shield', tier: 3, block: 0.65 },
  shield_4: { name: 'Pawęż', slot: 'shield', tier: 4, block: 0.72 },
  shield_5: { name: 'Egida', slot: 'shield', tier: 5, block: 0.8 },
};

export interface EnemyDef {
  name: string;
  hp: number;
  dmg: number;
  cooldown: number;
  gold: number;
  boss?: boolean;
}

export const ENEMIES: Record<string, EnemyDef> = {
  gnome: { name: 'Gnom', hp: 22, dmg: 7, cooldown: 1.3, gold: 4 },
  lizard: { name: 'Jaszczur', hp: 32, dmg: 9, cooldown: 1.2, gold: 6 },
  slingshot: { name: 'Gnom z procą', hp: 20, dmg: 8, cooldown: 2.0, gold: 7 },
  snake: { name: 'Wąż', hp: 40, dmg: 13, cooldown: 1.2, gold: 9 },
  spider: { name: 'Pająk', hp: 48, dmg: 15, cooldown: 1.1, gold: 11 },
  paddle: { name: 'Rekin z wiosłem', hp: 80, dmg: 20, cooldown: 1.3, gold: 15 },
  harpoon: { name: 'Harpunnik', hp: 62, dmg: 20, cooldown: 2.0, gold: 17 },
  torch: {
    name: 'Goblin z pochodnią',
    hp: 120,
    dmg: 28,
    cooldown: 1.2,
    gold: 22,
  },
  spear: {
    name: 'Goblin z włócznią',
    hp: 110,
    dmg: 30,
    cooldown: 1.3,
    gold: 24,
  },
  gnoll: { name: 'Gnoll', hp: 95, dmg: 28, cooldown: 1.9, gold: 25 },
  thief: { name: 'Złodziej', hp: 85, dmg: 26, cooldown: 1.0, gold: 30 },
  skull: { name: 'Szkielet', hp: 190, dmg: 40, cooldown: 1.2, gold: 34 },
  bat: { name: 'Nietoperz', hp: 120, dmg: 32, cooldown: 1.4, gold: 32 },
  imp: { name: 'Diablik', hp: 150, dmg: 38, cooldown: 1.3, gold: 36 },
  shaman: { name: 'Szaman', hp: 160, dmg: 44, cooldown: 1.8, gold: 40 },
  bear: {
    name: 'Niedźwiedź Burzy',
    hp: 320,
    dmg: 20,
    cooldown: 1.5,
    gold: 120,
    boss: true,
  },
  turtle: {
    name: 'Pradawny Żółw',
    hp: 620,
    dmg: 30,
    cooldown: 1.6,
    gold: 220,
    boss: true,
  },
  panda: {
    name: 'Mistrz Panda',
    hp: 980,
    dmg: 42,
    cooldown: 1.2,
    gold: 340,
    boss: true,
  },
  minotaur: {
    name: 'Minotaur',
    hp: 1500,
    dmg: 58,
    cooldown: 1.5,
    gold: 480,
    boss: true,
  },
  troll: {
    name: 'Król Trolli',
    hp: 2300,
    dmg: 78,
    cooldown: 1.6,
    gold: 700,
    boss: true,
  },
};

export interface LandDef {
  name: string;
  enemies: string[];
  boss: string;
  sky: [string, string];
  hills: [string, string];
  ground: string;
}

// One land per game (sprint), in order; after all five the loop starts again, tougher
export const LANDS: LandDef[] = [
  {
    name: 'Zielona Dolina',
    enemies: ['gnome', 'lizard', 'slingshot'],
    boss: 'bear',
    sky: ['#6bb8eb', '#d4f0f2'],
    hills: ['#9eccc7', '#85bda8'],
    ground: '#8fc46a',
  },
  {
    name: 'Zgniłe Bagna',
    enemies: ['snake', 'spider', 'slingshot'],
    boss: 'turtle',
    sky: ['#809473', '#ccd19e'],
    hills: ['#8c996b', '#707f57'],
    ground: '#7d8f4f',
  },
  {
    name: 'Wybrzeże Rekinów',
    enemies: ['paddle', 'harpoon', 'spider'],
    boss: 'panda',
    sky: ['#4d99bf', '#bfe6e0'],
    hills: ['#6badb8', '#57949e'],
    ground: '#d9c58c',
  },
  {
    name: 'Las Goblinów',
    enemies: ['torch', 'spear', 'gnoll', 'thief'],
    boss: 'minotaur',
    sky: ['#b8734d', '#f2bf80'],
    hills: ['#8c664d', '#6b5242'],
    ground: '#7a6b45',
  },
  {
    name: 'Kraina Cieni',
    enemies: ['skull', 'bat', 'imp', 'shaman'],
    boss: 'troll',
    sky: ['#1a1738', '#5c3866'],
    hills: ['#332b52', '#262140'],
    ground: '#4a4366',
  },
];

// Blacksmith (as in the game)
export const MAX_PLUS = 5;
const PLUS_BONUS = 0.15;
const UPGRADE_COST = 40;
const BASE_HP = 100;
// Auto-battles can't dodge or drink potions like the player does - these stand in for that
const SKILL = 3;
const BLOCK_EFFECT = 0.6;

export const MIN_LENGTH = 20;
export const MAX_LENGTH = 80;
export const FREE_PLAY_LENGTH = 40;

export interface Item {
  uid: string;
  id: string;
  plus: number;
}

export interface GameResult {
  gameNo: number;
  land: number;
  sprintName: string | null;
  endedAt: string;
  outcome: 'won' | 'lost';
  reached: number; // tile reached
  length: number;
  wins: number;
  items: number;
}

export interface JourneyState {
  gameNo: number; // 0, 1, 2... - picks the land and difficulty
  seed: number; // map layout of this game
  land: number;
  loop: number; // full rounds through all lands (enemies tougher)
  sprintId: number | null; // the sprint this game belongs to (null = free play)
  sprintName: string | null;
  endsAt: string | null; // sprint end date (YYYY-MM-DD)
  length: number; // tiles; the boss stands on the last one
  status: 'active' | 'won';
  position: number;
  pendingRolls: number; // dice rolls earned by real work, not thrown yet
  penalty: number; // steps taken off the next roll (tasks that ran over their estimate)
  gold: number;
  inventory: Item[];
  equipped: Record<Slot, string>; // item uid per slot
  defeated: number[]; // tiles whose enemy is beaten
  opened: number[]; // treasure / gold tiles already looted
  stats: { steps: number; wins: number; losses: number; chests: number };
  history: GameResult[]; // finished games, newest first
}

export type TileType =
  | 'start'
  | 'path'
  | 'treasure'
  | 'gold'
  | 'camp'
  | 'skirmish'
  | 'boss';

export interface Tile {
  index: number;
  type: TileType;
  enemy?: string;
}

export type Rng = () => number;

/* eslint-disable no-bitwise */
const hash = (n: number) => {
  let x = (n + 1) * 2654435761;
  x ^= x >>> 13;
  x = Math.imul(x, 1597334677);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
/* eslint-enable no-bitwise */

/** The tile at `index` of this game's map - stable for the game, new for every game. */
export const tileAt = (
  game: Pick<JourneyState, 'seed' | 'land' | 'length'>,
  index: number,
): Tile => {
  const land = LANDS[game.land];
  if (index <= 0) return { index: 0, type: 'start' };
  if (index >= game.length - 1) {
    return { index: game.length - 1, type: 'boss', enemy: land.boss };
  }
  if (index === Math.floor(game.length / 2)) return { index, type: 'camp' };
  const r = hash(game.seed * 1000 + index);
  if (r < 0.3) {
    const pick = hash(game.seed * 7919 + index);
    return {
      index,
      type: 'skirmish',
      enemy: land.enemies[Math.floor(pick * land.enemies.length)],
    };
  }
  if (r < 0.52) return { index, type: 'treasure' };
  if (r < 0.64) return { index, type: 'gold' };
  return { index, type: 'path' };
};

// --- Items -------------------------------------------------------------------------------

export const itemStat = (item: Item, stat: keyof ItemDef) => {
  const value = Number(ITEMS[item.id]?.[stat]) || 0;
  if (stat === 'speed') return value || 1;
  const boosted = value * (1 + PLUS_BONUS * item.plus);
  if (stat === 'defense') return Math.min(boosted, 0.6);
  if (stat === 'block') return Math.min(boosted, 0.95);
  return boosted;
};

export const upgradeCost = (item: Item) =>
  UPGRADE_COST * ITEMS[item.id].tier * (item.plus + 1);

let uidCounter = 0;
export const makeItem = (id: string, rng: Rng = Math.random): Item => {
  uidCounter += 1;
  return {
    uid: `${Date.now().toString(36)}${uidCounter}${Math.floor(rng() * 1e6).toString(36)}`,
    id,
    plus: 0,
  };
};

export const randomItemOfTier = (tier: number, rng: Rng = Math.random) => {
  const t = Math.min(5, Math.max(1, tier));
  const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].tier === t);
  return makeItem(ids[Math.floor(rng() * ids.length)], rng);
};

const starterGear = () => {
  const weapon = makeItem('sword_1');
  const armor = makeItem('armor_1');
  const shield = makeItem('shield_1');
  return {
    inventory: [weapon, armor, shield],
    equipped: { weapon: weapon.uid, armor: armor.uid, shield: shield.uid },
  };
};

export interface SprintInfo {
  id: number;
  name: string;
  endDate: string | null;
  expectedRolls: number; // from the sprint's tasks (see rollsForTask)
}

/**
 * Map length for a sprint: about 75% of the tiles its planned work would walk (rolls x
 * the average die), so finishing the planned work gets you to the boss with a little slack.
 */
export const lengthForSprint = (expectedRolls: number) =>
  Math.round(
    Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, expectedRolls * 3.5 * 0.75)),
  );

/** A new game: next land, fresh map, starter gear, no gold - and one roll to begin. */
export const newGame = (
  sprint: SprintInfo | null,
  previous?: JourneyState | null,
  rng: Rng = Math.random,
): JourneyState => {
  const gameNo = previous ? previous.gameNo + 1 : 0;
  return {
    gameNo,
    seed: Math.floor(rng() * 1e9),
    land: gameNo % LANDS.length,
    loop: Math.floor(gameNo / LANDS.length),
    sprintId: sprint?.id ?? null,
    sprintName: sprint?.name ?? null,
    endsAt: sprint?.endDate ?? null,
    length: sprint ? lengthForSprint(sprint.expectedRolls) : FREE_PLAY_LENGTH,
    status: 'active',
    position: 0,
    pendingRolls: 1,
    penalty: 0,
    gold: 0,
    ...starterGear(),
    defeated: [],
    opened: [],
    stats: { steps: 0, wins: 0, losses: 0, chests: 0 },
    history: previous?.history ?? [],
  };
};

export const initialJourney = (): JourneyState => newGame(null, null);

/** Closes the current game into the history (newest first, last 20 kept). */
export const archiveGame = (state: JourneyState): GameResult => ({
  gameNo: state.gameNo,
  land: state.land,
  sprintName: state.sprintName,
  endedAt: new Date().toISOString(),
  outcome: state.status === 'won' ? 'won' : 'lost',
  reached: state.position,
  length: state.length,
  wins: state.stats.wins,
  items: state.inventory.length,
});

export const startNextGame = (
  state: JourneyState,
  sprint: SprintInfo | null,
  rng: Rng = Math.random,
) =>
  newGame(
    sprint,
    {
      ...state,
      history: [archiveGame(state), ...state.history].slice(0, 20),
    },
    rng,
  );

export const equippedItem = (state: JourneyState, slot: Slot) =>
  state.inventory.find((i) => i.uid === state.equipped[slot]) ||
  state.inventory.find((i) => ITEMS[i.id].slot === slot)!;

export const heroStats = (state: JourneyState) => {
  const weapon = equippedItem(state, 'weapon');
  const armor = equippedItem(state, 'armor');
  const shield = equippedItem(state, 'shield');
  return {
    damage: itemStat(weapon, 'damage') * itemStat(weapon, 'speed'),
    hp: BASE_HP + itemStat(armor, 'hp'),
    defense: itemStat(armor, 'defense'),
    block: itemStat(shield, 'block'),
    color: ITEMS[armor.id].color || 'blue',
  };
};

const enemyScale = (loop: number) => 1 + 0.6 * loop;

/** > 1 means the warrior is expected to win; also used for the "odds" hint. */
export const battleRatio = (state: JourneyState, enemyId: string) => {
  const hero = heroStats(state);
  const e = ENEMIES[enemyId];
  const scale =
    enemyScale(state.loop) * (e.boss ? TUNING.BOSS[state.land] ?? 1 : 1);
  const enemyDps =
    ((e.dmg * scale) / e.cooldown) *
    (1 - hero.defense) *
    (1 - hero.block * BLOCK_EFFECT);
  const timeToKill = (e.hp * scale) / hero.damage;
  const timeToDie = (hero.hp * SKILL) / enemyDps;
  return timeToDie / timeToKill;
};

export const fight = (state: JourneyState, enemyId: string, rng: Rng) =>
  battleRatio(state, enemyId) * (0.8 + rng() * 0.45) >= 1;

/**
 * Loot tier along the map: starts at 1 and climbs to the land's tier (+1 near the end), so
 * the gear needed for this land's boss is found on the way.
 */
// Balance (Monte Carlo-tuned: finishing the sprint's planned work beats the boss ~2 times
// in 3 when the gear is used well). BOSS: per-land boss strength - the game's later bosses
// are tuned for a player who dodges, which auto-battles can't.
export const TUNING = {
  LOOT_CURVE: 0.6,
  LOOT_REACH: 1.8,
  GOLD_FACTOR: 1.5,
  BOSS: [1.35, 0.95, 0.68, 0.6, 0.52] as number[],
};
const LOOT_CURVE_GET = () => TUNING.LOOT_CURVE;
const lootTier = (state: JourneyState, index: number, rng: Rng) => {
  const progress = index / Math.max(1, state.length - 1);
  return (
    1 +
    Math.floor(
      progress ** LOOT_CURVE_GET() * (state.land + TUNING.LOOT_REACH),
    ) +
    (rng() < 0.2 ? 1 : 0) +
    state.loop
  );
};

// --- Moving --------------------------------------------------------------------------------

export type JourneyEvent =
  | { type: 'item'; item: Item; source: 'treasure' | 'chest' | 'boss' }
  | { type: 'gold'; amount: number }
  | { type: 'win'; enemy: string; gold: number }
  | { type: 'lose'; enemy: string; retreatTo: number }
  | { type: 'victory' }
  | { type: 'camp' }
  | { type: 'empty' };

const clone = (s: JourneyState): JourneyState => JSON.parse(JSON.stringify(s));

/**
 * Throws one die: the warrior walks that many tiles (minus any over-estimate penalty, at
 * least 1) and the tile he lands on resolves. He can't walk past the boss. A lost battle
 * sends him back (the enemy stays) - better gear or the blacksmith is the way through.
 */
export const roll = (input: JourneyState, rng: Rng = Math.random) => {
  if (input.pendingRolls <= 0 || input.status !== 'active') return null;
  const state = clone(input);
  state.pendingRolls -= 1;
  const dice = 1 + Math.floor(rng() * 6);
  const penalty = Math.min(state.penalty, dice - 1);
  state.penalty -= penalty;
  const from = state.position;
  const target = Math.min(from + dice - penalty, state.length - 1);
  const events: JourneyEvent[] = [];
  const path: number[] = [];
  for (let p = from + 1; p <= target; p += 1) path.push(p);
  state.position = target;
  state.stats.steps += target - from;

  const tile = tileAt(state, target);
  const looted = state.opened.includes(target);
  if (tile.type === 'treasure' && !looted) {
    state.opened.push(target);
    const item = randomItemOfTier(lootTier(state, target, rng), rng);
    state.inventory.push(item);
    events.push({ type: 'item', item, source: 'treasure' });
  } else if (tile.type === 'gold' && !looted) {
    state.opened.push(target);
    const amount = Math.round(
      (20 + rng() * 40) *
        (state.land + 1) *
        TUNING.GOLD_FACTOR *
        enemyScale(state.loop),
    );
    state.gold += amount;
    events.push({ type: 'gold', amount });
  } else if (tile.type === 'camp') {
    events.push({ type: 'camp' });
  } else if (
    (tile.type === 'skirmish' || tile.type === 'boss') &&
    tile.enemy &&
    !state.defeated.includes(target)
  ) {
    if (fight(state, tile.enemy, rng)) {
      const gold = Math.round(
        ENEMIES[tile.enemy].gold *
          3 *
          TUNING.GOLD_FACTOR *
          enemyScale(state.loop),
      );
      state.gold += gold;
      state.defeated.push(target);
      state.stats.wins += 1;
      events.push({ type: 'win', enemy: tile.enemy, gold });
      if (tile.type === 'boss') {
        state.status = 'won';
        events.push({ type: 'victory' });
      }
    } else {
      state.stats.losses += 1;
      const retreatTo = Math.max(target - (tile.type === 'boss' ? 3 : 1), 0);
      events.push({ type: 'lose', enemy: tile.enemy, retreatTo });
      state.position = retreatTo;
    }
  } else {
    events.push({ type: 'empty' });
  }
  return { state, dice, penalty, from, path, events };
};

/** An achievement chest: an item at the loot tier of where the warrior stands (+1). */
export const openChest = (input: JourneyState, rng: Rng = Math.random) => {
  const state = clone(input);
  const item = randomItemOfTier(
    lootTier(state, state.position, rng) + (rng() < 0.4 ? 1 : 0),
    rng,
  );
  state.inventory.push(item);
  state.stats.chests += 1;
  return { state, item };
};

export const equip = (input: JourneyState, uid: string) => {
  const item = input.inventory.find((i) => i.uid === uid);
  if (!item) return input;
  const state = clone(input);
  state.equipped[ITEMS[item.id].slot] = uid;
  return state;
};

export const upgrade = (input: JourneyState, uid: string) => {
  const item = input.inventory.find((i) => i.uid === uid);
  if (!item || item.plus >= MAX_PLUS) return null;
  const cost = upgradeCost(item);
  if (input.gold < cost) return null;
  const state = clone(input);
  state.gold -= cost;
  state.inventory.find((i) => i.uid === uid)!.plus += 1;
  return state;
};

/** Sells an unequipped item (frees the bag, gives gold for the blacksmith). */
export const sell = (input: JourneyState, uid: string) => {
  const item = input.inventory.find((i) => i.uid === uid);
  if (!item || Object.values(input.equipped).includes(uid)) return null;
  const state = clone(input);
  state.gold += Math.round(upgradeCost(item) * 0.4) + 10 * ITEMS[item.id].tier;
  state.inventory = state.inventory.filter((i) => i.uid !== uid);
  return state;
};

// --- Rolls for real work ---------------------------------------------------------------------

/**
 * Dice rolls a finished task is worth - bigger tasks, more rolls: by story points
 * (1-2 → 1, 3 → 2, 5 → 3, 8 → 4, 13+ → 5) or, without points, by estimated hours
 * (≤1 → 1, ≤3 → 2, ≤6 → 3, ≤12 → 4, more → 5). A task that took longer than its estimate
 * also costs one step off the next roll.
 */
export const rollsForTask = (task: {
  storyPoints?: number | null;
  estimate?: number | null; // hours
  spendTime?: number | null; // ms
}) => {
  const sp = Number(task.storyPoints) || 0;
  const hours = Number(task.estimate) || 0;
  let rolls = 1;
  if (sp > 0) {
    if (sp >= 13) rolls = 5;
    else if (sp >= 8) rolls = 4;
    else if (sp >= 5) rolls = 3;
    else if (sp >= 3) rolls = 2;
  } else if (hours > 0) {
    if (hours > 12) rolls = 5;
    else if (hours > 6) rolls = 4;
    else if (hours > 3) rolls = 3;
    else if (hours > 1) rolls = 2;
  }
  const overEstimate =
    hours > 0 && (Number(task.spendTime) || 0) > hours * 3600000;
  return { rolls, penalty: overEstimate ? 1 : 0 };
};

// Other real work
export const ROLLS = {
  FOCUS_BLOCK: 1,
  HABIT: 1,
  QUEST: 2,
};

/** Has the sprint this game belongs to ended (its end date is in the past)? */
export const sprintOver = (state: JourneyState, today: string) =>
  !!state.endsAt && state.endsAt.slice(0, 10) < today;
