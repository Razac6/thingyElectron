import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Zoom, LinearProgress } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SmartToyIcon from '@mui/icons-material/SmartToy'; 
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
  
  const [message, setMessage] = useState<string>('');
  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const fetchAiMessage = async () => {
      try {
          const userStr = localStorage.getItem('userId');
          const userId = userStr ? JSON.parse(userStr) : 1;
          const msg = await window.electron.database.getAiMessage(userId);
          
          if (msg !== message || !showBubble) {
              setMessage(msg);
              setShowBubble(true);
              
              if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
              bubbleTimeoutRef.current = setTimeout(() => setShowBubble(false), 12000);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const handleGenerateReport = async () => {
      setReportText(''); 
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
    setTimeout(fetchAiMessage, 1500);

    const loop = setInterval(() => {
        if (!showBubble) fetchAiMessage();
    }, 180000); 

    const statsInterval = setInterval(fetchStats, 60000);

    return () => {
        clearInterval(loop);
        clearInterval(statsInterval);
        if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    };
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
    <Paper sx={{ p: 2, height: '100%', position: 'relative', overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
            <PsychologyIcon color={isMature ? "secondary" : "action"} />
            <Typography variant="h6">Neural Core</Typography>
        </Box>
        <Tooltip title="Raport Dnia">
            <IconButton onClick={handleGenerateReport} size="small" color="primary">
                <SummarizeIcon fontSize="small" />
            </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
          {/* Left: Robot & Bubble */}
          <Box sx={{ width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              
              {/* Speech Bubble */}
              <Zoom in={showBubble}>
                <Box
                    onClick={() => setShowBubble(false)}
                    sx={{
                        position: 'absolute',
                        bottom: '90px', // Above robot
                        left: '10px',
                        zIndex: 100,
                        bgcolor: '#023047',
                        color: 'white',
                        p: 1.5,
                        borderRadius: '12px',
                        borderBottomLeftRadius: '0px',
                        minWidth: '180px',
                        maxWidth: '250px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: '-10px',
                            left: '0px',
                            borderStyle: 'solid',
                            borderWidth: '10px 10px 0 0',
                            borderColor: '#023047 transparent transparent transparent',
                        }
                    }}
                >
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {message}
                    </Typography>
                </Box>
              </Zoom>

              {/* Robot Icon (The "Head") */}
              <Box 
                onClick={() => fetchAiMessage()}
                sx={{ 
                    cursor: 'pointer',
                    bgcolor: 'rgba(0,0,0,0.04)',
                    p: 1,
                    borderRadius: '50%',
                    display: 'flex',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.08)', transform: 'scale(1.05)' }
                }}
              >
                <SmartToyIcon sx={{ fontSize: 40, color: isMature ? '#219ebc' : '#ffb703' }} />
              </Box>
              
              <Typography variant="caption" sx={{ mt: 1, fontWeight: 'bold', color: isMature ? 'success.main' : 'warning.main' }}>
                  {isMature ? 'ONLINE' : 'CALIBRATING'}
              </Typography>
          </Box>

          {/* Right: Detailed Stats */}
          <Box sx={{ flexGrow: 1 }}>
              <Box mb={1.5}>
                  <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Confidence</Typography>
                      <Typography variant="caption" fontWeight="bold">{stats.confidence}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={stats.confidence} sx={{ height: 6, borderRadius: 3 }} />
              </Box>

              <Box display="flex" gap={1}>
                  <Box sx={{ flex: 1, bgcolor: 'rgba(0,0,0,0.02)', p: 1, borderRadius: 1, textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <Typography variant="subtitle2" color="primary">{stats.trainingCount}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Cycles</Typography>
                  </Box>
                  <Box sx={{ flex: 1, bgcolor: 'rgba(0,0,0,0.02)', p: 1, borderRadius: 1, textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <Typography variant="subtitle2" color="secondary">{stats.dataCount}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Data</Typography>
                  </Box>
              </Box>
          </Box>
      </Box>

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