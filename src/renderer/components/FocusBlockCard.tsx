import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import LiquidFill from './LiquidFill';
import { useTimer } from '../context/TimerContext';
import { useGamification } from '../context/GamificationContext';
import { useIsLuma } from '../themes';
import { setRunningBlock } from './focusBlockStore';

// Focus blocks turn "work on this task" into one small, concrete goal for a set stretch of
// time - specific, near-term goals and visible small wins are what keep developers moving
// (and feeling progress). The card only speaks at natural breakpoints: when a timer starts
// and when a block ends. In between, Luma shows the countdown in the timer pill at the top
// (one countdown, not two); Classic keeps a slim bar at the bottom. Starting a block can
// also open Boost, the full-screen distraction-free view.

type Phase = 'propose' | 'running' | 'review' | 'won';

interface Step {
  id?: number; // checklist item id, when the goal is a checklist step
  text: string;
}

const MIN_BLOCK = 25;
const MAX_BLOCK = 90;
const SPLIT_ESTIMATE_HOURS = 2; // bigger tasks without steps get a "split it" nudge

// Block length that fits the user: their recommended max focus span, rounded to 5 min
const suggestedMinutes = (maxRecommended?: number) =>
  Math.min(
    MAX_BLOCK,
    Math.max(MIN_BLOCK, Math.round((maxRecommended || 50) / 5) * 5),
  );

const formatLeft = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function FocusBlockCard() {
  const { tasks, insights, toggleBoostMode } = useTimer();
  const isLuma = useIsLuma();
  const [withBoost, setWithBoost] = useState(
    () => localStorage.getItem('focus_block_boost') === 'true',
  );
  const { checkForAchievements } = useGamification();
  const navigate = useNavigate();
  const theme = useTheme();

  const activeTask = tasks.find((t) => t.startTimer);
  const isPomodoro = activeTask?.timerMode === 'pomodoro'; // Boost overlay handles those

  const suggested = suggestedMinutes(insights?.fatigueProfile?.maxRecommended);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [needsSplit, setNeedsSplit] = useState(false);
  const [minutes, setMinutes] = useState(suggested);
  const [block, setBlock] = useState<{ id: number | null; endsAt: number }>();
  const [now, setNow] = useState(Date.now());
  const sessionKey = useRef<string | null>(null);

  // The next unfinished checklist step of the task, or the task itself as the goal
  const loadNextStep = useCallback(async (task: typeof activeTask) => {
    if (!task) return;
    let items: any[] = [];
    try {
      items = await window.electron.database.getChecklistItems(task.id);
    } catch (e) {
      items = [];
    }
    const next = items.find((i) => !i.isCompleted);
    setStep(next ? { id: next.id, text: next.text } : { text: task.title });
    setNeedsSplit(
      items.length === 0 && Number(task.estimate) >= SPLIT_ESTIMATE_HOURS,
    );
  }, []);

  // A timer was started -> propose a block (once per timer start)
  useEffect(() => {
    if (!activeTask || isPomodoro) {
      // Timer stopped mid-block: record it as not reached, without a prompt
      if (block?.id && phase === 'running') {
        window.electron.database
          .finishFocusBlock(block.id, false)
          .catch(() => {});
      }
      sessionKey.current = null;
      setPhase(null);
      setBlock(undefined);
      setRunningBlock(null);
      return;
    }
    if (sessionKey.current === activeTask.startTimer) return;
    sessionKey.current = activeTask.startTimer;
    setMinutes(suggested);
    loadNextStep(activeTask).then(() => setPhase('propose'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.id, activeTask?.startTimer, isPomodoro]);

  // Tick only while a block runs
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Block over -> ask (the user may be in their editor, so also notify)
  useEffect(() => {
    if (phase === 'running' && block && now >= block.endsAt) {
      setPhase('review');
      setRunningBlock(null);
      toggleBoostMode(false);
      window.electron.ipcRenderer.send('focus-music:stop');
      try {
        // eslint-disable-next-line no-new
        new Notification('Focus block done', {
          body: step ? `Did you finish: ${step.text}?` : 'How did it go?',
        });
      } catch (e) {
        // Notifications unavailable - the card is enough
      }
    }
  }, [now, phase, block, step]);

  if (!activeTask || isPomodoro || !phase || !step) return null;
  // Luma: the running block lives in the timer pill at the top
  if (isLuma && phase === 'running') return null;

  const startBlock = async () => {
    let id: number | null = null;
    try {
      id = await window.electron.database.startFocusBlock({
        taskId: activeTask.id,
        goal: step.text,
        checklistItemId: step.id ?? null,
        plannedMinutes: minutes,
      });
    } catch (e) {
      id = null; // still run the block, just unrecorded
    }
    const endsAt = Date.now() + minutes * 60 * 1000;
    setBlock({ id, endsAt });
    setNow(Date.now());
    setPhase('running');
    setRunningBlock({ goal: step.text, minutes, endsAt, boost: withBoost });
    window.electron.ipcRenderer.send('focus-music:start');
    if (withBoost) toggleBoostMode(true);
  };

  const finishBlock = async (achieved: boolean) => {
    if (block?.id) {
      await window.electron.database
        .finishFocusBlock(block.id, achieved)
        .catch(() => {});
    }
    if (achieved) {
      if (step.id) {
        await window.electron.database
          .toggleChecklistItem(step.id, true)
          .catch(() => {});
      }
      checkForAchievements();
      setPhase('won');
      await loadNextStep(activeTask);
    } else {
      setPhase('propose');
    }
  };

  const blockOptions = Array.from(new Set([MIN_BLOCK, suggested, MAX_BLOCK]));
  const progress =
    block && phase === 'running'
      ? Math.min(
          100,
          100 - ((block.endsAt - now) / (minutes * 60 * 1000)) * 100,
        )
      : 0;

  return (
    <Paper
      role="status"
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: theme.zIndex.drawer + 2,
        width: phase === 'running' ? 340 : 400,
        maxWidth: 'calc(100vw - 32px)',
        p: phase === 'running' ? 1.5 : 2.5,
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(17,18,20,0.18)',
      }}
    >
      {phase !== 'running' && (
        <IconButton
          size="small"
          aria-label="Dismiss focus block"
          onClick={() => setPhase(null)}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}

      {phase === 'propose' && (
        <>
          <Typography variant="overline" color="text.secondary">
            Focus block
          </Typography>
          <Typography
            variant="body1"
            sx={{ fontWeight: 600, pr: 3, display: 'flex', gap: 1 }}
          >
            <FlagIcon fontSize="small" color="primary" sx={{ mt: 0.3 }} />
            {step.text}
          </Typography>
          {needsSplit && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Big task, no steps yet - splitting it into 3 small steps makes
              progress visible.{' '}
              <Button
                size="small"
                onClick={() => navigate(`/task/${activeTask.id}`)}
                sx={{ py: 0, minWidth: 0 }}
              >
                Split it
              </Button>
            </Typography>
          )}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={minutes}
              onChange={(_, value) => value && setMinutes(value)}
            >
              {blockOptions.map((m) => (
                <ToggleButton key={m} value={m} sx={{ px: 1.5 }}>
                  {m}m
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="contained"
              onClick={startBlock}
              sx={{ ml: 'auto' }}
            >
              Start block
            </Button>
          </Box>
          <FormControlLabel
            sx={{ mt: 1, ml: -0.5 }}
            control={
              <Checkbox
                size="small"
                checked={withBoost}
                onChange={(e) => {
                  setWithBoost(e.target.checked);
                  localStorage.setItem(
                    'focus_block_boost',
                    String(e.target.checked),
                  );
                }}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                Open Boost (full-screen, distraction-free)
              </Typography>
            }
          />
        </>
      )}

      {phase === 'running' && block && (
        // The card itself fills up with liquid as the block runs
        <LiquidFill
          progress={progress}
          color={theme.palette.secondary.main}
          opacity={0.35}
        />
      )}

      {phase === 'running' && block && (
        <Box sx={{ position: 'relative', py: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon fontSize="small" color="primary" />
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {step.text}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
            >
              {formatLeft(block.endsAt - now)}
            </Typography>
          </Box>
        </Box>
      )}

      {phase === 'review' && (
        <>
          <Typography variant="overline" color="text.secondary">
            Block done - {minutes} min
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, pr: 3 }}>
            Did you finish &quot;{step.text}&quot;?
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'end' }}>
            <Button onClick={() => finishBlock(false)}>Not yet</Button>
            <Button variant="contained" onClick={() => finishBlock(true)}>
              Done
            </Button>
          </Box>
        </>
      )}

      {phase === 'won' && (
        <>
          <Typography variant="overline" color="success.main">
            Small win
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, pr: 3 }}>
            {/* No checklist step means the goal was the task itself */}
            {step.id ? `Next: ${step.text}` : `Keep going on: ${step.text}`}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'end' }}>
            <Button onClick={() => setPhase(null)}>Take a break</Button>
            <Button variant="contained" onClick={() => setPhase('propose')}>
              Next block
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
