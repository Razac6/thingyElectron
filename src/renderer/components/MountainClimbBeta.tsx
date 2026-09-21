import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  keyframes,
  Button,
  Fade,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import TerrainIcon from '@mui/icons-material/Terrain';
import RefreshIcon from '@mui/icons-material/Refresh';
import FlagIcon from '@mui/icons-material/Flag';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import UmbrellaIcon from '@mui/icons-material/Umbrella';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useSettings } from '../context/SettingsContext';
import { useTimer } from '../context/TimerContext';
import { startNewExpedition } from '../services/DatabaseService';
import { getSprints } from '../services/SprintService';

// --- Animations ---
const drift = keyframes`
  from { transform: translate3d(-200px, 0, 0); }
  to { transform: translate3d(600px, 0, 0); }
`;

const rainAnim = keyframes`
  0% { transform: translateY(-20px) rotate(15deg); opacity: 0; }
  50% { opacity: 0.8; }
  100% { transform: translateY(300px) rotate(15deg); opacity: 0; }
`;

const lightning = keyframes`
  0%, 95%, 98% { opacity: 0; }
  96%, 99% { opacity: 0.8; }
`;

const blizzardAnim = keyframes`
  0% { transform: translate(50px, -20px); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(-150px, 320px); opacity: 0; }
`;

const sunGlow = keyframes`
  0% { transform: scale(1); filter: drop-shadow(0 0 10px #ffb703); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 25px #fb8500); }
  100% { transform: scale(1); filter: drop-shadow(0 0 10px #ffb703); }
`;

const pulse = keyframes`
  0% { transform: scale(1); filter: drop-shadow(0 0 2px #ffb703); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 8px #ffb703); }
  100% { transform: scale(1); filter: drop-shadow(0 0 2px #ffb703); }
`;

export default function MountainClimbBeta() {
  const { totalSpendTimeToday, tasks, refreshData } = useTimer();
  const { settings } = useSettings();
  const [sessionElapsed, setSessionElapsed] = React.useState(0);
  const [manualWeather, setManualWeather] = useState<
    'auto' | 'sunny' | 'cloudy' | 'rainy' | 'stormy'
  >('auto');
  const [activeSprint, setActiveSprint] = useState<any>(null);

  useEffect(() => {
    const fetchSprint = async () => {
      try {
        const sprints = await getSprints();
        const active = sprints.find((s: any) => s.status === 'ACTIVE');
        setActiveSprint(active);
      } catch (e) {
        console.error('Failed to fetch sprint for mountain climb', e);
      }
    };
    fetchSprint();
  }, []);

  const activeTask = useMemo(
    () =>
      tasks.find((t) => {
        if (!t.startTimer) return false;
        const st = String(t.startTimer).trim().toLowerCase();
        return st !== 'null' && st !== '' && st !== 'undefined';
      }),
    [tasks],
  );

  const isRunning = !!activeTask;

  // Real-time update for the climber
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && activeTask?.startTimer) {
      const start =
        Number(activeTask.startTimer) ||
        new Date(activeTask.startTimer as string).getTime();
      const tick = () => {
        if (!Number.isNaN(start) && start > 0) {
          setSessionElapsed(Date.now() - start);
        }
      };
      tick();
      interval = setInterval(tick, 1000);
    } else {
      setSessionElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeTask?.startTimer]);

  // 1. Expedition State
  const expedition = useMemo(() => {
    try {
      return settings?.current_expedition
        ? JSON.parse(settings.current_expedition)
        : { seed: 0.5, targetMinutes: 240 };
    } catch (e) {
      return { seed: 0.5, targetMinutes: 240 };
    }
  }, [settings?.current_expedition]);

  // --- Logic Selection: Sprint vs Daily ---
  const sprintTasks = useMemo(() => {
    if (!activeSprint) return [];
    // Filter sprint tasks and preserve order from tasks array (which is already sorted)
    const filtered = tasks.filter((t) => t.sprintId === activeSprint.id);
    // Ensure order: Completed first (in their order), then In Progress, then To Do
    return filtered.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        Completed: 0,
        'In Progress': 1,
        'To Do': 2,
      };
      const aOrder = statusOrder[a.status] ?? 3;
      const bOrder = statusOrder[b.status] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Keep original order within same status
      return tasks.indexOf(a) - tasks.indexOf(b);
    });
  }, [tasks, activeSprint]);

  const useSprintLogic = activeSprint && sprintTasks.length > 0;

  const targetMinutes = useSprintLogic
    ? sprintTasks.reduce((acc, t) => acc + (t.estimate || 1) * 60, 0)
    : expedition.targetMinutes || 240;

  // --- NEW LOGIC: Calculate progress based on task order and completion ---
  const earnedMinutes = useMemo(() => {
    if (useSprintLogic) {
      let earned = 0;
      sprintTasks.forEach((t) => {
        const taskEstMinutes = (t.estimate || 1) * 60;

        if (t.status === 'Completed') {
          earned += taskEstMinutes;
        } else if (activeTask && t.id === activeTask.id) {
          const spentMinutes =
            (t.spendTime || 0) / (1000 * 60) + sessionElapsed / (1000 * 60);
          // Kropka może dojść do checkpointa (100% estimate) ale nie dalej
          earned += Math.min(spentMinutes, taskEstMinutes);
        }
        // If not completed and not active, it contributes 0 to progress.
      });
      return earned;
    }
    return (totalSpendTimeToday + sessionElapsed) / (1000 * 60);
  }, [
    useSprintLogic,
    sprintTasks,
    activeTask,
    sessionElapsed,
    totalSpendTimeToday,
  ]);

  const globalProgress = Math.min(1, earnedMinutes / targetMinutes);
  const altitude = Math.round(globalProgress * targetMinutes * 16.6); // Altitude based on progress

  const isSummitReached =
    globalProgress >= 1 ||
    (useSprintLogic && sprintTasks.every((t) => t.status === 'Completed'));

  // Weather System
  const weather = useMemo(() => {
    if (manualWeather !== 'auto') {
      return {
        isSunny: manualWeather === 'sunny',
        isPartlyCloudy: manualWeather === 'cloudy',
        isRainy: manualWeather === 'rainy',
        isStormy: manualWeather === 'stormy',
      };
    }
    const seed = expedition.seed || 0.5;
    const wave1 = Math.sin((globalProgress * targetMinutes) / 20 + seed * 100);
    const wave2 = Math.sin((globalProgress * targetMinutes) / 45 + seed * 50);
    const val = (wave1 * 0.7 + wave2 * 0.3 + 1) * 50;
    return {
      isSunny: val >= 65,
      isPartlyCloudy: val >= 45 && val < 65,
      isRainy: val >= 25 && val < 45,
      isStormy: val < 25,
    };
  }, [expedition.seed, globalProgress, targetMinutes, manualWeather]);

  const getBackground = () => {
    if (weather.isStormy)
      return 'linear-gradient(180deg, #1a2a33 0%, #334d5c 100%)';
    if (weather.isRainy)
      return 'linear-gradient(180deg, #4b5d67 0%, #2c3e50 100%)';
    if (weather.isPartlyCloudy)
      return 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)';
    return 'linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)';
  };

  const handleStartNew = async () => {
    await startNewExpedition();
    await refreshData();
  };

  if (!settings || settings.mountain_climb_enabled === 'false') return null;

  if (isSummitReached && !isRunning) {
    return (
      <Fade in>
        <Box
          sx={{
            width: '100%',
            height: '320px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#023047',
            color: 'white',
            textAlign: 'center',
            p: 3,
            borderRadius: '16px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <EmojiEventsIcon sx={{ fontSize: 60, color: '#ffb703' }} />
            <FlagIcon sx={{ fontSize: 40, color: '#ffb703' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            SUMMIT REACHED!
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mb: 3 }}>
            Conquered in {Math.round(earnedMinutes)}m.
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleStartNew}
            sx={{
              bgcolor: '#fb8500',
              fontWeight: 900,
              px: 4,
              borderRadius: '12px',
            }}
          >
            START NEW
          </Button>
        </Box>
      </Fade>
    );
  }

  // --- SUB-COMPONENT: Full Mountain View ---
  function MountainView() {
    // Procedural Scenery Generation with controlled peaks
    const getMountainPoints = (
      seed: number,
      heightBase: number,
      variance: number,
      peaks: number,
    ) => {
      const pts = [{ x: -400, y: 150 }];
      for (let i = -2; i <= peaks + 2; i++) {
        const x = (i / peaks) * 400;
        const noise =
          Math.sin(i * seed * 12) * variance +
          Math.cos(i * seed * 23) * (variance / 2);
        let y = heightBase + noise;

        // Force the peak just before the end to be the absolute highest (the summit)
        if (i === peaks - 1) {
          y = 20;
        }

        pts.push({ x, y });
      }
      pts.push({ x: 800, y: 150 });
      return pts;
    };

    // Reduced peaks for a cleaner, more majestic look
    const frontPoints = useMemo(
      () => getMountainPoints(expedition.seed || 0.5, 70, 20, 6),
      [expedition.seed],
    );
    const backPoints = useMemo(
      () => getMountainPoints((expedition.seed || 0.5) + 0.1, 80, 15, 5),
      [expedition.seed],
    );

    const mountainFront = useMemo(
      () => `M${frontPoints.map((p) => `${p.x},${p.y}`).join(' L')} Z`,
      [frontPoints],
    );
    const mountainBack = useMemo(
      () => `M${backPoints.map((p) => `${p.x},${p.y}`).join(' L')} Z`,
      [backPoints],
    );

    // Automatically find the exact coordinate of the highest peak we forced earlier
    const summitPoint = useMemo(
      () => frontPoints.find((p) => p.y === 20) || { x: 333, y: 20 },
      [frontPoints],
    );

    const getPosOnMountain = (prog: number) => {
      const startX = 20;
      const endX = summitPoint.x;
      const currentX = startX + prog * (endX - startX);

      for (let i = 0; i < frontPoints.length - 1; i++) {
        const p1 = frontPoints[i];
        const p2 = frontPoints[i + 1];
        if (currentX >= p1.x && currentX <= p2.x) {
          const t = (currentX - p1.x) / (p2.x - p1.x);
          const currentY = p1.y + t * (p2.y - p1.y);
          return { x: currentX, y: currentY };
        }
      }
      return { x: currentX, y: 20 };
    };

    const { x: dotX, y: dotY } = getPosOnMountain(globalProgress);

    const checkpoints = useMemo(() => {
      if (useSprintLogic) {
        let cumulativeEst = 0;
        return sprintTasks.map((t, idx) => {
          cumulativeEst += (t.estimate || 1) * 60;
          const p = cumulativeEst / targetMinutes;
          const pos = getPosOnMountain(p);
          return { ...pos, task: t, isLast: idx === sprintTasks.length - 1 };
        });
      }
      const todoTasks = tasks
        .filter((t) => t.status !== 'Completed')
        .slice(0, 5);
      return todoTasks.map((t, idx) => {
        const p = ((idx + 1) / (todoTasks.length + 1)) * 0.8;
        const pos = getPosOnMountain(p);
        return { ...pos, task: t, isLast: idx === todoTasks.length - 1 };
      });
    }, [useSprintLogic, sprintTasks, tasks, targetMinutes, frontPoints]);

    return (
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
          zIndex: 1,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 -40 400 160"
          preserveAspectRatio="xMidYMax meet"
          style={{ overflow: 'visible' }}
        >
          <path d={mountainBack} fill="#219ebc" opacity="0.3" />
          <path d={mountainFront} fill="#023047" />

          {/* Checkpoints (Dots) */}
          {checkpoints.map((cp, idx) => {
            const isCompleted = cp.task.status === 'Completed';
            const isActive = activeTask && cp.task.id === activeTask.id;

            // Check if active task is overtime
            const isOvertime =
              isActive && activeTask
                ? (activeTask.spendTime || 0) / 1000 + sessionElapsed / 1000 >
                  (activeTask.estimate || 1) * 3600
                : false;

            // Don't draw a grey dot if it's the very last task (the summit flag covers it)
            if (cp.isLast) return null;

            return (
              <circle
                key={idx}
                cx={cp.x}
                cy={cp.y}
                r={isActive ? 6 : 4}
                fill={
                  isCompleted
                    ? '#4caf50'
                    : isOvertime
                      ? '#ef476f'
                      : isActive
                        ? '#ffb703'
                        : '#bdbdbd'
                }
                opacity={isCompleted ? 0.8 : isActive ? 1 : 0.6}
                stroke={isActive ? 'white' : 'none'}
                strokeWidth={isActive ? 1.5 : 0}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <title>
                  {isOvertime
                    ? `⚠️ ${cp.task.title} (przekroczono estimate)`
                    : cp.task.title}
                </title>
              </circle>
            );
          })}

          {/* Summit Goal (Yellow) exactly on the peak */}
          <FlagIconSVG
            x={summitPoint.x + 2}
            y={summitPoint.y - 3}
            color="#ffb703"
            size={8}
            isSummit
          />

          {/* Player Tent */}
          <TentSVG x={dotX} y={dotY} />
        </svg>
      </Box>
    );
  }

  // --- SUB-COMPONENT: Task Path View (Focus Mode) ---
  function TaskPathView() {
    if (!activeTask) return null;

    // Calculate progress of JUST this task
    const taskTargetSeconds = (activeTask.estimate || 1) * 3600;
    const taskSpentSeconds =
      (activeTask.spendTime || 0) / 1000 + sessionElapsed / 1000;
    const taskProgress = Math.min(1, taskSpentSeconds / taskTargetSeconds);
    const isOvertime = taskSpentSeconds > taskTargetSeconds;

    // Smooth, natural slope for the task
    const startX = 20;
    const startY = 100;
    const endX = 360;
    const endY = 30;
    const controlX = 180;
    const controlY = 110;

    const getBezierPoint = (t: number) => {
      const x =
        (1 - t) ** 2 * startX + 2 * (1 - t) * t * controlX + t ** 2 * endX;
      const y =
        (1 - t) ** 2 * startY + 2 * (1 - t) * t * controlY + t ** 2 * endY;
      return { x, y };
    };

    const { x: playerX, y: playerY } = getBezierPoint(taskProgress);

    // Extended paths for ultra-wide screen support
    const bgPathD = `M-400,150 L-400,80 L0,80 L100,50 L200,80 L300,40 L400,90 L800,90 L800,150 Z`;
    const fgPathD = `M-400,150 L-400,120 L${startX},${startY} Q${controlX},${controlY} ${endX},${endY} L800,${endY + 10} L800,150 Z`;

    return (
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
          zIndex: 1,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 -40 400 160"
          preserveAspectRatio="xMidYMax meet"
          style={{ overflow: 'visible' }}
        >
          {/* Distant mountains for depth */}
          <path d={bgPathD} fill="#219ebc" opacity="0.2" />

          {/* Task Slope */}
          <path d={fgPathD} fill="#023047" />

          {/* Task Goal Flag with clean native SVG text label */}
          <FlagIconSVG
            x={endX + 3.5}
            y={endY - 6}
            color="#fb8500"
            size={14}
            title={activeTask.title}
          />

          {/* Player climbing dot glow effect */}
          <circle
            cx={playerX}
            cy={playerY}
            fill={isOvertime ? '#ef476f' : '#ffb703'}
          >
            <animate
              attributeName="r"
              from="4"
              to="20"
              dur="2.5s"
              begin="0s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.6"
              to="0"
              dur="2.5s"
              begin="0s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Actual Player climbing dot */}
          <circle
            cx={playerX}
            cy={playerY}
            r={4}
            fill={isOvertime ? '#ef476f' : '#ffb703'}
            stroke="white"
            strokeWidth={1}
          >
            {isOvertime && <title>⚠️ Przekroczono estimate!</title>}
          </circle>
        </svg>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '320px',
        position: 'relative',
        overflow: 'hidden',
        background: getBackground(),
        transition: 'background 1s ease',
        borderRadius: '16px',
      }}
    >
      {/* Weather UI */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(0,0,0,0.2)',
          borderRadius: '20px',
          px: 1,
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <FormControl variant="standard" sx={{ m: 0, minWidth: 40 }}>
          <Select
            value={manualWeather}
            onChange={(e) => setManualWeather(e.target.value as any)}
            displayEmpty
            disableUnderline
            sx={{
              color: 'white',
              fontSize: '0.8rem',
              '.MuiSelect-select': {
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
              },
              '.MuiSvgIcon-root': { color: 'white', fontSize: '1.2rem' },
            }}
            renderValue={(value) => {
              switch (value) {
                case 'sunny':
                  return <WbSunnyIcon sx={{ fontSize: 16 }} />;
                case 'cloudy':
                  return <CloudIcon sx={{ fontSize: 16 }} />;
                case 'rainy':
                  return <UmbrellaIcon sx={{ fontSize: 16 }} />;
                case 'stormy':
                  return <ThunderstormIcon sx={{ fontSize: 16 }} />;
                default:
                  return <AutoAwesomeIcon sx={{ fontSize: 14 }} />;
              }
            }}
          >
            <MenuItem value="auto">
              <AutoAwesomeIcon sx={{ mr: 1, fontSize: 16 }} /> Auto
            </MenuItem>
            <MenuItem value="sunny">
              <WbSunnyIcon sx={{ mr: 1, fontSize: 16, color: '#ffb703' }} />{' '}
              Sunny
            </MenuItem>
            <MenuItem value="cloudy">
              <CloudIcon sx={{ mr: 1, fontSize: 16, color: '#8ecae6' }} />{' '}
              Cloudy
            </MenuItem>
            <MenuItem value="rainy">
              <UmbrellaIcon sx={{ mr: 1, fontSize: 16, color: '#219ebc' }} />{' '}
              Rainy
            </MenuItem>
            <MenuItem value="stormy">
              <ThunderstormIcon
                sx={{ mr: 1, fontSize: 16, color: '#023047' }}
              />{' '}
              Stormy
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      {weather.isSunny && (
        <Box
          sx={{
            position: 'absolute',
            top: 40,
            right: 60,
            animation: `${sunGlow} 4s infinite ease-in-out`,
            zIndex: 0,
            opacity: isRunning ? 0.2 : 1,
            transition: 'opacity 0.5s',
          }}
        >
          <SunSVG />
        </Box>
      )}

      {(weather.isPartlyCloudy || weather.isRainy || weather.isStormy) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              left: 0,
              animation: `${drift} 15s infinite linear`,
              zIndex: 0,
              opacity: 0.3,
            }}
          >
            <CloudSVG size={100} />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: 60,
              left: 0,
              animation: `${drift} 25s infinite linear`,
              animationDelay: '-5s',
              zIndex: 0,
              opacity: 0.15,
            }}
          >
            <CloudSVG size={70} />
          </Box>
        </Box>
      )}

      {weather.isRainy &&
        [...Array(15)].map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: -20,
              left: `${Math.random() * 100}%`,
              width: '1px',
              height: '12px',
              bgcolor: 'rgba(255,255,255,0.4)',
              animation: `${rainAnim} ${0.5 + Math.random() * 0.5}s infinite linear`,
              animationDelay: `${Math.random()}s`,
              zIndex: 1,
            }}
          />
        ))}

      {weather.isStormy && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'white',
            animation: `${lightning} 5s infinite`,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      )}

      {weather.isStormy &&
        [...Array(40)].map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: -20,
              left: `${Math.random() * 120}%`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              bgcolor: 'white',
              borderRadius: '50%',
              filter: 'blur(1px)',
              animation: `${blizzardAnim} ${0.5 + Math.random() * 0.5}s infinite linear`,
              animationDelay: `${Math.random() * 2}s`,
              zIndex: 1,
            }}
          />
        ))}

      {/* --- Info UI --- */}
      <Box
        sx={{
          p: 2,
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          color: '#fff',
          pointerEvents: 'none',
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{
              fontWeight: 800,
              fontSize: '0.6rem',
              letterSpacing: '0.05rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: 0.7,
            }}
          >
            <TerrainIcon sx={{ fontSize: 12 }} /> ALTITUDE
          </Typography>
          <Typography
            sx={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1 }}
          >
            {altitude}m
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography
            variant="overline"
            sx={{
              fontWeight: 800,
              fontSize: '0.6rem',
              display: 'block',
              opacity: 0.7,
            }}
          >
            {isRunning
              ? `${activeTask?.title?.substring(0, 15)}...`
              : weather.isStormy
                ? 'STORM'
                : weather.isRainy
                  ? 'RAIN'
                  : 'READY'}
          </Typography>
          <Typography
            sx={{
              color: '#ffb703',
              fontWeight: 900,
              fontSize: '1.2rem',
              lineHeight: 1,
            }}
          >
            {Math.round(globalProgress * 100)}%
          </Typography>
        </Box>
      </Box>

      {/* Dynamic View Logic */}
      <Fade in={!isRunning} timeout={800}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: isRunning ? 'none' : 'auto',
          }}
        >
          <MountainView />
        </Box>
      </Fade>

      <Fade in={isRunning} timeout={800}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: !isRunning ? 'none' : 'auto',
          }}
        >
          <TaskPathView />
        </Box>
      </Fade>
    </Box>
  );
}

function FlagIconSVG({ x, y, color, size, title, isSummit }: any) {
  const iconSize = size;
  const offset = iconSize / 2;

  return (
    <g
      transform={`translate(${x - offset}, ${y - offset})`}
      style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
    >
      {title && (
        <text
          x={offset}
          y={-10}
          textAnchor="middle"
          fill="white"
          fontSize={isSummit ? '8' : '7'}
          fontWeight="bold"
          style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
        >
          {title.length > 15 ? `${title.substring(0, 15)}...` : title}
        </text>
      )}
      <path
        d="M12.45 4H4.5v18.5h2V14H11l.55 2H21V6h-8l-.55-2z"
        fill={color}
        transform={`scale(${iconSize / 24})`}
        style={{
          filter: `drop-shadow(0 0 4px ${color})`,
          animation: title ? `${pulse} 2s infinite` : 'none',
        }}
      />
    </g>
  );
}

function SunSVG() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#ffb703">
      <circle cx="12" cy="12" r="6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="11"
          y="1"
          width="2"
          height="4"
          rx="1"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

function CloudSVG({ size = 60 }) {
  return (
    <svg width={size} height={size / 2} viewBox="0 0 24 24" fill="white">
      <path d="M17.5,19c-3,0-5.5-2.5-5.5-5.5c0-0.03,0-0.07,0-0.1C11.5,13.2,11,13,10.5,13c-1.4,0-2.5,1.1-2.5,2.5c0,0.1,0,0.2,0,0.3C6.8,16.3,6,17.5,6,19c0,1.7,1.3,3,3,3h8.5c1.9,0,3.5-1.6,3.5-3.5S19.4,15,17.5,15z" />
    </svg>
  );
}

function TentSVG({ x, y }: any) {
  const size = 24;
  return (
    <g transform={`translate(${x - size / 2}, ${y - size / 2})`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#fb8500">
        <path d="M12 4L2 21h20L12 4z" stroke="#023047" strokeWidth="1.2" />
        <path d="M12 4L8 21h8L12 4z" fill="#ffb703" opacity="0.8" />
        <path d="M11 17L12 21L13 17" fill="#023047" />
      </svg>
    </g>
  );
}
