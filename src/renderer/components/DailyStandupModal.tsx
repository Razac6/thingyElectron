import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Stack,
  Avatar,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
};

const GREETINGS = [
    "Gotowy na podbój dnia?",
    "Dzisiaj będzie Twój najlepszy dzień!",
    "Czas na odrobinę magii produktywności ✨",
    "Zaczynamy! Jaki jest Twój główny cel?",
    "Neural Core jest gotowy. A Ty?",
    "Kawa wypita? No to do roboty! ☕",
    "Pamiętaj: małe kroki prowadzą do wielkich celów.",
    "Twoja lista zadań już na Ciebie czeka.",
    "Skupienie to Twoja supermoc 🦸‍♂️",
    "Zróbmy dziś coś wielkiego!",
    "Witaj z powrotem, Mistrzu Skupienia!",
    "Plan na dziś: być lepszym niż wczoraj."
];

export default function DailyStandupModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  const randomGreeting = useMemo(() => {
      return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  }, [open]);

  useEffect(() => {
    const fetchAndOpen = async () => {
        const userStr = localStorage.getItem('userId');
        const userId = userStr ? JSON.parse(userStr) : 1;
        try {
            const standupData = await window.electron.database.getDailyStandup(userId);
            if (standupData) {
                setData(standupData);
                setOpen(true);
            }
        } catch (e) {
            console.error("Failed to fetch standup data", e);
        }
    };

    const checkAndShow = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastShown = localStorage.getItem('lastStandupShown');

      if (lastShown !== todayStr) {
        await fetchAndOpen();
        localStorage.setItem('lastStandupShown', todayStr);
      }
    };

    checkAndShow();

    const handleOpen = () => {
        fetchAndOpen();
    };

    window.addEventListener('open-daily-briefing', handleOpen);
    return () => window.removeEventListener('open-daily-briefing', handleOpen);
  }, []);

  const handleTaskClick = () => {
      if (data?.topSuggestion?.id) {
          setOpen(false);
          navigate(`/task/${data.topSuggestion.id}`);
      }
  };

  const handleExternalLink = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data?.topSuggestion?.link) {
          window.open(data.topSuggestion.link, '_blank');
      }
  };

  if (!data) return null;

  return (
    <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
            sx: { borderRadius: 3, p: 0, overflow: 'hidden' }
        }}
    >
      <Box sx={{ bgcolor: '#023047', color: 'white', p: 2, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'white', color: '#023047', width: 40, height: 40 }}>
              <SmartToyIcon fontSize="medium" />
          </Avatar>
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="h6" sx={{ fontWeight: 300, lineHeight: 1.2 }}>Dzień dobry!</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 300 }}>{randomGreeting}</Typography>
          </Box>
      </Box>

      <DialogContent sx={{ p: 2 }}>
          {/* Stats Row */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
               <Paper variant="outlined" sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#f8f9fa' }}>
                   <Typography variant="h5" sx={{ fontWeight: 100, color: '#219ebc' }}>
                       {data.yesterday.completedCount}
                   </Typography>
                   <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 300 }}>Ukończone wczoraj</Typography>
               </Paper>
               <Paper variant="outlined" sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#f8f9fa' }}>
                   <Typography variant="h5" sx={{ fontWeight: 100, color: '#fb8500' }}>
                       {formatDuration(data.yesterday.totalTimeMs)}
                   </Typography>
                   <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 300 }}>Czas skupienia</Typography>
               </Paper>
          </Stack>

          {/* AI Suggestion */}
          {data.topSuggestion ? (
              <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 400, letterSpacing: 1 }}>
                        NAJWAŻNIEJSZE NA DZIŚ
                    </Typography>
                    <Tooltip title={data.topSuggestion.aiReason || "Algorytm wybrał to zadanie jako priorytetowe"}>
                        <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
                    </Tooltip>
                  </Stack>
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
                        '&:hover': { bgcolor: '#f5f5f5', transform: 'translateY(-1px)' },
                        position: 'relative'
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
                              <Chip label="Peak Hour" size="small" sx={{ bgcolor: '#ffb703', color: '#023047', fontWeight: 400, height: 24, fontSize: '0.7rem' }} />
                          )}
                      </Stack>

                      {data.topSuggestion.link && (
                          <Tooltip title="Otwórz link">
                              <IconButton 
                                size="small" 
                                onClick={handleExternalLink}
                                sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }}
                              >
                                  <LaunchIcon fontSize="small" />
                              </IconButton>
                          </Tooltip>
                      )}
                  </Paper>
              </Box>
          ) : (
              <Paper sx={{ p: 2, mt: 1, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                  <Typography variant="body2" color="text.secondary">Brak pilnych zadań. Czyste konto!</Typography>
              </Paper>
          )}

          {/* Habit Streak */}
          {data.topHabit && (
              <Box sx={{ mt: 2, textAlign: 'center', p: 1, bgcolor: '#fff3e0', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: '#e65100', fontWeight: 300 }}>
                      <StarIcon fontSize="inherit" /> Streak: {data.topHabit.recent_count} dni – {data.topHabit.title}
                  </Typography>
              </Box>
          )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
            fullWidth
            variant="contained"
            onClick={() => setOpen(false)}
            sx={{ borderRadius: 2, py: 1, bgcolor: '#023047', '&:hover': { bgcolor: '#219ebc' } }}
            startIcon={<CheckCircleIcon />}
        >
          Do dzieła!
        </Button>
      </DialogActions>
    </Dialog>
  );
}