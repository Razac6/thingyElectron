import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, LinearProgress, Grid, CircularProgress, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SummarizeIcon from '@mui/icons-material/Summarize';

interface AiStats {
  maturity: number;
  confidence: number;
  trainingCount: number;
  dataCount: number;
}

const AiStatusWidget = () => {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await window.electron.database.getAiStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch AI stats', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
      setReportText(''); // Clear old report immediately
      setReportOpen(true);
      setReportLoading(true);
      try {
          const userStr = localStorage.getItem('userId');
          const userId = userStr ? JSON.parse(userStr) : 1;
          const text = await window.electron.database.generateDailyReport(userId);
          setReportText(text);
      } catch (e) {
          setReportText("Błąd generowania raportu.");
      } finally {
          setReportLoading(false);
      }
  };

  useEffect(() => {
    fetchStats();
    // Refresh occasionally or on mount
    const interval = setInterval(fetchStats, 60000); // 1 min refresh
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 150 }}>
        <CircularProgress />
      </Paper>
    );
  }

  const isMature = stats.maturity >= 100;

  return (
    <Paper sx={{ p: 2, height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Background decoration for AI feel */}
      <Box sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          opacity: 0.05,
          transform: 'rotate(15deg)'
      }}>
          <PsychologyIcon sx={{ fontSize: 150 }} />
      </Box>

      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
            <PsychologyIcon color={isMature ? "secondary" : "action"} />
            <Typography variant="h6">Neural Core Status</Typography>
            {isMature && <CheckCircleIcon color="success" fontSize="small" />}
        </Box>
        <Tooltip title="Generuj Raport AI">
            <IconButton onClick={handleGenerateReport} color="primary" size="small">
                <SummarizeIcon />
            </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
            {/* Maturity Circle */}
            <Box position="relative" display="inline-flex">
                <CircularProgress 
                    variant="determinate" 
                    value={Math.min(stats.maturity, 100)} 
                    size={80}
                    thickness={4}
                    color={isMature ? "secondary" : "primary"}
                />
                <Box
                    sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                    }}
                >
                    <Typography variant="h5" component="div" color="text.secondary">
                    {Math.min(stats.maturity, 100)}%
                    </Typography>
                    <Typography variant="caption" component="div" color="text.secondary">
                        Maturity
                    </Typography>
                </Box>
            </Box>
            <Typography variant="subtitle2" sx={{ mt: 1, color: isMature ? 'success.main' : 'text.secondary' }}>
                {isMature ? 'Active & Learning' : 'Calibration Phase'}
            </Typography>
        </Grid>

        <Grid item xs={12} sm={8}>
            <Box mb={2}>
                <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Confidence Score</Typography>
                    <Typography variant="body2" fontWeight="bold">{stats.confidence}/100</Typography>
                </Box>
                <LinearProgress 
                    variant="determinate" 
                    value={Math.min(stats.confidence, 100)} 
                    color="primary" 
                    sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary">
                    Based on task consistency and history.
                </Typography>
            </Box>

            <Grid container spacing={1}>
                <Grid item xs={6}>
                    <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">{stats.trainingCount}</Typography>
                        <Typography variant="caption" color="text.secondary">Training Cycles</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={6}>
                    <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="h6" color="secondary">{stats.dataCount}</Typography>
                        <Typography variant="caption" color="text.secondary">Data Points</Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Grid>
      </Grid>
      
      {!isMature && (
          <Box mt={2} p={1} bgcolor="rgba(255, 152, 0, 0.1)" borderRadius={1}>
              <Typography variant="caption" color="warning.main">
                  <ScienceIcon fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                  System is still learning your patterns. Predictions may vary.
              </Typography>
          </Box>
      )}

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Raport AI</DialogTitle>
          <DialogContent dividers>
              {reportLoading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                      <CircularProgress />
                  </Box>
              ) : (
                  <Typography style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {reportText}
                  </Typography>
              )}
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setReportOpen(false)}>Zamknij</Button>
          </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AiStatusWidget;
