import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Switch, FormControlLabel, Slider, Divider, Grid, Button, CircularProgress, TextField, Checkbox, FormGroup } from '@mui/material';
import { useSettings } from '../../context/SettingsContext';
import { forceNeuralTraining } from '../../services/DatabaseService';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from '@mui/icons-material/Add';

function Settings() {
    const { settings, updateSetting, loading } = useSettings();
    const [training, setTraining] = useState(false);
    const [webSettings, setWebSettings] = useState<any>(null);
    const [newSiteInput, setNewSiteInput] = useState('');
  
    const defaultSites = ['youtube.com/shorts', 'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'onet.pl', 'lowcygier.pl'];
  
    useEffect(() => {
        // @ts-ignore

      window.electron.database.getWebSettings()

          .then(setWebSettings)

  ;
  }, []);

  const handleWebSettingChange = (key: string, value: any) => {
      if (key === 'integrationEnabled') {
          updateSetting('browser_integration_enabled', String(value));
      }
      const newSettings = { ...webSettings, [key]: value };
      setWebSettings(newSettings);
      // @ts-ignore
      window.electron.database.saveWebSettings(newSettings);
  };

  const handleAddSite = () => {
      if (!newSiteInput.trim()) return;
      const site = newSiteInput.trim();
      // Add to blocked sites if not present
      if (!webSettings.blockedSites.includes(site)) {
           const newSites = [...(webSettings.blockedSites || []), site];
           handleWebSettingChange('blockedSites', newSites);
      }
      setNewSiteInput('');
  };

  const toggleBlockedSite = (site: string) => {
      const currentSites = webSettings.blockedSites || [];
      const newSites = currentSites.includes(site)
        ? currentSites.filter((s: string) => s !== site)
        : [...currentSites, site];
      
      handleWebSettingChange('blockedSites', newSites);
  };

  if (loading) return <Typography sx={{ p: 3 }}>Loading settings...</Typography>;

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
    <Box sx={{ maxWidth: 800, mx: 'auto', pb: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 300 }}>Settings</Typography>
      
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
                <Typography gutterBottom>Idle Detection Timeout (minutes)</Typography>
                <Typography variant="body2" color="text.secondary">
                    If you are inactive for this long, Thingy will ask if you want to keep the timer running.
                </Typography>
                <Box sx={{ px: 2, mt: 2 }}>
                    <Slider
                        value={Math.round((Number(settings.idleTimeout || 600) / 60))}
                        min={1}
                        max={60}
                        step={1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}m`}
                        onChange={(_, value) => updateSetting('idleTimeout', String((value as number) * 60))}
                    />
                </Box>
                <Typography align="center" sx={{ mt: 1 }}>Current: {Math.round((Number(settings.idleTimeout || 600) / 60))} min</Typography>
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

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Browser Integration (Chrome Extension)</Typography>
        <Divider sx={{ mb: 3 }} />

        {!webSettings ? (
            <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
            </Box>
        ) : (
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={webSettings.integrationEnabled} 
                            onChange={(e) => handleWebSettingChange('integrationEnabled', e.target.checked)} 
                        />
                    }
                    label="Enable Browser Integration"
                />
                 <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                    Allows Thingy to sync with the Chrome extension to block distractions and track web usage.
                </Typography>
            </Grid>

            {webSettings.integrationEnabled && (
            <>
            <Grid item xs={12}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={webSettings.blockingEnabled} 
                            onChange={(e) => handleWebSettingChange('blockingEnabled', e.target.checked)} 
                        />
                    }
                    label="Enable Website Blocking"
                />
            </Grid>
            
            <Grid item xs={12}>
                 <FormControlLabel
                    control={
                        <Switch 
                            disabled={!webSettings.blockingEnabled}
                            checked={webSettings.blockOnlyInFocus} 
                            onChange={(e) => handleWebSettingChange('blockOnlyInFocus', e.target.checked)} 
                        />
                    }
                    label="Block only during Focus Mode (Timer Running)"
                />
            </Grid>

            <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Blocked Sites:</Typography>
                <FormGroup row>
                    {Array.from(new Set([...defaultSites, ...(webSettings.blockedSites || [])])).map(site => (
                        <FormControlLabel
                            key={site}
                            control={
                                <Checkbox 
                                    disabled={!webSettings.blockingEnabled}
                                    checked={webSettings.blockedSites.includes(site)}
                                    onChange={() => toggleBlockedSite(site)}
                                />
                            }
                            label={site}
                        />
                    ))}
                </FormGroup>
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <TextField 
                        size="small"
                        placeholder="Add website (e.g. reddit.com)"
                        value={newSiteInput}
                        onChange={(e) => setNewSiteInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddSite()}
                        disabled={!webSettings.blockingEnabled}
                        sx={{ flexGrow: 1, maxWidth: 300 }}
                    />
                     <Button 
                        variant="outlined" 
                        startIcon={<AddIcon />}
                        onClick={handleAddSite}
                        disabled={!newSiteInput.trim() || !webSettings.blockingEnabled}
                    >
                        Add
                    </Button>
                </Box>
            </Grid>
             <Grid item xs={12}>
                <TextField
                    label="Extension Port"
                    type="number"
                    size="small"
                    value={settings.extension_port || 3333}
                    onChange={(e) => updateSetting('extension_port', e.target.value)}
                    helperText="Requires app restart to apply changes."
                />
            </Grid>

            <Grid item xs={12}>
                <Typography gutterBottom>Sync Interval (minutes)</Typography>
                <Typography variant="body2" color="text.secondary">
                    How often the browser extension sends data to Thingy.
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        type="number"
                        size="small"
                        label="Minutes"
                        value={settings.web_sync_interval || 60}
                        onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                                updateSetting('web_sync_interval', String(val));
                            }
                        }}
                        sx={{ width: 120 }}
                    />
                    <Button 
                        variant="contained" 
                        startIcon={<SyncIcon />}
                        onClick={() => {
                            // @ts-ignore
                            window.electron.database.requestSync();
                        }}
                    >
                        Sync Now
                    </Button>
                </Box>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                    Currently syncing every {settings.web_sync_interval || 60} minutes.
                </Typography>
            </Grid>
            </>
            )}
        </Grid>
        )}
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