import React, { useState, useEffect } from 'react';
import { Box, Typography, Tooltip, Stack, IconButton, ButtonGroup, TextField, InputAdornment, Popover, Slider } from '@mui/material';
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
import BedIcon from '@mui/icons-material/Bed';
import GroupsIcon from '@mui/icons-material/Groups';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useTimer } from '../context/TimerContext';
import { useSettings } from '../context/SettingsContext';
import { getDailyBio, updateDailyBio } from '../services/DatabaseService';

const SmartInsightWidget = () => {
  const { insights } = useTimer();
  const { settings } = useSettings();
  const [dailyBio, setDailyBioState] = useState<{ mode: string, sleepScore: number | null, meetingTime: number }>({ mode: 'normal', sleepScore: null, meetingTime: 0 });
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [meetingAnchorEl, setMeetingAnchorEl] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    const fetchMode = async () => {
      const today = new Date().toISOString().split('T')[0];
      const data = await getDailyBio(today);
      setDailyBioState({ ...data, meetingTime: data.meetingTime || 0 });
    };
    fetchMode();
  }, []);

  const handleModeChange = async (mode: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = await updateDailyBio(today, { mode });
    setDailyBioState({ ...dailyBio, ...updated });
  };

  const handleSleepChange = async (event: Event, newValue: number | number[]) => {
    const val = newValue as number;
    const today = new Date().toISOString().split('T')[0];
    const updated = await updateDailyBio(today, { sleepScore: val });
    setDailyBioState({ ...dailyBio, ...updated });
  };

  const handleMeetingChange = async (event: Event, newValue: number | number[]) => {
    const val = newValue as number;
    const today = new Date().toISOString().split('T')[0];
    const updated = await updateDailyBio(today, { meetingTime: val });
    setDailyBioState({ ...dailyBio, ...updated });
  };

  const handleOpenSleep = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseSleep = () => {
    setAnchorEl(null);
  };

  const handleOpenMeeting = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMeetingAnchorEl(event.currentTarget);
  };

  const handleCloseMeeting = () => {
    setMeetingAnchorEl(null);
  };

  const openSleep = Boolean(anchorEl);
  const openMeeting = Boolean(meetingAnchorEl);

  if (!insights) return null;

  const { peakHourRange, fatigueProfile, trend, focusScore, tagConsistency } = insights;

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'increasing': return <TrendingUpIcon fontSize="small" color="success" />;
      case 'decreasing': return <TrendingDownIcon fontSize="small" color="error" />;
      default: return <TrendingFlatIcon fontSize="small" color="action" />;
    }
  };

  const getAiColor = (category?: string) => {
      switch(category) {
          case 'high': return 'error';
          case 'low': return 'success';
          case 'focus': return 'secondary';
          default: return 'primary';
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
             {/* ... (keep stats) ... */}
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

           {/* Right Side: Daily Mode & Bio */}
           <Box sx={{ ml: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <ButtonGroup variant="text" size="small" orientation="vertical" aria-label="daily mode">
                <Tooltip title="Boost Mode: High focus, demo day" placement="left">
                  <IconButton onClick={() => handleModeChange('boost')} color={dailyBio.mode === 'boost' ? 'error' : 'default'}>
                    <LocalFireDepartmentIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Normal Mode: Standard productivity" placement="left">
                  <IconButton onClick={() => handleModeChange('normal')} color={dailyBio.mode === 'normal' ? 'primary' : 'default'}>
                    <CheckCircleIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Recovery Mode: Less pressure, more breaks" placement="left">
                  <IconButton onClick={() => handleModeChange('recovery')} color={dailyBio.mode === 'recovery' ? 'success' : 'default'}>
                    <SpaIcon />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {settings.enableSleepTracking === 'true' && (
                      <>
                        <Tooltip title={`Sleep Score: ${dailyBio.sleepScore || '-'}%`} placement="left">
                            <IconButton size="small" onClick={handleOpenSleep} color={dailyBio.sleepScore ? 'primary' : 'default'}>
                                <BedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Popover
                            open={openSleep}
                            anchorEl={anchorEl}
                            onClose={handleCloseSleep}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                        >
                            <Box sx={{ p: 2, width: 200 }}>
                                <Typography variant="caption" gutterBottom>Sleep Score: {dailyBio.sleepScore || 0}%</Typography>
                                <Slider
                                    value={dailyBio.sleepScore || 75}
                                    onChange={handleSleepChange}
                                    step={5}
                                    min={0}
                                    max={100}
                                    valueLabelDisplay="auto"
                                />
                            </Box>
                        </Popover>
                      </>
                  )}

                  {/* Meeting Time Input */}
                  <>
                    <Tooltip title={`Meetings: ${dailyBio.meetingTime ? (dailyBio.meetingTime / 60).toFixed(1) : 0}h today`} placement="left">
                        <IconButton size="small" onClick={handleOpenMeeting} color={dailyBio.meetingTime > 0 ? 'primary' : 'default'}>
                            <GroupsIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Popover
                        open={openMeeting}
                        anchorEl={meetingAnchorEl}
                        onClose={handleCloseMeeting}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                    >
                        <Box sx={{ p: 2, width: 200 }}>
                            <Typography variant="caption" gutterBottom>
                                Meetings: {(dailyBio.meetingTime ? dailyBio.meetingTime / 60 : 0).toFixed(1)}h
                            </Typography>
                            <Slider
                                value={dailyBio.meetingTime || 0}
                                onChange={handleMeetingChange}
                                step={15}
                                min={0}
                                max={480} // 8 hours max
                                valueLabelDisplay="auto"
                                valueLabelFormat={(x) => `${(x / 60).toFixed(1)}h`}
                            />
                        </Box>
                    </Popover>
                  </>

                  {/* AI Advisor Tip */}
                  {insights && insights.dailyTip && (
                      <Tooltip title={insights.dailyTip} arrow placement="left">
                          <IconButton color={getAiColor(insights.dailyTipCategory)} size="small">
                              <SmartToyIcon fontSize="small" />
                          </IconButton>
                      </Tooltip>
                  )}
              </Box>
           </Box>
       </Box>
    </Box>
  );
};

export default SmartInsightWidget;