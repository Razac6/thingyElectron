import React from 'react';
import { Box, keyframes } from '@mui/material';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';
import type { DropletMood } from './DropletCompanion';

// "Hoot" - an owl assistant character, drawn in SVG and tinted with the theme accent.
// Same moods as the droplet (see DropletCompanion):
//   idle  - sways and blinks
//   focus - a timer runs: puts on reading glasses, eyes narrowed
//   happy - hovered: ^ ^ eyes and flapping wings
//   sleep - late at night: eyes closed, head nodding, floating "z"
// `talking` opens and closes the beak.
// `variant="peek"`: enlarged so only the head and shoulders show above the bottom edge
// of the window, the way the cat companion peeks in.

const sway = keyframes`
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
`;
const nod = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(3px) rotate(-4deg); }
`;
const hop = keyframes`
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
`;
const flapLeft = keyframes`
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-28deg); }
`;
const flapRight = keyframes`
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(28deg); }
`;
const blink = keyframes`
  0%, 90%, 100% { transform: scaleY(0); }
  94% { transform: scaleY(1); }
`;
const beak = keyframes`
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.6); }
`;
const floatZ = keyframes`
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(10px, -22px) scale(1); }
`;

const INK = '#16181c';
const BEAK = '#f2a33a';

export default function OwlCompanion({
  mood = 'idle',
  talking = false,
  variant = 'full',
}: {
  mood?: DropletMood;
  talking?: boolean;
  variant?: 'full' | 'peek';
}) {
  const peek = variant === 'peek';
  const theme = useTheme();
  const accent = theme.palette.secondary.main;
  const feathers = darken(accent, 0.25); // body
  const wingColor = darken(accent, 0.4);
  const belly = lighten(accent, 0.55);
  const gradientId = React.useId();

  // Eyes: big white discs with pupils; the mood changes what's drawn on top
  const pupils = (() => {
    switch (mood) {
      case 'happy':
        return (
          <g stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round">
            <path d="M37 52 Q44 44 51 52" />
            <path d="M69 52 Q76 44 83 52" />
          </g>
        );
      case 'sleep':
        return (
          <g stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M37 50 Q44 56 51 50" />
            <path d="M69 50 Q76 56 83 50" />
          </g>
        );
      case 'focus':
        return (
          <g>
            {/* Eyelids half down - concentrating */}
            <circle cx={44} cy={52} r={6} fill={INK} />
            <circle cx={76} cy={52} r={6} fill={INK} />
            <path d="M32 50 A12 12 0 0 1 56 50 Z" fill={feathers} />
            <path d="M64 50 A12 12 0 0 1 88 50 Z" fill={feathers} />
            {/* Reading glasses */}
            <g stroke={INK} strokeWidth={2.2} fill="none">
              <circle cx={44} cy={51} r={13} />
              <circle cx={76} cy={51} r={13} />
              <path d="M57 50 Q60 47 63 50" />
            </g>
          </g>
        );
      default:
        return (
          <g>
            <circle cx={44} cy={51} r={6.5} fill={INK} />
            <circle cx={76} cy={51} r={6.5} fill={INK} />
            <circle cx={46.5} cy={48.5} r={2} fill="#fff" />
            <circle cx={78.5} cy={48.5} r={2} fill="#fff" />
            {/* Eyelids that sweep down for a blink */}
            <Box
              component="g"
              sx={{
                transformBox: 'fill-box',
                transformOrigin: 'top',
                animation: `${blink} 5s ease-in-out infinite`,
              }}
            >
              <circle cx={44} cy={51} r={11} fill={feathers} />
              <circle cx={76} cy={51} r={11} fill={feathers} />
            </Box>
          </g>
        );
    }
  })();

  const bodyAnimation = {
    idle: `${sway} 4s ease-in-out infinite`,
    focus: `${sway} 6s ease-in-out infinite`,
    happy: `${hop} 0.7s ease-in-out infinite`,
    sleep: `${nod} 3.5s ease-in-out infinite`,
  }[mood];

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      {mood === 'sleep' && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '2%',
            right: '14%',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: alpha(INK, 0.6),
            animation: `${floatZ} 2.6s ease-out infinite`,
          }}
        >
          z
        </Box>
      )}
      <Box
        component="svg"
        viewBox="0 0 120 120"
        role="img"
        aria-label="Assistant"
        sx={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          transformOrigin: '50% 100%',
          animation: bodyAnimation,
        }}
      >
        <defs>
          <radialGradient id={gradientId} cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor={lighten(feathers, 0.25)} />
            <stop offset="100%" stopColor={feathers} />
          </radialGradient>
        </defs>

        {/* Peek: scale up and push down so the belly and feet fall below the edge */}
        <g
          transform={
            peek ? 'translate(60 -10) scale(1.3) translate(-60 0)' : undefined
          }
        >
          {!peek && (
            <ellipse cx={60} cy={114} rx={28} ry={4} fill={alpha(INK, 0.12)} />
          )}

          {/* Wings (behind the body), hinged at the shoulders */}
          <Box
            component="path"
            d="M26 62 C12 72 14 96 30 102 C30 88 30 74 34 64 Z"
            fill={wingColor}
            sx={{
              transformBox: 'fill-box',
              transformOrigin: '100% 0%',
              animation:
                mood === 'happy'
                  ? `${flapLeft} 0.35s ease-in-out infinite`
                  : 'none',
            }}
          />
          <Box
            component="path"
            d="M94 62 C108 72 106 96 90 102 C90 88 90 74 86 64 Z"
            fill={wingColor}
            sx={{
              transformBox: 'fill-box',
              transformOrigin: '0% 0%',
              animation:
                mood === 'happy'
                  ? `${flapRight} 0.35s ease-in-out infinite`
                  : 'none',
            }}
          />

          {/* Ear tufts */}
          <path d="M32 30 L28 10 L46 24 Z" fill={feathers} />
          <path d="M88 30 L92 10 L74 24 Z" fill={feathers} />

          {/* Body */}
          <path
            d="M60 18 C88 18 96 42 96 70 C96 96 80 108 60 108 C40 108 24 96 24 70 C24 42 32 18 60 18 Z"
            fill={`url(#${gradientId})`}
          />

          {/* Belly with feather marks */}
          <ellipse cx={60} cy={86} rx={20} ry={19} fill={belly} />
          <g
            stroke={alpha(wingColor, 0.55)}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          >
            <path d="M51 80 L54 83 L57 80" />
            <path d="M63 80 L66 83 L69 80" />
            <path d="M57 90 L60 93 L63 90" />
          </g>

          {/* Face: eye discs */}
          <circle cx={44} cy={51} r={11} fill="#fff" />
          <circle cx={76} cy={51} r={11} fill="#fff" />
          {pupils}

          {/* Beak */}
          <Box
            component="path"
            d="M55 62 L65 62 L60 71 Z"
            fill={BEAK}
            sx={{
              transformBox: 'fill-box',
              transformOrigin: 'top',
              animation: talking ? `${beak} 0.3s ease-in-out infinite` : 'none',
            }}
          />

          {/* Feet */}
          {!peek && (
            <g fill={BEAK}>
              <ellipse cx={50} cy={108} rx={6} ry={3} />
              <ellipse cx={70} cy={108} rx={6} ry={3} />
            </g>
          )}
        </g>
      </Box>
    </Box>
  );
}
