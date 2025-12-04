import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import {
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { StatusEnum } from '../../enums/status.enum';
import { useTimer } from '../context/TimerContext';

export default function Dashboard() {
  const { tasks, isLoading } = useTimer();
  const [liveTotalSpendTime, setLiveTotalSpendTime] = useState(0);

  function formatTime(ms: number, withSec = true): string {
    if (ms < 0) {
      return withSec ? '00h 00m 00s' : '00h 00m';
    }
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds %= 60;
    minutes %= 60;

    const paddedHours = hours.toString().padStart(2, '0');
    const paddedMinutes = minutes.toString().padStart(2, '0');
    const paddedSeconds = seconds.toString().padStart(2, '0');
    if (withSec) {
      return `${paddedHours}h ${paddedMinutes}m ${paddedSeconds}s`;
    }
    return `${paddedHours}h ${paddedMinutes}m`;
  }

  useEffect(() => {
    const calculateLiveTime = () => {
      const now = Date.now();
      const total = tasks.reduce((acc, task) => {
        const baseSpendTime = task.spendTime || 0;
        const runningTime = task.startTimer ? now - task.startTimer : 0;
        return acc + baseSpendTime + runningTime;
      }, 0);
      setLiveTotalSpendTime(total);
    };

    calculateLiveTime(); // Initial calculation
    const interval = setInterval(calculateLiveTime, 1000); // Update every second

    return () => clearInterval(interval);
  }, [tasks]);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

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
        <Grid item xs={4}>
          <Item>
            <Typography variant="h4">{tasks.length}</Typography>
            <Typography variant="subtitle1">Total Tasks</Typography>
          </Item>
        </Grid>
        <Grid item xs={4}>
          <Item>
            <Typography variant="h4">{toDoTasksCount}</Typography>
            <Typography variant="subtitle1">Tasks To Do</Typography>
          </Item>
        </Grid>
        <Grid item xs={4}>
          <Item>
            <Typography variant="h4">{completedTasksCount}</Typography>
            <Typography variant="subtitle1">Tasks Completed</Typography>
          </Item>
        </Grid>

        <Grid item xs={12}>
          <Item>
            <Typography variant="h5">
              Total Time Spent on Tasks
            </Typography>
            <Typography variant="h3" sx={{ mt: 1 }}>
              {formatTime(liveTotalSpendTime)}
            </Typography>
          </Item>
        </Grid>
      </Grid>
    </Box>
  );
}
