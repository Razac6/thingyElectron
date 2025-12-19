import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Tooltip,
  LinearProgress,
  Avatar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LoopIcon from '@mui/icons-material/Loop';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'react-calendar-heatmap/dist/styles.css';
import './Habits.css';
import { useGamification } from '../../context/GamificationContext';
import { Collapse, ToggleButtonGroup, ToggleButton } from '@mui/material';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// --- Types ---
interface Habit {
  id: number;
  userId: number;
  title: string;
  description: string;
  frequency: {
    type: 'daily' | 'weekly';
    days: number[]; // 0-6, Sunday is 0
  };
  category: string;
  targetStreak: number;
  reminderTime: string;
  createdAt: string;
  isFavorite?: number;
}

interface HabitLog {
  id: number;
  habitId: number;
  date: string;
  value: number;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const CATEGORIES = ['Health', 'Coding', 'Content', 'Learning', 'Mindfulness', 'General'];

// --- Date Helpers (Local Time) ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return (new Date(date.getTime() - offset)).toISOString().slice(0, 10);
};

const getMonday = (d: Date) => {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const newDate = new Date(d.setDate(diff));
  newDate.setHours(0,0,0,0);
  return newDate;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const calculateStreak = (logs: HabitLog[]) => {
  const completedLogs = logs.filter(l => l.value >= 1);
  if (completedLogs.length === 0) return 0;
  
  const sortedDates = [...new Set(completedLogs.map(l => l.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  const today = toLocalISOString(new Date());
  const yesterday = toLocalISOString(addDays(new Date(), -1));
  
  const lastLogDate = sortedDates[0];
  if (lastLogDate !== today && lastLogDate !== yesterday) return 0;

  let streak = 0;
  let currentDate = new Date(lastLogDate);

  for (let i = 0; i < sortedDates.length; i++) {
      const logDate = sortedDates[i];
      if (logDate === toLocalISOString(currentDate)) {
          streak++;
          currentDate = addDays(currentDate, -1);
      } else break;
  }
  return streak;
};

const HabitHistoryChart = ({ logs, range }: { logs: HabitLog[], range: '7d' | '30d' | 'all' }) => {
  const data = useMemo(() => {
    let daysToScroll = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    if (range === 'all' && logs.length > 0) {
        const earliest = new Date(Math.min(...logs.filter(l => l.value >= 1).map(l => new Date(l.date).getTime())));
        daysToScroll = Math.min(Math.ceil((new Date().getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1, 365);
    }

    const labels: string[] = [];
    const points: number[] = [];
    for (let i = daysToScroll - 1; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      labels.push(d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }));
      const done = logs.some(l => l.date === toLocalISOString(d) && l.value >= 1);
      points.push(done ? 1 : 0);
    }

    const strengthPoints = points.map((_, idx, arr) => {
        const window = arr.slice(Math.max(0, idx - 6), idx + 1);
        return Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 100);
    });

    return {
      labels,
      datasets: [{
        label: 'Habit Strength (%)',
        data: strengthPoints,
        borderColor: '#219ebc',
        backgroundColor: 'rgba(33, 158, 188, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: range === '7d' ? 4 : 0,
      }],
    };
  }, [logs, range]);

  return (
    <Line 
      data={data} 
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
          x: { grid: { display: false } }
        }
      }} 
    />
  );
};

const HabitCard = ({ habit, logs, onToggleDate, onToggleFavorite, onEdit, onDelete }: { 
    habit: Habit, 
    logs: HabitLog[], 
    onToggleDate: (date: string) => void, 
    onToggleFavorite: () => void,
    onEdit: () => void, 
    onDelete: () => void 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');
  
  const today = new Date();
  const currentMonday = getMonday(today);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i));
  const todayStr = toLocalISOString(today);
  const streak = calculateStreak(logs);
  const isCompleted = (dateStr: string) => logs.some(l => l.date === dateStr && l.value >= 1);

  return (
    <Card className="habit-card" sx={{ mb: 2, borderRadius: 3, overflow: 'visible' }}>
      <CardContent sx={{ p: '24px !important', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <Grid container alignItems="center" spacing={2}>
            <Grid item xs={12} md={4}>
                <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'rgba(33, 158, 188, 0.1)', color: '#219ebc', borderRadius: 2 }}>
                        {habit.title.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>{habit.title}</Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Chip label={habit.category} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: '#f0f0f0' }} />
                            <Box display="flex" alignItems="center" color="#fb8500" gap={0.5}>
                                <WhatshotIcon sx={{ fontSize: 16 }} />
                                <Typography variant="caption" fontWeight="bold">{streak} day streak</Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Grid>

            <Grid item xs={12} md={5}>
                <Box className="week-bubbles-container" onClick={(e) => e.stopPropagation()}>
                    {weekDates.map((date) => {
                        const dateStr = toLocalISOString(date);
                        const done = isCompleted(dateStr);
                        const isToday = dateStr === todayStr;
                        const isPendingToday = isToday && !done;
                        return (
                            <Box key={dateStr} className="day-column" onClick={() => onToggleDate(dateStr)}>
                                <Typography variant="caption" className={`day-label ${isToday ? 'today' : ''}`}>
                                    {DAYS_OF_WEEK.find(d => d.value === date.getDay())?.label.charAt(0)}
                                </Typography>
                                <Box className={`day-bubble ${done ? 'done' : ''} ${isToday ? 'today-bubble' : ''} ${isPendingToday ? 'pending-today' : ''}`}>
                                    {done && <CheckIcon sx={{ fontSize: 14, color: 'white' }} />}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Grid>

            <Grid item xs={12} md={3} display="flex" justifyContent="flex-end" alignItems="center" onClick={(e) => e.stopPropagation()}>
                 <IconButton size="small" onClick={onToggleFavorite} sx={{ color: habit.isFavorite ? '#ffb703' : '#9e9e9e' }}>
                    {habit.isFavorite ? <StarIcon /> : <StarBorderIcon />}
                 </IconButton>
                 <IconButton size="small" onClick={onEdit} sx={{ color: '#9e9e9e' }}><EditIcon fontSize="small" /></IconButton>
                 <IconButton size="small" onClick={onDelete} sx={{ color: '#ef476f' }}><DeleteIcon fontSize="small" /></IconButton>
                 <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ ml: 1 }}>
                    {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                 </IconButton>
            </Grid>
        </Grid>
      </CardContent>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ p: 3, borderTop: '1px solid rgba(0,0,0,0.05)', bgcolor: '#fafafa' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2" fontWeight="bold">Habit Strength Over Time</Typography>
                  <ToggleButtonGroup value={range} exclusive onChange={(_, v) => v && setRange(v)} size="small" sx={{ height: 30 }}>
                    <ToggleButton value="7d">7D</ToggleButton>
                    <ToggleButton value="30d">30D</ToggleButton>
                    <ToggleButton value="all">All</ToggleButton>
                  </ToggleButtonGroup>
              </Box>
              <Box sx={{ height: 200, width: '100%' }}>
                  <HabitHistoryChart logs={logs} range={range} />
              </Box>
          </Box>
      </Collapse>
    </Card>
  );
};

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<number, HabitLog[]>>({});
  const [openDialog, setOpenDialog] = useState(false);
  const { addXp, triggerRewardAnimation } = useGamification();
  
  // Form State
  const [currentHabit, setCurrentHabit] = useState<Partial<Habit>>({
    title: '',
    description: '',
    frequency: { type: 'daily', days: [] },
    category: 'General',
    targetStreak: 30,
    reminderTime: '09:00'
  });
  const [isEditing, setIsEditing] = useState(false);

  const userStr = localStorage.getItem('userId');
  const userId = userStr ? JSON.parse(userStr) : 1;

  const loadData = async () => {
    try {
      const fetchedHabits = await window.electron.database.getHabits(userId);
      setHabits(fetchedHabits);

      // Load logs for all habits
      const logs = await window.electron.database.getHabitLogs(userId);
      // Group logs by habitId
      const logsMap: Record<number, HabitLog[]> = {};
      logs.forEach((log: HabitLog) => {
        if (!logsMap[log.habitId]) logsMap[log.habitId] = [];
        logsMap[log.habitId].push(log);
      });
      setHabitLogs(logsMap);
    } catch (e) {
      console.error("Failed to load habits", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = (habit?: Habit) => {
    if (habit) {
      setCurrentHabit(habit);
      setIsEditing(true);
    } else {
      setCurrentHabit({
        title: '',
        description: '',
        frequency: { type: 'daily', days: [] },
        category: 'General',
        targetStreak: 30,
        reminderTime: '09:00'
      });
      setIsEditing(false);
    }
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      if (isEditing && currentHabit.id) {
        await window.electron.database.updateHabit({ ...currentHabit, id: currentHabit.id });
      } else {
        await window.electron.database.createHabit(currentHabit, userId);
      }
      setOpenDialog(false);
      loadData();
    } catch (e) {
      console.error("Failed to save habit", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this habit?')) {
        await window.electron.database.deleteHabit(id);
        loadData();
    }
  };

  const handleToggleDate = async (habitId: number, dateStr: string) => {
    const logs = habitLogs[habitId] || [];
    const existingLog = logs.find(l => l.date === dateStr);
    
    let newValue = 1;
    if (existingLog && existingLog.value >= 1) {
        newValue = 0; // Uncheck
    }

    await window.electron.database.logHabit(habitId, dateStr, newValue);
    
    // Only reward if toggling ON and it's TODAY
    const today = toLocalISOString(new Date());
    if (newValue === 1 && dateStr === today) {
        addXp(15);
        triggerRewardAnimation('standard');
    }
    
    loadData();
  };

  const handleToggleFavorite = async (habitId: number) => {
      await window.electron.database.toggleHabitFavorite(habitId, userId);
      loadData();
  };

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', overflow: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', color: '#023047' }}>
          <LoopIcon fontSize="large" sx={{ color: '#219ebc' }} /> Habit Forge
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} sx={{ borderRadius: 2, textTransform: 'none', fontSize: '1rem', px: 3 }}>
          New Habit
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Main List */}
        <Grid item xs={12} md={12}>
            {habits.length === 0 && (
                <Box textAlign="center" py={5}>
                    <Typography color="text.secondary" variant="h6">No habits defined yet.</Typography>
                    <Typography color="text.secondary">Create one to start your journey!</Typography>
                </Box>
            )}
            {habits.map(habit => (
                <HabitCard 
                    key={habit.id} 
                    habit={habit} 
                    logs={habitLogs[habit.id] || []}
                    onToggleDate={(date) => handleToggleDate(habit.id, date)}
                    onToggleFavorite={() => handleToggleFavorite(habit.id)}
                    onEdit={() => handleOpenDialog(habit)}
                    onDelete={() => handleDelete(habit.id)}
                />
            ))}
        </Grid>
      </Grid>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit Habit' : 'New Habit'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField 
                label="Title" 
                fullWidth 
                value={currentHabit.title} 
                onChange={e => setCurrentHabit({...currentHabit, title: e.target.value})} 
            />
             <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                    value={currentHabit.category}
                    label="Category"
                    onChange={e => setCurrentHabit({...currentHabit, category: e.target.value})}
                >
                    {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
            </FormControl>
            
            <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                    value={currentHabit.frequency?.type}
                    label="Frequency"
                    onChange={e => setCurrentHabit({...currentHabit, frequency: { ...currentHabit.frequency!, type: e.target.value as 'daily'|'weekly' }})}
                >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                </Select>
            </FormControl>

            {currentHabit.frequency?.type === 'weekly' && (
                <FormControl sx={{ width: '100%' }}>
                    <InputLabel id="days-label">Days</InputLabel>
                    <Select
                    labelId="days-label"
                    multiple
                    value={currentHabit.frequency.days}
                    onChange={(event) => {
                        const { value } = event.target;
                        setCurrentHabit({
                            ...currentHabit,
                            frequency: {
                                ...currentHabit.frequency!,
                                days: typeof value === 'string' ? value.split(',').map(Number) : value as number[],
                            }
                        });
                    }}
                    input={<OutlinedInput label="Days" />}
                    renderValue={(selected) => selected.map(val => DAYS_OF_WEEK.find(d => d.value === val)?.label).join(', ')}
                    >
                    {DAYS_OF_WEEK.map((day) => (
                        <MenuItem key={day.value} value={day.value}>
                        <Checkbox checked={currentHabit.frequency!.days.indexOf(day.value) > -1} />
                        <ListItemText primary={day.label} />
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl>
            )}

            <TextField
                label="Reminder Time"
                type="time"
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }} // 5 min
                value={currentHabit.reminderTime}
                onChange={e => setCurrentHabit({...currentHabit, reminderTime: e.target.value})}
            />
          </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
