import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from "lottie-react";
import { Box, Paper, Typography, Fade, Slide, Button, Stack, Chip, Divider } from '@mui/material';
import catAnimation from '../../../assets/Cat Movement.json';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningIcon from '@mui/icons-material/Warning';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import { useSettings } from '../context/SettingsContext';
import { useTimer } from '../context/TimerContext';
import { useGamification } from '../context/GamificationContext';

const MESSAGES = [
    "Pamiętaj o wodzie! 💧",
    "Jak tam idzie? 🐾",
    "Może krótka przerwa?",
    "Jesteś w trybie bestii! 🔥",
    "Mruuu...",
    "Trzymam kciuki! 🤞",
    "Skupienie to klucz.",
    "Jeszcze jedno zadanie?",
    "Wyglądasz na zapracowanego."
];

export const AiCompanion = () => {
    const { settings } = useSettings();
    const { tasks, stopTimer } = useTimer();
    const { checkForAchievements, triggerRewardAnimation } = useGamification();
    const navigate = useNavigate();

    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState<'main' | 'distractions' | 'report' | 'suggest' | 'standup'>('main');
    
    const [distractions, setDistractions] = useState<any[]>([]);
    const [reportData, setReportData] = useState<any>(null);
    const [suggestion, setSuggestion] = useState<any>(null);
    const [waterIntake, setWaterIntake] = useState(0);
    const [meditationMinutes, setMeditationMinutes] = useState(0);
    const [stretchingMinutes, setStretchingMinutes] = useState(0);
    const [promptType, setPromptType] = useState<'none' | 'water' | 'meditation' | 'stretching'>('none');
    const [isPriorityMessage, setIsPriorityMessage] = useState(false);
    const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
    
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);

    const opacity = Number(settings.ai_bubble_opacity) || 0.8;
    const isEnabled = settings.enable_ai_assistant !== 'false';

    // Fetch stats on visibility change
    useEffect(() => {
        if (!isEnabled || !isVisible) return;
        const fetchStats = async () => {
            const today = new Date().toISOString().split('T')[0];
            try {
                // @ts-ignore
                const bio = await window.electron.database.getDailyBio(today);
                setWaterIntake(bio.waterIntake || 0);
                setMeditationMinutes(bio.meditationMinutes || 0);
                setStretchingMinutes(bio.stretchingMinutes || 0);
            } catch (e) {}
        };
        fetchStats();
    }, [isEnabled, isVisible]);

    // Handle Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMenuOpen && bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
                closeEverything();
            }
        };
        if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const closeEverything = () => {
        setIsMenuOpen(false);
        setMenuView('main');
        setMessage(null);
        setPromptType('none');
        setIsPriorityMessage(false);
        setShowSnoozeOptions(false);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => setIsVisible(false), 5000);
    };

    // IPC Listeners
    useEffect(() => {
        if (!isEnabled) return;
        
        const handleSummon = () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            setIsPriorityMessage(false);
            setIsVisible(true);
            setIsMenuOpen(true);
            setMenuView('main');
            setPromptType('none');
            setShowSnoozeOptions(false);
            setMessage("Jestem! W czym pomóc?");
        };

        const handleShowMessage = (msg: any) => {
            console.log("[AiCompanion] Received IPC Message:", msg);
            const safeMsg = (typeof msg === 'string') ? msg : String(msg || '');

            if (safeMsg === 'STANDUP_TRIGGER') {
                handleAction('standup_init');
                return;
            }

            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            
            setIsPriorityMessage(true);
            setIsMenuOpen(false);
            setShowSnoozeOptions(false);
            setIsVisible(true);
            setMessage(safeMsg);

            const lowMsg = safeMsg.toLowerCase();
            if (lowMsg.includes("nawodnieniu") || lowMsg.includes("wody")) setPromptType('water');
            else if (lowMsg.includes("ruch") || lowMsg.includes("wyprostuj") || lowMsg.includes("szyję")) setPromptType('stretching');
            else if (lowMsg.includes("mindfulness") || lowMsg.includes("oddech") || lowMsg.includes("medytacji")) setPromptType('meditation');
            else setPromptType('none');
            
            hideTimeoutRef.current = setTimeout(() => {
                if (!isMenuOpen) {
                    setIsVisible(false);
                    setMessage(null);
                    setPromptType('none');
                    setIsPriorityMessage(false);
                }
            }, 20000);
        };

        window.addEventListener('summon-ai-companion', handleSummon);
        // @ts-ignore
        window.electron.ipcRenderer.on('ai-companion:show-message', handleShowMessage);

        return () => {
            window.removeEventListener('summon-ai-companion', handleSummon);
            // @ts-ignore
            window.electron.ipcRenderer.removeListener('ai-companion:show-message', handleShowMessage);
        };
    }, [isEnabled, isMenuOpen]);

    // Random Appearance Loop
    useEffect(() => {
        if (!isEnabled) return;
        const scheduleNextAppearance = () => {
            const nextTime = Math.random() * (45 * 60 * 1000 - 15 * 60 * 1000) + 15 * 60 * 1000;
            return setTimeout(() => {
                if (!isPriorityMessage && !isMenuOpen) triggerAppearance();
                scheduleNextAppearance();
            }, nextTime);
        };
        const timer = scheduleNextAppearance();
        return () => clearTimeout(timer);
    }, [isEnabled, isPriorityMessage, isMenuOpen]);

    const triggerAppearance = async (forceMessage = false) => {
        if (isVisible || isPriorityMessage || !isEnabled) return;
        let msg = null;
        let type: 'none' | 'water' | 'meditation' | 'stretching' = 'none';
        
        const showMessage = forceMessage || Math.random() > 0.6;
        if (showMessage) {
            try {
                const userStr = localStorage.getItem('userId');
                const userId = userStr ? JSON.parse(userStr) : 1;
                // @ts-ignore
                const aiMsg = await window.electron.database.getAiMessage(userId);
                msg = aiMsg || MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            } catch (e) {
                msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            }
        }
        if (!msg && !forceMessage) return;

        setMessage(msg);
        setIsVisible(true);
        setPromptType(type);
        setShowSnoozeOptions(false);

        if (msg) {
             messageTimeoutRef.current = setTimeout(() => {
                if (!isMenuOpen && !isPriorityMessage) setMessage(null);
            }, 3000);
        }
        hideTimeoutRef.current = setTimeout(() => {
            if (!isMenuOpen && !isPriorityMessage) {
                setIsVisible(false);
                setMessage(null);
                setPromptType('none');
            }
        }, 8000);
    };

    const handleLogActivity = async (activity: 'water' | 'meditation' | 'stretching') => {
        const today = new Date().toISOString().split('T')[0];
        try {
            if (activity === 'water') {
                const newVal = waterIntake + 1;
                setWaterIntake(newVal);
                // @ts-ignore
                await window.electron.database.updateDailyBio(today, { waterIntake: newVal });
                setMessage("Super! Tak trzymaj. 🌊");
                if (await checkForAchievements('HEALTH_ACTION')) triggerRewardAnimation('achievement');
            } else if (activity === 'meditation') {
                const activeTask = tasks.find(t => t.startTimer !== null);
                if (activeTask) await stopTimer(activeTask.id);
                navigate('/meditation');
                setIsVisible(false); 
                return;
            } else if (activity === 'stretching') {
                const newVal = stretchingMinutes + 2; 
                setStretchingMinutes(newVal);
                // @ts-ignore
                await window.electron.database.updateDailyBio(today, { stretchingMinutes: newVal });
                setMessage("Ciało Ci podziękuje! 💪");
            }
        } catch(e) {}
        setPromptType('none');
        setIsPriorityMessage(false);
        setTimeout(() => { if (!isMenuOpen) { setIsVisible(false); setMessage(null); } }, 3000);
    };

    const handleSnooze = (minutes: number) => {
        setIsVisible(false);
        setPromptType('none');
        setIsPriorityMessage(false);
        setShowSnoozeOptions(false);
        setTimeout(() => {
            const msg = promptType === 'meditation' ? '🧘‍♀️ Gotowy na medytację?' : 'Gotowy?';
            setIsVisible(true);
            setMessage(msg);
            setPromptType(promptType);
            setIsPriorityMessage(true);
        }, minutes * 60 * 1000);
    };

    const handleSkip = async () => {
        if (promptType === 'meditation') {
            // @ts-ignore
            await window.electron.app.skipMeditation();
        }
        setIsVisible(false);
        setPromptType('none');
        setIsPriorityMessage(false);
        setShowSnoozeOptions(false);
    };

    const handleAction = async (action: string) => {
        const userStr = localStorage.getItem('userId');
        const userId = userStr ? JSON.parse(userStr) : 1;

        switch(action) {
            case 'report':
                setMenuView('report');
                setMessage("Generuję raport...");
                try {
                    // @ts-ignore
                    const data = await window.electron.database.getDailyReportData(userId);
                    setReportData(data);
                    setMessage("Twoje dzisiejsze wyniki:");
                } catch (e) { setMessage("Błąd pobierania raportu."); }
                break;
            case 'standup_init':
                setIsVisible(true);
                setIsMenuOpen(true);
                setMenuView('standup');
                setMessage("Dzień dobry! Oto Twój plan:");
                try {
                    // @ts-ignore
                    const data = await window.electron.database.getDailyStandup(userId);
                    setReportData({ yesterday: data.yesterday }); 
                    setSuggestion({ topSuggestion: data.topSuggestion, challenge: data.challenge });
                } catch (e) { console.error(e); }
                break;
            case 'start_meditation':
                handleLogActivity('meditation');
                break;
            case 'suggest':
                setMenuView('suggest');
                setMessage("Szukam najlepszego zadania...");
                try {
                    // @ts-ignore
                    const data = await window.electron.database.getDailyStandup(userId);
                    setSuggestion({ topSuggestion: data?.topSuggestion });
                    setMessage(data?.topSuggestion ? "Proponuję zająć się tym:" : "Wszystko zrobione!");
                } catch (e) { setMessage("Błąd analizy zadań."); }
                break;
            case 'distractions':
                setMenuView('distractions');
                setMessage("Analizuję Twoje rozpraszacze...");
                try {
                    // @ts-ignore
                    const stats = await window.electron.database.getWebStats(1);
                    const top = stats.topDomains.slice(0, 3).map((d: any) => ({
                        name: d.domain,
                        time: Math.round(d.totalTime / 60000)
                    }));
                    setDistractions(top);
                    setMessage(top.length > 0 ? "Główne pożeracze czasu:" : "Czysto!");
                } catch (e) { setMessage("Błąd danych."); }
                break;
            case 'back':
                setMenuView('main');
                setMessage("W czym mogę Ci dzisiaj pomóc?");
                break;
        }
    };

    const handleCatClick = () => {
        if (isMenuOpen) {
            closeEverything();
        } else {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            setIsPriorityMessage(false);
            setIsMenuOpen(true);
            setMenuView('main');
            setMessage("W czym mogę Ci dzisiaj pomóc?");
        }
    };

    const formatDuration = (ms: number) => {
        const h = Math.floor(ms / (1000 * 60 * 60));
        const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const addWater = async () => {
        const today = new Date().toISOString().split('T')[0];
        const newVal = waterIntake + 1;
        setWaterIntake(newVal);
        try {
            // @ts-ignore
            await window.electron.database.updateDailyBio(today, { waterIntake: newVal });
        } catch(e) {}
        setMessage("Super! Tak trzymaj. 🌊");
        setTimeout(() => { if (!isMenuOpen) setMessage(null); }, 3000);
    };

    if (!isEnabled) return null;

    const bubbleWidth = (menuView === 'standup') ? 360 : (isMenuOpen ? 260 : 'max-content');

    return (
        <Box sx={{ position: 'fixed', bottom: -40, right: 0, zIndex: 10000, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pr: 1 }}>
            <Fade in={isVisible && !!message} timeout={500}>
                <Paper ref={bubbleRef} sx={{
                    mb: 2, mr: 10, p: isMenuOpen ? 2 : 1.5,
                    background: `linear-gradient(135deg, rgba(255, 255, 255, ${opacity}) 0%, rgba(255, 255, 255, ${opacity * 0.6}) 100%)`,
                    backdropFilter: 'saturate(180%) blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    borderRadius: '24px', borderBottomRightRadius: '4px',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
                    width: bubbleWidth, maxWidth: (menuView === 'standup') ? 400 : 280,
                    pointerEvents: 'auto', transition: 'all 0.3s ease'
                }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#023047', display: 'block', mb: (isMenuOpen || promptType !== 'none') ? 1.5 : 0 }}>
                        {message}
                    </Typography>

                    {promptType !== 'none' && !isMenuOpen && !showSnoozeOptions && (
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" color="primary" onClick={() => handleLogActivity(promptType as any)} sx={{ fontSize: '0.7rem' }}>
                                {promptType === 'meditation' ? 'Medytuj' : 'Zrobione!'}
                            </Button>
                            <Button size="small" onClick={() => setShowSnoozeOptions(true)} sx={{ fontSize: '0.7rem' }}>Później...</Button>
                        </Stack>
                    )}

                    {showSnoozeOptions && (
                        <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">Kiedy przypomnieć?</Typography>
                            <Box display="flex" gap={1}>
                                <Button size="small" variant="outlined" onClick={() => handleSnooze(15)} sx={{ fontSize: '0.65rem', minWidth: 0 }}>15m</Button>
                                <Button size="small" variant="outlined" onClick={() => handleSnooze(60)} sx={{ fontSize: '0.65rem', minWidth: 0 }}>1h</Button>
                                <Button size="small" color="error" onClick={handleSkip} sx={{ fontSize: '0.65rem', minWidth: 0 }}>Pomiń</Button>
                            </Box>
                            <Button size="small" onClick={() => setShowSnoozeOptions(false)} sx={{ fontSize: '0.65rem' }}>Anuluj</Button>
                        </Stack>
                    )}

                    {isMenuOpen && menuView === 'main' && (
                        <Stack spacing={1}>
                            {settings.enable_water_reminders === 'true' && (
                                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 0.5, mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">Woda dzisiaj:</Typography>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography variant="caption" fontWeight="bold">{waterIntake} 🥛</Typography>
                                        <Button size="small" sx={{ minWidth: 30, p: 0, height: 20 }} onClick={addWater}>+</Button>
                                    </Box>
                                </Box>
                            )}
                            {(settings.enable_meditation_reminders === 'true' || settings.enable_stretching_reminders === 'true') && (
                                <Box display="flex" justifyContent="space-between" sx={{ px: 0.5, mb: 0.5 }}>
                                    {settings.enable_meditation_reminders === 'true' && <Typography variant="caption" color="text.secondary">🧘‍♀️ {meditationMinutes}m</Typography>}
                                    {settings.enable_stretching_reminders === 'true' && <Typography variant="caption" color="text.secondary">🤸 {stretchingMinutes}m</Typography>}
                                </Box>
                            )}
                            <Button size="small" fullWidth startIcon={<SelfImprovementIcon sx={{ fontSize: 16 }}/>} onClick={() => handleAction('start_meditation')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#023047', fontSize: '0.75rem', py: 0.5 }}>Medytuj teraz</Button>
                            <Button size="small" fullWidth startIcon={<AssignmentIcon sx={{ fontSize: 16 }}/>} onClick={() => handleAction('report')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#023047', fontSize: '0.75rem', py: 0.5 }}>Szybki raport</Button>
                            <Button size="small" fullWidth startIcon={<LightbulbIcon sx={{ fontSize: 16 }}/>} onClick={() => handleAction('suggest')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#023047', fontSize: '0.75rem', py: 0.5 }}>Co teraz robić?</Button>
                            <Button size="small" fullWidth startIcon={<WarningIcon sx={{ fontSize: 16 }}/>} onClick={() => handleAction('distractions')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#023047', fontSize: '0.75rem', py: 0.5 }}>Co mnie rozprasza?</Button>
                        </Stack>
                    )}

                    {isMenuOpen && menuView === 'standup' && reportData && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: '0.7rem', fontWeight: 700 }}>WCZORAJ</Typography>
                                <Box display="flex" justifyContent="space-between"><Typography variant="caption">Zadania:</Typography><Typography variant="caption" fontWeight="bold">{reportData.yesterday?.completedCount || 0}</Typography></Box>
                                <Box display="flex" justifyContent="space-between"><Typography variant="caption">Czas:</Typography><Typography variant="caption" fontWeight="bold">{formatDuration(reportData.yesterday?.totalTimeMs || 0)}</Typography></Box>
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontSize: '0.7rem', fontWeight: 700 }}>DZISIEJSZE WYZWANIE 🎯</Typography>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 300 }}>{suggestion?.challenge?.description || "Brak wyzwania."}</Typography>
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" color="secondary" gutterBottom sx={{ fontSize: '0.7rem', fontWeight: 700 }}>SUGEROWANY START 🚀</Typography>
                                {suggestion?.topSuggestion ? (
                                    <Box bgcolor="rgba(0,0,0,0.03)" p={1} borderRadius={1}>
                                        <Typography variant="body2" fontWeight="bold" noWrap sx={{ fontSize: '0.75rem' }}>{suggestion.topSuggestion.title}</Typography>
                                        <Button size="small" variant="contained" color="secondary" fullWidth sx={{ mt: 1, fontSize: '0.65rem' }} onClick={() => { navigate(`/task/${suggestion.topSuggestion.id}`); closeEverything(); }}>Otwórz</Button>
                                    </Box>
                                ) : <Typography variant="caption">Brak zadań.</Typography>}
                            </Box>
                            <Button size="small" fullWidth onClick={() => closeEverything()} sx={{ mt: 1, textTransform: 'none' }}>Zaczynamy!</Button>
                        </Stack>
                    )}

                    {isMenuOpen && menuView === 'distractions' && (
                        <Stack spacing={1}>
                            {distractions.map((d, i) => (
                                <Box key={i} display="flex" justifyContent="space-between" alignItems="center" sx={{ fontSize: '0.75rem', color: '#023047' }}>
                                    <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>{i+1}. {d.name}</Typography>
                                    <Typography variant="caption" fontWeight="bold">{d.time}m</Typography>
                                </Box>
                            ))}
                            <Button size="small" fullWidth onClick={() => handleAction('back')} sx={{ mt: 1, textTransform: 'none', color: '#023047', fontSize: '0.7rem', opacity: 0.7 }}>← Wróć</Button>
                        </Stack>
                    )}

                    {isMenuOpen && menuView === 'report' && reportData && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                            <Box display="flex" justifyContent="space-between"><Typography variant="caption">Zadania:</Typography><Typography variant="caption" fontWeight="bold">{reportData.completedCount || 0}</Typography></Box>
                            <Box display="flex" justifyContent="space-between"><Typography variant="caption">Czas:</Typography><Typography variant="caption" fontWeight="bold">{formatDuration(reportData.totalTimeMs || 0)}</Typography></Box>
                            <Box display="flex" justifyContent="space-between"><Typography variant="caption">Pomodoro:</Typography><Typography variant="caption" fontWeight="bold">🍅 {reportData.pomodoroCount || 0}</Typography></Box>
                            <Button size="small" fullWidth onClick={() => handleAction('back')} sx={{ mt: 1, textTransform: 'none', fontSize: '0.7rem', opacity: 0.7 }}>← Wróć</Button>
                        </Stack>
                    )}

                    {isMenuOpen && menuView === 'suggest' && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                            {suggestion?.topSuggestion ? (
                                <>
                                    <Typography variant="caption" fontWeight="bold">{suggestion.topSuggestion.title}</Typography>
                                    <Button variant="contained" size="small" color="secondary" onClick={() => navigate(`/task/${suggestion.topSuggestion.id}`)} sx={{ fontSize: '0.65rem' }}>Otwórz zadanie</Button>
                                </>
                            ) : <Typography variant="caption">Brak zadań.</Typography>}
                            <Button size="small" fullWidth onClick={() => handleAction('back')} sx={{ mt: 1, textTransform: 'none', fontSize: '0.7rem', opacity: 0.7 }}>← Wróć</Button>
                        </Stack>
                    )}
                </Paper>
            </Fade>

            <Slide direction="up" in={isVisible} mountOnEnter unmountOnExit timeout={800}>
                <Box onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
                    sx={{ width: 130, height: 130, cursor: 'pointer', pointerEvents: 'auto', transition: 'transform 0.3s ease', transform: isHovered ? 'scale(1.05) translateY(-5px)' : 'scale(1)', filter: 'drop-shadow(0px 5px 10px rgba(0,0,0,0.15))' }}
                    onClick={(e) => { e.stopPropagation(); handleCatClick(); }}>
                    <Lottie animationData={catAnimation} loop={true} />
                </Box>
            </Slide>
        </Box>
    );
};
