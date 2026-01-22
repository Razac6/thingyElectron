import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Avatar,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Divider,
  LinearProgress
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import { useTimer } from '../context/TimerContext';
import { useSettings } from '../context/SettingsContext';

const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
};

const GREETINGS = [
    "Gotowy na podbój dnia?",
    "Dzisiaj będzie Twój najlepszy dzień!",
    "Czas na odrobinę magii produktywności ✨",
    "Do dzieła! Jaki jest Twój główny cel na dziś?",
    "Neural Core jest gotowy. A Ty?",
];

export default function DailyStandupModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'briefing' | 'report'>('briefing');
  const [data, setData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const navigate = useNavigate();
  const { refreshData } = useTimer();

  const randomGreeting = useMemo(() => {
      return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  }, [open]);

  useEffect(() => {
    const fetchStandup = async () => {
        const userStr = localStorage.getItem('userId');
        const userId = userStr ? JSON.parse(userStr) : 1;
        try {
            const standupData = await window.electron.database.getDailyStandup(userId);
            if (standupData) setData(standupData);
        } catch (e) { console.error(e); }
    };

    const fetchReport = async () => {
        const userStr = localStorage.getItem('userId');
        const userId = userStr ? JSON.parse(userStr) : 1;
        try {
            const rpt = await window.electron.database.getDailyReportData(userId);
            if (rpt) setReportData(rpt);
        } catch (e) { console.error(e); }
    };

    const handleOpenBriefing = () => {
        setMode('briefing');
        fetchStandup();
        setOpen(true);
    };

    const handleOpenReport = () => {
        setMode('report');
        fetchReport();
        fetchStandup(); // For suggestion
        setOpen(true);
    };

    const checkAndShow = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastShown = localStorage.getItem('lastStandupShown');

      if (lastShown !== todayStr) {
        handleOpenBriefing();
        localStorage.setItem('lastStandupShown', todayStr);
      }
    };

    checkAndShow();

    window.addEventListener('open-daily-briefing', handleOpenBriefing);
    window.addEventListener('open-daily-report', handleOpenReport);
    return () => {
        window.removeEventListener('open-daily-briefing', handleOpenBriefing);
        window.removeEventListener('open-daily-report', handleOpenReport);
    };
  }, []);

  const handleClose = () => {
      setOpen(false);
      refreshData();
  };

  const handleTaskClick = () => {
      if (data?.topSuggestion?.id) {
          setOpen(false);
          refreshData();
          navigate(`/task/${data.topSuggestion.id}`);
      }
  };

  const handleExternalLink = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data?.topSuggestion?.link) {
          window.open(data.topSuggestion.link, '_blank');
      }
  };

  if (!open) return null;

  return (
    <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={mode === 'report' ? 'md' : 'xs'}
        fullWidth
        PaperProps={{
            sx: { borderRadius: 3, p: 0, overflow: 'hidden' }
        }}
    >
      <Box sx={{ bgcolor: '#023047', color: 'white', p: 2, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'white', color: '#023047', width: 40, height: 40 }}>
              <SmartToyIcon fontSize="medium" />
          </Avatar>
          <Box sx={{ textAlign: 'left', flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 300, lineHeight: 1.2 }}>
                {mode === 'report' ? 'Raport Dzienny' : 'Dzień dobry!'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 300 }}>
                {mode === 'report' ? new Date().toLocaleDateString() : randomGreeting}
            </Typography>
          </Box>
          {mode === 'report' && (
              <Chip 
                label={reportData?.trend === 'increasing' ? 'Wzrost' : (reportData?.trend === 'decreasing' ? 'Spadek' : 'Stabilnie')} 
                color={reportData?.trend === 'increasing' ? 'success' : (reportData?.trend === 'decreasing' ? 'error' : 'default')}
                size="small"
                icon={<TrendingUpIcon />}
              />
          )}
      </Box>

      <DialogContent sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          {mode === 'briefing' ? (
              // --- BRIEFING VIEW ---
              <Box>
                  {data && (
                      <>
                      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                           <Paper variant="outlined" sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: 'white' }}>
                               <Typography variant="h5" sx={{ fontWeight: 100, color: '#219ebc' }}>
                                   {data.yesterday.completedCount}
                               </Typography>
                               <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 300 }}>Zrobione wczoraj</Typography>
                           </Paper>
                           <Paper variant="outlined" sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: 'white' }}>
                               <Typography variant="h5" sx={{ fontWeight: 100, color: '#fb8500' }}>
                                   {formatDuration(data.yesterday.totalTimeMs)}
                               </Typography>
                               <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 300 }}>Czas skupienia</Typography>
                           </Paper>
                      </Stack>

                      {data.topSuggestion && (
                          <Box>
                              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 400, letterSpacing: 1 }}>
                                  GŁÓWNY PRIORYTET
                              </Typography>
                              <Paper 
                                onClick={handleTaskClick}
                                sx={{ 
                                    p: 2, 
                                    mt: 0.5, 
                                    border: '1px solid #e0e0e0', 
                                    borderLeft: '4px solid #ffb703', 
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    '&:hover': { bgcolor: '#white', transform: 'translateY(-1px)', boxShadow: 2 },
                                    position: 'relative',
                                    bgcolor: 'white'
                                }}
                              >
                                  <Box sx={{ pr: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 300, lineHeight: 1.3 }}>
                                        {data.topSuggestion.title}
                                    </Typography>
                                  </Box>
                                  
                                  <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                                      <Chip
                                        icon={<TrendingUpIcon />}
                                        label={`~${(data.topSuggestion.neuralEst / 60).toFixed(1)}h`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ height: 24, fontWeight: 300 }}
                                      />
                                      {data.isPeakHour && (
                                          <Chip label="Złota Godzina" size="small" sx={{ bgcolor: '#ffb703', color: '#023047', fontWeight: 400, height: 24, fontSize: '0.7rem' }} />
                                      )}
                                  </Stack>
                              </Paper>
                          </Box>
                      )}
                      </>
                  )}
              </Box>
          ) : (
              // --- REPORT VIEW ---
              <Box>
                  {reportData ? (
                      <Grid container spacing={2}>
                          {/* Left Column: Stats */}
                          <Grid item xs={12} md={6}>
                              <Paper sx={{ p: 2, height: '100%' }}>
                                  <Typography variant="subtitle2" gutterBottom color="text.secondary">POSTĘPY DZISIAJ</Typography>
                                  <Box display="flex" justifyContent="space-around" mb={2}>
                                      <Box textAlign="center">
                                          <Typography variant="h4" color="primary">{reportData.completedCount}</Typography>
                                          <Typography variant="caption">Zadania</Typography>
                                      </Box>
                                      <Box textAlign="center">
                                          <Typography variant="h4" color="secondary">{formatDuration(reportData.totalTimeMs)}</Typography>
                                          <Typography variant="caption">Czas pracy</Typography>
                                      </Box>
                                  </Box>
                                  <Divider sx={{ my: 2 }} />
                                  <Typography variant="subtitle2" gutterBottom color="text.secondary">GŁÓWNE ZADANIA</Typography>
                                  {reportData.topTasks.map((t: any, i: number) => (
                                      <Box key={i} display="flex" justifyContent="space-between" mb={1}>
                                          <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>{i+1}. {t.title}</Typography>
                                          <Typography variant="body2" color="text.secondary">{formatDuration(t.duration)}</Typography>
                                      </Box>
                                  ))}
                              </Paper>
                          </Grid>

                          {/* Right Column: Insights & Distractions */}
                          <Grid item xs={12} md={6}>
                              <Paper sx={{ p: 2, mb: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom color="text.secondary" display="flex" alignItems="center" gap={1}>
                                      <SmartToyIcon fontSize="small" /> ANALIZA AI
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#555' }}>
                                      {reportData.trend === 'increasing' 
                                        ? "Świetna robota! Wykazujesz tendencję wzrostową w produktywności. Tak trzymaj!" 
                                        : (reportData.trend === 'decreasing' 
                                            ? "Produktywność nieco spadła. Uważaj na rozpraszacze i spróbuj skupić się na jednym zadaniu naraz." 
                                            : "Twoja wydajność jest stabilna. Konsekwencja to klucz do długoterminowego sukcesu.")}
                                  </Typography>
                              </Paper>

                              <Paper sx={{ p: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom color="text.secondary" display="flex" alignItems="center" gap={1}>
                                      <WarningIcon fontSize="small" color="error" /> ROZPRASZACZE
                                  </Typography>
                                  {reportData.topDistractions.length > 0 ? (
                                      reportData.topDistractions.map((d: any, i: number) => (
                                          <Box key={i} mb={1}>
                                              <Box display="flex" justifyContent="space-between">
                                                  <Typography variant="body2">{d.name}</Typography>
                                                  <Typography variant="caption">{formatDuration(d.duration)}</Typography>
                                              </Box>
                                              <LinearProgress variant="determinate" value={Math.min(100, (d.duration / (reportData.totalTimeMs || 1)) * 100)} color="error" sx={{ height: 4, borderRadius: 2 }} />
                                          </Box>
                                      ))
                                  ) : (
                                      <Typography variant="caption" color="success.main">Brak znaczących rozpraszaczy!</Typography>
                                  )}
                              </Paper>
                          </Grid>
                      </Grid>
                  ) : (
                      <Typography>Ładowanie raportu...</Typography>
                  )}
              </Box>
          )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, bgcolor: '#f5f5f5' }}>
        <Button
            fullWidth
            variant="contained"
            onClick={handleClose}
            sx={{ borderRadius: 2, py: 1, bgcolor: '#023047', '&:hover': { bgcolor: '#219ebc' } }}
            startIcon={<CheckCircleIcon />}
        >
          {mode === 'briefing' ? "Zaczynamy!" : "Zamknij Raport"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}