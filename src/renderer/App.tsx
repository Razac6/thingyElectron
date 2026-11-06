import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import Dashboard from './dashboard/dashboard';
import List from './pages/list/List';
import Habits from './pages/habits/Habits';
import Statistics from './pages/statistics/Statistics';
import Profile from './pages/profile/Profile';
import SystemLogs from './pages/system-logs/SystemLogs';
import Settings from './pages/settings/Settings';
import About from './pages/about/About';
import SprintsPage from './pages/sprints/Sprints';
import SprintDetail from './pages/sprints/SprintDetail';
import TaskDetail from './pages/task/TaskDetail';
import WebAnalytics from './pages/web-analytics/WebAnalytics';
import MeditationPage from './pages/meditation/MeditationPage';
import { TimerProvider } from './context/TimerContext';
import { GamificationProvider } from './context/GamificationContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { themes, resolveTheme, DEFAULT_THEME } from './themes';

// Applies the theme picked in Settings. Lives under SettingsProvider so it can read it; the
// outer ThemeProvider (default theme) still covers the top-level ErrorBoundary.
function SettingsThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const theme = React.useMemo(
    () => resolveTheme(settings),
    // Rebuild only when a theme-related setting changes, not on every settings update
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      settings.ui_theme,
      settings.luma_primary,
      settings.luma_accent,
      settings.luma_highlight,
      settings.luma_band,
    ],
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Theme colors for plain CSS (Habits.css, the Sprints calendar) */}
      <GlobalStyles
        styles={{
          ':root': {
            '--thingy-primary': theme.palette.primary.main,
            '--thingy-primary-contrast': theme.palette.primary.contrastText,
            '--thingy-secondary': theme.palette.secondary.main,
            '--thingy-warning': theme.palette.warning.main,
            '--thingy-text': theme.palette.text.primary,
          },
        }}
      />
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={themes[DEFAULT_THEME]}>
        <CssBaseline />
        <Router>
          <ErrorBoundary>
            <SettingsProvider>
              <SettingsThemeProvider>
                <GamificationProvider>
                  <TimerProvider>
                    <ErrorBoundary>
                      <Layout>
                        <Routes>
                          <Route path="/list" element={<List />} />
                          <Route path="/habits" element={<Habits />} />
                          {/* Chat route removed */}
                          <Route path="/statistics" element={<Statistics />} />
                          <Route
                            path="/web-activity"
                            element={<WebAnalytics />}
                          />
                          <Route path="/profile" element={<Profile />} />
                          <Route
                            path="/meditation"
                            element={<MeditationPage />}
                          />

                          <Route path="/logs" element={<SystemLogs />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/sprints" element={<SprintsPage />} />
                          <Route
                            path="/sprints/:sprintId"
                            element={<SprintDetail />}
                          />
                          <Route
                            path="/task/:taskId"
                            element={<TaskDetail />}
                          />
                          <Route path="/" element={<Dashboard />} />
                        </Routes>
                      </Layout>
                    </ErrorBoundary>
                  </TimerProvider>
                </GamificationProvider>
              </SettingsThemeProvider>
            </SettingsProvider>
          </ErrorBoundary>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
