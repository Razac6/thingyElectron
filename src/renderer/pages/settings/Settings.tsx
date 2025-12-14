import React, { useState } from 'react';
import { Box, Paper, Typography, Switch, FormControlLabel, Slider, Divider, Grid, Button, CircularProgress } from '@mui/material';
import { useSettings } from '../../context/SettingsContext';
import { forceNeuralTraining } from '../../services/DatabaseService';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

function Settings() {
  const { settings, updateSetting, loading } = useSettings();
  const [training, setTraining] = useState(false);

  if (loading) return <Typography>Loading settings...</Typography>;

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

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Settings</Typography>
      
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