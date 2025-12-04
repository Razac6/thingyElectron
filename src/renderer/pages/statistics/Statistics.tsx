import React from 'react';
import { Box, Paper, Grid, Typography } from '@mui/material';
import { Pie, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { useTimer } from '../../context/TimerContext';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import ProductivityChart from '../../components/ProductivityChart';

function Statistics() {
  const { tasks } = useTimer();

  // Data for Status Pie Chart
  const statusCounts = {
    [StatusEnum.TO_DO]: 0,
    [StatusEnum.IN_PROGRESS]: 0,
    [StatusEnum.IN_REVIEW]: 0,
    [StatusEnum.COMPLETED]: 0,
  };
  tasks.forEach(task => {
    if (task.status in statusCounts) {
      statusCounts[task.status]++;
    }
  });

  const statusPieData = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        label: '# of Tasks by Status',
        data: Object.values(statusCounts),
        backgroundColor: [
          'rgba(150, 150, 150, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
        ],
        borderColor: [
          'rgba(150, 150, 150, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Data for Priority Doughnut Chart
  const priorityCounts = {
    [PriorityEnum.HIGH]: 0,
    [PriorityEnum.MEDIUM]: 0,
    [PriorityEnum.LOW]: 0,
  };
  tasks.forEach(task => {
    if (task.priority in priorityCounts) {
      priorityCounts[task.priority]++;
    }
  });

  const priorityDoughnutData = {
    labels: Object.keys(priorityCounts),
    datasets: [
      {
        label: '# of Tasks by Priority',
        data: Object.values(priorityCounts),
        backgroundColor: [
          'rgba(211, 47, 47, 0.7)', // High - Red
          'rgba(255, 179, 0, 0.7)',  // Medium - Amber
          'rgba(25, 118, 210, 0.7)', // Low - Blue
        ],
        borderColor: [
          'rgba(211, 47, 47, 1)',
          'rgba(255, 179, 0, 1)',
          'rgba(25, 118, 210, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Productivity Line Chart - Top Full Width */}
        <Grid item xs={12}>
          <Paper sx={{ padding: 2 }}>
            <Typography variant="h6" gutterBottom>Productivity Over Time</Typography>
            <ProductivityChart />
          </Paper>
        </Grid>

        {/* Status Pie Chart - Bottom Left */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Tasks by Status</Typography>
            <Box sx={{ height: 300, position: 'relative' }}>
              <Pie data={statusPieData} options={{ maintainAspectRatio: false }}/>
            </Box>
          </Paper>
        </Grid>

        {/* Priority Doughnut Chart - Bottom Right */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Tasks by Priority</Typography>
            <Box sx={{ height: 300, position: 'relative' }}>
              <Doughnut data={priorityDoughnutData} options={{ maintainAspectRatio: false }} />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Statistics;
