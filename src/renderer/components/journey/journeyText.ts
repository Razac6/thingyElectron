import { ENEMIES, ITEMS, Item, JourneyEvent } from '../../../main/journey';

// Item rarity by tier - colours as in the game (grey, green, blue, purple, orange)
export const TIER = [
  { name: 'Common', color: '#9e9e9e' },
  { name: 'Uncommon', color: '#4caf50' },
  { name: 'Rare', color: '#4a90e2' },
  { name: 'Epic', color: '#a64dff' },
  { name: 'Legendary', color: '#ff9f1a' },
];

export const tierOf = (item: Item) =>
  TIER[Math.min(4, Math.max(0, ITEMS[item.id].tier - 1))];

export const itemTitle = (item: Item) =>
  `${ITEMS[item.id].name}${item.plus ? ` +${item.plus}` : ''}`;

export const eventText = (e: JourneyEvent): string => {
  switch (e.type) {
    case 'item': {
      const from = { treasure: 'Treasure', chest: 'Chest', boss: 'Boss loot' }[
        e.source
      ];
      return `${from}: ${itemTitle(e.item)} (${tierOf(e.item).name})`;
    }
    case 'gold':
      return `Found ${e.amount} gold`;
    case 'win':
      return `Defeated ${ENEMIES[e.enemy].name}! +${e.gold} gold`;
    case 'lose':
      return `${ENEMIES[e.enemy].name} was too strong – you fall back. Upgrade your gear at the blacksmith.`;
    case 'camp':
      return 'A quiet camp by the road.';
    case 'victory':
      return 'Victory! The boss is defeated – a new journey starts with the next sprint.';
    default:
      return 'A peaceful stretch of road.';
  }
};

/** How the warrior's chances look against an enemy, from the battle ratio. */
export const oddsLabel = (ratio: number) => {
  if (ratio >= 1.4) return { text: 'easy', color: 'success.main' };
  if (ratio >= 1.05) return { text: 'even', color: 'warning.main' };
  return { text: 'too strong', color: 'error.main' };
};
