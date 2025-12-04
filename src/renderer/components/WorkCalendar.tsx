import React, { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
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
  let hours = Math.floor(minutes / 60);

  seconds %= 60;
  minutes %= 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0 && minutes < 5) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(' ') : 'Less than a second';
}

function WorkCalendar() {
  const [activeDate, setActiveDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<{ date: string; time: string } | null>(null);

  const dailyProgress: DailyProgressEntry[] = useMemo(() => {
    const storedData = localStorage.getItem('dailyProgress');
    return storedData ? JSON.parse(storedData) : [];
  }, []);

  const handleDayClick = (value: Date) => {
    const dateString = value.toLocaleDateString();
    const dayData = dailyProgress.find(d => d.date === dateString);

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

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const getTileClassName = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const dateString = date.toLocaleDateString();
      const dayData = dailyProgress.find(d => d.date === dateString);
      if (dayData && dayData.dayTimeSpend > 0) {
        return 'has-activity';
      }
    }
    return null;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Work Activity Calendar</Typography>
      <Calendar
        onChange={setActiveDate}
        value={activeDate}
        onClickDay={handleDayClick}
        tileClassName={getTileClassName}
      />
      <Dialog open={modalOpen} onClose={handleCloseModal}>
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
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkCalendar;
