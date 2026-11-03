import React, { useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import Lottie from 'lottie-react';
import catAnimation from '../../../assets/Cat Movement.json';
import DropletCompanion from './DropletCompanion';
import OwlCompanion from './OwlCompanion';
import DogCompanion from './DogCompanion';
import { SnakePreview } from './SnakeCompanion';
import WarriorCompanion from './journey/WarriorCompanion';

// Assistant character picker with live previews - each card shows the character the way
// it appears in the app (the animals peeking over the bottom edge), and hovering a card
// shows its happy reaction.

export type CompanionCharacter =
  | 'warrior'
  | 'droplet'
  | 'owl'
  | 'dog'
  | 'snake'
  | 'cat';

const CHARACTERS: { id: CompanionCharacter; label: string }[] = [
  { id: 'warrior', label: 'Warrior' },
  { id: 'droplet', label: 'Drop' },
  { id: 'owl', label: 'Owl' },
  { id: 'dog', label: 'Dog' },
  { id: 'snake', label: 'Snake' },
  { id: 'cat', label: 'Cat' },
];

export const normalizeCharacter = (value?: string): CompanionCharacter =>
  CHARACTERS.some((c) => c.id === value)
    ? (value as CompanionCharacter)
    : 'droplet';

function Preview({
  id,
  hovered,
}: {
  id: CompanionCharacter;
  hovered: boolean;
}) {
  const mood = hovered ? 'happy' : 'idle';
  switch (id) {
    case 'owl':
      return <OwlCompanion mood={mood} variant="peek" />;
    case 'dog':
      return <DogCompanion mood={mood} variant="peek" />;
    case 'cat':
      return <Lottie animationData={catAnimation} loop />;
    case 'snake':
      return <SnakePreview hovered={hovered} />;
    case 'warrior':
      return <WarriorCompanion mood={mood} size={120} />;
    default:
      return <DropletCompanion mood={mood} />;
  }
}

export default function CompanionPicker({
  value,
  onChange,
}: {
  value: CompanionCharacter;
  onChange: (value: CompanionCharacter) => void;
}) {
  const [hovered, setHovered] = useState<CompanionCharacter | null>(null);

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {CHARACTERS.map(({ id, label }) => {
        const selected = id === value;
        // Animals peek like in the app: the bottom of the drawing is cut off by the card
        const peeks = id === 'owl' || id === 'dog' || id === 'cat';
        return (
          <ButtonBase
            key={id}
            onClick={() => onChange(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            aria-pressed={selected}
            aria-label={`${label} assistant`}
            sx={{
              flexDirection: 'column',
              width: 104,
              borderRadius: '18px',
              overflow: 'hidden',
              border: 2,
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: 'background.default',
              transition: 'border-color 0.2s',
              '&:hover': {
                borderColor: selected ? 'primary.main' : 'text.secondary',
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: 92,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 104,
                  height: peeks ? 128 : 92,
                  top: peeks ? 4 : 0,
                }}
              >
                <Preview id={id} hovered={hovered === id} />
              </Box>
            </Box>
            <Typography
              variant="caption"
              sx={{
                py: 0.75,
                width: '100%',
                fontWeight: 600,
                color: selected ? 'text.primary' : 'text.secondary',
                bgcolor: 'background.paper',
              }}
            >
              {label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
