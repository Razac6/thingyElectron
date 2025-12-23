import React from 'react';
import { Box, Typography, LinearProgress, Paper, Chip } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTimer } from '../context/TimerContext';

const DailyChallengeWidget = () => {
  const { dailyChallenge } = useTimer();

  if (!dailyChallenge) {
    return (
      <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
         <Typography variant="body2" color="text.secondary">No active challenge today.</Typography>
      </Paper>
    );
  }

  const progressPercent = Math.min(100, Math.round((dailyChallenge.progress / dailyChallenge.target) * 100));
  const isCompleted = dailyChallenge.status === 'COMPLETED';

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between',
        border: isCompleted ? '1px solid #4caf50' : 'none',
        background: isCompleted ? 'rgba(76, 175, 80, 0.05)' : 'inherit'
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
           <EmojiEventsIcon color={isCompleted ? 'success' : 'primary'} />
           <Typography variant="h6" fontSize="1rem">Daily Quest</Typography>
        </Box>
        <Chip 
          label={`+${dailyChallenge.xpReward} XP`} 
          color={isCompleted ? 'success' : 'default'} 
          size="small" 
          variant="outlined" 
        />
      </Box>

      <Typography variant="body2" gutterBottom sx={{ textAlign: 'center', mt: 1, mb: 1 }}>
        {dailyChallenge.description}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Box display="flex" justifyContent="space-between" mb={0.5}>
           <Typography variant="caption" color="text.secondary">
             Progress
           </Typography>
           <Typography variant="caption" fontWeight="bold">
             {dailyChallenge.progress} / {dailyChallenge.target}
           </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={progressPercent} 
          color={isCompleted ? 'success' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      
      {isCompleted && (
         <Box display="flex" alignItems="center" gap={0.5} mt={1} justifyContent="flex-end">
            <CheckCircleIcon fontSize="small" color="success" />
            <Typography variant="caption" color="success.main" fontWeight="bold">Completed!</Typography>
         </Box>
      )}
    </Paper>
  );
};

export default DailyChallengeWidget;
