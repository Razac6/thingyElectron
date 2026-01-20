import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem } from '@mui/material';
import { useTheme } from '@mui/material/styles';

ChartJS.register(ArcElement, Tooltip, Legend);

const CATEGORIES = ['WORK', 'LEARNING', 'DISTRACTION', 'NEUTRAL', 'UNCATEGORIZED'];

const WebAnalytics = () => {
  const theme = useTheme();
  const [stats, setStats] = useState<{ topDomains: any[], totalDuration: number } | null>(null);
  const [appStats, setAppStats] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ integrationEnabled: true, appMonitoringEnabled: true });

  const handleCategoryChange = async (domain: string, category: string) => {
      try {
          // @ts-ignore
          await window.electron.database.setDomainCategory(domain, category);
          // Refresh stats
          // @ts-ignore
          const data = await window.electron.database.getTodaysWebStats();
          setStats(data);
      } catch (e) {
          console.error(e);
      }
  };

  const handleAppCategoryChange = async (appName: string, category: string) => {
      try {
          // @ts-ignore
          await window.electron.database.setAppCategory(appName, category);
          // Refresh stats
          // @ts-ignore
          const appData = await window.electron.database.getTodaysAppStats();
          setAppStats(appData);
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // @ts-ignore
        const data = await window.electron.database.getTodaysWebStats();
        setStats(data);
        
        // @ts-ignore
        const appData = await window.electron.database.getTodaysAppStats();
        setAppStats(appData);

        // @ts-ignore
        const currentSettings = await window.electron.database.getWebSettings();
        setSettings(currentSettings);
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
        📊 Monitoring Activity
      </Typography>

      {settings.integrationEnabled && (
      <>
      <Typography variant="h5" gutterBottom sx={{ mt: 2, mb: 3 }}>
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
            <Typography variant="h6" gutterBottom>Top 10 Domains (Today)</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Domain</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Time Spent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.topDomains.map((row) => (
                    <TableRow key={row.domain}>
                      <TableCell component="th" scope="row">
                        {row.domain}
                      </TableCell>
                      <TableCell>
                        <Select
                            value={row.category || 'UNCATEGORIZED'}
                            size="small"
                            onChange={(e) => handleCategoryChange(row.domain, e.target.value as string)}
                            variant="standard"
                            disableUnderline
                            sx={{ fontSize: '0.875rem' }}
                        >
                            {CATEGORIES.map(cat => (
                                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                            ))}
                        </Select>
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
      </>
      )}

      {settings.appMonitoringEnabled && (
      <>
      <Typography variant="h5" gutterBottom sx={{ color: theme.palette.text.primary, mb: 3, mt: 6 }}>
        🖥️ Desktop Apps (Today)
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" gutterBottom>App Distribution</Typography>
            {appStats.length > 0 ? (
                <Box sx={{ maxWidth: 400, width: '100%' }}>
                    <Doughnut data={{
                        labels: appStats.map(d => d.appName),
                        datasets: [{
                            label: 'Minutes',
                            data: appStats.map(d => Math.round(d.totalTime / 60000)),
                            backgroundColor: ['#00d2d3', '#54a0ff', '#5f27cd', '#ff9f43', '#ee5253', '#0abde3'],
                            borderWidth: 1,
                        }]
                    }} />
                </Box>
            ) : (
                <Typography sx={{ mt: 5, color: 'text.secondary' }}>No desktop activity recorded yet.</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Top 10 Applications (Today)</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Application</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Time Spent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {appStats.map((row) => (
                    <TableRow key={row.appName}>
                      <TableCell component="th" scope="row">
                        {row.appName}
                      </TableCell>
                      <TableCell>
                        <Select
                            value={row.category || 'UNCATEGORIZED'}
                            size="small"
                            onChange={(e) => handleAppCategoryChange(row.appName, e.target.value as string)}
                            variant="standard"
                            disableUnderline
                            sx={{ fontSize: '0.875rem' }}
                        >
                            {CATEGORIES.map(cat => (
                                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                            ))}
                        </Select>
                      </TableCell>
                      <TableCell align="right">{formatDuration(row.totalTime)}</TableCell>
                    </TableRow>
                  ))}
                  {appStats.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={2} align="center">Go use some apps!</TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
      </>
      )}
    </Box>
  );
};

export default WebAnalytics;
