import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Divider,
  Paper
} from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTimer } from '../context/TimerContext';
import { useSettings } from '../context/SettingsContext';

interface ShutdownModalProps {
  open: boolean;
  onClose: () => void;
}

const ShutdownModal: React.FC<ShutdownModalProps> = ({ open, onClose }) => {
  const { totalSpendTimeToday, insights, tasks, dailyChallenge } = useTimer();
  const { settings } = useSettings();
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
      try {
          const loadedItems = settings.shutdown_checklist 
              ? JSON.parse(settings.shutdown_checklist) 
              : [
                  "Skrzynka odbiorcza i komunikatory sprawdzone (Inbox Zero)",
                  "Plan na jutro przygotowany i zapisany",
                  "Biurko / Pulpit uporządkowane"
              ];
          setItems(loadedItems);
          
          // Reset state on open
          const initialState: Record<string, boolean> = {};
          loadedItems.forEach((i: string) => initialState[i] = false);
          setChecklistState(initialState);
      } catch (e) {
          setItems(["Błąd ładowania listy"]);
      }
  }, [open, settings.shutdown_checklist]);

  const completedCount = tasks.filter(t => t.status === 'Completed' && t.updateStatusDate === new Date().toLocaleDateString()).length;
  
  // Format Deep Work
  const deepWorkText = insights?.focusScore 
      ? (typeof insights.focusScore === 'object' 
          ? `${insights.focusScore.score}% (${Math.floor(insights.focusScore.deepWorkMinutes / 60)}h ${insights.focusScore.deepWorkMinutes % 60}m)`
          : `${insights.focusScore}%`) 
      : '0%';

  const handleShutdown = () => {
      window.close(); 
  };

  const allChecked = items.length > 0 && items.every(i => checklistState[i]);

  const toggleItem = (item: string) => {
      setChecklistState(prev => ({ ...prev, [item]: !prev[item] }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
          Podsumowanie Dnia
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          "Praca skończona. Czas na regenerację."
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <Typography variant="caption" display="block">Czas Pracy</Typography>
                    <Typography variant="h6">{Math.floor(totalSpendTimeToday / 3600000)}h {Math.floor((totalSpendTimeToday % 3600000) / 60000)}m</Typography>
                </Grid>
                <Grid item xs={6}>
                    <Typography variant="caption" display="block">Zadania</Typography>
                    <Typography variant="h6">{completedCount}</Typography>
                </Grid>
                <Grid item xs={6}>
                    <Typography variant="caption" display="block">Deep Work</Typography>
                    <Typography variant="h6" color="secondary">{deepWorkText}</Typography>
                </Grid>
                <Grid item xs={6}>
                    <Typography variant="caption" display="block">Daily Quest</Typography>
                    <Typography variant="h6">{dailyChallenge?.status === 'COMPLETED' ? '✅ Zrobione' : '⏳ W toku'}</Typography>
                </Grid>
            </Grid>
        </Paper>

        <Typography variant="subtitle1" align="left" gutterBottom>
            Rytuał Zamknięcia (Shutdown Ritual)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 3 }}>
            {items.map((item, index) => (
                <FormControlLabel
                    key={index}
                    control={<Checkbox checked={!!checklistState[item]} onChange={() => toggleItem(item)} />}
                    label={item}
                />
            ))}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Button 
            variant="contained" 
            color={allChecked ? "success" : "error"} 
            size="large" 
            fullWidth
            onClick={handleShutdown}
            startIcon={<PowerSettingsNewIcon />}
            disabled={!allChecked}
            sx={{ py: 1.5 }}
        >
            {allChecked ? "SYSTEM SHUTDOWN" : "Dokończ Rytuał"}
        </Button>
        {!allChecked && (
            <Button onClick={onClose} sx={{ mt: 1 }}>
                Wróć do pracy
            </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default ShutdownModal;
