import React, { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import StopIcon from '@mui/icons-material/Stop';
import Timer from './Timer';
import LiquidFill from './LiquidFill';
import { Task } from '../../interfaces/task.interface';

// Luma's floating "currently working on" pill. It fills with liquid as the session uses up
// the task's estimate - blue, then amber from 70%, red from 90% (same thresholds as the
// active row sweep on the task list).

const REFRESH_MS = 5000;

export default function TimerPill({
  task,
  onStop,
}: {
  task: Task;
  onStop: () => void;
}) {
  const theme = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const estimateMs = (Number(task.estimate) || 0) * 60 * 60 * 1000;
  const spentMs = (task.spendTime || 0) + (now - Number(task.startTimer));
  const progress = estimateMs > 0 ? (spentMs / estimateMs) * 100 : 0;

  let liquidColor = theme.palette.progress.main;
  if (progress >= 90) liquidColor = theme.palette.error.main;
  else if (progress >= 70) liquidColor = theme.palette.warning.main;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 40,
        pl: 2.5,
        pr: 0.5,
        borderRadius: 999,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        boxShadow: '0 8px 24px rgba(17,18,20,0.18)',
        '& > :not([aria-hidden])': { position: 'relative', zIndex: 1 },
      }}
    >
      {estimateMs > 0 && (
        <LiquidFill
          progress={Math.min(progress, 100)}
          color={liquidColor}
          opacity={0.55}
          waveHeight={4}
        />
      )}
      <Typography
        variant="body2"
        noWrap
        sx={{ color: 'inherit', maxWidth: 220 }}
      >
        {task.title}
      </Typography>
      <Box sx={{ minWidth: '110px' }}>
        <Timer
          startTimer={task.startTimer}
          spendTime={task.spendTime}
          estimate={task.estimate}
          context="header"
        />
      </Box>
      <IconButton
        size="small"
        aria-label="Stop timer"
        onClick={onStop}
        sx={{ color: '#ef476f' }}
      >
        <StopIcon />
      </IconButton>
    </Box>
  );
}
