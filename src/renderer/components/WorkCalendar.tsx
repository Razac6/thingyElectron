import React, { useState, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import './WorkCalendar.css';

interface DailyProgressEntry {
  date: string;
  dayTimeSpend: number;
}

function formatTime(ms: number): string {
  if (ms <= 0) return 'No time tracked';
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  seconds %= 60;
  minutes %= 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0 && minutes < 5) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(' ') : 'Less than a second';
}

function WorkCalendar() {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<{
    date: string;
    time: string;
  } | null>(null);

  const dailyProgress: DailyProgressEntry[] = useMemo(() => {
    const storedData = localStorage.getItem('dailyProgress');
    return storedData ? JSON.parse(storedData) : [];
  }, []);

  const handleDayClick = (day: Date) => {
    const dateString = day.toLocaleDateString();
    const dayData = dailyProgress.find((d) => d.date === dateString);

    if (dayData) {
      setSelectedDayData({
        date: dateString,
        time: formatTime(dayData.dayTimeSpend),
      });
    } else {
      setSelectedDayData({
        date: dateString,
        time: 'No activity recorded.',
      });
    }
    setModalOpen(true);
  };

  const hasActivityDays = useMemo(() => {
    return dailyProgress
      .filter((d) => d.dayTimeSpend > 0)
      .map((d) => new Date(d.date));
  }, [dailyProgress]);

  const modifiers = {
    hasActivity: hasActivityDays,
  };

  const modifiersStyles = {
    hasActivity: {
      fontWeight: 'bold',
      backgroundColor: '#8ecae6',
      borderRadius: '50%',
    },
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Typography variant="h6" gutterBottom>
        Work Activity Calendar
      </Typography>
      <DayPicker
        mode="single"
        selected={selectedDay}
        onSelect={(day) => {
          setSelectedDay(day);
          if (day) handleDayClick(day);
        }}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
      />
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>Activity Details</DialogTitle>
        {selectedDayData && (
          <DialogContent>
            <Typography variant="h6">{selectedDayData.date}</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Total time spent: <strong>{selectedDayData.time}</strong>
            </Typography>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkCalendar;
