import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';

ChartJS.register(ArcElement, Tooltip, Legend);

const WebAnalytics = () => {
  const theme = useTheme();
  const [stats, setStats] = useState<{ topDomains: any[], totalDuration: number } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // @ts-ignore
        const data = await window.electron.database.getTodaysWebStats();
        setStats(data);
      } catch (error) {
        console.error('WebAnalytics: Failed to fetch stats. Ensure app is restarted.', error);
        setStats({ topDomains: [], totalDuration: 0 }); // Fallback to avoid stuck loading
      }
    };

    fetchStats();
    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <Typography>Loading analytics...</Typography>;

  const chartData = {
    labels: stats.topDomains.map(d => d.domain),
    datasets: [
      {
        label: '# of Minutes',
        data: stats.topDomains.map(d => Math.round(d.totalTime / 60000)),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
        ],
        borderWidth: 1,
      },
    ],
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theme.palette.text.primary, mb: 4 }}>
        🌐 Web Activity (Today)
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" gutterBottom>Time Distribution</Typography>
            {stats.topDomains.length > 0 ? (
                <Box sx={{ maxWidth: 400, width: '100%' }}>
                    <Doughnut data={chartData} />
                </Box>
            ) : (
                <Typography sx={{ mt: 5, color: 'text.secondary' }}>No activity recorded yet.</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Top Distractions</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Domain</TableCell>
                    <TableCell align="right">Time Spent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.topDomains.map((row) => (
                    <TableRow key={row.domain}>
                      <TableCell component="th" scope="row">
                        {row.domain}
                      </TableCell>
                      <TableCell align="right">{formatDuration(row.totalTime)}</TableCell>
                    </TableRow>
                  ))}
                  {stats.topDomains.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={2} align="center">Go browse the web!</TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default WebAnalytics;
