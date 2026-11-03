import React, { useEffect, useRef, useState } from 'react';
import { Box, keyframes } from '@mui/material';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';
import type { DropletMood } from './DropletCompanion';

// "Noodle" - a snake assistant that lives along the bottom edge of the app. When summoned
// it slithers in from the left edge to the bottom-right corner (where the speech bubble
// opens), and slithers off to the right when dismissed. The body is a chain of segments
// sampled from a sine wave fixed in screen space, so every segment follows the path the
// head took - that's what makes it read as slithering rather than sliding.
//   idle  - gentle undulation, tongue flicks now and then
//   focus - slower, calmer undulation
//   happy - hovered: faster wiggle, ^ ^ eyes
//   sleep - late at night: stops moving, eyes closed, floating "z"
// `talking` flicks the tongue quickly.
// Once it reaches its spot it coils up - seen from the side, rings stacked with the head
// raised and turned to face the user - and uncoils before slithering off.

const SEGMENTS = 34;
const SPACING = 7; // px between segments along x
const BODY_LENGTH = SEGMENTS * SPACING;
const WAVELENGTH = 90; // px
const SPEED = 170; // px/s - minimum travel speed
// A trip across a wide window would take longer than the companion stays visible, so far
// from the target the snake goes faster (speed ~ remaining distance / TRIP_SECONDS), which
// also makes it ease in to a stop
const TRIP_SECONDS = 1;
// Once coiled it stays at least this long, even if it was told to leave on the way
const MIN_DWELL_MS = 2500;
const STRIP_HEIGHT = 72;
const BASE_Y = 46; // body centre line within the strip
const HOME_OFFSET = 72; // head stops this far from the right edge

// Coiled pose, seen from the side: rings stacked from a wide one at the bottom to a small
// one on top, the neck rising from the top ring and the head facing the user
const COIL_NECK_SEGMENTS = 6;
const COIL_NECK_STEP = 4.5;
const COIL_TURNS = 2.4;
const COIL_TOP_RADIUS = 11;
const COIL_BOTTOM_RADIUS = 22;
const COIL_TOP_Y = BASE_Y - 14;
const COIL_BOTTOM_Y = BASE_Y + 14;
const COIL_TILT = 0.38; // ring height / width - viewed slightly from above
const COIL_CENTER_OFFSET = 18; // stack centre this far left of the head's home x
const COIL_SPEED = 1.6; // coil progress per second (0 = stretched out, 1 = coiled)

const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Segment positions (index 0 = right behind the head) in the coiled pose, with a depth
// for drawing order (back of a ring behind its front), plus where the head goes
function sideCoil(headX: number) {
  const cx = headX - COIL_CENTER_OFFSET;
  // The neck joins the top ring at its front-centre point
  const neckBottomY = COIL_TOP_Y + COIL_TOP_RADIUS * COIL_TILT;
  const headY = neckBottomY - (COIL_NECK_SEGMENTS + 1) * COIL_NECK_STEP - 4;
  const points: { x: number; y: number; depth: number }[] = [];

  for (let i = 0; i < COIL_NECK_SEGMENTS; i += 1) {
    const t = (i + 1) / (COIL_NECK_SEGMENTS + 1);
    points.push({
      x: cx + Math.sin(t * Math.PI) * 3, // a slight S in the neck
      y: headY + 8 + (neckBottomY - headY - 8) * t,
      depth: 2, // the neck is in front of everything
    });
  }

  const helixCount = SEGMENTS - COIL_NECK_SEGMENTS;
  for (let j = 0; j < helixCount; j += 1) {
    const t = j / (helixCount - 1);
    const theta = Math.PI / 2 + t * COIL_TURNS * 2 * Math.PI;
    const r = COIL_TOP_RADIUS + (COIL_BOTTOM_RADIUS - COIL_TOP_RADIUS) * t;
    const ringY = COIL_TOP_Y + (COIL_BOTTOM_Y - COIL_TOP_Y) * t;
    points.push({
      x: cx + r * Math.cos(theta),
      y: ringY + r * COIL_TILT * Math.sin(theta),
      depth: Math.sin(theta), // +1 = front of the ring, -1 = back
    });
  }
  return { points, head: { x: cx, y: headY } };
}

const flick = keyframes`
  0%, 88%, 100% { transform: scaleX(0); }
  91%, 96% { transform: scaleX(1); }
`;
const flickFast = keyframes`
  0%, 100% { transform: scaleX(0.2); }
  50% { transform: scaleX(1); }
`;
const flickDown = keyframes`
  0%, 88%, 100% { transform: scaleY(0); }
  91%, 96% { transform: scaleY(1); }
`;
const flickDownFast = keyframes`
  0%, 100% { transform: scaleY(0.2); }
  50% { transform: scaleY(1); }
`;
const sway = keyframes`
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
`;
const floatZ = keyframes`
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(10px, -22px) scale(1); }
`;

const INK = '#16181c';

export default function SnakeCompanion({
  visible,
  mood = 'idle',
  talking = false,
  onClick,
  onHoverChange,
}: {
  visible: boolean;
  mood?: DropletMood;
  talking?: boolean;
  onClick?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const theme = useTheme();
  const scale = theme.palette.secondary.main;
  const [width, setWidth] = useState(window.innerWidth);
  const [rendered, setRendered] = useState(visible);
  const [frame, setFrame] = useState({
    headX: -BODY_LENGTH,
    phase: 0,
    coil: 0,
  });
  const state = useRef({
    headX: -BODY_LENGTH,
    phase: 0,
    coil: 0,
    last: 0,
    coiledAt: 0, // rAF time the coil completed (0 = not coiled yet this visit)
  });
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (visible) {
      // Enter from the left edge unless already on screen
      if (!rendered) {
        state.current.headX = -SPACING;
        state.current.coil = 0;
      }
      state.current.coiledAt = 0;
      setRendered(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Animation loop: move the head toward home (or off-screen when hidden) and undulate
  useEffect(() => {
    if (!rendered) return undefined;
    let raf = 0;
    const tick = (t: number) => {
      const s = state.current;
      const dt = s.last ? Math.min(0.05, (t - s.last) / 1000) : 0;
      s.last = t;

      const home = width - HOME_OFFSET;
      // Always finish the visit: reach home, coil up and rest a moment before leaving -
      // even when hidden on the way (otherwise it could slither past without stopping)
      const dwelt = s.coiledAt > 0 && t - s.coiledAt >= MIN_DWELL_MS;
      const leaving = !visible && dwelt;
      const target = leaving ? width + BODY_LENGTH : home;
      const distance = target - s.headX;

      // Coil up once home; when leaving (or the window resized), uncoil before moving
      const atHome = !leaving && Math.abs(home - s.headX) <= 1;
      const coilTarget = atHome ? 1 : 0;
      s.coil +=
        Math.sign(coilTarget - s.coil) *
        Math.min(Math.abs(coilTarget - s.coil), COIL_SPEED * dt);
      if (s.coil >= 1 && !s.coiledAt) s.coiledAt = t;

      const travelling = Math.abs(distance) > 1 && s.coil < 0.01;
      if (travelling) {
        const speed = Math.max(SPEED, Math.abs(distance) / TRIP_SECONDS);
        s.headX +=
          Math.sign(distance) * Math.min(Math.abs(distance), speed * dt);
      }

      const currentMood = moodRef.current;
      // Undulation speed (rad/s) - the wave drifts even at rest, so the body ripples
      let omega = 2.2;
      if (currentMood === 'focus') omega = 1.2;
      if (currentMood === 'happy') omega = 6;
      if (currentMood === 'sleep' && !travelling) omega = 0;
      s.phase += omega * dt;

      setFrame({ headX: s.headX, phase: s.phase, coil: s.coil });

      if (leaving && s.headX >= width + BODY_LENGTH - 1) {
        setRendered(false);
        s.last = 0;
        s.coiledAt = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      state.current.last = 0;
    };
  }, [rendered, visible, width]);

  if (!rendered) return null;

  const amplitude = mood === 'happy' ? 7 : mood === 'sleep' ? 3 : 5;
  const k = (2 * Math.PI) / WAVELENGTH;
  const yAt = (x: number) => BASE_Y + amplitude * Math.sin(k * x - frame.phase);

  // Blend between the stretched-out wave and the side-view coil, segment by segment
  const coil = easeInOut(frame.coil);
  const coiledPose = coil > 0 ? sideCoil(frame.headX) : null;
  // Coiled, the body still "breathes" a little
  const breath = 1 + 0.03 * Math.sin(frame.phase * 1.5) * coil;

  const segments = Array.from({ length: SEGMENTS }, (_, index) => {
    // index 0 = right behind the head
    const waveX = frame.headX - (index + 1) * SPACING;
    const waveY = yAt(waveX);
    const taper = 1 - (index / SEGMENTS) * 0.75;
    // Coiled, the body is evenly thick and only the very tail thins out
    const coiledTaper =
      index > SEGMENTS - 6 ? 1 - (index - (SEGMENTS - 6)) / 8 : 1;
    const c = coiledPose?.points[index];
    return {
      index,
      x: c ? waveX + (c.x - waveX) * coil : waveX,
      y: c ? waveY + (c.y - waveY) * coil : waveY,
      r: (8 * taper + (7 * coiledTaper - 8 * taper) * coil) * breath,
      depth: c ? c.depth : 0,
      band: Math.floor(index / 3) % 2 === 1,
    };
  });
  // Stretched out: tail first so the head end is on top. Coiled: back of the rings
  // first, front last, so the stack reads in depth.
  const drawOrder = [...segments].sort((a, b) =>
    coil > 0.5 ? a.depth - b.depth || b.index - a.index : b.index - a.index,
  );

  const waveHeadY = yAt(frame.headX);
  const headX = coiledPose
    ? frame.headX + (coiledPose.head.x - frame.headX) * coil
    : frame.headX;
  const headY = coiledPose
    ? waveHeadY + (coiledPose.head.y - waveHeadY) * coil
    : waveHeadY;
  const slope = amplitude * k * Math.cos(k * frame.headX - frame.phase);
  const angle = ((Math.atan(slope) * 180) / Math.PI) * (1 - coil);
  // Late in the coiling the head turns from profile-from-above to facing the user
  const facing = clamp01((coil - 0.55) / 0.35);

  // Eyes on the head seen from above (travelling)
  const topEyes = (() => {
    if (mood === 'sleep') {
      return (
        <g stroke={INK} strokeWidth={1.6} strokeLinecap="round">
          <path d="M3 -5.5 L7 -5.5" />
          <path d="M3 5.5 L7 5.5" />
        </g>
      );
    }
    if (mood === 'happy') {
      return (
        <g stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round">
          <path d="M3 -4 Q5 -7.5 7 -4" />
          <path d="M3 7 Q5 3.5 7 7" />
        </g>
      );
    }
    const ry = mood === 'focus' ? 1.4 : 2.4;
    return (
      <g>
        <ellipse cx={5} cy={-5.5} rx={2.4} ry={ry} fill={INK} />
        <ellipse cx={5} cy={5.5} rx={2.4} ry={ry} fill={INK} />
        {mood !== 'focus' && (
          <>
            <circle cx={5.8} cy={-6.3} r={0.8} fill="#fff" />
            <circle cx={5.8} cy={4.7} r={0.8} fill="#fff" />
          </>
        )}
      </g>
    );
  })();

  // Eyes on the head facing the user (coiled)
  const frontEyes = (() => {
    if (mood === 'sleep') {
      return (
        <g stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round">
          <path d="M-8 -2 Q-5.5 0.5 -3 -2" />
          <path d="M3 -2 Q5.5 0.5 8 -2" />
        </g>
      );
    }
    if (mood === 'happy') {
      return (
        <g stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round">
          <path d="M-8 -1 Q-5.5 -4.5 -3 -1" />
          <path d="M3 -1 Q5.5 -4.5 8 -1" />
        </g>
      );
    }
    const ry = mood === 'focus' ? 1.6 : 3;
    return (
      <g>
        <ellipse cx={-5.5} cy={-2} rx={2.6} ry={ry} fill={INK} />
        <ellipse cx={5.5} cy={-2} rx={2.6} ry={ry} fill={INK} />
        {mood !== 'focus' && (
          <>
            <circle cx={-4.6} cy={-3.2} r={0.9} fill="#fff" />
            <circle cx={6.4} cy={-3.2} r={0.9} fill="#fff" />
          </>
        )}
      </g>
    );
  })();

  let tongueAnimation = `${flick} 3s ease-in-out infinite`;
  let tongueDownAnimation = `${flickDown} 3s ease-in-out infinite`;
  if (talking) {
    tongueAnimation = `${flickFast} 0.25s ease-in-out infinite`;
    tongueDownAnimation = `${flickDownFast} 0.25s ease-in-out infinite`;
  }
  if (mood === 'sleep') {
    tongueAnimation = 'none';
    tongueDownAnimation = 'none';
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: STRIP_HEIGHT,
        pointerEvents: 'none',
        zIndex: 10000,
      }}
    >
      <svg
        width="100%"
        height={STRIP_HEIGHT}
        style={{ overflow: 'visible', display: 'block' }}
        aria-hidden
      >
        {/* Soft shadow: a long line stretched out, a pool under the coil */}
        <path
          d={`M${frame.headX - BODY_LENGTH} ${BASE_Y + 12} L${frame.headX} ${BASE_Y + 12}`}
          stroke={alpha(INK, 0.08 * (1 - coil))}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {coiledPose && (
          <ellipse
            cx={frame.headX - COIL_CENTER_OFFSET}
            cy={COIL_BOTTOM_Y + 10}
            rx={COIL_BOTTOM_RADIUS + 6}
            ry={4}
            fill={alpha(INK, 0.14 * coil)}
          />
        )}
        {/* Body as a tube: each piece joins a segment to the next one toward the tail,
            with round caps, so tight coils read as one smooth body, not beads */}
        {drawOrder.map((seg) => {
          const next = segments[seg.index + 1];
          const fill = seg.band
            ? darken(scale, 0.25 - 0.08 * Math.max(0, seg.depth) * coil)
            : lighten(scale, 0.08 * Math.max(0, seg.depth) * coil);
          return next ? (
            <line
              key={seg.index}
              x1={seg.x}
              y1={seg.y}
              x2={next.x}
              y2={next.y}
              stroke={fill}
              strokeWidth={seg.r * 2}
              strokeLinecap="round"
            />
          ) : (
            <circle
              key={seg.index}
              cx={seg.x}
              cy={seg.y}
              r={seg.r}
              fill={fill}
            />
          );
        })}
        {/* Head - one group so it's clickable whichever way it faces */}
        <g
          transform={`translate(${headX} ${headY})`}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={onClick}
          onMouseEnter={() => onHoverChange?.(true)}
          onMouseLeave={() => onHoverChange?.(false)}
          role="button"
          aria-label="Assistant"
        >
          {/* Seen from above, travelling */}
          <g transform={`rotate(${angle})`} opacity={1 - facing}>
            <Box
              component="path"
              d="M10 0 L19 0 M19 0 L23 -3 M19 0 L23 3"
              stroke="#ef476f"
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
              sx={{
                transformBox: 'fill-box',
                transformOrigin: 'left center',
                animation: tongueAnimation,
                transform: mood === 'sleep' ? 'scaleX(0)' : undefined,
              }}
            />
            <ellipse cx={0} cy={0} rx={12} ry={10} fill={scale} />
            <ellipse
              cx={-2}
              cy={-3}
              rx={6}
              ry={3}
              fill={lighten(scale, 0.4)}
              opacity={0.6}
            />
            {topEyes}
          </g>
          {/* Facing the user, coiled */}
          {facing > 0 && (
            <Box
              component="g"
              opacity={facing}
              sx={{
                transformBox: 'fill-box',
                transformOrigin: '50% 100%',
                animation:
                  mood === 'sleep'
                    ? 'none'
                    : `${sway} 3.4s ease-in-out infinite`,
              }}
            >
              <Box
                component="path"
                d="M0 9 L0 16 M0 16 L-3 20 M0 16 L3 20"
                stroke="#ef476f"
                strokeWidth={1.6}
                strokeLinecap="round"
                fill="none"
                sx={{
                  transformBox: 'fill-box',
                  transformOrigin: 'top center',
                  animation: tongueDownAnimation,
                  transform: mood === 'sleep' ? 'scaleY(0)' : undefined,
                }}
              />
              <ellipse cx={0} cy={0} rx={13} ry={11} fill={scale} />
              <ellipse
                cx={0}
                cy={5}
                rx={8.5}
                ry={5.5}
                fill={lighten(scale, 0.25)}
              />
              <ellipse
                cx={-4}
                cy={-6}
                rx={5}
                ry={2.5}
                fill={lighten(scale, 0.45)}
                opacity={0.5}
              />
              {frontEyes}
              <circle cx={-2} cy={5} r={0.9} fill={alpha(INK, 0.6)} />
              <circle cx={2} cy={5} r={0.9} fill={alpha(INK, 0.6)} />
            </Box>
          )}
        </g>
        {mood === 'sleep' && (
          <Box
            component="text"
            x={headX + 8}
            y={headY - 14}
            fontSize={14}
            fontWeight={700}
            fill={alpha(INK, 0.6)}
            sx={{ animation: `${floatZ} 2.6s ease-out infinite` }}
          >
            z
          </Box>
        )}
      </svg>
    </Box>
  );
}

// Small in-place version for the character picker: undulates without travelling
export function SnakePreview({ hovered = false }: { hovered?: boolean }) {
  const theme = useTheme();
  const scale = theme.palette.secondary.main;
  const [phase, setPhase] = useState(0);
  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      setPhase((p) => p + (hoveredRef.current ? 6 : 2.2) * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const headX = 84;
  const baseY = 52;
  const amplitude = hovered ? 7 : 5;
  const k = (2 * Math.PI) / 60;
  const yAt = (x: number) => baseY + amplitude * Math.sin(k * x - phase);
  const count = 14;
  const slope = amplitude * k * Math.cos(k * headX - phase);

  return (
    <svg viewBox="0 0 104 92" width="100%" height="100%" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const index = count - 1 - i;
        const x = headX - (index + 1) * 5;
        return (
          <circle
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            cx={x}
            cy={yAt(x)}
            r={6.5 * (1 - (index / count) * 0.7)}
            fill={Math.floor(index / 3) % 2 ? darken(scale, 0.25) : scale}
          />
        );
      })}
      <g
        transform={`translate(${headX} ${yAt(headX)}) rotate(${(Math.atan(slope) * 180) / Math.PI})`}
      >
        <ellipse cx={0} cy={0} rx={9.5} ry={8} fill={scale} />
        <ellipse cx={4} cy={-4.5} rx={2} ry={2} fill={INK} />
        <ellipse cx={4} cy={4.5} rx={2} ry={2} fill={INK} />
      </g>
    </svg>
  );
}
