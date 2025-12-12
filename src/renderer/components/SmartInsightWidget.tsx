import React, { useState, useEffect } from 'react';
import { Box, Typography, Tooltip, Stack, IconButton, ButtonGroup } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import SpeedIcon from '@mui/icons-material/Speed';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SpaIcon from '@mui/icons-material/Spa';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTimer } from '../context/TimerContext';
import { getDailyMode, setDailyMode } from '../services/DatabaseService';

const SmartInsightWidget = () => {
  const { insights } = useTimer();
  const [dailyMode, setDailyModeState] = useState<string>('normal');

  useEffect(() => {
    const fetchMode = async () => {
      const today = new Date().toISOString().split('T')[0];
      const mode = await getDailyMode(today);
      setDailyModeState(mode);
    };
    fetchMode();
  }, []);

  const handleModeChange = async (mode: string) => {
    const today = new Date().toISOString().split('T')[0];
    await setDailyMode(today, mode);
    setDailyModeState(mode);
  };

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
       
       <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
           {/* Left Side: Stats */}
           <Stack spacing={1} sx={{ flexGrow: 1 }}>
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

           {/* Right Side: Daily Mode Selector */}
           <Box sx={{ ml: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ButtonGroup variant="text" size="small" orientation="vertical" aria-label="daily mode">
                <Tooltip title="Boost Mode: High focus, demo day" placement="left">
                  <IconButton onClick={() => handleModeChange('boost')} color={dailyMode === 'boost' ? 'error' : 'default'}>
                    <LocalFireDepartmentIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Normal Mode: Standard productivity" placement="left">
                  <IconButton onClick={() => handleModeChange('normal')} color={dailyMode === 'normal' ? 'primary' : 'default'}>
                    <CheckCircleIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Recovery Mode: Less pressure, more breaks" placement="left">
                  <IconButton onClick={() => handleModeChange('recovery')} color={dailyMode === 'recovery' ? 'success' : 'default'}>
                    <SpaIcon />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
           </Box>
       </Box>
    </Box>
  );
};

export default SmartInsightWidget;
