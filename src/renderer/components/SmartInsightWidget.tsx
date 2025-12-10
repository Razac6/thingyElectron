import React from 'react';
import { Box, Typography, Tooltip, Stack } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import SpeedIcon from '@mui/icons-material/Speed';
import { useTimer } from '../context/TimerContext';

const SmartInsightWidget = () => {
  const { insights } = useTimer();

  if (!insights) return null;

  const { peakHourRange, fatigueProfile, trend, focusScore, tagConsistency } = insights;

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'increasing': return <TrendingUpIcon fontSize="small" color="success" />;
      case 'decreasing': return <TrendingDownIcon fontSize="small" color="error" />;
      default: return <TrendingFlatIcon fontSize="small" color="action" />;
    }
  };

  return (
    <Box sx={{ mt: 2, p: 1, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
       <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
         Smart Insights
       </Typography>
       
       <Stack spacing={1}>
         <Box display="flex" alignItems="center" gap={1}>
            <WbSunnyIcon fontSize="small" sx={{ color: '#ffb703' }} />
            <Typography variant="body2">
               <strong>Peak:</strong> {peakHourRange}
            </Typography>
         </Box>

         <Box display="flex" alignItems="center" gap={1}>
            <CenterFocusStrongIcon fontSize="small" color="primary" />
            <Typography variant="body2">
               <strong>Deep Work:</strong> {focusScore}%
            </Typography>
         </Box>

         <Box display="flex" alignItems="center" gap={1}>
            <BatteryAlertIcon fontSize="small" color="warning" />
            <Typography variant="body2">
               <strong>Max Focus:</strong> {fatigueProfile.maxRecommended}m
            </Typography>
         </Box>
         
         <Tooltip title={trend.description} arrow>
            <Box display="flex" alignItems="center" gap={1} sx={{ cursor: 'help' }}>
               {getTrendIcon()}
               <Typography variant="body2">
                  <strong>Trend:</strong> {trend.direction}
               </Typography>
            </Box>
         </Tooltip>

         {tagConsistency && tagConsistency.consistent.length > 0 && (
           <Box display="flex" alignItems="center" gap={1}>
             <SpeedIcon fontSize="small" color="success" />
             <Typography variant="body2">
               <strong>Consistent:</strong> #{tagConsistency.consistent[0]}
             </Typography>
           </Box>
         )}

         {tagConsistency && tagConsistency.volatile.length > 0 && (
           <Box display="flex" alignItems="center" gap={1}>
             <SpeedIcon fontSize="small" color="error" />
             <Typography variant="body2">
               <strong>Volatile:</strong> #{tagConsistency.volatile[0]}
             </Typography>
           </Box>
         )}
       </Stack>
    </Box>
  );
};

export default SmartInsightWidget;
