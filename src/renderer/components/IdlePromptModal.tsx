import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Stack,
  Avatar,
  LinearProgress,
} from '@mui/material';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement'; // Deep work/Thinking
import CoffeeIcon from '@mui/icons-material/Coffee'; // Break
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface IdlePromptModalProps {
  open: boolean;
  idleTimeMs: number;
  taskTitle: string;
  onKeep: () => void;
  onDiscard: () => void;
  // 'long-session': a timer that ran far too long is being stopped (see TimerContext)
  reason?: 'idle' | 'long-session';
  sessionStart?: number;
  lastActivityAt?: number | null;
}

export default function IdlePromptModal({
  open,
  idleTimeMs,
  taskTitle,
  onKeep,
  onDiscard,
  reason = 'idle',
  sessionStart,
  lastActivityAt,
}: IdlePromptModalProps) {
  const isLongSession = reason === 'long-session' && sessionStart !== undefined;
  const [timeLeft, setTimeLeft] = useState(60); // Auto-discard after 60s if no answer

  useEffect(() => {
    if (!open) {
      setTimeLeft(60);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDiscard(); // Auto-discard on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onDiscard]);

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.max(0, Math.floor(ms / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} min`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  // Long session: total so far, and what "Discard" keeps (everything up to the cut-off)
  const totalMs = isLongSession ? Date.now() - sessionStart : 0;
  const keptMs = Math.max(0, totalMs - idleTimeMs);
  const formatClock = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const title = isLongSession
    ? `The timer ran for ${formatDuration(totalMs)}`
    : `You were away for ${formatDuration(idleTimeMs)}`;
  const question = isLongSession
    ? lastActivityAt
      ? `Your last activity at the computer was at ${formatClock(lastActivityAt)}. Did you forget to stop it?`
      : 'There is no activity data for this session. Did you forget to stop it?'
    : 'Were you working offline or taking a break?';
  const keepLabel = isLongSession
    ? `I worked all of it (${formatDuration(totalMs)})`
    : 'I was working (Keep Time)';
  const discardLabel = isLongSession
    ? lastActivityAt
      ? `Count until ${formatClock(lastActivityAt)} (${formatDuration(keptMs)})`
      : `Count ${formatDuration(keptMs)} only`
    : 'I took a break (Discard)';

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, p: 1 },
      }}
    >
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Avatar
          sx={{
            bgcolor: '#fff3e0',
            color: 'warning.main',
            width: 56,
            height: 56,
            mx: 'auto',
            mb: 2,
          }}
        >
          <AccessTimeIcon fontSize="large" />
        </Avatar>
        <Typography variant="h6" fontWeight="bold">
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, px: 2 }}
        >
          Task: <strong>{taskTitle}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {question}
        </Typography>
      </Box>

      <DialogContent>
        <Stack spacing={2}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SelfImprovementIcon />}
            onClick={onKeep}
            sx={{
              py: 1.5,
              bgcolor: 'text.primary',
              '&:hover': { bgcolor: 'primary.main' },
              borderRadius: 2,
            }}
          >
            {keepLabel}
          </Button>

          <Button
            variant="outlined"
            color="warning"
            size="large"
            startIcon={<CoffeeIcon />}
            onClick={onDiscard}
            sx={{
              py: 1.5,
              borderColor: 'warning.main',
              color: 'warning.main',
              '&:hover': { borderColor: '#e65100', bgcolor: '#fff3e0' },
              borderRadius: 2,
            }}
          >
            {discardLabel}
          </Button>
        </Stack>

        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={(timeLeft / 60) * 100}
            sx={{ flex: 1, height: 4, borderRadius: 2 }}
          />
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ minWidth: 20 }}
          >
            {timeLeft}s
          </Typography>
        </Box>
        <Typography
          variant="caption"
          color="text.disabled"
          display="block"
          textAlign="center"
          mt={0.5}
        >
          Auto-discarding in {timeLeft} seconds...
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
