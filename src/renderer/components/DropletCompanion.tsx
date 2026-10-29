import React from 'react';
import { Box, keyframes } from '@mui/material';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';

// "Drop" - the assistant's own character: a small droplet of the same liquid as the
// app's loaders, in the theme accent color. Pure SVG + CSS, so it can react to what's
// going on instead of looping one canned animation:
//   idle   - breathes and blinks
//   focus  - a timer runs: narrowed, determined eyes and a soft glow
//   happy  - hovered: ^ ^ eyes and a little bounce
//   sleep  - late at night: eyes closed, floating "z"
// `talking` (a speech bubble is open) animates the mouth on top of any mood.

export type DropletMood = 'idle' | 'focus' | 'happy' | 'sleep';

const breathe = keyframes`
  0%, 100% { transform: scale(1, 1) translateY(0); }
  50% { transform: scale(1.03, 0.97) translateY(2px); }
`;
const bounce = keyframes`
  0%, 100% { transform: translateY(0) scale(1, 1); }
  30% { transform: translateY(-10px) scale(0.96, 1.04); }
  55% { transform: translateY(0) scale(1.05, 0.95); }
`;
const blink = keyframes`
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
`;
const talk = keyframes`
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1.2); }
`;
const glow = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(0.95); }
  50% { opacity: 0.7; transform: scale(1.08); }
`;
const floatZ = keyframes`
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(10px, -22px) scale(1); }
`;

// Teardrop body, tip at the top
const BODY =
  'M60 10 C60 10 98 52 98 76 A38 38 0 0 1 22 76 C22 52 60 10 60 10 Z';

export default function DropletCompanion({
  mood = 'idle',
  talking = false,
}: {
  mood?: DropletMood;
  talking?: boolean;
}) {
  const theme = useTheme();
  const body = theme.palette.secondary.main;
  const ink = '#16181c';
  const gradientId = React.useId();

  const eyeY = 74;
  const eyes = (() => {
    switch (mood) {
      case 'happy': // ^ ^
        return (
          <g stroke={ink} strokeWidth={3.2} fill="none" strokeLinecap="round">
            <path d="M40 76 Q46 68 52 76" />
            <path d="M68 76 Q74 68 80 76" />
          </g>
        );
      case 'sleep': // closed
        return (
          <g stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M40 74 Q46 79 52 74" />
            <path d="M68 74 Q74 79 80 74" />
          </g>
        );
      case 'focus': // narrowed, with determined brows
        return (
          <g>
            <g stroke={ink} strokeWidth={2.6} strokeLinecap="round">
              <path d="M39 64 L52 67" />
              <path d="M81 64 L68 67" />
            </g>
            <ellipse cx={46} cy={eyeY} rx={5.5} ry={3.6} fill={ink} />
            <ellipse cx={74} cy={eyeY} rx={5.5} ry={3.6} fill={ink} />
          </g>
        );
      default: // idle - round eyes that blink
        return (
          <Box
            component="g"
            sx={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `${blink} 4.5s ease-in-out infinite`,
            }}
          >
            <ellipse cx={46} cy={eyeY} rx={5.5} ry={7} fill={ink} />
            <ellipse cx={74} cy={eyeY} rx={5.5} ry={7} fill={ink} />
            <circle cx={48} cy={71} r={1.8} fill="#fff" />
            <circle cx={76} cy={71} r={1.8} fill="#fff" />
          </Box>
        );
    }
  })();

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {mood === 'focus' && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: '18% 14% 2%',
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${alpha(body, 0.55)}, transparent)`,
            filter: 'blur(8px)',
            animation: `${glow} 3s ease-in-out infinite`,
          }}
        />
      )}
      {mood === 'sleep' && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '8%',
            right: '16%',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: alpha(ink, 0.6),
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
          animation:
            mood === 'happy'
              ? `${bounce} 0.9s ease-in-out infinite`
              : `${breathe} ${mood === 'sleep' ? 5 : 3.2}s ease-in-out infinite`,
        }}
      >
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor={lighten(body, 0.45)} />
            <stop offset="60%" stopColor={body} />
            <stop offset="100%" stopColor={darken(body, 0.18)} />
          </radialGradient>
        </defs>
        {/* Ground shadow */}
        <ellipse cx={60} cy={114} rx={30} ry={4} fill={alpha(ink, 0.12)} />
        <path d={BODY} fill={`url(#${gradientId})`} />
        {/* Shine */}
        <ellipse
          cx={44}
          cy={50}
          rx={6}
          ry={11}
          fill="#fff"
          opacity={0.45}
          transform="rotate(25 44 50)"
        />
        {/* Cheeks */}
        <ellipse
          cx={36}
          cy={86}
          rx={6}
          ry={3.5}
          fill="#ff7aa8"
          opacity={0.35}
        />
        <ellipse
          cx={84}
          cy={86}
          rx={6}
          ry={3.5}
          fill="#ff7aa8"
          opacity={0.35}
        />
        {eyes}
        {/* Mouth */}
        {talking ? (
          <Box
            component="ellipse"
            cx={60}
            cy={90}
            rx={4.5}
            ry={3.5}
            fill={ink}
            sx={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `${talk} 0.32s ease-in-out infinite`,
            }}
          />
        ) : (
          <path
            d={mood === 'focus' ? 'M55 90 L65 90' : 'M54 88 Q60 94 66 88'}
            stroke={ink}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </Box>
    </Box>
  );
}
