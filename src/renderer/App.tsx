import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Dashboard from './dashboard/dashboard';
import List from './pages/list/List';
import Habits from './pages/habits/Habits';
import Notes from './pages/notes/Notes';
import Statistics from './pages/statistics/Statistics';
import Profile from './pages/profile/Profile';
import SystemLogs from './pages/system-logs/SystemLogs';
import Settings from './pages/settings/Settings';
import SprintsPage from './pages/sprints/Sprints';
import TaskDetail from './pages/task/TaskDetail';
import { TimerProvider } from './context/TimerContext';
import { GamificationProvider } from './context/GamificationContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import theme from './theme';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <SettingsProvider>
          <TimerProvider>
            <GamificationProvider>
              <Layout>
                <Routes>
                  <Route path="/list" element={<List />} />
                  <Route path="/habits" element={<Habits />} />
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/statistics" element={<Statistics />} />
                                  <Route path="/profile" element={<Profile />} />
                                  <Route path="/logs" element={<SystemLogs />} />
                                  <Route path="/settings" element={<Settings />} />
                                  <Route path="/sprints" element={<SprintsPage />} />                  <Route path="/task/:taskId" element={<TaskDetail />} />
                  <Route path="/" element={<Dashboard />} />
                </Routes>
              </Layout>
            </GamificationProvider>
          </TimerProvider>
        </SettingsProvider>
      </Router>
    </ThemeProvider>
  );
}
