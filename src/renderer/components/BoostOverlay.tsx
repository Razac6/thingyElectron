import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Fade, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    List, 
    ListItem, 
    ListItemText, 
    ListItemIcon, 
    Checkbox, 
    TextField, 
    IconButton,
    Fab
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { keyframes } from '@emotion/react';
import { useTimer } from '../context/TimerContext';
import { useSettings } from '../context/SettingsContext';

// --- Animations ---
const wave = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
  70% { box-shadow: 0 0 0 20px rgba(33, 150, 243, 0); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
`;

const pulseWarning = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
  70% { box-shadow: 0 0 0 20px rgba(244, 67, 54, 0); }
  100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

interface BoostOverlayProps {
  open: boolean;
  onClose: () => void;
}

// Helper to format time as HH:MM:SS or MM:SS
function formatTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const mStr = minutes.toString().padStart(2, '0');
    const sStr = seconds.toString().padStart(2, '0');

    if (hours > 0) {
        return `${hours}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
}

const BoostOverlay = ({ open, onClose }: BoostOverlayProps) => {
  const { tasks, stopTimer } = useTimer();
  const { settings } = useSettings();
  const activeTask = tasks.find(t => t.startTimer !== null);
  
  const isPomodoro = activeTask?.timerMode === 'pomodoro';
  
  const [progress, setProgress] = useState(isPomodoro ? 100 : 0);
  const [visualProgress, setVisualProgress] = useState(isPomodoro ? 100 : 0);
  const [timeLeftStr, setTimeLeftStr] = useState('00:00');
  const [isOvertime, setIsOvertime] = useState(false);
  
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const refreshChecklist = async () => {
      if (!activeTask) return;
      try {
          const items = await window.electron.database.getChecklistItems(activeTask.id);
          setChecklistItems(items || []);
      } catch (e) {}
  };

  useEffect(() => {
      if (isChecklistOpen && activeTask) {
          refreshChecklist();
      }
  }, [isChecklistOpen, activeTask?.id]);

  useEffect(() => {
    if (!open || !activeTask) return;

    const interval = setInterval(() => {
        const now = Date.now();
        const start = parseInt(activeTask.startTimer || '0', 10);
        const elapsed = activeTask.spendTime + (now - start);
        
        if (isPomodoro) {
            const durationMin = Number(settings.pomodoro_duration) || 25;
            const durationMs = durationMin * 60 * 1000;
            const elapsedSinceStart = now - start;
            
            const remaining = Math.max(0, durationMs - elapsedSinceStart);
            
            const p = (remaining / durationMs) * 100;
            setProgress(p);
            setVisualProgress(p); 

            setTimeLeftStr(formatTime(remaining));

            if (remaining <= 0) {
                handlePomodoroComplete();
                clearInterval(interval);
            }
        } else {
            const estimateMs = (activeTask.estimate || 1) * 60 * 60 * 1000;
            let p = (elapsed / estimateMs) * 100;
            setProgress(p);
            setVisualProgress(Math.min(p, 100));

            const overtime = elapsed > estimateMs;
            setIsOvertime(overtime);

            if (overtime) {
                const extra = elapsed - estimateMs;
                setTimeLeftStr(`+${formatTime(extra)}`);
            } else {
                const remaining = estimateMs - elapsed;
                setTimeLeftStr(formatTime(remaining));
            }
        }

    }, 1000);

    return () => clearInterval(interval);
  }, [open, activeTask, isPomodoro]);

    const handlePomodoroComplete = async () => {
        if (!activeTask) return;
        
        await window.electron.app.completePomodoro(activeTask.id);
        stopTimer(activeTask.id);
    };

  const handleAddSubtask = async () => {
      if (!newSubtaskTitle.trim() || !activeTask) return;
      try {
          await window.electron.database.addChecklistItem(activeTask.id, newSubtaskTitle);
          setNewSubtaskTitle('');
          refreshChecklist();
      } catch (e) {}
  };

  const handleToggleSubtask = async (itemId: number, currentStatus: boolean) => {
      try {
          await window.electron.database.toggleChecklistItem(itemId, !currentStatus);
          refreshChecklist();
      } catch (e) {}
  };
  
  const handleDeleteSubtask = async (itemId: number) => {
      try {
          await window.electron.database.deleteChecklistItem(itemId);
          refreshChecklist();
      } catch (e) {}
  };

  if (!open) return null;

  const waveColor = isPomodoro ? '#ef5350' : (isOvertime ? '#ef5350' : '#2196f3'); 
  const waveColorLight = isPomodoro ? '#e57373' : (isOvertime ? '#e57373' : '#64b5f6');

  return (
    <Fade in={open} timeout={800}>
        <Box
        sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            bgcolor: isPomodoro ? 'rgba(20, 5, 5, 0.92)' : 'rgba(5, 10, 20, 0.9)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
        }}
        >
        <Fab 
            color="primary" 
            aria-label="checklist" 
            sx={{ position: 'absolute', top: 32, right: 32, bgcolor: isPomodoro ? '#ef5350' : 'primary.main' }}
            onClick={() => setIsChecklistOpen(true)}
        >
            <PlaylistAddCheckIcon />
        </Fab>

        <Box
            sx={{
            width: 300,
            height: 300,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.1)',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.3)',
            boxShadow: (isOvertime || isPomodoro) ? '0 0 50px rgba(244, 67, 54, 0.3)' : '0 0 50px rgba(33, 150, 243, 0.2)',
            animation: `${(isOvertime || isPomodoro) ? pulseWarning : pulse} 2s infinite`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 4
            }}
        >
            <Box
            sx={{
                position: 'absolute',
                top: `${100 - visualProgress}%`,
                left: '-50%',
                width: '200%',
                height: '200%',
                backgroundColor: waveColor,
                borderRadius: '40%',
                opacity: 0.8,
                animation: `${wave} 6s linear infinite`,
                transition: 'top 1s ease-in-out, background-color 1s ease'
            }}
            />
            <Box
            sx={{
                position: 'absolute',
                top: `${100 - visualProgress}%`,
                left: '-50%',
                width: '200%',
                height: '200%',
                backgroundColor: waveColorLight,
                borderRadius: '43%',
                opacity: 0.4,
                animation: `${wave} 10s linear infinite`,
                transition: 'top 1s ease-in-out, background-color 1s ease'
            }}
            />

            <Box sx={{ position: 'relative', zIndex: 10, textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                <Typography variant="h2" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                    {isPomodoro ? timeLeftStr : `${Math.round(progress)}%`}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, color: (isOvertime || isPomodoro) ? '#ffcdd2' : 'inherit' }}>
                    {isPomodoro ? 'REMAINING' : timeLeftStr}
                </Typography>
            </Box>
        </Box>

        <Box sx={{ textAlign: 'center', maxWidth: '600px', animation: `${fadeIn} 1s ease` }}>
            <Typography variant="overline" color="rgba(255,255,255,0.5)" letterSpacing={2}>
                {isPomodoro ? 'POMODORO SESSION' : 'CURRENT FOCUS'}
            </Typography>
            <Typography variant="h5" gutterBottom fontWeight="400" color="white" sx={{ mt: 1, mb: 4 }}>
                {activeTask ? activeTask.title : 'Focus Mode'}
            </Typography>
            
            <Button 
                variant="outlined" 
                color="error" 
                size="large"
                startIcon={<StopIcon />}
                onClick={() => {
                    if (activeTask) stopTimer(activeTask.id);
                }}
                sx={{ 
                    borderRadius: 8, 
                    px: 4, 
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
            >
                Stop Timer
            </Button>
        </Box>

        <Dialog 
            open={isChecklistOpen} 
            onClose={() => setIsChecklistOpen(false)} 
            fullWidth 
            maxWidth="sm"
            sx={{ zIndex: 10001 }}
        >
            <DialogTitle>Subtasks</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField 
                        fullWidth 
                        size="small" 
                        placeholder="Add subtask..." 
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
                    />
                    <Button variant="contained" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}>
                        <AddIcon />
                    </Button>
                </Box>
                <List>
                    {checklistItems.map((item) => (
                        <ListItem 
                            key={item.id}
                            secondaryAction={
                                <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteSubtask(item.id)}>
                                    <DeleteIcon />
                                </IconButton>
                            }
                            disablePadding
                        >
                            <ListItemIcon>
                                <Checkbox
                                    edge="start"
                                    checked={item.isCompleted === 1}
                                    onChange={() => handleToggleSubtask(item.id, item.isCompleted === 1)}
                                    tabIndex={-1}
                                    disableRipple
                                />
                            </ListItemIcon>
                            <ListItemText 
                                primary={item.text} 
                                sx={{ textDecoration: item.isCompleted === 1 ? 'line-through' : 'none', color: item.isCompleted === 1 ? 'text.disabled' : 'text.primary' }}
                            />
                        </ListItem>
                    ))}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setIsChecklistOpen(false)}>Close</Button>
            </DialogActions>
        </Dialog>
        </Box>
    </Fade>
  );
};

export default BoostOverlay;