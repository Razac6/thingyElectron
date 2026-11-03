import React from 'react';
import { Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ITEMS,
  Item,
  JourneyState,
  LANDS,
  MAX_PLUS,
  Slot,
  battleRatio,
  equippedItem,
  heroStats,
  itemStat,
  upgradeCost,
} from '../../../main/journey';
import Sprite from './Sprite';
import { HERO, ICON } from './assets';
import { itemTitle, oddsLabel, tierOf } from './journeyText';
import useJourney from './useJourney';

// The warrior's gear on the Profile page: what's equipped, the bag, and the blacksmith
// (upgrade with gold found on the trail). Armour also changes the warrior's colours.

const SLOTS: { slot: Slot; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Weapon', icon: ICON.sword.src },
  { slot: 'armor', label: 'Armour', icon: ICON.shield.src },
  { slot: 'shield', label: 'Shield', icon: ICON.shield.src },
];

const statsText = (item: Item) => {
  const def = ITEMS[item.id];
  if (def.slot === 'weapon') {
    return `Damage ${Math.round(itemStat(item, 'damage'))} · speed ${itemStat(item, 'speed')}`;
  }
  if (def.slot === 'armor') {
    return `HP +${Math.round(itemStat(item, 'hp'))} · protection ${Math.round(itemStat(item, 'defense') * 100)}%`;
  }
  return `Block ${Math.round(itemStat(item, 'block') * 100)}%`;
};

function ItemRow({
  item,
  equipped,
  gold,
  onEquip,
  onUpgrade,
  onSell,
}: {
  item: Item;
  equipped: boolean;
  gold: number;
  onEquip: () => void;
  onUpgrade: () => void;
  onSell: () => void;
}) {
  const tier = tierOf(item);
  const cost = upgradeCost(item);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 1,
        borderRadius: 2,
        border: 1,
        borderColor: equipped ? alpha(tier.color, 0.6) : 'divider',
        bgcolor: equipped ? alpha(tier.color, 0.08) : 'transparent',
      }}
    >
      <Box
        sx={{
          width: 4,
          alignSelf: 'stretch',
          borderRadius: 2,
          bgcolor: tier.color,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {itemTitle(item)}{' '}
          <Typography
            component="span"
            variant="caption"
            sx={{ color: tier.color }}
          >
            {tier.name}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {statsText(item)}
        </Typography>
      </Box>
      {equipped ? (
        <Typography variant="caption" color="text.secondary">
          Equipped
        </Typography>
      ) : (
        <>
          <Button size="small" onClick={onEquip}>
            Equip
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={onSell}
            sx={{ color: 'text.secondary' }}
          >
            Sell
          </Button>
        </>
      )}
      <Tooltip
        title={
          item.plus >= MAX_PLUS
            ? 'Fully upgraded'
            : `Blacksmith: +1 for ${cost} gold`
        }
      >
        <span>
          <Button
            size="small"
            variant="outlined"
            disabled={item.plus >= MAX_PLUS || gold < cost}
            onClick={onUpgrade}
            sx={{ minWidth: 0, whiteSpace: 'nowrap' }}
          >
            +1 · {cost}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}

export default function WarriorPanel() {
  const { enabled, state, setState } = useJourney();
  if (!enabled || !state) return null;

  const hero = heroStats(state);
  const land = LANDS[state.land];
  const odds = oddsLabel(battleRatio(state, land.boss));
  const equippedUids = Object.values(state.equipped);

  const apply = async (call: Promise<JourneyState | null>) => {
    const next = await call;
    if (next) setState(next);
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Warrior */}
        <Box sx={{ width: 200, textAlign: 'center' }}>
          <Typography variant="subtitle2" sx={{ textAlign: 'left' }}>
            Your warrior
          </Typography>
          <Box
            sx={{
              mt: 1,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${land.sky[0]}, ${land.sky[1]})`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              height: 150,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ mb: -2 }}>
              <Sprite sheet={HERO[hero.color].idle} size={170} />
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 0.5,
              mt: 1,
            }}
          >
            <Box
              component="img"
              src={ICON.gold.src}
              alt=""
              sx={{ width: 20, imageRendering: 'pixelated' }}
            />
            <Typography variant="body2" fontWeight={600}>
              {state.gold} gold
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" component="div">
            Damage {Math.round(hero.damage)} · HP {Math.round(hero.hp)}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {land.name} boss:{' '}
            <Box component="span" sx={{ color: odds.color, fontWeight: 600 }}>
              {odds.text}
            </Box>
          </Typography>
          <Typography variant="caption" color="text.disabled" component="div">
            {state.stats.wins} wins · {state.stats.chests} chests ·{' '}
            {state.stats.steps} tiles
          </Typography>
        </Box>

        {/* Gear */}
        <Box sx={{ flex: 1, minWidth: 300 }}>
          {SLOTS.map(({ slot, label }) => {
            const items = state.inventory
              .filter((i) => ITEMS[i.id]?.slot === slot)
              .sort(
                (a, b) =>
                  ITEMS[b.id].tier - ITEMS[a.id].tier || b.plus - a.plus,
              );
            const current = equippedItem(state, slot);
            return (
              <Box key={slot} sx={{ mb: 1.5 }}>
                <Typography variant="overline" color="text.secondary">
                  {label}
                </Typography>
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
                >
                  {items.map((item) => (
                    <ItemRow
                      key={item.uid}
                      item={item}
                      equipped={
                        item.uid === current.uid ||
                        equippedUids.includes(item.uid)
                      }
                      gold={state.gold}
                      onEquip={() =>
                        apply(
                          window.electron.database.equipJourneyItem(item.uid),
                        )
                      }
                      onUpgrade={() =>
                        apply(
                          window.electron.database.upgradeJourneyItem(item.uid),
                        )
                      }
                      onSell={() =>
                        apply(
                          window.electron.database.sellJourneyItem(item.uid),
                        )
                      }
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}
