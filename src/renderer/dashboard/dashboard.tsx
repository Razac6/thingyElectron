import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import {
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import React from 'react';
import { StatusEnum } from '../../enums/status.enum';
import { useTimer } from '../context/TimerContext';
import DailyProductivityBarChart from '../components/DailyProductivityBarChart';
import ContributionGraph from '../components/ContributionGraph'; // Import the new component

function formatTime(ms: number): string {
  if (ms <= 0) return '0h 0m';
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  minutes %= 60;
  return `${hours}h ${minutes}m`;
}

export default function Dashboard() {
  const { tasks, isLoading } = useTimer();

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  const workday = new Date().toLocaleDateString(); // Simple version for daily stats
  const todaysTasks = tasks.filter((task) => task.updateStatusDate === workday);

  const totalSpendTimeToday = todaysTasks.reduce(
    (acc, task) => acc + (task.spendTime || 0),
    0,
  );

  const toDoTasksCount = tasks.filter(
    (task) => task.status === StatusEnum.TO_DO,
  ).length;
  const completedTasksCount = tasks.filter(
    (task) => task.status === StatusEnum.COMPLETED,
  ).length;
  const Item = styled(Paper)(({ theme }) => ({
    ...theme.typography.body2,
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
    height: '100%',
  }));

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Item>
            <Typography variant="h4">{tasks.length}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 300, color: 'text.secondary' }}>Total Tasks</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Item>
            <Typography variant="h4">{toDoTasksCount}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 300, color: 'text.secondary' }}>Tasks To Do</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Item>
            <Typography variant="h4">{completedTasksCount}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 300, color: 'text.secondary' }}>Tasks Completed</Typography>
          </Item>
        </Grid>

        <Grid item xs={12} md={6}>
          <Item>
            <Typography variant="h5">
              Total Time Spent Today
            </Typography>
            <Typography variant="h3" sx={{ mt: 1 }}>
              {formatTime(totalSpendTimeToday)}
            </Typography>
          </Item>
        </Grid>
        <Grid item xs={12} md={6}>
          <Item sx={{ height: 200 }}>
             <Typography variant="h5" gutterBottom>
              Last 5 Days Activity
            </Typography>
            <Box sx={{ height: '100%', width: '100%' }}>
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
