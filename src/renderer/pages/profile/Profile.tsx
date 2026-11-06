import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { useGamification } from '../../context/GamificationContext';
import DailyChallengeWidget from '../../components/DailyChallengeWidget';
import { LiquidLoader } from '../../components/LiquidFill';

// Profile: every achievement with its real progress (derived from your data by the main
// process) and today's quest.

interface AchievementView {
  id: string;
  name: string;
  description: string;
  group: string;
  target: number;
  progress: number;
  earnedAt: string | null;
}

const GROUPS = ['Tasks', 'Focus', 'Planning', 'Habits', 'Wellbeing'];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function AchievementCard({ a }: { a: AchievementView }) {
  const theme = useTheme();
  const earned = !!a.earnedAt;
  const pct = Math.round((a.progress / a.target) * 100);
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        height: '100%',
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        borderColor: earned
          ? alpha(theme.palette.warning.main, 0.5)
          : 'divider',
        bgcolor: earned
          ? alpha(theme.palette.warning.main, 0.06)
          : 'transparent',
      }}
    >
      {earned ? (
        <EmojiEventsIcon sx={{ color: 'warning.main', mt: 0.25 }} />
      ) : (
        <EmojiEventsOutlinedIcon sx={{ color: 'text.disabled', mt: 0.25 }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          noWrap
          sx={{ color: earned ? 'text.primary' : 'text.secondary' }}
        >
          {a.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {a.description}
        </Typography>
        {earned ? (
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>
            Earned {shortDate(a.earnedAt as string)}
          </Typography>
        ) : (
          <Tooltip title={`${a.progress} / ${a.target}`}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
            >
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ flex: 1, height: 5, borderRadius: 999 }}
              />
              <Typography variant="caption" color="text.secondary">
                {a.progress}/{a.target}
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>
    </Paper>
  );
}

function Profile() {
  const { earnedAchievements } = useGamification();
  const [achievements, setAchievements] = useState<AchievementView[] | null>(
    null,
  );

  // Re-read whenever a new achievement is earned anywhere in the app
  useEffect(() => {
    window.electron.database
      .getGamificationState()
      .then((state: any) => setAchievements(state.achievements))
      .catch(() => setAchievements([]));
  }, [earnedAchievements.length]);

  const earnedCount = useMemo(
    () => (achievements || []).filter((a) => a.earnedAt).length,
    [achievements],
  );

  if (!achievements) return <LiquidLoader label="Loading profile" />;

  return (
    <Box sx={{ pb: 2 }}>
      <Grid container spacing={2}>
        {/* Achievements so far */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="overline" color="text.secondary">
              Achievements
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
              <Typography
                variant="h3"
                sx={{ fontWeight: 300, lineHeight: 1.1 }}
              >
                {earnedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                of {achievements.length} earned
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={
                achievements.length
                  ? (earnedCount / achievements.length) * 100
                  : 0
              }
              sx={{ mt: 1.5, height: 10, borderRadius: 999 }}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                icon={<EmojiEventsIcon sx={{ fontSize: 16 }} />}
                label={`${earnedCount} / ${achievements.length} achievements`}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Today's quest */}
        <Grid item xs={12} md={5}>
          <DailyChallengeWidget />
        </Grid>

        {/* Achievements */}
        {GROUPS.map((group) => {
          const items = achievements
            .filter((a) => a.group === group)
            // earned first, then the closest to done
            .sort(
              (a, b) =>
                Number(!!b.earnedAt) - Number(!!a.earnedAt) ||
                b.progress / b.target - a.progress / a.target,
            );
          if (!items.length) return null;
          return (
            <Grid item xs={12} key={group}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {group}{' '}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  {items.filter((a) => a.earnedAt).length}/{items.length}
                </Typography>
              </Typography>
              <Grid container spacing={1.5}>
                {items.map((a) => (
                  <Grid item xs={12} sm={6} lg={4} key={a.id}>
                    <AchievementCard a={a} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default Profile;
