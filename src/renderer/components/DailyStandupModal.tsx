import React, { useState, useEffect } from 'react';
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
  Chip
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
};

export default function DailyStandupModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);

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

    // Listen for manual trigger
    const handleOpen = () => {
        fetchAndOpen();
    };

    window.addEventListener('open-daily-briefing', handleOpen);
    return () => window.removeEventListener('open-daily-briefing', handleOpen);
  }, []);

  if (!data) return null;

  return (
    <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
            sx: { borderRadius: 4, p: 1 }
        }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
          <Avatar sx={{ bgcolor: '#219ebc', mx: 'auto', mb: 1, width: 56, height: 56 }}>
              <SmartToyIcon fontSize="large" />
          </Avatar>
          <Typography variant="h5" fontWeight="300">Dzień dobry, Marcin!</Typography>
          <Typography variant="caption" color="text.secondary">Oto Twój inteligentny briefing na dziś</Typography>
      </DialogTitle>

      <DialogContent>
          <Box sx={{ mt: 3 }}>
              {/* Yesterday Summary */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 3, mb: 2 }}>
                  <Typography variant="overline" color="text.secondary">
                      Podsumowanie z: {new Date(data.lastActiveDate).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                      <Box>
                          <Typography variant="h6" color="#023047">{data.yesterday.completedCount} zadań</Typography>
                          <Typography variant="body2" color="text.secondary">Ukończono pomyślnie</Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem />
                      <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h6" color="#219ebc">{formatDuration(data.yesterday.totalTimeMs)}</Typography>
                          <Typography variant="body2" color="text.secondary">Czas skupienia</Typography>
                      </Box>
                  </Stack>
              </Paper>

              {/* Today Recommendation */}
              <Box sx={{ p: 1 }}>
                  <Typography variant="overline" color="text.secondary">Sugestia AI na start</Typography>
                  {data.topSuggestion ? (
                      <Paper sx={{ p: 2, mt: 1, borderLeft: '4px solid #ffb703', borderRadius: '4px 12px 12px 4px' }}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                              {data.topSuggestion.title}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                icon={<TrendingUpIcon />}
                                label={`AI: ~${(data.topSuggestion.neuralEst / 60).toFixed(1)}h`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              {data.isPeakHour && (
                                  <Chip label="Peak Hour ✨" size="small" sx={{ bgcolor: '#ffb703', color: '#023047', fontWeight: 'bold' }} />
                              )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              Zacznij od tego zadania – algorytm WSJF wskazuje, że przyniesie ono dziś największy progres.
                          </Typography>
                      </Paper>
                  ) : (
                      <Typography variant="body2" color="text.secondary">Brak aktywnych zadań. Dodaj coś nowego!</Typography>
                  )}
              </Box>

              {/* Habits */}
              {data.topHabit && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: '#fb8500', fontWeight: 'bold' }}>
                          <StarIcon fontSize="inherit" /> Utrzymaj swój streak: {data.topHabit.title} ({data.topHabit.recent_count} dni!)
                      </Typography>
                  </Box>
              )}
          </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
        <Button
            variant="contained"
            onClick={() => setOpen(false)}
            sx={{ borderRadius: 3, px: 4, bgcolor: '#023047', '&:hover': { bgcolor: '#219ebc' } }}
            startIcon={<CheckCircleIcon />}
        >
          Zaczynajmy!
        </Button>
      </DialogActions>
    </Dialog>
  );
}
