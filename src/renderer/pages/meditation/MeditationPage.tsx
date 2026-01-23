import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Fade, Stack } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import StopIcon from '@mui/icons-material/Stop';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import { useSettings } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';

const wave = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(77, 182, 172, 0.4); }
  70% { box-shadow: 0 0 0 30px rgba(77, 182, 172, 0); }
  100% { box-shadow: 0 0 0 0 rgba(77, 182, 172, 0); }
`;

const MeditationPage = () => {
    const { settings } = useSettings();
    const navigate = useNavigate();
    
    const durationMin = Number(settings.meditation_duration) || 10;
    const [timeLeft, setTimeLeft] = useState(durationMin * 60);
    const [isActive, setIsActive] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const progress = (timeLeft / (durationMin * 60)) * 100;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        setIsActive(true);
        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    finishSession();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleStop = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsActive(false);
        setTimeLeft(durationMin * 60);
    };

    const finishSession = async () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsActive(false);
        
        const userStr = localStorage.getItem('userId');
        const userId = userStr ? JSON.parse(userStr) : 1;
        
        // @ts-ignore
        await window.electron.app.completeMeditation(userId, durationMin);
        navigate('/');
    };

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const waveColor = '#4db6ac'; 
    const waveColorLight = '#80cbc4';

    return (
        <Fade in={true} timeout={1000}>
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(circle, #f0fdfa 0%, #ffffff 100%)',
                    textAlign: 'center',
                    overflow: 'hidden',
                    zIndex: 10,
                    pt: 4 // Dodatkowy odstęp od góry
                }}
            >
                <SelfImprovementIcon sx={{ fontSize: 60, color: '#00695c', mb: 2, opacity: 0.6 }} />
                
                <Typography variant="h4" sx={{ fontWeight: 200, color: '#004d40', mb: 4, letterSpacing: 2 }}>
                    {isActive ? 'ODDYCHAJ...' : 'MINDFULNESS'}
                </Typography>

                {/* Liquid Container */}
                <Box
                    sx={{
                        width: 280,
                        height: 280,
                        borderRadius: '50%',
                        border: '6px solid rgba(0, 150, 136, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundColor: 'white',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
                        animation: isActive ? `${pulse} 3s infinite` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 6
                    }}
                >
                    {/* Liquid Wave */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: `${progress}%`,
                            left: '-50%',
                            width: '200%',
                            height: '200%',
                            backgroundColor: waveColor,
                            borderRadius: '42%',
                            opacity: 0.6,
                            animation: isActive ? `${wave} 8s linear infinite` : 'none',
                            transition: 'top 1s ease-in-out, background-color 1s ease'
                        }}
                    />
                    <Box
                        sx={{
                            position: 'absolute',
                            top: `${progress}%`,
                            left: '-55%',
                            width: '200%',
                            height: '200%',
                            backgroundColor: waveColorLight,
                            borderRadius: '40%',
                            opacity: 0.3,
                            animation: isActive ? `${wave} 12s linear infinite` : 'none',
                            transition: 'top 1s ease-in-out, background-color 1s ease'
                        }}
                    />

                    {/* Time Text */}
                    <Box sx={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
                        <Typography variant="h2" sx={{ fontWeight: 100, color: progress > 50 ? '#004d40' : '#00695c', transition: 'color 1s' }}>
                            {formatTime(timeLeft)}
                        </Typography>
                    </Box>
                </Box>

                {!isActive ? (
                    <Stack spacing={2} alignItems="center">
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mb: 2 }}>
                            Znajdź spokojne miejsce i zamknij oczy.
                        </Typography>
                        <Button 
                            variant="contained" 
                            size="large" 
                            onClick={handleStart}
                            sx={{ 
                                borderRadius: 50, 
                                px: 6, py: 2, 
                                bgcolor: '#009688',
                                color: 'white',
                                boxShadow: '0 4px 14px 0 rgba(0,150,136,0.39)',
                                '&:hover': { bgcolor: '#00796b' }
                            }}
                        >
                            Zacznij
                        </Button>
                    </Stack>
                ) : (
                    <Button 
                        variant="text" 
                        color="error" 
                        onClick={handleStop}
                        sx={{ opacity: 0.6 }}
                    >
                        Anuluj sesję
                    </Button>
                )}
            </Box>
        </Fade>
    );
};

export default MeditationPage;