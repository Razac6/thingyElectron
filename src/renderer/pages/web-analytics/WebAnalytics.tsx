import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { Theme, alpha, useTheme } from '@mui/material/styles';
import LanguageIcon from '@mui/icons-material/Language';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import { LiquidLoader } from '../../components/LiquidFill';

// Web & app monitoring: where the time went, grouped by focus category. Compact by design -
// a summary strip on top, then one card per source with a stacked category bar and a
// ranked list (time bar + inline category picker) instead of doughnut charts.

const CATEGORIES = [
  'WORK',
  'LEARNING',
  'DISTRACTION',
  'NEUTRAL',
  'UNCATEGORIZED',
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  WORK: 'Work',
  LEARNING: 'Learning',
  DISTRACTION: 'Distraction',
  NEUTRAL: 'Neutral',
  UNCATEGORIZED: 'Uncategorized',
};

const categoryColor = (theme: Theme, category: Category) =>
  ({
    WORK: theme.palette.success.main,
    LEARNING: theme.palette.progress?.main ?? theme.palette.info.main,
    DISTRACTION: theme.palette.error.main,
    NEUTRAL: theme.palette.text.disabled,
    UNCATEGORIZED: alpha(theme.palette.text.primary, 0.12),
  })[category];

// Legacy/custom category names fall back to Uncategorized for display
const toCategory = (value?: string): Category =>
  CATEGORIES.includes(value as Category)
    ? (value as Category)
    : 'UNCATEGORIZED';

interface Row {
  name: string;
  totalTime: number;
  category: Category;
}

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const sumBy = (rows: Row[], categories: Category[]) =>
  rows
    .filter((r) => categories.includes(r.category))
    .reduce((sum, r) => sum + r.totalTime, 0);

function Dot({ color }: { color: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
      }}
    />
  );
}

// Time split by category as one thin stacked bar
function CategoryBar({ rows }: { rows: Row[] }) {
  const theme = useTheme();
  const total = rows.reduce((sum, r) => sum + r.totalTime, 0);
  if (!total) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        height: 8,
        borderRadius: 999,
        overflow: 'hidden',
        gap: '2px',
      }}
    >
      {CATEGORIES.map((category) => {
        const ms = sumBy(rows, [category]);
        if (!ms) return null;
        return (
          <Tooltip
            key={category}
            title={`${CATEGORY_LABELS[category]} · ${formatDuration(ms)}`}
          >
            <Box
              sx={{
                flex: ms,
                bgcolor: categoryColor(theme, category),
                minWidth: 4,
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

function SourceCard({
  title,
  icon,
  rows,
  emptyText,
  onCategoryChange,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Row[];
  emptyText: string;
  onCategoryChange: (name: string, category: string) => void;
}) {
  const theme = useTheme();
  const total = rows.reduce((sum, r) => sum + r.totalTime, 0);
  const max = Math.max(1, ...rows.map((r) => r.totalTime));

  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5,
          color: 'text.secondary',
        }}
      >
        {icon}
        <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" sx={{ ml: 'auto' }}>
          {formatDuration(total)}
        </Typography>
      </Box>

      <CategoryBar rows={rows} />

      {rows.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 4, textAlign: 'center' }}
        >
          {emptyText}
        </Typography>
      ) : (
        <Box sx={{ mt: 1.5 }}>
          {rows.map((row) => (
            <Box
              key={row.name}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 128px 64px',
                alignItems: 'center',
                columnGap: 1.5,
                py: 0.75,
                borderTop: 1,
                borderColor: 'divider',
                '&:first-of-type': { borderTop: 0 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap title={row.name}>
                  {row.name}
                </Typography>
                {/* Share of the longest entry */}
                <Box
                  sx={{
                    mt: 0.5,
                    height: 3,
                    borderRadius: 999,
                    width: `${(row.totalTime / max) * 100}%`,
                    bgcolor: alpha(categoryColor(theme, row.category), 0.8),
                  }}
                />
              </Box>
              <Select
                value={row.category}
                size="small"
                variant="standard"
                disableUnderline
                onChange={(e) =>
                  onCategoryChange(row.name, e.target.value as string)
                }
                renderValue={(value) => (
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                  >
                    <Dot color={categoryColor(theme, value as Category)} />
                    {CATEGORY_LABELS[value as Category]}
                  </Box>
                )}
                sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
              >
                {CATEGORIES.map((category) => (
                  <MenuItem
                    key={category}
                    value={category}
                    sx={{ gap: 1, fontSize: '0.85rem' }}
                  >
                    <Dot color={categoryColor(theme, category)} />
                    {CATEGORY_LABELS[category]}
                  </MenuItem>
                ))}
              </Select>
              <Typography
                variant="body2"
                sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatDuration(row.totalTime)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

function SummaryTile({
  label,
  ms,
  total,
  color,
}: {
  label: string;
  ms: number;
  total: number;
  color: string;
}) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Dot color={color} />
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {total ? `${Math.round((ms / total) * 100)}%` : '–'}
        </Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 400 }}>
        {formatDuration(ms)}
      </Typography>
    </Paper>
  );
}

function WebAnalytics() {
  const theme = useTheme();
  const [stats, setStats] = useState<{
    topDomains: any[];
    totalDuration: number;
  } | null>(null);
  const [appStats, setAppStats] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    integrationEnabled: true,
    appMonitoringEnabled: true,
  });
  const [days, setDays] = useState(1);

  const handleCategoryChange = async (domain: string, category: string) => {
    try {
      // @ts-ignore
      await window.electron.database.setDomainCategory(domain, category);
      // @ts-ignore
      const data = await window.electron.database.getWebStats(days);
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAppCategoryChange = async (appName: string, category: string) => {
    try {
      // @ts-ignore
      await window.electron.database.setAppCategory(appName, category);
      // @ts-ignore
      const appData = await window.electron.database.getAppStats(days);
      setAppStats(appData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // @ts-ignore
        const data = await window.electron.database.getWebStats(days);
        setStats(data);

        // @ts-ignore
        const appData = await window.electron.database.getAppStats(days);
        setAppStats(appData);

        // @ts-ignore
        const currentSettings = await window.electron.database.getWebSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error(
          'WebAnalytics: Failed to fetch stats. Ensure app is restarted.',
          error,
        );
        setStats({ topDomains: [], totalDuration: 0 }); // Fallback to avoid stuck loading
      }
    };

    fetchStats();
    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [days]);

  if (!stats) return <LiquidLoader label="Loading activity" />;

  const webRows: Row[] = settings.integrationEnabled
    ? stats.topDomains.map((d) => ({
        name: d.domain,
        totalTime: d.totalTime,
        category: toCategory(d.category),
      }))
    : [];
  const appRows: Row[] = settings.appMonitoringEnabled
    ? appStats.map((a) => ({
        name: a.appName,
        totalTime: a.totalTime,
        category: toCategory(a.category),
      }))
    : [];
  const allRows = [...webRows, ...appRows];
  const total = allRows.reduce((sum, r) => sum + r.totalTime, 0);

  return (
    <Box sx={{ pb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Tracked{' '}
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {formatDuration(total)}
          </Box>
        </Typography>
        <ToggleButtonGroup
          value={days}
          exclusive
          size="small"
          onChange={(_, value) => value && setDays(value)}
          aria-label="time range"
        >
          <ToggleButton value={1}>Today</ToggleButton>
          <ToggleButton value={7}>7 days</ToggleButton>
          <ToggleButton value={30}>30 days</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <SummaryTile
            label="Productive"
            ms={sumBy(allRows, ['WORK', 'LEARNING'])}
            total={total}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryTile
            label="Distracting"
            ms={sumBy(allRows, ['DISTRACTION'])}
            total={total}
            color={theme.palette.error.main}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryTile
            label="Neutral & uncategorized"
            ms={sumBy(allRows, ['NEUTRAL', 'UNCATEGORIZED'])}
            total={total}
            color={theme.palette.text.disabled}
          />
        </Grid>

        {settings.integrationEnabled && (
          <Grid item xs={12} md={settings.appMonitoringEnabled ? 6 : 12}>
            <SourceCard
              title="Websites"
              icon={<LanguageIcon fontSize="small" />}
              rows={webRows}
              emptyText="No browsing recorded yet."
              onCategoryChange={handleCategoryChange}
            />
          </Grid>
        )}
        {settings.appMonitoringEnabled && (
          <Grid item xs={12} md={settings.integrationEnabled ? 6 : 12}>
            <SourceCard
              title="Applications"
              icon={<DesktopWindowsIcon fontSize="small" />}
              rows={appRows}
              emptyText="No desktop activity recorded yet."
              onCategoryChange={handleAppCategoryChange}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default WebAnalytics;
