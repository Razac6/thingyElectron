import React from 'react';
import { Box, keyframes } from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import type { DropletMood } from './DropletCompanion';

// "Biscuit" - a puppy assistant character, drawn in SVG. Natural fur colors, with the
// theme accent on the collar and tag. Same moods as the droplet (see DropletCompanion):
//   idle  - slow tail wag, blinks
//   focus - a timer runs: ears up, eyes narrowed, tail still
//   happy - hovered: tongue out, fast wag, a little hop
//   sleep - late at night: ears droop, eyes closed, floating "z"
// `talking` opens and closes the mouth.
// `variant="peek"`: just the head and two paws gripping the bottom edge of the window,
// the way the cat companion peeks in - the rest of the body stays out of view.

const wagSlow = keyframes`
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(14deg); }
`;
const wagFast = keyframes`
  0%, 100% { transform: rotate(-18deg); }
  50% { transform: rotate(22deg); }
`;
const hop = keyframes`
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
`;
const breathe = keyframes`
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.02, 0.98); }
`;
const tilt = keyframes`
  0%, 70%, 100% { transform: rotate(0deg); }
  80%, 90% { transform: rotate(-6deg); }
`;
const blink = keyframes`
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
`;
const talk = keyframes`
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1.3); }
`;
const floatZ = keyframes`
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(10px, -22px) scale(1); }
`;

const INK = '#1b1714';
const FUR = '#d9a066';
const EAR = '#9c6235';
const MUZZLE = '#f6e3c8';
const TONGUE = '#f07b8a';

export default function DogCompanion({
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
  const collar = theme.palette.secondary.main;

  // Ears hinge at the top of the head: up when focused, drooping when asleep
  const earAngle = { idle: 0, focus: -18, happy: 6, sleep: 22 }[mood];

  const eyes = (() => {
    switch (mood) {
      case 'happy':
        return (
          <g stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M43 49 Q48 43 53 49" />
            <path d="M67 49 Q72 43 77 49" />
          </g>
        );
      case 'sleep':
        return (
          <g stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round">
            <path d="M43 47 Q48 52 53 47" />
            <path d="M67 47 Q72 52 77 47" />
          </g>
        );
      case 'focus':
        return (
          <g>
            <g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
              <path d="M42 39 L53 42" />
              <path d="M78 39 L67 42" />
            </g>
            <ellipse cx={48} cy={48} rx={4.5} ry={2.8} fill={INK} />
            <ellipse cx={72} cy={48} rx={4.5} ry={2.8} fill={INK} />
          </g>
        );
      default:
        return (
          <Box
            component="g"
            sx={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `${blink} 4.8s ease-in-out infinite`,
            }}
          >
            <circle cx={48} cy={48} r={4.8} fill={INK} />
            <circle cx={72} cy={48} r={4.8} fill={INK} />
            <circle cx={49.6} cy={46.4} r={1.6} fill="#fff" />
            <circle cx={73.6} cy={46.4} r={1.6} fill="#fff" />
          </Box>
        );
    }
  })();

  const tailAnimation = {
    idle: `${wagSlow} 1.2s ease-in-out infinite`,
    focus: 'none',
    happy: `${wagFast} 0.28s ease-in-out infinite`,
    sleep: 'none',
  }[mood];

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {mood === 'sleep' && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '4%',
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
          animation:
            mood === 'happy'
              ? `${hop} 0.7s ease-in-out infinite`
              : `${breathe} ${mood === 'sleep' ? 4.5 : 3}s ease-in-out infinite`,
        }}
      >
        {!peek && (
          <>
            {/* Ground shadow */}
            <ellipse cx={60} cy={114} rx={30} ry={4} fill={alpha(INK, 0.12)} />

            {/* Tail, wagging from its base */}
            <Box
              component="path"
              d="M82 96 C96 92 102 80 98 70"
              stroke={FUR}
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              sx={{
                transformBox: 'fill-box',
                transformOrigin: '0% 100%',
                animation: tailAnimation,
              }}
            />

            {/* Sitting body and front legs */}
            <ellipse cx={60} cy={92} rx={26} ry={19} fill={FUR} />
            <ellipse cx={60} cy={96} rx={13} ry={12} fill={MUZZLE} />
            <rect x={44} y={96} width={10} height={16} rx={5} fill={FUR} />
            <rect x={66} y={96} width={10} height={16} rx={5} fill={FUR} />
            <ellipse cx={49} cy={111} rx={6.5} ry={3} fill={MUZZLE} />
            <ellipse cx={71} cy={111} rx={6.5} ry={3} fill={MUZZLE} />

            {/* Collar with the accent color and a tag */}
            <path
              d="M40 74 Q60 84 80 74"
              stroke={collar}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={60} cy={82} r={4} fill={darken(collar, 0.15)} />
          </>
        )}

        {/* Head (idle: an occasional curious tilt). Peek: enlarged, lower half below
            the window edge. The SVG transform sits on a wrapper - a CSS animation on
            the same element would override it. */}
        <g
          transform={
            peek ? 'translate(60 55) scale(1.6) translate(-60 -50)' : undefined
          }
        >
          <Box
            component="g"
            sx={{
              transformBox: 'fill-box',
              transformOrigin: '50% 90%',
              animation:
                mood === 'idle' ? `${tilt} 7s ease-in-out infinite` : 'none',
            }}
          >
            {/* Floppy ears */}
            <Box
              component="path"
              d="M38 32 C26 34 22 52 28 64 C34 62 40 50 42 38 Z"
              fill={EAR}
              sx={{
                transformBox: 'fill-box',
                transformOrigin: '80% 0%',
                transform: `rotate(${earAngle}deg)`,
                transition: 'transform 0.4s ease',
              }}
            />
            <Box
              component="path"
              d="M82 32 C94 34 98 52 92 64 C86 62 80 50 78 38 Z"
              fill={EAR}
              sx={{
                transformBox: 'fill-box',
                transformOrigin: '20% 0%',
                transform: `rotate(${-earAngle}deg)`,
                transition: 'transform 0.4s ease',
              }}
            />
            <circle cx={60} cy={50} r={25} fill={FUR} />
            {/* Patch over one eye */}
            <ellipse cx={72} cy={46} rx={9} ry={8} fill={alpha(EAR, 0.55)} />
            {eyes}
            {/* Muzzle, nose, mouth */}
            <ellipse cx={60} cy={62} rx={13} ry={10} fill={MUZZLE} />
            <ellipse cx={60} cy={56.5} rx={5} ry={3.6} fill={INK} />
            <path
              d="M60 60 L60 63.5"
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {talking ? (
              <Box
                component="ellipse"
                cx={60}
                cy={66.5}
                rx={4.5}
                ry={3}
                fill={INK}
                sx={{
                  transformBox: 'fill-box',
                  transformOrigin: 'top',
                  animation: `${talk} 0.3s ease-in-out infinite`,
                }}
              />
            ) : (
              <path
                d="M53 63.5 Q56.5 67 60 63.5 Q63.5 67 67 63.5"
                stroke={INK}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
              />
            )}
            {mood === 'happy' && !talking && (
              <path d="M57 65.5 Q60 74 63 65.5 Z" fill={TONGUE} />
            )}
          </Box>
        </g>

        {/* Peek: paws resting on the window edge */}
        {peek && (
          <g>
            {[34, 86].map((cx) => (
              <g key={cx}>
                <ellipse cx={cx} cy={80} rx={11} ry={7} fill={FUR} />
                <g
                  stroke={alpha(EAR, 0.7)}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                >
                  <path d={`M${cx - 4} 76 L${cx - 4} 80`} />
                  <path d={`M${cx + 4} 76 L${cx + 4} 80`} />
                </g>
              </g>
            ))}
          </g>
        )}
      </Box>
    </Box>
  );
}
