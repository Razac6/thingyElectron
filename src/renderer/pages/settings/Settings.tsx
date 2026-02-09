import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Slider,
  Grid,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useSettings } from '../../context/SettingsContext';

function Settings() {
  const { settings, updateSetting } = useSettings();
  const [geminiKey, setGeminiKey] = useState('');
  const [shutdownItems, setShutdownItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    if (settings.geminiApiKey) {
      setGeminiKey(settings.geminiApiKey);
    }
    try {
        if (settings.shutdown_checklist) {
            setShutdownItems(JSON.parse(settings.shutdown_checklist));
        } else {
            // Default if empty
            setShutdownItems([
                "Skrzynka odbiorcza i komunikatory sprawdzone (Inbox Zero)",
                "Plan na jutro przygotowany i zapisany",
                "Biurko / Pulpit uporządkowane",
                "Ostatnie spojrzenie na kalendarz"
            ]);
        }
    } catch(e) { setShutdownItems([]); }
  }, [settings]);

  const handleShutdownSave = (newItems: string[]) => {
      setShutdownItems(newItems);
      updateSetting('shutdown_checklist', JSON.stringify(newItems));
  };

  const addShutdownItem = () => {
      if (!newItem.trim()) return;
      const updated = [...shutdownItems, newItem.trim()];
      handleShutdownSave(updated);
      setNewItem('');
  };

  const removeShutdownItem = (index: number) => {
      const updated = shutdownItems.filter((_, i) => i !== index);
      handleShutdownSave(updated);
  };

  const handleSaveKey = () => {
    updateSetting('geminiApiKey', geminiKey);
    alert('API Key saved!');
  };

  const handleTestNotification = () => {
      window.electron.app.testMeditationNotif();
  };

  const handleTestStandup = () => {
      window.electron.app.testDailyStandup();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* AI & API Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Configure the brain of your assistant. Local AI is private and runs offline.
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.aiEngine === 'gemini'}
              onChange={(e) => updateSetting('aiEngine', e.target.checked ? 'gemini' : 'local')}
            />
          }
          label="Use Google Gemini (Cloud) instead of Local Neural Core"
        />

        {settings.aiEngine === 'gemini' && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <TextField
              label="Gemini API Key"
              type="password"
              fullWidth
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              size="small"
            />
            <Button variant="contained" onClick={handleSaveKey}>
              Save
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Work Day Start</Typography>
                <TextField 
                    type="time" 
                    size="small" 
                    fullWidth 
                    value={settings.workDayStart || '09:00'} 
                    onChange={(e) => updateSetting('workDayStart', e.target.value)}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Work Day End</Typography>
                <TextField 
                    type="time" 
                    size="small" 
                    fullWidth 
                    value={settings.workDayEnd || '17:00'} 
                    onChange={(e) => updateSetting('workDayEnd', e.target.value)}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Idle Timeout (sec)</Typography>
                <TextField 
                    type="number" 
                    size="small" 
                    fullWidth 
                    value={settings.idleTimeout || 600} 
                    onChange={(e) => updateSetting('idleTimeout', e.target.value)}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Complexity Threshold (SP)</Typography>
                <TextField 
                    type="number" 
                    size="small" 
                    fullWidth 
                    value={settings.complexityThreshold || 8} 
                    onChange={(e) => updateSetting('complexityThreshold', e.target.value)}
                />
            </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableRewardAnimations !== 'false'}
                  onChange={(e) => updateSetting('enableRewardAnimations', String(e.target.checked))}
                />
              }
              label="Enable Reward Animations (Confetti)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableFatigueWarnings !== 'false'}
                  onChange={(e) => updateSetting('enableFatigueWarnings', String(e.target.checked))}
                />
              }
              label="Enable Brain Fatigue Warnings"
            />
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Window Opacity</Typography>
                <Slider
                    value={Number(settings.window_opacity) || 1.0}
                    onChange={(_, val) => {
                        updateSetting('window_opacity', String(val));
                        window.electron.app.setWindowOpacity(val as number);
                    }}
                    step={0.05}
                    min={0.5}
                    max={1.0}
                    valueLabelDisplay="auto"
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Activity Graph Range (Days)</Typography>
                <TextField 
                    type="number" 
                    size="small" 
                    fullWidth 
                    value={settings.activityGraphDays || 365} 
                    onChange={(e) => updateSetting('activityGraphDays', e.target.value)}
                />
            </Grid>
        </Grid>
      </Paper>

      {/* Shutdown Ritual Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Shutdown Ritual Checklist</Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
              Customize the steps you take to close your day.
          </Typography>
          
          <List dense>
              {shutdownItems.map((item, index) => (
                  <ListItem key={index} secondaryAction={
                      <IconButton edge="end" aria-label="delete" onClick={() => removeShutdownItem(index)}>
                          <DeleteIcon />
                      </IconButton>
                  }>
                      <ListItemText primary={item} />
                  </ListItem>
              ))}
          </List>
          
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField 
                  label="New Item" 
                  size="small" 
                  fullWidth 
                  value={newItem} 
                  onChange={(e) => setNewItem(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && addShutdownItem()}
              />
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addShutdownItem}>Add</Button>
          </Box>
      </Paper>

      {/* Health & Habits Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Health & Habits
        </Typography>
        
        <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Water Reminder Interval (min)</Typography>
                <Slider
                    value={Number(settings.water_interval) || 90}
                    onChange={(_, val) => updateSetting('water_interval', String(val))}
                    step={15}
                    min={30}
                    max={180}
                    valueLabelDisplay="auto"
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Stretching Interval (min)</Typography>
                <Slider
                    value={Number(settings.stretching_interval) || 60}
                    onChange={(_, val) => updateSetting('stretching_interval', String(val))}
                    step={15}
                    min={30}
                    max={120}
                    valueLabelDisplay="auto"
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Meditation Duration (min)</Typography>
                <TextField 
                    type="number" 
                    size="small" 
                    fullWidth 
                    value={settings.meditation_duration || 10} 
                    onChange={(e) => updateSetting('meditation_duration', e.target.value)}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Pomodoro Duration (min)</Typography>
                <TextField 
                    type="number" 
                    size="small" 
                    fullWidth 
                    value={settings.pomodoro_duration || 25} 
                    onChange={(e) => updateSetting('pomodoro_duration', e.target.value)}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Complexity Threshold (SP)</Typography>
                <TextField 
                    type="number" 
                    size="small" 
                    fullWidth 
                    value={settings.complexityThreshold || 8} 
                    onChange={(e) => updateSetting('complexityThreshold', e.target.value)}
                />
            </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableRewardAnimations !== 'false'}
                  onChange={(e) => updateSetting('enableRewardAnimations', String(e.target.checked))}
                />
              }
              label="Enable Reward Animations (Confetti)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableFatigueWarnings !== 'false'}
                  onChange={(e) => updateSetting('enableFatigueWarnings', String(e.target.checked))}
                />
              }
              label="Enable Brain Fatigue Warnings"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_water_reminders !== 'false'}
                  onChange={(e) => updateSetting('enable_water_reminders', String(e.target.checked))}
                />
              }
              label="Enable Water Reminders"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_stretching_reminders !== 'false'}
                  onChange={(e) => updateSetting('enable_stretching_reminders', String(e.target.checked))}
                />
              }
              label="Enable Stretching Reminders"
            />
             <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_meditation_reminders !== 'false'}
                  onChange={(e) => updateSetting('enable_meditation_reminders', String(e.target.checked))}
                />
              }
              label="Enable Daily Meditation (09:00)"
            />
        </Box>
      </Paper>

      {/* Web Integration Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Web Integration</Typography>
          <FormControlLabel
              control={
                  <Switch
                      checked={settings.browser_integration_enabled !== 'false'}
                      onChange={(e) => updateSetting('browser_integration_enabled', String(e.target.checked))}
                  />
              }
              label="Enable Browser Integration (Chrome Extension)"
          />
          <FormControlLabel
              control={
                  <Switch
                      checked={settings.desktop_app_monitoring_enabled !== 'false'}
                      onChange={(e) => updateSetting('desktop_app_monitoring_enabled', String(e.target.checked))}
                  />
              }
              label="Enable Desktop App Monitoring"
          />
          <FormControlLabel
              control={
                  <Switch
                      checked={settings.web_blocking_only_focus !== 'false'}
                      onChange={(e) => updateSetting('web_blocking_only_focus', String(e.target.checked))}
                  />
              }
              label="Block Sites Only During Focus Mode"
          />
          
          <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Always Blocked Sites (Distractions)</Typography>
              <Typography variant="caption" color="text.secondary" paragraph>
                  These sites will be blocked or modified (e.g. Shorts hidden) if integration is active.
              </Typography>
              {/* Simple list display for now, full editor was complex. 
                  If we had a chip editor here it would be best. 
                  Let's add a simple text area for JSON editing as a power user fallback or just list them.
              */}
              <TextField
                  label="Blocked Sites (JSON Array)"
                  multiline
                  rows={3}
                  fullWidth
                  variant="outlined"
                  value={settings.web_blocking_sites || '[]'}
                  onChange={(e) => updateSetting('web_blocking_sites', e.target.value)}
                  helperText='Example: ["facebook.com", "youtube.com/shorts"]'
              />
          </Box>
      </Paper>

      {/* Debug Section */}
      <Paper sx={{ p: 3, bgcolor: '#fff3e0' }}>
          <Typography variant="h6" color="warning.main" gutterBottom>Debug Zone</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="outlined" color="warning" onClick={handleTestNotification}>
                  Test Notification (Kot)
              </Button>
              <Button variant="outlined" color="warning" onClick={handleTestStandup}>
                  Test Daily Standup
              </Button>
              <Button variant="outlined" color="secondary" onClick={() => window.electron.app.openDevTools()}>
                  Open DevTools
              </Button>
          </Box>
      </Paper>
    </Box>
  );
}

export default Settings;