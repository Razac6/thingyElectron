import React from 'react';
import {
  Box,
  ButtonBase,
  Collapse,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { alpha, lighten, darken, useTheme } from '@mui/material/styles';
import { useTimer } from '../context/TimerContext';
import DailyProductivityBarChart from '../components/DailyProductivityBarChart';
import ContributionGraph from '../components/ContributionGraph';
import SmartInsightWidget from '../components/SmartInsightWidget';
import FavoriteHabitWidget from '../components/FavoriteHabitWidget';
import DailyChallengeWidget from '../components/DailyChallengeWidget';
import { toLocalISOString, addDays } from '../util/dateUtils';
import useDashboardViews from './useDashboardViews';
import useTodayWins from './useTodayWins';
import { useSettings } from '../context/SettingsContext';
import { StatusEnum } from '../../enums/status.enum';
import {
  TileId,
  TILE_LABELS,
  TILES_SETTING,
  HIGHLIGHT_SETTING,
  parseTiles,
  parseHighlight,
} from './dashboardTiles';

const formatDuration = (ms: number) => {
  // Use ceil for consistency with charts
  const totalMinutes = ms > 0 ? Math.ceil(ms / (1000 * 60)) : 0;
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
};

const fadeIn = { animation: 'lumaFadeIn 0.4s ease-out' };

// Big, thin number with a small unit next to it - "23 min", "84 / 100"
function Metric({
  value,
  unit,
  size = '2.75rem',
}: {
  value: React.ReactNode;
  unit?: string;
  size?: string;
}) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'baseline' }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: size,
          fontWeight: 300,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: 'inherit',
        }}
      >
        {value}
      </Typography>
      {unit && (
        <Typography
          component="span"
          sx={{
            ml: 0.75,
            mr: 1.5,
            fontSize: '0.95rem',
            color: 'inherit',
            opacity: 0.55,
          }}
        >
          {unit}
        </Typography>
      )}
    </Box>
  );
}

function StatCard({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const { main, contrastText } = useTheme().palette.highlight;
  return (
    <Paper
      sx={{
        p: 2.5,
        height: '100%',
        minHeight: 128,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: 'text.primary',
        ...(highlight && {
          color: contrastText,
          background: `radial-gradient(120% 140% at 80% 0%, ${lighten(main, 0.65)} 0%, ${main} 55%, ${darken(main, 0.08)} 100%)`,
          boxShadow: `0 12px 32px ${alpha(main, 0.35)}`,
        }),
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ color: highlight ? alpha(contrastText, 0.85) : 'text.secondary' }}
      >
        {label}
      </Typography>
      <Box sx={{ mt: 2 }}>{children}</Box>
    </Paper>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  // Text/lines on the Activity band - readable whatever band color the user picked
  const onBand = useTheme().palette.band.contrastText;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: '14px',
        bgcolor: alpha(onBand, 0.06),
        border: `1px solid ${alpha(onBand, 0.06)}`,
      }}
    >
      <Typography
        sx={{ flex: 1, fontSize: '0.9rem', color: alpha(onBand, 0.85) }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          width: 2,
          height: 16,
          borderRadius: 1,
          bgcolor: 'secondary.main',
        }}
      />
      <Typography
        sx={{
          minWidth: 64,
          textAlign: 'right',
          fontSize: '0.9rem',
          color: alpha(onBand, 0.55),
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function LumaDashboard() {
  const theme = useTheme();
  const { tasks, totalSpendTimeToday, productivityData } = useTimer();
  const { settings } = useSettings();
  const { activeView, availableViews, handleViewChange } = useDashboardViews();

  const wins = useTodayWins();
  // The Activity band stays tucked away until the arrow at the bottom is clicked
  const [activityOpen, setActivityOpen] = React.useState(false);
  const activityRef = React.useRef<HTMLDivElement>(null);
  const today = formatDuration(totalSpendTimeToday);

  const week = React.useMemo(() => {
    const byDate = new Map(
      productivityData.map((p) => [p.date, p.totalDuration]),
    );
    // Same day boundary as DailyProductivityBarChart: work before 4am counts as yesterday
    const anchor = new Date();
    if (anchor.getHours() < 4) anchor.setDate(anchor.getDate() - 1);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(anchor, i - 6);
      return { date, ms: byDate.get(toLocalISOString(date)) || 0 };
    });
    const totalMs = days.reduce((sum, d) => sum + d.ms, 0);
    const best = days.reduce((a, b) => (b.ms > a.ms ? b : a));
    return { totalMs, avgMs: totalMs / 7, best };
  }, [productivityData]);

  const fmt = (ms: number) => {
    const { hours, minutes } = formatDuration(ms);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const tiles = parseTiles(settings[TILES_SETTING]);
  const highlighted = parseHighlight(settings[HIGHLIGHT_SETTING]);
  const completedCount = tasks.filter(
    (t) => t.status === StatusEnum.COMPLETED,
  ).length;

  // Value of each stat tile - big thin number + small unit
  const renderTile = (id: TileId) => {
    switch (id) {
      case 'focusedToday':
        return (
          <>
            <Metric value={today.hours} unit="h" />
            <Metric value={today.minutes} unit="min" />
          </>
        );
      case 'stepsDone':
        return <Metric value={wins?.stepsCompleted ?? 0} unit="today" />;
      case 'focusBlocks':
        return (
          <Metric
            value={wins?.focusBlocksAchieved ?? 0}
            unit={`/ ${wins?.focusBlocks ?? 0} hit`}
          />
        );
      case 'tasksDoneToday':
        return <Metric value={wins?.tasksCompleted ?? 0} unit="tasks" />;
      case 'tasksToDo':
        return (
          <Metric
            value={tasks.filter((t) => t.status === StatusEnum.TO_DO).length}
            unit={`/ ${tasks.length}`}
          />
        );
      case 'tasksCompletedAll':
        return <Metric value={completedCount} unit="tasks" />;
      case 'completionRate':
        return (
          <Metric
            value={
              tasks.length
                ? Math.round((completedCount / tasks.length) * 100)
                : 0
            }
            unit="%"
          />
        );
      case 'weekTotal':
        return <Metric value={fmt(week.totalMs)} size="2.25rem" />;
      case 'dailyAverage':
        return <Metric value={fmt(week.avgMs)} size="2.25rem" />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, pb: 2 }}>
      <Grid container spacing={2}>
        {/* Stat tiles - which, in what order, and the highlighted one come from Settings */}
        {tiles.map((id) => (
          <Grid key={id} item xs={12} sm={6} lg={12 / tiles.length}>
            <StatCard label={TILE_LABELS[id]} highlight={id === highlighted}>
              {renderTile(id)}
            </StatCard>
          </Grid>
        ))}

        {/* View switcher card */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              position: 'relative',
              height: 360,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
              {activeView === 2 ? (
                <Box sx={{ p: 2.5, height: '100%', ...fadeIn }}>
                  <DailyChallengeWidget />
                </Box>
              ) : (
                <Box
                  sx={{ p: 2.5, height: '100%', overflow: 'auto', ...fadeIn }}
                >
                  <Typography variant="subtitle2">
                    Today&apos;s insight
                  </Typography>
                  <SmartInsightWidget />
                  <FavoriteHabitWidget />
                </Box>
              )}
            </Box>

            {/* Pagination - the active view is an elongated pill */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 1,
                py: 1.5,
                position: 'absolute',
                bottom: 0,
                width: '100%',
                zIndex: 20,
              }}
            >
              {availableViews.map((idx) => (
                <Box
                  key={idx}
                  onClick={() => handleViewChange(idx)}
                  sx={{
                    width: activeView === idx ? 22 : 8,
                    height: 8,
                    borderRadius: 999,
                    // The dots sit on the card's white strip below every view (the
                    // mountain scene included), so they're always dark
                    bgcolor:
                      activeView === idx
                        ? theme.palette.primary.main
                        : alpha(theme.palette.primary.main, 0.2),
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Last 7 days */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              height: 360,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Last 7 days</Typography>
              <Typography variant="subtitle2">{fmt(week.totalMs)}</Typography>
            </Box>
            <Box sx={{ flexGrow: 1, minHeight: 200, mt: 1 }}>
              <DailyProductivityBarChart />
            </Box>
          </Paper>
        </Grid>

        {/* Activity band - slides out from under the arrow handle */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ButtonBase
              onClick={() => setActivityOpen((open) => !open)}
              aria-expanded={activityOpen}
              aria-label={activityOpen ? 'Hide activity' : 'Show activity'}
              sx={{
                gap: 0.5,
                px: 2,
                py: 0.5,
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                transition: 'color 0.2s, border-color 0.2s',
                '&:hover': {
                  color: 'text.primary',
                  borderColor: 'text.secondary',
                },
              }}
            >
              Activity
              <KeyboardArrowUpIcon
                fontSize="small"
                sx={{
                  transition: 'transform 0.3s',
                  transform: activityOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </ButtonBase>
          </Box>
          <Collapse
            in={activityOpen}
            timeout={350}
            unmountOnExit
            onEntered={() =>
              activityRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              })
            }
          >
            <Box
              ref={activityRef}
              sx={{
                mt: 1.5,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '28px',
                bgcolor: 'band.main',
                color: 'band.contrastText',
                p: { xs: 2.5, md: 3.5 },
                // Soft accent glow rising from the bottom edge
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: '35%',
                  bottom: '-55%',
                  width: '60%',
                  height: '100%',
                  background: `radial-gradient(closest-side, ${alpha(theme.palette.secondary.main, 0.28)}, transparent)`,
                  filter: 'blur(20px)',
                  pointerEvents: 'none',
                },
              }}
            >
              <Grid container spacing={3} sx={{ position: 'relative' }}>
                <Grid item xs={12} md={4}>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 300, color: 'inherit', mb: 2.5 }}
                  >
                    Activity
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <SummaryRow label="This week" value={fmt(week.totalMs)} />
                    <SummaryRow label="Daily average" value={fmt(week.avgMs)} />
                    <SummaryRow
                      label="Best day"
                      value={
                        week.best.ms
                          ? week.best.date.toLocaleDateString('en-US', {
                              weekday: 'short',
                            })
                          : '-'
                      }
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={8} sx={{ minWidth: 0 }}>
                  <ContributionGraph tone="dark" />
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Grid>
      </Grid>

      <style>
        {`
            @keyframes lumaFadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
          `}
      </style>
    </Box>
  );
}
