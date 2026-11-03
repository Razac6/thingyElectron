import React, { useEffect, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import StopIcon from '@mui/icons-material/Stop';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import Timer from './Timer';
import LiquidFill from './LiquidFill';
import { Task } from '../../interfaces/task.interface';
import { setRunningBlock, useRunningBlock } from './focusBlockStore';
import { useTimer } from '../context/TimerContext';

// Luma's floating "currently working on" pill, the same height as the search pill.
// Normally it shows the session time and fills with liquid as the session uses up the
// task's estimate (blue, amber from 70%, red from 90%). During a focus block it becomes the
// block's single countdown - "FOCUS 18:42" - filling as the block runs, with a Boost button.

const REFRESH_MS = 5000;
export const PILL_HEIGHT = 40;

const formatLeft = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function TimerPill({
  task,
  onStop,
}: {
  task: Task;
  onStop: () => void;
}) {
  const theme = useTheme();
  const block = useRunningBlock();
  const { isBoostMode, toggleBoostMode } = useTimer();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // A block counts down by the second; otherwise a slow refresh for the liquid is enough
    const interval = setInterval(
      () => setNow(Date.now()),
      block ? 1000 : REFRESH_MS,
    );
    return () => clearInterval(interval);
  }, [block]);

  const estimateMs = (Number(task.estimate) || 0) * 60 * 60 * 1000;
  const spentMs = (task.spendTime || 0) + (now - Number(task.startTimer));
  let progress = estimateMs > 0 ? (spentMs / estimateMs) * 100 : 0;
  let liquidColor = theme.palette.progress.main;
  if (progress >= 90) liquidColor = theme.palette.error.main;
  else if (progress >= 70) liquidColor = theme.palette.warning.main;

  if (block) {
    const totalMs = block.minutes * 60000;
    progress = 100 - ((block.endsAt - now) / totalMs) * 100;
    liquidColor = theme.palette.secondary.main;
  }
  const showLiquid = block || estimateMs > 0;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        height: PILL_HEIGHT,
        boxSizing: 'border-box',
        pl: 2,
        pr: 0.5,
        borderRadius: 999,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        boxShadow: '0 8px 24px rgba(17,18,20,0.18)',
        fontSize: '0.875rem',
        lineHeight: 1,
        '& > :not([aria-hidden])': { position: 'relative', zIndex: 1 },
      }}
    >
      {showLiquid && (
        <LiquidFill
          progress={Math.max(0, Math.min(progress, 100))}
          color={liquidColor}
          opacity={0.55}
          waveHeight={4}
        />
      )}
      <Typography
        variant="body2"
        noWrap
        title={block ? `Focus block: ${block.goal}` : task.title}
        sx={{ color: 'inherit', maxWidth: 220, lineHeight: 1 }}
      >
        {block ? block.goal : task.title}
      </Typography>
      {block ? (
        <Box
          sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}
          aria-label="Focus block time left"
        >
          <Typography
            component="span"
            sx={{
              color: 'inherit',
              opacity: 0.75,
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            FOCUS
          </Typography>
          <Typography
            component="span"
            sx={{
              color: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatLeft(block.endsAt - now)}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ minWidth: 64, fontVariantNumeric: 'tabular-nums' }}>
          <Timer
            startTimer={task.startTimer}
            spendTime={task.spendTime}
            estimate={task.estimate}
            context="header"
          />
        </Box>
      )}
      {block && (
        <Tooltip
          title={isBoostMode ? 'Boost is on' : 'Boost: full-screen focus'}
        >
          <IconButton
            size="small"
            aria-label="Boost"
            onClick={() => {
              // Layout keeps Boost open only while the block asks for it
              setRunningBlock({ ...block, boost: true });
              toggleBoostMode(true);
            }}
            sx={{ color: 'inherit', p: 0.5 }}
          >
            <RocketLaunchOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
      <IconButton
        size="small"
        aria-label="Stop timer"
        onClick={onStop}
        sx={{ color: '#ef476f', p: 0.5 }}
      >
        <StopIcon sx={{ fontSize: 22 }} />
      </IconButton>
    </Box>
  );
}
