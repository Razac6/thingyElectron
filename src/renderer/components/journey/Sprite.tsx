import React from 'react';
import { Box, keyframes } from '@mui/material';
import type { SpriteSheet } from './assets';

// Plays a horizontal sprite strip with CSS steps() - no JS per frame. Pixel art stays crisp.

const animations = new Map<string, ReturnType<typeof keyframes>>();
const stripAnimation = (distance: number) => {
  const key = String(distance);
  if (!animations.has(key)) {
    animations.set(
      key,
      keyframes`from { background-position-x: 0; } to { background-position-x: -${distance}px; }`,
    );
  }
  return animations.get(key)!;
};

export default function Sprite({
  sheet,
  size,
  fps = 8,
  flip = false,
  paused = false,
  title,
}: {
  sheet: SpriteSheet;
  size: number; // rendered frame height in px
  fps?: number;
  flip?: boolean;
  paused?: boolean;
  title?: string;
}) {
  const scale = size / sheet.frameHeight;
  const width = sheet.frameWidth * scale;
  const stripWidth = width * sheet.frames;
  return (
    <Box
      role={title ? 'img' : undefined}
      aria-label={title}
      title={title}
      sx={{
        width,
        height: size,
        flexShrink: 0,
        backgroundImage: `url(${sheet.src})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${stripWidth}px ${size}px`,
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : undefined,
        animation:
          sheet.frames > 1 && !paused
            ? `${stripAnimation(stripWidth)} ${sheet.frames / fps}s steps(${sheet.frames}) infinite`
            : 'none',
      }}
    />
  );
}

Sprite.defaultProps = {
  fps: 8,
  flip: false,
  paused: false,
  title: undefined,
};
