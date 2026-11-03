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
import WarriorPanel from '../../components/journey/WarriorPanel';
import { totalXp, xpForNextLevel } from '../../../main/gamification';

// Profile: the warrior (when the journey is on) on top, level and XP, every achievement with its real progress (derived from your
// data by the main process), and where recent XP came from.

interface AchievementView {
  id: string;
  name: string;
  description: string;
  xp: number;
  group: string;
  target: number;
  progress: number;
  earnedAt: string | null;
}

interface XpEvent {
  amount: number;
  reason: string;
  createdAt: string;
}

const GROUPS = ['Tasks', 'Focus', 'Planning', 'Habits', 'Wellbeing'];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const when = (iso: string) => {
  const d = new Date(iso);
  return new Date().toDateString() === d.toDateString()
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : shortDate(iso);
};

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ flex: 1, color: earned ? 'text.primary' : 'text.secondary' }}
          >
            {a.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            +{a.xp} XP
          </Typography>
        </Box>
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
  const { profile } = useGamification();
  const [achievements, setAchievements] = useState<AchievementView[] | null>(
    null,
  );
  const [recentXp, setRecentXp] = useState<XpEvent[]>([]);

  // Re-read whenever the profile changes (XP awarded anywhere in the app)
  useEffect(() => {
    window.electron.database
      .getGamificationState()
      .then((state: any) => {
        setAchievements(state.achievements);
        setRecentXp(state.recentXp);
      })
      .catch(() => setAchievements([]));
  }, [profile?.xp, profile?.level]);

  const earnedCount = useMemo(
    () => (achievements || []).filter((a) => a.earnedAt).length,
    [achievements],
  );

  if (!profile || !achievements)
    return <LiquidLoader label="Loading profile" />;

  const needed = xpForNextLevel(profile.level);

  return (
    <Box sx={{ pb: 2 }}>
      <Grid container spacing={2}>
        {/* Journey warrior and gear (only while the Warrior is the assistant) */}
        <Grid item xs={12} sx={{ '&:empty': { display: 'none' } }}>
          <WarriorPanel />
        </Grid>

        {/* Level */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="overline" color="text.secondary">
              Level
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
              <Typography
                variant="h3"
                sx={{ fontWeight: 300, lineHeight: 1.1 }}
              >
                {profile.level}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totalXp(profile.level, profile.xp)} XP total
              </Typography>
            </Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}
            >
              <LinearProgress
                variant="determinate"
                value={(profile.xp / needed) * 100}
                sx={{ flex: 1, height: 10, borderRadius: 999 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: 'nowrap' }}
              >
                {profile.xp} / {needed} XP
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {needed - profile.xp} XP to level {profile.level + 1}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                icon={<EmojiEventsIcon sx={{ fontSize: 16 }} />}
                label={`${earnedCount} / ${achievements.length} achievements`}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Quest + recent XP */}
        <Grid
          item
          xs={12}
          md={5}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <DailyChallengeWidget />
          <Paper sx={{ p: 2, flex: 1, minHeight: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Recent XP
            </Typography>
            {recentXp.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Finish a task, a habit or a focus block to earn XP.
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 220, overflow: 'auto' }}>
                {recentXp.map((e, i) => (
                  <Box
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    sx={{
                      display: 'flex',
                      gap: 1,
                      py: 0.5,
                      borderTop: i ? 1 : 0,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      {e.reason}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: 'success.main', fontWeight: 600 }}
                    >
                      +{e.amount}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ width: 52, textAlign: 'right' }}
                    >
                      {when(e.createdAt)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
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
