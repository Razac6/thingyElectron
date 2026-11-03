import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Grid,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  ButtonBase,
  Collapse,
  Tooltip,
} from '@mui/material';
import { Theme, alpha, useTheme } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Bar, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { useTimer } from '../../context/TimerContext';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import HourlyProductivityChart from '../../components/HourlyProductivityChart';
import AiProductivityChart from '../../components/AiProductivityChart';
import { getWorkHistory } from '../../services/DatabaseService';
import { LiquidLoader } from '../../components/LiquidFill';
import { toLocalISOString, addDays } from '../../util/dateUtils';

// Statistics: one range picker for the whole page, KPI tiles on top, theme-coloured charts,
// compact bars instead of pies, and a dense day-by-day history list.

const formatDuration = (ms: number): string => {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const RANGES = [7, 14, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];
type View = 'general' | 'ai' | 'history';

const shortDate = (iso: string) => {
  // Parse YYYY-MM-DD manually - the Date constructor would treat it as UTC
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const chartFont = (theme: Theme) => ({
  family: theme.typography.fontFamily as string,
  size: 11,
});

// Shared axis styling: no vertical grid, faint horizontal lines, muted ticks
const axes = (theme: Theme, unit = 'm') => ({
  x: {
    grid: { display: false },
    border: { display: false },
    ticks: { color: theme.palette.text.secondary, font: chartFont(theme) },
  },
  y: {
    beginAtZero: true,
    border: { display: false },
    grid: { color: alpha(theme.palette.text.primary, 0.06) },
    ticks: {
      color: theme.palette.text.secondary,
      font: chartFont(theme),
      maxTicksLimit: 5,
      callback: (value: number) => `${value}${unit}`,
    },
  },
});

function Card({
  title,
  action,
  children,
  height,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1.5,
          gap: 1,
        }}
      >
        <Typography variant="subtitle2">{title}</Typography>
        {action}
      </Box>
      {height ? (
        <Box sx={{ height, position: 'relative' }}>{children}</Box>
      ) : (
        children
      )}
    </Paper>
  );
}
Card.defaultProps = { action: undefined, height: undefined };

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 400, mt: 0.25 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
Kpi.defaultProps = { hint: undefined };

// Counts as labelled rows with a share bar - easier to compare than a pie
function BreakdownBars({
  items,
}: {
  items: { label: string; count: number; color: string }[];
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {items.map((item) => (
        <Box key={item.label}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mb: 0.5,
            }}
          >
            <Typography variant="body2">{item.label}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.count}
              {total ? ` · ${Math.round((item.count / total) * 100)}%` : ''}
            </Typography>
          </Box>
          <Box
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: total ? `${(item.count / total) * 100}%` : 0,
                bgcolor: item.color,
                borderRadius: 999,
                transition: 'width 0.4s',
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function HistoryDay({ day, maxMs }: { day: any; maxMs: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <ButtonBase
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '120px minmax(0, 1fr) 72px 80px 24px',
          alignItems: 'center',
          columnGap: 2,
          py: 1.25,
          px: 1,
          textAlign: 'left',
          borderRadius: 2,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography variant="body2" fontWeight={600}>
          {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
        <Box
          sx={{
            height: 6,
            borderRadius: 999,
            width: `${Math.max(2, (day.totalDuration / maxMs) * 100)}%`,
            bgcolor: 'primary.main',
            opacity: 0.85,
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {day.tasks.length} task{day.tasks.length === 1 ? '' : 's'}
        </Typography>
        <Typography
          variant="body2"
          sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatDuration(day.totalDuration)}
        </Typography>
        <KeyboardArrowDownIcon
          fontSize="small"
          sx={{
            color: 'text.secondary',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pl: '136px', pr: 5, pb: 1.5 }}>
          {day.tasks.map((task: any) => (
            <ButtonBase
              key={task.taskId}
              onClick={() => navigate(`/task/${task.taskId}`)}
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                py: 0.5,
                px: 1,
                borderRadius: 1.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                {task.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flexShrink: 0 }}
              >
                {formatDuration(task.duration)}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function Statistics() {
  const theme = useTheme();
  const location = useLocation();
  const { tasks, productivityData } = useTimer();
  const [view, setView] = useState<View>(
    location.state && (location.state as any).tab === 'history'
      ? 'history'
      : 'general',
  );
  const [range, setRange] = useState<RangeDays>(14);
  const [deepWorkData, setDeepWorkData] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Range = the last N days including today
  const days = useMemo(
    () =>
      Array.from({ length: range }, (_, i) =>
        toLocalISOString(addDays(new Date(), i - range + 1)),
      ),
    [range],
  );
  const startDate = days[0];
  const endDate = days[days.length - 1];

  useEffect(() => {
    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const data = await getWorkHistory(startDate, endDate);
        setHistoryData(data || []);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [startDate, endDate]);

  useEffect(() => {
    const fetchDeepWork = async () => {
      const userStr = localStorage.getItem('userId');
      const userId = userStr ? JSON.parse(userStr) : 1;
      const data = await window.electron.database.getDeepWorkHistory(
        userId,
        range,
      );
      setDeepWorkData(data || []);
    };
    fetchDeepWork();
  }, [range]);

  // Every day of the range, zero-filled so gaps show as empty days
  const daily = useMemo(() => {
    const byDate = new Map(
      productivityData.map((p) => [p.date, p.totalDuration]),
    );
    return days.map((date) => ({ date, ms: byDate.get(date) || 0 }));
  }, [days, productivityData]);

  const kpis = useMemo(() => {
    const totalMs = daily.reduce((sum, d) => sum + d.ms, 0);
    const activeDays = daily.filter((d) => d.ms > 0).length;
    const best = daily.reduce((a, b) => (b.ms > a.ms ? b : a), daily[0]);
    const deep = deepWorkData.reduce(
      (sum, d) => sum + (d.deepWorkDuration || 0),
      0,
    );
    const work = deepWorkData.reduce(
      (sum, d) => sum + (d.totalDuration || 0),
      0,
    );
    return {
      totalMs,
      activeDays,
      avgMs: activeDays ? totalMs / activeDays : 0,
      best,
      deepShare: work ? Math.round((deep / work) * 100) : null,
    };
  }, [daily, deepWorkData]);

  const dailyChart = useMemo(
    () => ({
      labels: daily.map((d) => shortDate(d.date)),
      datasets: [
        {
          label: 'Minutes',
          data: daily.map((d) => Math.round(d.ms / 60000)),
          backgroundColor: daily.map((d) =>
            d.date === endDate
              ? theme.palette.primary.main
              : alpha(theme.palette.primary.main, 0.25),
          ),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 28,
        },
      ],
    }),
    [daily, endDate, theme],
  );

  const focusChart = useMemo(() => {
    const progress = theme.palette.progress?.main ?? theme.palette.info.main;
    return {
      labels: deepWorkData.map((d) => shortDate(String(d.date).slice(0, 10))),
      datasets: [
        {
          label: 'Total work',
          data: deepWorkData.map((d) => d.totalDuration),
          backgroundColor: alpha(theme.palette.text.primary, 0.05),
          borderColor: alpha(theme.palette.text.primary, 0.25),
          borderWidth: 1.5,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
        {
          label: 'Deep work',
          data: deepWorkData.map((d) => d.deepWorkDuration),
          backgroundColor: alpha(progress, 0.18),
          borderColor: progress,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
        {
          label: 'Longest session',
          data: deepWorkData.map((d) => d.maxSession),
          borderColor: theme.palette.warning.main,
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 2,
          tension: 0,
          fill: false,
        },
      ],
    };
  }, [deepWorkData, theme]);

  const statusItems = useMemo(() => {
    const count = (s: StatusEnum) => tasks.filter((t) => t.status === s).length;
    return [
      {
        label: 'To do',
        count: count(StatusEnum.TO_DO),
        color: theme.palette.text.disabled,
      },
      {
        label: 'In progress',
        count: count(StatusEnum.IN_PROGRESS),
        color: theme.palette.progress?.main ?? theme.palette.info.main,
      },
      {
        label: 'In review',
        count: count(StatusEnum.IN_REVIEW),
        color: theme.palette.review?.main ?? theme.palette.secondary.main,
      },
      {
        label: 'Completed',
        count: count(StatusEnum.COMPLETED),
        color: theme.palette.success.main,
      },
    ];
  }, [tasks, theme]);

  const priorityItems = useMemo(() => {
    // Only open work - finished tasks' priority no longer matters
    const open = tasks.filter((t) => t.status !== StatusEnum.COMPLETED);
    const count = (p: PriorityEnum) =>
      open.filter((t) => t.priority === p).length;
    return [
      {
        label: 'High',
        count: count(PriorityEnum.HIGH),
        color: theme.palette.error.main,
      },
      {
        label: 'Medium',
        count: count(PriorityEnum.MEDIUM),
        color: theme.palette.warning.main,
      },
      {
        label: 'Low',
        count: count(PriorityEnum.LOW),
        color: theme.palette.info.main,
      },
    ];
  }, [tasks, theme]);

  const historyMax = Math.max(1, ...historyData.map((d) => d.totalDuration));
  const legend = {
    display: true,
    position: 'bottom' as const,
    labels: {
      boxWidth: 8,
      boxHeight: 8,
      usePointStyle: true,
      color: theme.palette.text.secondary,
      font: chartFont(theme),
    },
  };

  return (
    <Box sx={{ width: '100%', pb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, next) => next && setView(next)}
          aria-label="statistics view"
        >
          <ToggleButton value="general">Overview</ToggleButton>
          <ToggleButton value="ai">Neural Core AI</ToggleButton>
          <ToggleButton value="history">History</ToggleButton>
        </ToggleButtonGroup>
        {view !== 'ai' && (
          <ToggleButtonGroup
            value={range}
            exclusive
            size="small"
            onChange={(_, next) => next && setRange(next)}
            aria-label="date range"
          >
            {RANGES.map((r) => (
              <ToggleButton key={r} value={r}>
                {r} days
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </Box>

      {view === 'general' && (
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Kpi
              label="Total focused"
              value={formatDuration(kpis.totalMs)}
              hint={`${kpis.activeDays} of ${range} days active`}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <Kpi
              label="Average per active day"
              value={formatDuration(kpis.avgMs)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <Kpi
              label="Best day"
              value={kpis.best?.ms ? formatDuration(kpis.best.ms) : '–'}
              hint={kpis.best?.ms ? shortDate(kpis.best.date) : undefined}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <Tooltip title="Share of work time spent in long, uninterrupted sessions">
              <Box sx={{ height: '100%' }}>
                <Kpi
                  label="Deep work"
                  value={kpis.deepShare === null ? '–' : `${kpis.deepShare}%`}
                  hint="of work time"
                />
              </Box>
            </Tooltip>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card title="Focused time per day" height={260}>
              <Bar
                data={dailyChart}
                options={
                  {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: axes(theme),
                  } as any
                }
              />
            </Card>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Card title="By hour of day" height={260}>
              <HourlyProductivityChart />
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card title="Focus quality" height={240}>
              <Line
                data={focusChart}
                options={
                  {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend },
                    scales: axes(theme),
                  } as any
                }
              />
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card title="Tasks by status">
              <BreakdownBars items={statusItems} />
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card title="Open tasks by priority">
              <BreakdownBars items={priorityItems} />
            </Card>
          </Grid>
        </Grid>
      )}

      {view === 'ai' && <AiProductivityChart />}

      {view === 'history' && (
        <Paper sx={{ p: 2 }}>
          {isHistoryLoading && (
            <LiquidLoader size={40} label="Loading history" />
          )}
          {!isHistoryLoading && historyData.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No work logged in this date range.
            </Typography>
          )}
          {!isHistoryLoading && historyData.length > 0 && (
            <Box sx={{ '& > div:first-of-type': { borderTop: 0 } }}>
              {historyData.map((day) => (
                <HistoryDay key={day.date} day={day} maxMs={historyMax} />
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default Statistics;
