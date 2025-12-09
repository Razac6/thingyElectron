import React, { useState, useMemo } from 'react';
import { Box, Paper, Grid, Typography, TextField } from '@mui/material';
import { Pie, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { useTimer } from '../../context/TimerContext';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import ProductivityChart from '../../components/ProductivityChart';
import HourlyProductivityChart from '../../components/HourlyProductivityChart'; // Import new component

// Helper to format date to YYYY-MM-DD for the input
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

function Statistics() {
  const { tasks, productivityData } = useTimer();
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to last 7 days
    return formatDateForInput(date);
  });
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date()));

  // Memoized data for Productivity Line Chart based on date range
  const productivityChartData = useMemo(() => {
    // productivityData from Context is already in { date: 'YYYY-MM-DD', totalDuration: ms } format
    // and aligned with local timezone/productivity day logic.

    const filteredProgress = productivityData.filter(entry => {
      return entry.date >= startDate && entry.date <= endDate;
    });

    // Sort the filtered data just in case it's not in order
    filteredProgress.sort((a, b) => a.date.localeCompare(b.date));

    const labels = filteredProgress.map(entry => {
       // Parse YYYY-MM-DD manually to avoid UTC conversion issues in Date constructor
       const [y, m, d] = entry.date.split('-').map(Number);
       const localDate = new Date(y, m - 1, d);
       return localDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });
    
    const data = filteredProgress.map(entry => Math.ceil(entry.totalDuration / (1000 * 60)));

    return {
      labels,
      datasets: [{
        label: 'Time Spent (minutes)',
        data,
        fill: false,
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: 'rgba(75, 192, 192, 0.2)',
      }],
    };
  }, [startDate, endDate, productivityData]);

  // Data for Status Pie Chart (always shows current state)
  const statusPieData = useMemo(() => {
    const statusCounts = {
      [StatusEnum.TO_DO]: 0,
      [StatusEnum.IN_PROGRESS]: 0,
      [StatusEnum.IN_REVIEW]: 0,
      [StatusEnum.COMPLETED]: 0,
    };
    tasks.forEach(task => { if (task.status in statusCounts) statusCounts[task.status]++; });
    return {
      labels: Object.keys(statusCounts),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['rgba(150, 150, 150, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)'] }],
    };
  }, [tasks]);

  // Data for Priority Doughnut Chart (always shows current state)
  const priorityDoughnutData = useMemo(() => {
    const priorityCounts = { [PriorityEnum.HIGH]: 0, [PriorityEnum.MEDIUM]: 0, [PriorityEnum.LOW]: 0 };
    tasks.forEach(task => { if (task.priority in priorityCounts) priorityCounts[task.priority]++; });
    return {
      labels: Object.keys(priorityCounts),
      datasets: [{ data: Object.values(priorityCounts), backgroundColor: ['rgba(211, 47, 47, 0.7)', 'rgba(255, 179, 0, 0.7)', 'rgba(25, 118, 210, 0.7)'] }],
    };
  }, [tasks]);

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ padding: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Productivity Over Time</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                <TextField label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
              </Box>
            </Box>
            <Box sx={{ height: 300, position: 'relative' }}>
              <ProductivityChart chartData={productivityChartData} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ padding: 2 }}>
            <Box sx={{ height: 300, position: 'relative' }}>
              <HourlyProductivityChart />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Tasks by Status</Typography>
            <Box sx={{ height: 300, position: 'relative' }}>
              <Pie data={statusPieData} options={{ maintainAspectRatio: false }}/>
            </Box>
          </Paper>
        </Grid>
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
