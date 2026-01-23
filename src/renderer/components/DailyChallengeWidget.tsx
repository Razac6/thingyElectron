import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTimer } from '../context/TimerContext';
import { keyframes } from '@emotion/react';

const wave = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const DailyChallengeWidget = () => {
  const { dailyChallenge } = useTimer();
  const [visualProgress, setVisualProgress] = useState(0);

  // Update visual progress when challenge data changes
  useEffect(() => {
      if (dailyChallenge) {
          const p = Math.min(100, Math.round((dailyChallenge.progress / dailyChallenge.target) * 100));
          setVisualProgress(p);
      }
  }, [dailyChallenge]);

  if (!dailyChallenge) {
    return (
      <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed #ccc', background: 'transparent' }}>
         <Typography variant="body2" color="text.secondary">No quest for today.</Typography>
      </Paper>
    );
  }

  const isCompleted = dailyChallenge.status === 'COMPLETED';
  const waveColor = isCompleted ? '#4caf50' : '#2196f3';
  const waveColorLight = isCompleted ? '#81c784' : '#64b5f6';

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 1.5, 
        borderRadius: 3,
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(0,0,0,0.08)',
        bgcolor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 110
      }}
    >
      {/* Left Content */}
      <Box sx={{ zIndex: 2, flex: 1, pr: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>
                Daily Quest
            </Typography>
            {isCompleted && <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />}
          </Box>
          
          <Typography variant="body2" sx={{ fontWeight: 300, lineHeight: 1.3, mb: 1.5, color: '#023047' }}>
            {dailyChallenge.description}
          </Typography>

          <Chip 
            icon={<EmojiEventsIcon sx={{ fontSize: '1rem !important' }} />}
            label={`+${dailyChallenge.xpReward} XP`} 
            size="small"
            sx={{ 
                fontWeight: 400, 
                bgcolor: isCompleted ? 'rgba(76, 175, 80, 0.1)' : 'rgba(33, 150, 243, 0.1)', 
                color: isCompleted ? '#2e7d32' : '#1565c0',
                height: 24,
                fontSize: '0.7rem',
                border: 'none'
            }} 
          />
      </Box>

      {/* Right Content: Liquid Loader */}
      <Box
        sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `1px solid ${isCompleted ? 'rgba(76, 175, 80, 0.2)' : 'rgba(33, 150, 243, 0.1)'}`,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.02)',
            flexShrink: 0
        }}
      >
            {/* Wave 1 */}
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
            {/* Wave 2 */}
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

            {/* Percentage Text */}
            <Box sx={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 200, color: visualProgress > 50 ? '#fff' : '#023047', fontSize: '1rem', textShadow: visualProgress > 50 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>
                    {visualProgress}%
                </Typography>
            </Box>
      </Box>
    </Paper>
  );
};

export default DailyChallengeWidget;