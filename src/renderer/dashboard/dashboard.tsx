import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import { Typography, Box } from '@mui/material';
import React from 'react';
import { StatusEnum } from '../../enums/status.enum';
import { useTimer } from '../context/TimerContext';
import DailyProductivityBarChart from '../components/DailyProductivityBarChart';
import ContributionGraph from '../components/ContributionGraph';
import SmartInsightWidget from '../components/SmartInsightWidget';
import FavoriteHabitWidget from '../components/FavoriteHabitWidget';
import MountainClimbBeta from '../components/MountainClimbBeta';
import DailyChallengeWidget from '../components/DailyChallengeWidget';
import { useSettings } from '../context/SettingsContext';

function formatTime(ms: number): string {
  if (ms <= 0) return '0h 0m';
  // Use ceil for consistency with charts
  const totalMinutes = Math.ceil(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

const Item = styled(Paper)(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(2),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: '100%',
}));

export default function Dashboard() {
  const { tasks, isLoading, totalSpendTimeToday } = useTimer();
  const { settings } = useSettings();

  // Persist state in localStorage
  const [activeView, setActiveView] = React.useState(() => {
    const saved = localStorage.getItem('dashboard_active_view');
    return saved !== null ? parseInt(saved, 10) : 0;
  });

  const isMountainClimbEnabled =
    settings && settings.mountain_climb_enabled !== 'false';

  // View 1 (Mountain Climb) only exists when the setting is enabled - views 0 and 2 are
  // always available.
  const availableViews = isMountainClimbEnabled ? [0, 1, 2] : [0, 2];

  // Force back to first view if the current view is the (now-disabled) Mountain Climb one
  React.useEffect(() => {
    if (!isMountainClimbEnabled && activeView === 1) {
      setActiveView(0);
    }
  }, [isMountainClimbEnabled, activeView]);

  const handleViewChange = (idx: number) => {
    setActiveView(idx);
    localStorage.setItem('dashboard_active_view', idx.toString());
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  const toDoTasksCount = tasks.filter(
    (task) => task.status === StatusEnum.TO_DO,
  ).length;
  const completedTasksCount = tasks.filter(
    (task) => task.status === StatusEnum.COMPLETED,
  ).length;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        {/* Top Mini Stats */}
        <Grid item xs={12} sm={4}>
          <Item sx={{ py: 1 }}>
            <Typography variant="h5" fontWeight="300" color="#023047">
              {tasks.length}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 300,
                color: 'text.secondary',
                textTransform: 'uppercase',
                fontSize: '0.65rem',
              }}
            >
              Total Tasks
            </Typography>
          </Item>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Item sx={{ py: 1 }}>
            <Typography variant="h5" fontWeight="300" color="#219ebc">
              {toDoTasksCount}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 300,
                color: 'text.secondary',
                textTransform: 'uppercase',
                fontSize: '0.65rem',
              }}
            >
              Tasks To Do
            </Typography>
          </Item>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Item sx={{ py: 1 }}>
            <Typography variant="h5" fontWeight="300" color="#8ecae6">
              {completedTasksCount}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 300,
                color: 'text.secondary',
                textTransform: 'uppercase',
                fontSize: '0.65rem',
              }}
            >
              Tasks Completed
            </Typography>
          </Item>
        </Grid>
        {/* Main Switcher Card */}
        <Grid item xs={12} md={6}>
          <Item
            sx={{
              position: 'relative',
              height: '360px', // Fixed height to prevent layout jumps
              display: 'flex',
              flexDirection: 'column',
              p: 0,
              overflow: 'hidden',
            }}
          >
            {/* View Container */}
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
              {activeView === 1 && isMountainClimbEnabled ? (
                <Box
                  sx={{ height: '320px', animation: 'fadeIn 0.4s ease-out' }}
                >
                  <MountainClimbBeta />
                </Box>
              ) : activeView === 2 ? (
                <Box
                  sx={{
                    p: 2,
                    height: '100%',
                    animation: 'fadeIn 0.4s ease-out',
                  }}
                >
                  <DailyChallengeWidget />
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 2,
                    height: '100%',
                    animation: 'fadeIn 0.4s ease-out',
                  }}
                >
                  <Typography variant="subtitle1" fontWeight="300">
                    Total Time Spent Today
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ mt: 0.5, mb: 1, color: '#023047', fontWeight: 300 }}
                  >
                    {formatTime(totalSpendTimeToday)}
                  </Typography>
                  <SmartInsightWidget />
                  <FavoriteHabitWidget />
                </Box>
              )}
            </Box>

            {/* Pagination Dots */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 1.5,
                py: 1.5,
                bgcolor:
                  activeView === 1 && isMountainClimbEnabled
                    ? 'transparent'
                    : 'rgba(255,255,255,0.5)',
                borderTop:
                  activeView === 1 && isMountainClimbEnabled
                    ? 'none'
                    : '1px solid rgba(0,0,0,0.05)',
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
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: activeView === idx ? '#023047' : '#cfd8dc',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'scale(1.3)',
                      bgcolor: '#219ebc',
                    },
                    boxShadow:
                      activeView === idx
                        ? '0 0 8px rgba(2, 48, 71, 0.3)'
                        : 'none',
                  }}
                />
              ))}
            </Box>
          </Item>
        </Grid>
        <Grid item xs={12} md={6}>
          <Item
            sx={{ display: 'flex', flexDirection: 'column', height: '360px' }}
          >
            <Typography
              variant="subtitle1"
              fontWeight="300"
              gutterBottom
              sx={{ p: 2, pb: 0 }}
            >
              Last 7 Days Activity
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 200, width: '100%', p: 1 }}>
              <DailyProductivityBarChart />
            </Box>
          </Item>
        </Grid>
        ...
        <Grid item xs={12}>
          <ContributionGraph />
        </Grid>
      </Grid>

      <style>
        {`
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
          `}
      </style>
    </Box>
  );
}
