import React from 'react';
import { Box } from '@mui/material';
import type { DropletMood } from '../DropletCompanion';
import { heroStats } from '../../../main/journey';
import Sprite from './Sprite';
import { HERO } from './assets';
import useJourney from './useJourney';

// The warrior from the journey as the assistant character - wearing the armour you equipped.
//   idle  - breathing idle   focus - same, calmer   happy (hover) - sword swing
//   sleep - very slow idle

export default function WarriorCompanion({
  mood = 'idle',
  size = 150,
}: {
  mood?: DropletMood;
  size?: number;
}) {
  const { state } = useJourney();
  const color = state ? heroStats(state).color : 'blue';
  const sheets = HERO[color] || HERO.blue;
  const fps = { idle: 8, focus: 6, happy: 12, sleep: 3 }[mood];
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
        sheet={mood === 'happy' ? sheets.attack : sheets.idle}
        size={size}
        fps={fps}
      />
    </Box>
  );
}

WarriorCompanion.defaultProps = { mood: 'idle', size: 150 };
