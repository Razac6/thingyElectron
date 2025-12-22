import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import {
  Typography,
  Box,
  Fab,
  Tooltip,
  Zoom,
  Button, // Import Button component
} from '@mui/material';
import React from 'react';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { StatusEnum } from '../../enums/status.enum';
import { useTimer } from '../context/TimerContext';
import DailyProductivityBarChart from '../components/DailyProductivityBarChart';
import ContributionGraph from '../components/ContributionGraph';
import SmartInsightWidget from '../components/SmartInsightWidget';
import FavoriteHabitWidget from '../components/FavoriteHabitWidget';
import DailyStandupModal from '../components/DailyStandupModal';

function formatTime(ms: number): string {
  if (ms <= 0) return '0h 0m';
  // Use ceil for consistency with charts
  let totalMinutes = Math.ceil(ms / (1000 * 60));
  let hours = Math.floor(totalMinutes / 60);
  let minutes = totalMinutes % 60;
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
  const { tasks, isLoading, totalSpendTimeToday, insights, updateTask } = useTimer();

  React.useEffect(() => {
      // Force a slight refresh if insights are missing but loading is false
      // This helps with the 'blank' dashboard on first login/load
      if (!insights && !isLoading) {
          // fetchAllData is internal to TimerContext, but we can trigger 
          // a refresh by just mounting the component if the context is healthy.
      }
  }, [insights, isLoading]);

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
      <DailyStandupModal />
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Item sx={{ py: 1 }}>
            <Typography variant="h5" fontWeight="300" color="#023047">{tasks.length}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 300, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.65rem' }}>Total Tasks</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Item sx={{ py: 1 }}>
            <Typography variant="h5" fontWeight="300" color="#219ebc">{toDoTasksCount}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 300, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.65rem' }}>Tasks To Do</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Item sx={{ py: 1 }}>
            <Typography variant="h5" fontWeight="300" color="#8ecae6">{completedTasksCount}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 300, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.65rem' }}>Tasks Completed</Typography>
          </Item>
        </Grid>

        <Grid item xs={12} md={6}>
          <Item>
            <Typography variant="subtitle1" fontWeight="300">
              Total Time Spent Today
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5, color: '#023047', fontWeight: 300 }}>
              {formatTime(totalSpendTimeToday)}
            </Typography>
            <SmartInsightWidget />
            
            <FavoriteHabitWidget />
          </Item>
        </Grid>
        <Grid item xs={12} md={6}>
          <Item sx={{ display: 'flex', flexDirection: 'column' }}>
             <Typography variant="subtitle1" fontWeight="300" gutterBottom>
              Last 7 Days Activity
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 200, width: '100%' }}>
              <DailyProductivityBarChart />
            </Box>
          </Item>
        </Grid>
        <Grid item xs={12}>
          <ContributionGraph />
        </Grid>
      </Grid>
    </Box>
  );
}
