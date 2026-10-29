import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  IconButton,
  Tooltip,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useSettings } from '../../context/SettingsContext';
import {
  themeLabels,
  DEFAULT_THEME,
  ThemeVariant,
  getLumaColors,
  lumaColorSettings,
} from '../../themes';
import { LumaColors } from '../../themes/luma';
import {
  ALL_TILES,
  MAX_TILES,
  TILE_LABELS,
  TILES_SETTING,
  HIGHLIGHT_SETTING,
  TileId,
  parseTiles,
  parseHighlight,
} from '../../dashboard/dashboardTiles';
import CompanionPicker, {
  normalizeCharacter,
} from '../../components/CompanionPicker';

const lumaColorFields: {
  key: keyof LumaColors;
  label: string;
  hint: string;
}[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, active menu' },
  { key: 'accent', label: 'Accent', hint: 'Active icon, glow, charts' },
  { key: 'highlight', label: 'Highlight', hint: 'Dashboard highlight card' },
  { key: 'band', label: 'Activity', hint: 'Dashboard activity section' },
];

// Brand color pickers for the Luma theme. The native picker fires on every drag step,
// so the preview updates locally and the setting is saved once the user pauses.
function LumaColorSettings() {
  const { settings, updateSetting } = useSettings();
  const saved = getLumaColors(settings);
  const [draft, setDraft] = useState<Partial<LumaColors>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const handleChange = (key: keyof LumaColors, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      await updateSetting(lumaColorSettings[key], value);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 250);
  };

  const handleReset = () => {
    setDraft({});
    lumaColorFields.forEach(({ key }) =>
      updateSetting(lumaColorSettings[key], ''),
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.5,
        }}
      >
        {lumaColorFields.map(({ key, label, hint }) => {
          const value = draft[key] ?? saved[key];
          return (
            <Box
              key={key}
              component="label"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: '16px',
                border: 1,
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': { borderColor: 'text.secondary' },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: value,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                }}
              >
                <input
                  type="color"
                  aria-label={`${label} color`}
                  value={value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.primary', fontWeight: 600 }}
                >
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {hint}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      <Button size="small" onClick={handleReset} sx={{ mt: 1.5 }}>
        Reset colors
      </Button>
    </Box>
  );
}

// Which stat tiles the Luma dashboard shows (max 4), their order, and the highlighted one
function DashboardTilesSettings() {
  const { settings, updateSetting } = useSettings();
  const selected = parseTiles(settings[TILES_SETTING]);
  const highlighted = parseHighlight(settings[HIGHLIGHT_SETTING]);
  const rows: TileId[] = [
    ...selected,
    ...ALL_TILES.filter((id) => !selected.includes(id)),
  ];

  const saveTiles = (tiles: TileId[]) =>
    updateSetting(TILES_SETTING, JSON.stringify(tiles));

  const toggle = (id: TileId) => {
    if (selected.includes(id)) {
      if (selected.length > 1) saveTiles(selected.filter((t) => t !== id));
    } else if (selected.length < MAX_TILES) {
      saveTiles([...selected, id]);
    }
  };

  const move = (id: TileId, delta: number) => {
    const index = selected.indexOf(id);
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    saveTiles(next);
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Dashboard tiles - pick up to {MAX_TILES}, order them, star one to
        highlight
      </Typography>
      {rows.map((id) => {
        const isOn = selected.includes(id);
        const index = selected.indexOf(id);
        return (
          <Box
            key={id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: isOn ? 1 : 0.6,
            }}
          >
            <Checkbox
              size="small"
              checked={isOn}
              disabled={
                (!isOn && selected.length >= MAX_TILES) ||
                (isOn && selected.length === 1)
              }
              onChange={() => toggle(id)}
              inputProps={{ 'aria-label': TILE_LABELS[id] }}
            />
            <Typography variant="body2" sx={{ flex: 1, color: 'text.primary' }}>
              {TILE_LABELS[id]}
            </Typography>
            {isOn && (
              <>
                <Tooltip title="Highlight">
                  <IconButton
                    size="small"
                    aria-label={`Highlight ${TILE_LABELS[id]}`}
                    onClick={() =>
                      updateSetting(
                        HIGHLIGHT_SETTING,
                        highlighted === id ? 'none' : id,
                      )
                    }
                  >
                    {highlighted === id ? (
                      <StarIcon fontSize="small" color="secondary" />
                    ) : (
                      <StarBorderIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="small"
                  aria-label={`Move ${TILE_LABELS[id]} up`}
                  disabled={index === 0}
                  onClick={() => move(id, -1)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move ${TILE_LABELS[id]} down`}
                  disabled={index === selected.length - 1}
                  onClick={() => move(id, 1)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function Settings() {
  const { settings, updateSetting } = useSettings();
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    if (settings.geminiApiKey) {
      setGeminiKey(settings.geminiApiKey);
    }
  }, [settings]);

  const handleSaveKey = useCallback(() => {
    updateSetting('geminiApiKey', geminiKey);
    alert('API Key saved!');
  }, [updateSetting, geminiKey]);

  const handleTestNotification = useCallback(() => {
    window.electron.app.testMeditationNotif();
  }, []);

  const handleTestStandup = useCallback(() => {
    window.electron.app.testDailyStandup();
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      {/* Appearance Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Appearance
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={settings.ui_theme || DEFAULT_THEME}
          onChange={(_, value: ThemeVariant | null) => {
            if (value) updateSetting('ui_theme', value);
          }}
        >
          {(Object.keys(themeLabels) as ThemeVariant[]).map((name) => (
            <ToggleButton key={name} value={name} sx={{ px: 3 }}>
              {themeLabels[name]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Assistant character
        </Typography>
        <CompanionPicker
          value={normalizeCharacter(settings.companion_character)}
          onChange={(value) => updateSetting('companion_character', value)}
        />
        {(settings.ui_theme || DEFAULT_THEME) === 'luma' && (
          <>
            <LumaColorSettings />
            <DashboardTilesSettings />
          </>
        )}
      </Paper>

      {/* AI & API Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Configure the brain of your assistant. Local AI is private and runs
          offline.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.aiEngine === 'gemini'}
              onChange={(e) =>
                updateSetting('aiEngine', e.target.checked ? 'gemini' : 'local')
              }
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
              onChange={(e) =>
                updateSetting('complexityThreshold', e.target.value)
              }
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enableRewardAnimations !== 'false'}
                onChange={(e) =>
                  updateSetting(
                    'enableRewardAnimations',
                    String(e.target.checked),
                  )
                }
              />
            }
            label="Enable Reward Animations (Confetti)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.mountain_climb_enabled !== 'false'}
                onChange={(e) =>
                  updateSetting(
                    'mountain_climb_enabled',
                    String(e.target.checked),
                  )
                }
              />
            }
            label="Enable Mountain Climb Expedition (BETA)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enableFatigueWarnings !== 'false'}
                onChange={(e) =>
                  updateSetting(
                    'enableFatigueWarnings',
                    String(e.target.checked),
                  )
                }
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
              onChange={(e) =>
                updateSetting('activityGraphDays', e.target.value)
              }
            />
          </Grid>
        </Grid>
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
              onChange={(_, val) =>
                updateSetting('water_interval', String(val))
              }
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
              onChange={(_, val) =>
                updateSetting('stretching_interval', String(val))
              }
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
              onChange={(e) =>
                updateSetting('meditation_duration', e.target.value)
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography gutterBottom>Pomodoro Duration (min)</Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              value={settings.pomodoro_duration || 25}
              onChange={(e) =>
                updateSetting('pomodoro_duration', e.target.value)
              }
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enable_water_reminders !== 'false'}
                onChange={(e) =>
                  updateSetting(
                    'enable_water_reminders',
                    String(e.target.checked),
                  )
                }
              />
            }
            label="Enable Water Reminders"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enable_stretching_reminders !== 'false'}
                onChange={(e) =>
                  updateSetting(
                    'enable_stretching_reminders',
                    String(e.target.checked),
                  )
                }
              />
            }
            label="Enable Stretching Reminders"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.enable_meditation_reminders !== 'false'}
                onChange={(e) =>
                  updateSetting(
                    'enable_meditation_reminders',
                    String(e.target.checked),
                  )
                }
              />
            }
            label="Enable Daily Meditation (09:00)"
          />
        </Box>
      </Paper>

      {/* Web Integration Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Web Integration
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={settings.browser_integration_enabled !== 'false'}
              onChange={(e) =>
                updateSetting(
                  'browser_integration_enabled',
                  String(e.target.checked),
                )
              }
            />
          }
          label="Enable Browser Integration (Chrome Extension)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.desktop_app_monitoring_enabled !== 'false'}
              onChange={(e) =>
                updateSetting(
                  'desktop_app_monitoring_enabled',
                  String(e.target.checked),
                )
              }
            />
          }
          label="Enable Desktop App Monitoring"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.web_blocking_only_focus !== 'false'}
              onChange={(e) =>
                updateSetting(
                  'web_blocking_only_focus',
                  String(e.target.checked),
                )
              }
            />
          }
          label="Block Sites Only During Focus Mode"
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Always Blocked Sites (Distractions)
          </Typography>
          <Typography variant="caption" color="text.secondary" paragraph>
            These sites will be blocked or modified (e.g. Shorts hidden) if
            integration is active.
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
            onChange={(e) =>
              updateSetting('web_blocking_sites', e.target.value)
            }
            helperText='Example: ["facebook.com", "youtube.com/shorts"]'
          />
        </Box>
      </Paper>

      {/* Debug Section */}
      <Paper sx={{ p: 3, bgcolor: '#fff3e0' }}>
        <Typography variant="h6" color="warning.main" gutterBottom>
          Debug Zone
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleTestNotification}
          >
            Test Notification (Kot)
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleTestStandup}
          >
            Test Daily Standup
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => window.electron.app.openDevTools()}
          >
            Open DevTools
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default Settings;
