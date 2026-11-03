import {
  LANDS,
  MAX_LENGTH,
  MIN_LENGTH,
  battleRatio,
  equip,
  heroStats,
  initialJourney,
  JourneyState,
  lengthForSprint,
  makeItem,
  newGame,
  roll,
  rollsForTask,
  sell,
  sprintOver,
  startNextGame,
  tileAt,
  upgrade,
  upgradeCost,
} from './journey';

const seq = (...values: number[]) => {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
};

const sprint = {
  id: 7,
  name: 'Sprint 7',
  endDate: '2026-11-14',
  expectedRolls: 16,
};

describe('journey: one game per sprint', () => {
  it('a new game: land by game number, starter gear, one roll, boss at the end', () => {
    const game = newGame(sprint, null);
    expect(game).toMatchObject({
      gameNo: 0,
      land: 0,
      sprintId: 7,
      endsAt: '2026-11-14',
      pendingRolls: 1,
      gold: 0,
      status: 'active',
    });
    expect(game.inventory.map((i) => i.id)).toEqual([
      'sword_1',
      'armor_1',
      'shield_1',
    ]);
    expect(tileAt(game, 0).type).toBe('start');
    expect(tileAt(game, game.length - 1)).toMatchObject({
      type: 'boss',
      enemy: 'bear',
    });
    expect(tileAt(game, Math.floor(game.length / 2)).type).toBe('camp');
  });

  it('map length follows the planned work', () => {
    expect(lengthForSprint(16)).toBe(42);
    expect(lengthForSprint(1)).toBe(MIN_LENGTH);
    expect(lengthForSprint(500)).toBe(MAX_LENGTH);
  });

  it('the next sprint is a new game in the next land; the old one goes to history', () => {
    const first = { ...newGame(sprint, null), position: 30, gold: 500 };
    const second = startNextGame(first, { ...sprint, id: 8, name: 'Sprint 8' });
    expect(second).toMatchObject({
      gameNo: 1,
      land: 1,
      position: 0,
      gold: 0,
      sprintId: 8,
    });
    expect(second.history[0]).toMatchObject({
      outcome: 'lost',
      reached: 30,
      land: 0,
    });
    expect(second.seed).not.toBe(first.seed);
    // after all five lands: back to the first one, one loop tougher
    const sixth = newGame(sprint, { ...first, gameNo: 4 });
    expect(sixth).toMatchObject({ land: 0, loop: 1 });
  });

  it('knows when its sprint is over', () => {
    const game = newGame(sprint, null);
    expect(sprintOver(game, '2026-11-14')).toBe(false);
    expect(sprintOver(game, '2026-11-15')).toBe(true);
    expect(sprintOver(newGame(null, null), '2030-01-01')).toBe(false);
  });
});

describe('journey: rolls for work', () => {
  it('bigger tasks give more rolls; over-estimate costs a step', () => {
    expect(rollsForTask({ storyPoints: 1 })).toEqual({ rolls: 1, penalty: 0 });
    expect(rollsForTask({ storyPoints: 5 })).toEqual({ rolls: 3, penalty: 0 });
    expect(rollsForTask({ storyPoints: 13 })).toEqual({ rolls: 5, penalty: 0 });
    expect(rollsForTask({ estimate: 4 })).toEqual({ rolls: 3, penalty: 0 });
    expect(rollsForTask({ estimate: 2, spendTime: 3 * 3600000 })).toEqual({
      rolls: 2,
      penalty: 1,
    });
    expect(rollsForTask({})).toEqual({ rolls: 1, penalty: 0 });
  });
});

describe('journey: moving and fighting', () => {
  const game = (over: Partial<JourneyState> = {}): JourneyState => ({
    ...newGame(sprint, null),
    ...over,
  });

  it('moves by the dice minus the penalty (at least one step)', () => {
    const result = roll(game({ penalty: 1 }), seq(0.5, 0.1, 0.1))!; // die 4
    expect(result.dice).toBe(4);
    expect(result.penalty).toBe(1);
    expect(result.path).toEqual([1, 2, 3]);
    expect(result.state.penalty).toBe(0);
    expect(roll(game({ pendingRolls: 0 }))).toBeNull();
  });

  it("stops at the boss and can't go past him; beating him wins the game", () => {
    const g = game();
    const nearBoss = { ...g, position: g.length - 3 };
    const result = roll(nearBoss, seq(0.99, 0.99))!; // die 6, best fight luck
    expect(result.path[result.path.length - 1]).toBe(g.length - 1);
    // starter gear vs the bear: ratio is below 1, so even luck can lose; with luck 0.99
    // the multiplier is 1.25
    if (result.events.some((e) => e.type === 'win')) {
      expect(result.state.status).toBe('won');
      expect(result.events).toContainEqual({ type: 'victory' });
      expect(roll({ ...result.state, pendingRolls: 1 })).toBeNull();
    } else {
      expect(result.state.position).toBe(g.length - 4);
    }
  });

  it('starter gear loses to the first boss; upgraded gear beats him', () => {
    const start = game();
    expect(battleRatio(start, 'bear')).toBeLessThan(1);
    expect(battleRatio(start, 'gnome')).toBeGreaterThan(1);
    // gear from the end of the first land: tier 2, upgraded once
    const loot = ['sword_2', 'armor_2', 'shield_2'].map((id) => ({
      ...makeItem(id),
      plus: 1,
    }));
    let ready: JourneyState = {
      ...start,
      inventory: [...start.inventory, ...loot],
    };
    loot.forEach((item) => {
      ready = equip(ready, item.uid);
    });
    expect(battleRatio(ready, 'bear')).toBeGreaterThan(1);
  });

  it('armour colours the warrior; equip / upgrade / sell', () => {
    const state = initialJourney();
    expect(heroStats(state).color).toBe('blue');
    const mail = makeItem('armor_2');
    const withMail = equip(
      { ...state, inventory: [...state.inventory, mail] },
      mail.uid,
    );
    expect(heroStats(withMail).color).toBe('red');

    const sword = withMail.inventory.find((i) => i.id === 'sword_1')!;
    expect(upgrade(withMail, sword.uid)).toBeNull(); // no gold
    const upgraded = upgrade({ ...withMail, gold: 100 }, sword.uid)!;
    expect(upgraded.gold).toBe(100 - upgradeCost(sword));
    expect(upgraded.inventory.find((i) => i.uid === sword.uid)!.plus).toBe(1);

    expect(sell(upgraded, sword.uid)).toBeNull(); // equipped
    const oldArmor = upgraded.inventory.find((i) => i.id === 'armor_1')!;
    const sold = sell(upgraded, oldArmor.uid)!;
    expect(sold.inventory.some((i) => i.uid === oldArmor.uid)).toBe(false);
    expect(sold.gold).toBeGreaterThan(upgraded.gold);
  });

  it('every land has its boss', () => {
    LANDS.forEach((land, i) => {
      const g = newGame(sprint, { ...initialJourney(), gameNo: i - 1 });
      expect(g.land).toBe(i);
      expect(tileAt(g, g.length - 1).enemy).toBe(land.boss);
    });
  });
});
