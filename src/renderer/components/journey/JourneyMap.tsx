import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, keyframes } from '@mui/material';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
  ENEMIES,
  JourneyEvent,
  JourneyState,
  Tile,
  LANDS,
  battleRatio,
  heroStats,
  tileAt,
} from '../../../main/journey';
import Sprite from './Sprite';
import {
  DECO,
  DECO_FEET,
  ENEMY,
  ENEMY_ART,
  HERO,
  HERO_FEET,
  ICON,
  UI,
} from './assets';
import { eventText, oddsLabel } from './journeyText';
import useJourney from './useJourney';

// The journey board on the dashboard: a side-scrolling trail through the current land.
// "Roll" throws a die (one per finished task / focus block / habit / quest), the warrior
// runs that many tiles, and what's on the tile he stops on plays out.

const TILE = 92; // px between tiles
const HERO_SCALE = 0.55; // hero frames (192 px) drawn at this scale
const ENEMY_SCALE = 0.5; // x the game's per-enemy normalisation
const BOSS_SCALE = 0.3; // bosses are huge in the game - keep them inside the card
const DECO_SCALE = 0.42;
const HERO_X = 110; // the warrior's fixed spot; the world scrolls under him
const STEP_MS = 260;
// Render well past both edges so nothing pops in or out where you can see it
const VISIBLE_BEHIND = 4;
const VISIBLE_AHEAD = 14;

const tumble = keyframes`
  0% { transform: rotate(0deg) scale(0.6); }
  60% { transform: rotate(540deg) scale(1.1); }
  100% { transform: rotate(720deg) scale(1); }
`;
const pop = keyframes`
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
`;
const drift = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-60px); }
`;

// Deterministic decoration per tile
const decoFor = (position: number) => {
  const r = Math.abs(Math.sin(position * 12.9898) * 43758.5453) % 1;
  if (r < 0.28) return `tree_${1 + (Math.floor(r * 14) % 4)}`;
  if (r < 0.5) return `bush_${1 + (Math.floor(r * 20) % 4)}`;
  if (r < 0.62) return `rock_${1 + (Math.floor(r * 30) % 4)}`;
  return null;
};

// A long, irregular hill line (never repeats within the board) as an SVG path. `seed`
// varies it per land and layer.
const HILL_WIDTH = 7000;
const HILL_HEIGHT = 120;
const hillPath = (seed: number, amplitude: number) => {
  const step = 140;
  const points: [number, number][] = [];
  for (let x = 0; x <= HILL_WIDTH + step; x += step) {
    const y =
      HILL_HEIGHT -
      amplitude *
        (0.55 +
          0.3 * Math.sin(x / 410 + seed) +
          0.15 * Math.sin(x / 173 + seed * 2.3));
    points.push([x, y]);
  }
  let d = `M0 ${HILL_HEIGHT} L0 ${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    d += ` Q${x0 + step / 2} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
    if (i === points.length - 1) d += ` T${x1} ${y1}`;
  }
  return `${d} L${HILL_WIDTH + step} ${HILL_HEIGHT} Z`;
};

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: '14px',
        bgcolor: '#fff',
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        display: 'grid',
        gridTemplate: 'repeat(3, 1fr) / repeat(3, 1fr)',
        p: 1,
        animation: rolling ? `${tumble} 0.7s ease-out` : 'none',
      }}
    >
      {PIPS[value].map(([row, col]) => (
        <Box
          key={`${row}${col}`}
          sx={{
            gridRow: row + 1,
            gridColumn: col + 1,
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: '#1b1b1b',
            alignSelf: 'center',
            justifySelf: 'center',
          }}
        />
      ))}
    </Box>
  );
}

type Phase = 'idle' | 'dice' | 'walk' | 'fight' | 'retreat';

export default function JourneyMap() {
  const navigate = useNavigate();
  const { state, setState } = useJourney();
  const [phase, setPhase] = useState<Phase>('idle');
  const [shownPos, setShownPos] = useState<number | null>(null);
  const [dice, setDice] = useState(6);
  const [penaltyShown, setPenaltyShown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const later = (ms: number, fn: () => void) =>
    timers.current.push(setTimeout(fn, ms));

  if (!state) return null;
  const position = shownPos ?? state.position;
  const tile = tileAt(state, position);
  const land = LANDS[state.land];
  const hero = heroStats(state);
  const busy = phase !== 'idle';
  const won = state.status === 'won';

  // The boss at the end of the map and the odds against him
  const odds = oddsLabel(battleRatio(state, land.boss));
  const daysLeft = state.endsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(`${state.endsAt}T23:59:59`).getTime() - Date.now()) /
            86400000,
        ),
      )
    : null;

  const onRoll = async () => {
    if (busy || state.pendingRolls <= 0) return;
    const result = await window.electron.database.rollJourney();
    if (!result) return;
    const events: JourneyEvent[] = result.events;
    setMessage(null);
    setDice(result.dice);
    setPenaltyShown(result.penalty || 0);
    setPhase('dice');
    setShownPos(state.position);

    later(800, () => {
      setPhase('walk');
      result.path.forEach((p: number, i: number) =>
        later(i * STEP_MS, () => setShownPos(p)),
      );
      const walked = result.path.length * STEP_MS;
      const fightEvent = events.find(
        (e) => e.type === 'win' || e.type === 'lose',
      );
      later(walked, () => {
        if (fightEvent) setPhase('fight');
      });
      const fightMs = fightEvent ? 1100 : 0;
      later(walked + fightMs, () => {
        setMessage(
          events
            .filter((e) => e.type !== 'empty' || events.length === 1)
            .map(eventText)
            .join(' · '),
        );
        const lose = events.find((e) => e.type === 'lose');
        if (lose && lose.type === 'lose') {
          setPhase('retreat');
          later(400, () => setShownPos(lose.retreatTo));
        }
        later(lose ? 700 : 0, () => {
          setPhase('idle');
          setShownPos(null);
          setState(result.state as JourneyState);
        });
      });
    });
  };

  // Visible stretch of the trail around the warrior
  const tiles: Tile[] = [];
  for (
    let p = position - VISIBLE_BEHIND;
    p <= position + VISIBLE_AHEAD;
    p += 1
  ) {
    if (p >= 0 && p < state.length) tiles.push(tileAt(state, p));
  }

  let heroSheet = HERO[hero.color]?.idle || HERO.blue.idle;
  if (phase === 'walk' || phase === 'retreat') heroSheet = HERO[hero.color].run;
  if (phase === 'fight') heroSheet = HERO[hero.color].attack;

  const groundTop = '62%';

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${land.sky[0]} 0%, ${land.sky[1]} 70%)`,
        transition: 'background 1s',
      }}
    >
      {/* Background layers scroll slower than the trail (parallax), so the world feels deep */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${-position * TILE * 0.05}px)`,
          transition: `transform ${STEP_MS}ms linear`,
        }}
      >
        <Box
          component="img"
          src={DECO.cloud_1.src}
          alt=""
          sx={{
            position: 'absolute',
            top: 18,
            left: '55%',
            width: 150,
            opacity: 0.85,
            imageRendering: 'pixelated',
            animation: `${drift} 40s linear infinite alternate`,
          }}
        />
        <Box
          component="img"
          src={DECO.cloud_3.src}
          alt=""
          sx={{
            position: 'absolute',
            top: 48,
            left: '8%',
            width: 110,
            opacity: 0.7,
            imageRendering: 'pixelated',
            animation: `${drift} 55s linear infinite alternate-reverse`,
          }}
        />
      </Box>
      {/* Two hill ranges, the far one moving slower */}
      {[
        { color: land.hills[0], parallax: 0.12, amplitude: 70, seed: 1 },
        { color: land.hills[1], parallax: 0.28, amplitude: 45, seed: 4 },
      ].map((layer) => (
        <Box
          key={layer.seed}
          component="svg"
          viewBox={`0 0 ${HILL_WIDTH} ${HILL_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
          sx={{
            position: 'absolute',
            left: 0,
            width: HILL_WIDTH,
            height: HILL_HEIGHT,
            top: `calc(${groundTop} - ${HILL_HEIGHT - 2}px)`,
            transform: `translateX(${-position * TILE * layer.parallax}px)`,
            transition: `transform ${STEP_MS}ms linear`,
          }}
        >
          <path
            d={hillPath(layer.seed + (state.seed % 97) * 0.37, layer.amplitude)}
            fill={layer.color}
          />
        </Box>
      ))}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: groundTop,
          bottom: 0,
          bgcolor: land.ground,
        }}
      />

      {/* Trail: decorations behind, then tiles and their contents, scrolling together */}
      {(['deco', 'objects'] as const).map((layer) => (
        <Box
          key={layer}
          sx={{
            position: 'absolute',
            top: groundTop,
            left: 0,
            height: 0,
            zIndex: layer === 'deco' ? 1 : 2,
            transform: `translateX(${HERO_X - position * TILE}px)`,
            transition: `transform ${STEP_MS}ms linear`,
          }}
        >
          {tiles.map((t) => {
            if (layer === 'deco') {
              const deco = decoFor(t.index);
              if (!deco) return null;
              const sheet = DECO[deco];
              const scale = deco.startsWith('rock') ? 0.5 : DECO_SCALE;
              return (
                <Box
                  key={t.index}
                  sx={{
                    position: 'absolute',
                    // halfway between this tile and the next, a little behind the path
                    left:
                      t.index * TILE +
                      TILE / 2 -
                      (sheet.frameWidth * scale) / 2,
                    top: -(DECO_FEET[deco] ?? sheet.frameHeight) * scale - 6,
                  }}
                >
                  <Sprite
                    sheet={sheet}
                    size={sheet.frameHeight * scale}
                    fps={6}
                  />
                </Box>
              );
            }
            const done =
              state.defeated.includes(t.index) ||
              state.opened.includes(t.index);
            const enemySheet =
              t.enemy && !state.defeated.includes(t.index)
                ? ENEMY[t.enemy]
                : null;
            const art = t.enemy ? ENEMY_ART[t.enemy] : null;
            const enemyScale =
              art && art.scale * (t.type === 'boss' ? BOSS_SCALE : ENEMY_SCALE);
            return (
              <Box
                key={t.index}
                sx={{ position: 'absolute', left: t.index * TILE }}
              >
                {/* stepping stone */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: -18,
                    top: -4,
                    width: 36,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: 'rgba(0,0,0,0.18)',
                    outline:
                      t.type === 'boss'
                        ? '2px solid rgba(255,80,60,0.6)'
                        : 'none',
                  }}
                />
                {!done && t.type === 'treasure' && (
                  <Box sx={{ position: 'absolute', left: -16, top: -30 }}>
                    <Box
                      component="img"
                      src={UI.paper_s.src}
                      alt="Treasure"
                      sx={{
                        width: 32,
                        imageRendering: 'pixelated',
                        display: 'block',
                      }}
                    />
                    <Typography
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        fontWeight: 800,
                        fontSize: 18,
                        lineHeight: '32px',
                        textAlign: 'center',
                        color: '#5b3a1a',
                      }}
                    >
                      ?
                    </Typography>
                  </Box>
                )}
                {!done && t.type === 'gold' && (
                  <Box
                    component="img"
                    src={ICON.gold.src}
                    alt="Gold"
                    sx={{
                      position: 'absolute',
                      left: -16,
                      top: -28,
                      width: 32,
                      imageRendering: 'pixelated',
                    }}
                  />
                )}
                {t.type === 'camp' && (
                  <Box
                    component="img"
                    src={ICON.meat.src}
                    alt="Camp"
                    sx={{
                      position: 'absolute',
                      left: -14,
                      top: -26,
                      width: 28,
                      imageRendering: 'pixelated',
                    }}
                  />
                )}
                {enemySheet && art && enemyScale && t.enemy && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -(enemySheet.frameWidth * enemyScale) / 2,
                      top: -art.feet * enemyScale,
                    }}
                  >
                    <Sprite
                      sheet={enemySheet}
                      size={enemySheet.frameHeight * enemyScale}
                      flip
                      fps={7}
                      title={ENEMIES[t.enemy].name}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Warrior: fixed spot, feet on the ground line */}
      <Box
        sx={{
          position: 'absolute',
          left: HERO_X - (192 * HERO_SCALE) / 2,
          top: `calc(${groundTop} - ${HERO_FEET * HERO_SCALE}px)`,
          zIndex: 3,
        }}
      >
        <Sprite
          sheet={heroSheet}
          size={192 * HERO_SCALE}
          fps={phase === 'fight' ? 10 : 8}
          flip={phase === 'retreat'}
        />
      </Box>

      {/* Header: land, gold, boss odds */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          zIndex: 4,
        }}
      >
        <Box
          sx={{
            px: 1.25,
            py: 0.5,
            borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.35)',
            color: '#fff',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ color: 'inherit', lineHeight: 1.2 }}
          >
            {land.name}
            {state.loop ? ` · loop ${state.loop + 1}` : ''}
            {state.sprintName ? ` · ${state.sprintName}` : ' · free play'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Tile {tile.index + 1}/{state.length}
            {daysLeft !== null && ` · ${daysLeft}d left`}
            {!won && (
              <>
                {' · '}
                {ENEMIES[land.boss].name}:{' '}
                <Box
                  component="span"
                  sx={{
                    color:
                      odds.color === 'success.main'
                        ? '#9be79b'
                        : odds.color === 'warning.main'
                          ? '#ffd27a'
                          : '#ff9a8a',
                    fontWeight: 600,
                  }}
                >
                  {odds.text}
                </Box>
              </>
            )}
          </Typography>
        </Box>
        <Box
          sx={{
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.35)',
            color: '#fff',
          }}
        >
          <Box
            component="img"
            src={ICON.gold.src}
            alt=""
            sx={{ width: 20, imageRendering: 'pixelated' }}
          />
          <Typography
            variant="body2"
            sx={{ color: 'inherit', fontWeight: 600 }}
          >
            {state.gold}
          </Typography>
        </Box>
      </Box>

      {/* Dice */}
      {(phase === 'dice' || phase === 'walk') && (
        <Box
          sx={{
            position: 'absolute',
            top: '24%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
          }}
        >
          <Die value={dice} rolling={phase === 'dice'} />
          {penaltyShown > 0 && phase === 'walk' && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.5,
                textAlign: 'center',
                color: '#fff',
                fontWeight: 700,
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              −{penaltyShown} over estimate
            </Typography>
          )}
        </Box>
      )}

      {/* Bottom: result + actions */}
      <Box
        sx={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 4,
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<CasinoOutlinedIcon fontSize="small" />}
          disabled={busy || won || state.pendingRolls <= 0}
          onClick={onRoll}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Roll{state.pendingRolls > 0 ? ` (${state.pendingRolls})` : ''}
        </Button>
        <Button
          size="small"
          startIcon={<ShieldOutlinedIcon fontSize="small" />}
          onClick={() => navigate('/profile')}
          sx={{
            color: '#fff',
            bgcolor: 'rgba(0,0,0,0.3)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.45)' },
            whiteSpace: 'nowrap',
          }}
        >
          Gear
        </Button>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {message ? (
            <Typography
              variant="body2"
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.88)',
                color: '#1b1b1b',
                animation: `${pop} 0.3s ease-out`,
              }}
            >
              {message}
            </Typography>
          ) : (
            !busy &&
            (won || state.pendingRolls <= 0) && (
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 2,
                  bgcolor: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                }}
              >
                {won
                  ? 'Boss defeated! A new journey starts with the next sprint.'
                  : 'Finish a task, a focus block or a habit to earn a roll.'}
              </Typography>
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
