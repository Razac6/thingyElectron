import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Tooltip, Stack, IconButton, ButtonGroup, TextField, Popover, Fade, Paper, keyframes } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SpaIcon from '@mui/icons-material/Spa';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BedIcon from '@mui/icons-material/Bed';
import GroupsIcon from '@mui/icons-material/Groups';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FlagIcon from '@mui/icons-material/Flag';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PetsIcon from '@mui/icons-material/Pets';
import { useTimer } from '../context/TimerContext';
import { useSettings } from '../context/SettingsContext';
import { getDailyBio, updateDailyBio } from '../services/DatabaseService';

const SmartInsightWidget = () => {
  const { insights, toggleBoostMode } = useTimer();
  const { settings } = useSettings();
  const [dailyBio, setDailyBioState] = useState<{ mode: string, sleepScore: number | null, meetingTime: number }>({ mode: 'normal', sleepScore: null, meetingTime: 0 });
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [meetingAnchorEl, setMeetingAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [sprintAnalysis, setSprintAnalysis] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : 1;

    const fetchMode = async () => {
      const today = new Date().toISOString().split('T')[0];
      const data = await getDailyBio(today);
      setDailyBioState({ ...data, meetingTime: data.meetingTime || 0 });
    };
    const fetchSprint = async () => {
        const analysis = await window.electron.database.getSprintAnalysis(userId);
        setSprintAnalysis(analysis);
    };
    fetchMode();
    fetchSprint();
  }, []);

  const handleModeChange = async (mode: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = await updateDailyBio(today, { mode });
    setDailyBioState({ ...dailyBio, ...updated });
    
    if (mode === 'boost') {
        toggleBoostMode(true);
    }
  };

  const handleSleepUpdate = async (val: number) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = await updateDailyBio(today, { sleepScore: val });
    setDailyBioState({ ...dailyBio, ...updated });
  };

  const handleMeetingUpdate = async (val: number) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = await updateDailyBio(today, { meetingTime: val });
    setDailyBioState({ ...dailyBio, ...updated });
  };

  if (!insights) return null;

  const { peakHourRange, fatigueProfile, trend, focusScore } = insights;

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
       <Typography variant="overline" color="text.secondary" display="block" gutterBottom sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
         Smart Insights
       </Typography>
       
       <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
           {/* Left Side: Stats */}
           <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
             <Box display="flex" alignItems="center" gap={1}>
                <WbSunnyIcon sx={{ color: '#ffb703', fontSize: 16 }} />
                <Typography variant="caption"><strong>Peak:</strong> {peakHourRange}</Typography>
             </Box>

             <Box display="flex" alignItems="center" gap={1}>
                <CenterFocusStrongIcon sx={{ color: '#219ebc', fontSize: 16 }} />
                <Typography variant="caption"><strong>Deep Work:</strong> {focusScore}%</Typography>
             </Box>

             <Box display="flex" alignItems="center" gap={1}>
                <BatteryAlertIcon sx={{ color: '#fb8500', fontSize: 16 }} />
                <Typography variant="caption"><strong>Max Focus:</strong> {fatigueProfile.maxRecommended}m</Typography>
             </Box>
             
             <Tooltip title={trend.description} arrow>
                <Box display="flex" alignItems="center" gap={1} sx={{ cursor: 'help' }}>
                   {getTrendIcon()}
                   <Typography variant="caption"><strong>Trend:</strong> {trend.direction}</Typography>
                </Box>
             </Tooltip>

             {sprintAnalysis && (
                <Tooltip title={sprintAnalysis.message} arrow>
                    <Box display="flex" alignItems="center" gap={1}>
                        <FlagIcon sx={{ 
                            color: sprintAnalysis.risk === 'Critical' ? '#d32f2f' : (sprintAnalysis.risk === 'At Risk' ? '#fb8500' : '#2e7d32'), 
                            fontSize: 16 
                        }} />
                        <Box sx={{ flexGrow: 1, maxWidth: 100 }}>
                            <Box sx={{ width: '100%', bgcolor: '#e9ecef', height: 4, borderRadius: 2 }}>
                                <Box sx={{ 
                                    width: `${(sprintAnalysis.completed / sprintAnalysis.total) * 100}%`, 
                                    bgcolor: sprintAnalysis.risk === 'Critical' ? '#d32f2f' : (sprintAnalysis.risk === 'At Risk' ? '#fb8500' : '#2e7d32'), 
                                    height: '100%', 
                                    borderRadius: 2 
                                }} />
                            </Box>
                        </Box>
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 'bold', color: sprintAnalysis.risk === 'Critical' ? '#d32f2f' : '#2e7d32' }}>
                            {sprintAnalysis.risk}
                        </Typography>
                    </Box>
                </Tooltip>
             )}
           </Stack>

           {/* Right Side: Toolbar */}
           <Box sx={{ ml: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <ButtonGroup variant="text" size="small" orientation="vertical">
                <Tooltip title="Boost Mode" placement="left">
                  <IconButton size="small" onClick={() => handleModeChange('boost')} color={dailyBio.mode === 'boost' ? 'error' : 'default'}>
                    <LocalFireDepartmentIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Normal Mode" placement="left">
                  <IconButton size="small" onClick={() => handleModeChange('normal')} color={dailyBio.mode === 'normal' ? 'primary' : 'default'}>
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Recovery Mode" placement="left">
                  <IconButton size="small" onClick={() => handleModeChange('recovery')} color={dailyBio.mode === 'recovery' ? 'success' : 'default'}>
                    <SpaIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {settings.enableSleepTracking === 'true' && (
                      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} color={dailyBio.sleepScore ? 'primary' : 'default'}>
                          <BedIcon fontSize="small" />
                      </IconButton>
                  )}
                  <IconButton size="small" onClick={(e) => setMeetingAnchorEl(e.currentTarget)} color={dailyBio.meetingTime > 0 ? 'primary' : 'default'}>
                      <GroupsIcon fontSize="small" />
                  </IconButton>
                  
                  <Tooltip title="Przywołaj asystenta" arrow placement="left">
                      <IconButton color="primary" size="small" onClick={() => window.dispatchEvent(new CustomEvent('summon-ai-companion'))}>
                          <PetsIcon fontSize="small" />
                      </IconButton>
                  </Tooltip>
              </Box>
           </Box>
       </Box>

       {/* Popovers */}
       <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Box sx={{ p: 2, width: 150 }}>
                <TextField label="Sleep Score (%)" type="number" size="small" fullWidth value={dailyBio.sleepScore || ''} onChange={(e) => handleSleepUpdate(Number(e.target.value))} />
            </Box>
        </Popover>

        <Popover open={Boolean(meetingAnchorEl)} anchorEl={meetingAnchorEl} onClose={() => setMeetingAnchorEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Box sx={{ p: 2, width: 220 }}>
                <Typography variant="caption" display="block">Meeting Duration</Typography>
                <Box display="flex" gap={1} mt={1}>
                    <TextField label="Hrs" type="number" size="small" value={Math.floor((dailyBio.meetingTime || 0) / 60)} onChange={(e) => handleMeetingUpdate((Number(e.target.value) * 60) + ((dailyBio.meetingTime || 0) % 60))} />
                    <TextField label="Min" type="number" size="small" value={(dailyBio.meetingTime || 0) % 60} onChange={(e) => handleMeetingUpdate((Math.floor((dailyBio.meetingTime || 0) / 60) * 60) + Number(e.target.value))} />
                </Box>
            </Box>
        </Popover>
    </Box>
  );
};

export default SmartInsightWidget;