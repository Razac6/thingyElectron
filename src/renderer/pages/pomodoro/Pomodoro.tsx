import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Button, styled } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';

// --- Styled Components ---
const PomodoroContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: 'calc(100vh - 100px)',
  backgroundColor: '#ac3e33',
  padding: '20px',
  borderRadius: '16px',
  position: 'relative',
});

const ClockFace = styled(Box)({
  width: 350,
  height: 350,
  borderRadius: '50%',
  backgroundColor: '#ff5958',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.2)',
});

const TimeDisplay = styled(Typography)({
  color: 'white',
  fontSize: '6rem',
  fontWeight: 'bold',
  fontFamily: 'sans-serif',
});

const ControlButton = styled(Button)({
  width: 80,
  height: 80,
  borderRadius: '50%',
  backgroundColor: 'white',
  color: '#ff5958',
  marginTop: '40px',
  '&:hover': {
    backgroundColor: '#f0f0f0',
  },
});

const ProgressSVG = styled('svg')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  transform: 'rotate(-90deg)',
});

// --- Component ---
function Pomodoro() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState(25 * 60); // Default 25 minutes
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const savedDuration = localStorage.getItem('pomodoroDuration');
    const newDuration = savedDuration ? JSON.parse(savedDuration) * 60 : 25 * 60;
    setDuration(newDuration);
    setTimeRemaining(newDuration);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      setIsActive(false);
      // Handle end of session
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeRemaining]);

  const toggleTimer = () => setIsActive(!isActive);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const radius = 165;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeRemaining / duration) * circumference;
  const strokeDashoffset = circumference - progress;

  return (
    <PomodoroContainer>
      <IconButton onClick={() => navigate('/profile')} sx={{ position: 'absolute', top: 16, right: 16, color: 'white' }}>
        <SettingsIcon />
      </IconButton>

      <Typography variant="h5" sx={{ color: 'white', marginBottom: 2 }}>
        Pomodoro Timer
      </Typography>

      <ClockFace>
        <ProgressSVG viewBox="0 0 350 350">
          <circle cx="175" cy="175" r={radius} stroke="#ac3e33" strokeWidth="10" fill="transparent" />
          <circle cx="175" cy="175" r={radius} stroke="white" strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </ProgressSVG>
        <TimeDisplay>{formatTime(timeRemaining)}</TimeDisplay>
      </ClockFace>

      <ControlButton onClick={toggleTimer}>
        {isActive ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
      </ControlButton>
    </PomodoroContainer>
  );
}

export default Pomodoro;
