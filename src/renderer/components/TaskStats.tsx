import React, { useEffect, useState } from 'react';
import { Box, Typography, LinearProgress, Paper } from '@mui/material';
import { Task } from '../../interfaces/task.interface';

interface TaskStatsProps {
  task: Task;
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0m';
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  minutes %= 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function TaskStats({ task }: TaskStatsProps) {
  const [avgTime, setAvgTime] = useState(0);

  useEffect(() => {
    const fetchAvg = async () => {
      const avg = await window.electron.database.getAverageTimeForTaskType(task.type);
      setAvgTime(avg);
    };
    fetchAvg();
  }, [task.type]);

  const spendTime = task.spendTime || 0;
  const estimateTime = (task.estimate || 0) * 3600 * 1000;
  const progress = estimateTime > 0 ? Math.min((spendTime / estimateTime) * 100, 100) : 0;
  const isOvertime = spendTime > estimateTime;

  let comparisonText = '';
  if (avgTime > 0 && task.status === 'COMPLETED') {
    const difference = ((spendTime - avgTime) / avgTime) * 100;
    if (difference > 10) {
      comparisonText = `${Math.round(difference)}% slower than average.`;
    } else if (difference < -10) {
      comparisonText = `${Math.round(Math.abs(difference))}% faster than average.`;
    } else {
      comparisonText = 'Right on average.';
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Task Analytics</Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2">
          Time Spent: {formatTime(spendTime)} / {formatTime(estimateTime)}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={isOvertime ? 'error' : 'primary'}
          sx={{ height: 8, borderRadius: 5 }}
        />
      </Box>
      {comparisonText && (
        <Typography variant="body2" color="text.secondary">
          {comparisonText}
        </Typography>
      )}
    </Paper>
  );
}

export default TaskStats;
