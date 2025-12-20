import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Switch, FormControlLabel, Slider, Divider, Grid, Button, CircularProgress, TextField, LinearProgress, Chip } from '@mui/material';
import { useSettings } from '../../context/SettingsContext';
import { forceNeuralTraining } from '../../services/DatabaseService';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudIcon from '@mui/icons-material/Cloud';
import ComputerIcon from '@mui/icons-material/Computer';
import { ToggleButtonGroup, ToggleButton, Collapse } from '@mui/material';

function Settings() {
  const { settings, updateSetting, loading } = useSettings();
  const [training, setTraining] = useState(false);
  
  // Llama State
  const [llamaStatus, setLlamaStatus] = useState({ ready: false, progress: 0, isInitializing: false, statusText: '' });

  useEffect(() => {
      const fetchLlama = async () => {
          const status = await window.electron.ai.getLlamaStatus();
          setLlamaStatus(prev => ({ ...prev, ...status }));
      };
      fetchLlama();

      window.electron.ai.onProgress((data: { progress: number, status: string }) => {
          setLlamaStatus(prev => ({ 
              ...prev, 
              progress: data.progress, 
              statusText: data.status,
              isInitializing: true,
              ready: data.status === 'Model gotowy!'
          }));
      });
  }, []);

  const handleInitLlama = async () => {
      setLlamaStatus(prev => ({ ...prev, isInitializing: true }));
      await window.electron.ai.initLlama();
      const status = await window.electron.ai.getLlamaStatus();
      setLlamaStatus(status);
  };

  const handleComplexityChange = (event: Event, newValue: number | number[]) => {
    updateSetting('complexityThreshold', String(newValue));
  };

  const handleRewardChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting('enableRewardAnimations', String(event.target.checked));
  };

  const handleFatigueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting('enableFatigueWarnings', String(event.target.checked));
  };

  const handleSleepTrackingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting('enableSleepTracking', String(event.target.checked));
  };

  const handleDaysChange = (event: Event, newValue: number | number[]) => {
    updateSetting('activityGraphDays', String(newValue));
  };

  const handleCalibrate = async () => {
      setTraining(true);
      await forceNeuralTraining();
      setTimeout(() => setTraining(false), 1000);
  };

  if (loading) return <Typography sx={{ p: 3 }}>Loading settings...</Typography>;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', pb: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 300 }}>Settings</Typography>
      
      {/* 1. AI Engine Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>AI Engine Selection</Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
              Choose which brain powers your Chat and Smart Insights.
          </Typography>
          <ToggleButtonGroup
            value={settings.aiEngine || 'local'}
            exclusive
            onChange={(_, val) => val && updateSetting('aiEngine', val)}
            fullWidth
            sx={{ mb: 3 }}
          >
            <ToggleButton value="local" sx={{ py: 1.5 }}>
                <ComputerIcon sx={{ mr: 1 }} /> Local AI (Llama 3.2)
            </ToggleButton>
            <ToggleButton value="gemini" sx={{ py: 1.5 }}>
                <CloudIcon sx={{ mr: 1 }} /> Cloud AI (Gemini API)
            </ToggleButton>
          </ToggleButtonGroup>

          {settings.aiEngine === 'gemini' && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(33, 158, 188, 0.05)', borderRadius: 2 }}>
                  <TextField 
                    label="Gemini API Key" 
                    fullWidth 
                    type="password"
                    placeholder="Wklej swój klucz API..."
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                    helperText="Get your free key at aistudio.google.com"
                  />
              </Box>
          )}
      </Paper>

      {/* 2. Llama 3.2 Management (Only show if local or for setup) */}
      <Collapse in={settings.aiEngine === 'local'}>
          <Paper sx={{ p: 3, mb: 3, border: '1px solid rgba(33, 158, 188, 0.2)' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Box>
                                <Typography variant="h6">Local AI Language Model</Typography>
                                <Typography variant="caption" color="text.secondary">Qwen 2.5 1.5B-Instruct (ONNX)</Typography>
                            </Box>                {llamaStatus.ready ? (
                    <Chip icon={<CheckCircleIcon />} label="Brain Ready" color="success" variant="outlined" />
                ) : (
                    <Button 
                        variant="contained" 
                        startIcon={<BoltIcon />} 
                        onClick={handleInitLlama}
                        disabled={llamaStatus.isInitializing}
                    >
                        {llamaStatus.isInitializing ? `Downloading ${Math.round(llamaStatus.progress)}%` : 'Initialize Local AI'}
                    </Button>
                )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" paragraph>
                To enable "Human-like" communication and advanced reasoning, Thingy needs to download a local language model (~1.2 GB). 
                This happens only once and the model will run 100% offline on your machine.
            </Typography>
            
            {llamaStatus.isInitializing && !llamaStatus.ready && (
                <Box sx={{ mt: 2 }}>
                    <LinearProgress variant="determinate" value={llamaStatus.progress} sx={{ height: 8, borderRadius: 4 }} />
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', fontWeight: 'bold' }} color="primary">
                        {llamaStatus.statusText || 'Pobieranie modelu...'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Proszę nie zamykać aplikacji. Może to potrwać kilka minut zależnie od łącza i GPU.
                    </Typography>
                </Box>
            )}
          </Paper>
      </Collapse>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Productivity AI</Typography>
            <Button 
                variant="outlined" 
                startIcon={training ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
                onClick={handleCalibrate}
                disabled={training}
            >
                {training ? 'Calibrating...' : 'Calibrate AI Now'}
            </Button>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <Typography gutterBottom>Complexity Warning Threshold</Typography>
                <Typography variant="body2" color="text.secondary">
                    Tasks estimated longer than this will trigger a complexity warning suggesting a breakdown.
                </Typography>
                <Box sx={{ px: 2, mt: 2 }}>
                    <Slider
                        value={Number(settings.complexityThreshold) || 8}
                        onChange={handleComplexityChange}
                        step={1}
                        marks
                        min={2}
                        max={12}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}h`}
                    />
                </Box>
                <Typography align="center" sx={{ mt: 1 }}>Current: {settings.complexityThreshold}h</Typography>
            </Grid>

            <Grid item xs={12}>
                <Typography gutterBottom>Activity Graph Range (Days)</Typography>
                <Typography variant="body2" color="text.secondary">
                    How many days of history to show on the Dashboard contribution graph.
                </Typography>
                <Box sx={{ px: 2, mt: 2 }}>
                    <Slider
                        value={Number(settings.activityGraphDays) || 365}
                        onChange={handleDaysChange}
                        step={30}
                        marks
                        min={30}
                        max={365}
                        valueLabelDisplay="auto"
                    />
                </Box>
                <Typography align="center" sx={{ mt: 1 }}>Last {settings.activityGraphDays || 365} days</Typography>
            </Grid>

            <Grid item xs={12}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={settings.enableFatigueWarnings === 'true'} 
                            onChange={handleFatigueChange} 
                        />
                    }
                    label="Enable Fatigue & Fragmentation Warnings"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                    Receive notifications when you work too long without breaks or switch contexts too often.
                </Typography>
            </Grid>

            <Grid item xs={12}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={settings.habit_notifications_enabled !== 'false'} 
                            onChange={(e) => updateSetting('habit_notifications_enabled', String(e.target.checked))} 
                        />
                    }
                    label="Enable Habit Reminders"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                    Get notified if you haven't completed your daily habits (3 hours after reminder time).
                </Typography>
            </Grid>

            <Grid item xs={12}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={settings.enableSleepTracking === 'true'} 
                            onChange={handleSleepTrackingChange} 
                        />
                    }
                    label="Enable Sleep Tracking Integration"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                    Show Sleep Score input in Smart Insights. Data is used to adjust fatigue recommendations.
                </Typography>
            </Grid>

            <Grid item xs={6}>
                <TextField
                    label="Work Day Start"
                    type="time"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={settings.workDayStart || '09:00'}
                    onChange={(e) => updateSetting('workDayStart', e.target.value)}
                />
            </Grid>
            <Grid item xs={6}>
                <TextField
                    label="Work Day End"
                    type="time"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={settings.workDayEnd || '17:00'}
                    onChange={(e) => updateSetting('workDayEnd', e.target.value)}
                />
            </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Gamification & Visuals</Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={settings.enableRewardAnimations === 'true'} 
                            onChange={handleRewardChange} 
                        />
                    }
                    label="Enable Reward Animations (Confetti/Lottie)"
                />
            </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default Settings;