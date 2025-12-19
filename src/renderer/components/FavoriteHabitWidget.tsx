import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, IconButton, keyframes, Tooltip } from '@mui/material';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import CheckIcon from '@mui/icons-material/Check';
import { styled } from '@mui/material/styles';
import { useGamification } from '../context/GamificationContext';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 183, 3, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(255, 183, 3, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 183, 3, 0); }
`;

const Bubble = styled(Box)(({ theme }) => ({
  width: 14,
  height: 14,
  borderRadius: '50%',
  backgroundColor: '#f8f9fa',
  border: '1px solid #e9ecef',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
  cursor: 'pointer',
  '&.done': {
    backgroundColor: '#219ebc',
    borderColor: '#219ebc',
  },
  '&.today': {
    borderColor: '#ffb703',
    borderWidth: 2
  },
  '&.pending-today': {
    animation: `${pulse} 2s infinite`,
    borderColor: '#fb8500',
  }
}));

// --- Date Helpers (Local Time) ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return (new Date(date.getTime() - offset)).toISOString().slice(0, 10);
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getMonday = (d: Date) => {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const newDate = new Date(d.setDate(diff));
  newDate.setHours(0,0,0,0);
  return newDate;
};

export default function FavoriteHabitWidget() {
  const [habit, setHabit] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const { addXp, triggerRewardAnimation } = useGamification();

  const loadData = async () => {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : 1;

    try {
      const topHabit = await window.electron.database.getTopHabit(userId);
      if (topHabit) {
        setHabit(topHabit);
        const allLogs = await window.electron.database.getHabitLogs(userId);
        const habitLogs = allLogs.filter((l: any) => l.habitId === topHabit.id);
        setLogs(habitLogs);
        
        const completedDates = [...new Set(habitLogs.filter((l: any) => l.value >= 1).map((l: any) => l.date))];
        const sortedDates = completedDates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
        
        if (sortedDates.length > 0) {
            const today = toLocalISOString(new Date());
            const yesterday = toLocalISOString(addDays(new Date(), -1));
            if (sortedDates[0] === today || sortedDates[0] === yesterday) {
                let s = 0;
                let curr = new Date(sortedDates[0]);
                for (let d of sortedDates) {
                    if (d === toLocalISOString(curr)) {
                        s++;
                        curr = addDays(curr, -1);
                    } else break;
                }
                setStreak(s);
            } else setStreak(0);
        } else setStreak(0);
      }
    } catch (e) {
      console.error("Failed to load top habit", e);
    }
  };

  const handleToggleToday = async () => {
    if (!habit) return;
    const todayStr = toLocalISOString(new Date());
    const isDone = logs.some(l => l.date === todayStr && l.value >= 1);
    const newValue = isDone ? 0 : 1;

    await window.electron.database.logHabit(habit.id, todayStr, newValue);
    
    if (newValue === 1) {
        addXp(15);
        triggerRewardAnimation('standard');
    }
    loadData();
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!habit) return null;

  const today = new Date();
  const monday = getMonday(today);
  const todayStr = toLocalISOString(today);
  const weekDates = Array.from({ length: 7 }, (_, i) => toLocalISOString(addDays(monday, i)));

  return (
    <Box sx={{ mt: 2, p: 1.5, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" fontWeight="bold" sx={{ color: '#023047', fontSize: '0.75rem' }}>
                {habit.title}
            </Typography>
            <Box display="flex" alignItems="center" color="#fb8500">
                <WhatshotIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.7rem' }}>{streak}</Typography>
            </Box>
        </Box>
        <Box display="flex" gap={0.8}>
            {weekDates.map(dateStr => {
                const done = logs.some(l => l.date === dateStr && l.value >= 1);
                const isToday = dateStr === todayStr;
                const isPendingToday = isToday && !done;

                return (
                    <Tooltip key={dateStr} title={isToday ? "Click to toggle today" : dateStr} arrow>
                        <Bubble 
                            onClick={isToday ? handleToggleToday : undefined}
                            className={`${done ? 'done' : ''} ${isToday ? 'today' : ''} ${isPendingToday ? 'pending-today' : ''}`}
                        >
                            {done && <CheckIcon sx={{ fontSize: 9, color: 'white' }} />}
                        </Bubble>
                    </Tooltip>
                );
            })}
        </Box>
      </Box>
    </Box>
  );
}
