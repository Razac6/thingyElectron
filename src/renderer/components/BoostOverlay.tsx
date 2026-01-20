import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Fade } from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import { keyframes } from '@emotion/react';
import { useTimer } from '../context/TimerContext';

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

const BoostOverlay = ({ open, onClose }: BoostOverlayProps) => {
  const { tasks, stopTimer } = useTimer();
  const activeTask = tasks.find(t => t.startTimer !== null);
  const [progress, setProgress] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0); // Clamped to 100 for liquid height
  const [timeLeftStr, setTimeLeftStr] = useState('00:00');
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    if (!open || !activeTask) return;

    const interval = setInterval(() => {
        const now = Date.now();
        const start = parseInt(activeTask.startTimer || '0', 10);
        const elapsed = activeTask.spendTime + (now - start);
        const estimateMs = (activeTask.estimate || 1) * 60 * 60 * 1000;
        
        let p = (elapsed / estimateMs) * 100;
        setProgress(p);
        setVisualProgress(Math.min(p, 100)); // Cap visual fill at 100%

        const overtime = elapsed > estimateMs;
        setIsOvertime(overtime);

        if (overtime) {
            const extra = elapsed - estimateMs;
            const mins = Math.floor(extra / 60000);
            const secs = Math.floor((extra % 60000) / 1000);
            setTimeLeftStr(`+${mins}:${secs.toString().padStart(2, '0')}`);
        } else {
            const remaining = estimateMs - elapsed;
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setTimeLeftStr(`${mins}:${secs.toString().padStart(2, '0')}`);
        }

    }, 1000);

    return () => clearInterval(interval);
  }, [open, activeTask]);

  if (!open) return null;

  const waveColor = isOvertime ? '#ef5350' : '#2196f3'; 
  const waveColorLight = isOvertime ? '#e57373' : '#64b5f6';

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
            bgcolor: 'rgba(5, 10, 20, 0.9)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
        }}
        >
        {/* Liquid Timer Container */}
        <Box
            sx={{
            width: 300,
            height: 300,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.1)',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.3)',
            boxShadow: isOvertime ? '0 0 50px rgba(244, 67, 54, 0.3)' : '0 0 50px rgba(33, 150, 243, 0.2)',
            animation: `${isOvertime ? pulseWarning : pulse} 2s infinite`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 4
            }}
        >
            {/* The Liquid Wave */}
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
            {/* Second Wave for depth */}
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

            {/* Central Text */}
            <Box sx={{ position: 'relative', zIndex: 10, textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                <Typography variant="h2" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                    {Math.round(progress)}%
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, color: isOvertime ? '#ffcdd2' : 'inherit' }}>
                    {timeLeftStr}
                </Typography>
                {isOvertime && (
                    <Typography variant="caption" sx={{ display: 'block', color: '#ffcdd2', mt: 0.5 }}>OVERTIME</Typography>
                )}
            </Box>
        </Box>

        {/* Task Info */}
        <Box sx={{ textAlign: 'center', maxWidth: '600px', animation: `${fadeIn} 1s ease` }}>
            <Typography variant="overline" color="rgba(255,255,255,0.5)" letterSpacing={2}>
                CURRENT FOCUS
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
                    // onClose(); // Let state handle close
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
        </Box>
    </Fade>
  );
};

export default BoostOverlay;