import React from 'react';
import { Box } from '@mui/material';
import type { DropletMood } from '../DropletCompanion';
import Sprite from './Sprite';
import { HERO, HERO_FEET, HERO_TOP, MONSTERS } from './assets';

// Pixel-art assistant characters: the blue warrior or one of the monsters.
//   idle  - breathing idle   focus - same, calmer   happy (hover) - faster (warrior: sword swing)
//   sleep - very slow idle
// Every character stands with its feet where the warrior's are and is drawn about as tall,
// whatever the size of its sprite frames.

const FPS: Record<DropletMood, number> = {
  idle: 8,
  focus: 6,
  happy: 12,
  sleep: 3,
};

export function MonsterCompanion({
  monster,
  mood = 'idle',
  size = 150,
}: {
  monster: string;
  mood?: DropletMood;
  size?: number;
}) {
  const art = MONSTERS[monster];
  if (!art) return null;
  // the warrior's drawing height and feet line in a `size` box
  const heroScale = size / HERO.idle.frameHeight;
  const target = (HERO_FEET - HERO_TOP) * heroScale;
  // as tall as the warrior, but never wider than most of the box
  const scale = Math.min(
    target / (art.feet - art.top),
    (size * 0.8) / art.width,
  );
  const frame = art.sheet.frameHeight * scale;
  const feetY = HERO_FEET * heroScale;
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: feetY - art.feet * scale,
            transform: 'translateX(-50%)',
          }}
        >
          <Sprite sheet={art.sheet} size={frame} fps={FPS[mood]} />
        </Box>
      </Box>
    </Box>
  );
}

MonsterCompanion.defaultProps = { mood: 'idle', size: 150 };

export default function WarriorCompanion({
  mood = 'idle',
  size = 150,
}: {
  mood?: DropletMood;
  size?: number;
}) {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <Sprite
        sheet={mood === 'happy' ? HERO.attack : HERO.idle}
        size={size}
        fps={FPS[mood]}
      />
    </Box>
  );
}

WarriorCompanion.defaultProps = { mood: 'idle', size: 150 };
