import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from './SettingsContext';
import { useGamification } from './GamificationContext';
import { Task } from '../../interfaces/task.interface';
import {
  fetchData as fetchTasks,
  updateTask as updateTaskService,
  logWorkSession as logWorkSessionService,
  getDailyProductivity,
  getContributionData,
  getHourlyProductivity,
  getProductivityInsights,
  getDailyChallenge,
  createTask as createTaskService,
  deleteTask as deleteTaskService,
  getDailyBio,
} from '../services/DatabaseService';
import { StatusEnum } from '../../enums/status.enum';

interface DailyProgressEntry {
  date: string;
  totalDuration: number;
}

interface AnalysisResult {
  peakHours: number[];
  peakHourRange: string;
  fatigueProfile: {
    averageSession: number;
    maxRecommended: number;
    isFatigued: boolean;
  };
  trend: {
    slope: number;
    direction: 'increasing' | 'decreasing' | 'stable';
    description: string;
  };
  focusScore: {
    score: number;
    deepWorkMinutes: number;
    longestSessionToday: number;
  };
  tagConsistency: {
    consistent: string[];
    volatile: string[];
  };
  dailyTip?: string;
  dailyTipCategory?: 'high' | 'low' | 'neutral' | 'focus';
  habitCorrelation?: { impact: number; message: string } | null;
}

interface DailyChallenge {
  id: number;
  type: string;
  target: number;
  progress: number;
  description: string;
  xpReward: number;
  status: 'ACTIVE' | 'COMPLETED';
}

export interface IdlePromptState {
  isOpen: boolean;
  idleTimeMs: number;
  taskId: number;
  taskTitle: string;
  originalStartTime: number;
}

const getWorkdayISO = () => {
  const now = new Date();
  if (now.getHours() < 4) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface TimerContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  updateTask: (updatedData: Partial<Task> & { id: number }) => Promise<void>;
  createTask: (newTask: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: number) => Promise<void>;
  startTimer: (taskId: number, mode?: 'normal' | 'pomodoro') => Promise<void>;
  stopTimer: (taskId: number) => Promise<void>;
  isLoading: boolean;
  productivityData: DailyProgressEntry[];
  isLoadingProductivity: boolean;
  contributionData: any[];
  isLoadingContribution: boolean;
  hourlyProductivity: any[];
  insights: AnalysisResult | null;
  dailyChallenge: DailyChallenge | null;
  totalSpendTimeToday: number;
  refreshData: () => Promise<void>;
  idlePrompt: IdlePromptState | null;
  handleKeepIdleTime: () => void;
  handleDiscardIdleTime: () => Promise<void>;
  isBoostMode: boolean;
  toggleBoostMode: (forceState?: boolean) => void;
  dailyMode: string;
  setDailyMode: (mode: string) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productivityData, setProductivityData] = useState<
    DailyProgressEntry[]
  >([]);
  const [isLoadingProductivity, setIsLoadingProductivity] = useState(true);
  const [contributionData, setContributionData] = useState<any[]>([]);
  const [isLoadingContribution, setIsLoadingContribution] = useState(true);
  const [hourlyProductivity, setHourlyProductivity] = useState<any[]>([]);
  const [insights, setInsights] = useState<AnalysisResult | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(
    null,
  );
  const [totalSpendTimeToday, setTotalSpendTimeToday] = useState(0);
  const [idlePrompt, setIdlePrompt] = useState<IdlePromptState | null>(null);
  const [isBoostMode, setIsBoostMode] = useState(false);
  const [dailyMode, setDailyMode] = useState('normal');
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { checkForAchievements, triggerRewardAnimation } = useGamification();

  const toggleBoostMode = (forceState?: boolean) => {
    setIsBoostMode((prev) => (forceState !== undefined ? forceState : !prev));
  };

  const tasksRef = React.useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const handleIdle = () => {
      const currentTasks = tasksRef.current;
      const activeTask = currentTasks.find((t) => t.startTimer);

      if (activeTask && activeTask.startTimer) {
        const IDLE_THRESHOLD = 10 * 60 * 1000;
        setIdlePrompt({
          isOpen: true,
          idleTimeMs: IDLE_THRESHOLD,
          taskId: activeTask.id,
          taskTitle: activeTask.title,
          originalStartTime: Number(activeTask.startTimer),
        });
        new Notification('💤 Idle Detected', {
          body: 'Are you still working? Click to confirm.',
        });
      }
    };

    const unsubIdle = window.electron.ipcRenderer.on(
      'activity:idle-detected',
      handleIdle,
    );

    // Listener for notification action "Stop Timer"
    const handleStopRequest = () => {
      const currentTasks = tasksRef.current;
      const activeTask = currentTasks.find((t) => t.startTimer);
      if (activeTask) {
        stopTimer(activeTask.id);
        const userStr = localStorage.getItem('userId');
        if (userStr) {
          const userId = JSON.parse(userStr);
          // @ts-ignore
          window.electron.rewardFatigueCompliance(userId);
        }
      }
    };
    const unsubStop = window.electron.ipcRenderer.on(
      'timer:stop-requested',
      handleStopRequest,
    );

    // Refresh data on gamification events
    const handleGamificationUpdate = () => {
      fetchAllData();
    };
    const unsubGame = window.electron.ipcRenderer.on(
      'gamification:check',
      handleGamificationUpdate,
    );

    // Auto-refresh on new day
    const unsubDay = window.electron.ipcRenderer.on('app:day-changed', () => {
      console.log('Day changed detected. Refreshing data...');
      fetchAllData();
    });

    // Cleanup
    return () => {
      if (unsubIdle) unsubIdle();
      if (unsubStop) unsubStop();
      if (unsubGame) unsubGame();
      if (unsubDay) unsubDay();
    };
  }, []); // Mount once

  // Context-Aware Notifications - Check every 10 minutes
  useEffect(() => {
    const userStr = localStorage.getItem('userId');
    if (!userStr) return;
    const userId = JSON.parse(userStr);

    // Initial check after 1 minute
    const initialTimer = setTimeout(() => {
      window.electron.database
        .checkContextNotifications(userId)
        .catch(console.error);
    }, 60000);

    // Periodic check every 10 minutes
    const notificationInterval = setInterval(
      () => {
        window.electron.database
          .checkContextNotifications(userId)
          .catch(console.error);
      },
      10 * 60 * 1000,
    );

    return () => {
      clearTimeout(initialTimer);
      clearInterval(notificationInterval);
    };
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    setIsLoadingProductivity(true);
    setIsLoadingContribution(true);
    try {
      const userStr = localStorage.getItem('userId');
      const userId = userStr ? JSON.parse(userStr) : 1;
      const todayISO = getWorkdayISO();

      // @ts-ignore
      const rawInsights = await getProductivityInsights(userId);
      // @ts-ignore
      const dailyDeep = await window.electron.database.getDailyDeepWork(userId);

      // Merge daily deep work into insights for dashboard display
      const combinedInsights = rawInsights
        ? {
            ...rawInsights,
            focusScore: {
              score: dailyDeep.score,
              deepWorkMinutes: dailyDeep.duration,
              longestSessionToday: dailyDeep.longestSession,
            },
          }
        : null;

      const [taskData, prodData, contData, hourlyData, challengeData, bioData] =
        await Promise.all([
          fetchTasks(navigate),
          getDailyProductivity(),
          getContributionData(Number(settings.activityGraphDays) || 365),
          getHourlyProductivity(),
          getDailyChallenge(),
          getDailyBio(todayISO),
        ]);

      const sortedTasks = (taskData || []).sort(
        (a: Task, b: Task) => (a.displayOrder || 0) - (b.displayOrder || 0),
      );
      setTasks(sortedTasks);
      setProductivityData(prodData || []);
      setContributionData(contData || []);
      setHourlyProductivity(hourlyData || []);
      setInsights(combinedInsights);
      setDailyChallenge(challengeData);
      if (bioData) setDailyMode(bioData.mode);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
      setIsLoadingProductivity(false);
      setIsLoadingContribution(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [settings.activityGraphDays]);

  useEffect(() => {
    const todayISO = getWorkdayISO();
    const todayData = productivityData.find((d) => d.date === todayISO);
    setTotalSpendTimeToday(todayData?.totalDuration || 0);
  }, [productivityData]);

  useEffect(() => {
    const activeTask = tasks.find((task) => task.startTimer !== null);
    if (activeTask && activeTask.startTimer) {
      const userStr = localStorage.getItem('userId');
      const userId = userStr ? JSON.parse(userStr) : undefined;

      window.electron.ipcRenderer.send('tray:start-timer', {
        title: activeTask.title,
        startTime: activeTask.startTimer,
        estimate: activeTask.estimate || 0,
        initialSpendTime: activeTask.spendTime || 0,
        userId,
      });
    } else {
      window.electron.ipcRenderer.send('tray:stop-timer');
    }
    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.electron.ipcRenderer.send('tray:create');
      } else {
        window.electron.ipcRenderer.send('tray:destroy');
      }
    };
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.electron.ipcRenderer.send('tray:destroy');
    };
  }, [tasks, navigate]);

  const updateTask = useCallback(
    async (updatedData: Partial<Task> & { id: number }) => {
      try {
        await updateTaskService(updatedData);

        // Optimistic update: update local state immediately
        setTasks((prev) =>
          prev.map((t) =>
            t.id === updatedData.id ? { ...t, ...updatedData } : t,
          ),
        );

        // Only refetch productivity if task was completed
        if (updatedData.status === StatusEnum.COMPLETED) {
          const prodData = await getDailyProductivity();
          setProductivityData(prodData || []);

          // Also refresh insights and challenge as they depend on completed tasks
          const [insightsData, challengeData] = await Promise.all([
            getProductivityInsights(),
            getDailyChallenge(),
          ]);
          setInsights(insightsData);
          setDailyChallenge(challengeData);
        }
      } catch (error) {
        console.error('Error updating task:', error);
        // Rollback: refetch all data on error
        await fetchAllData();
        throw error;
      }
    },
    [],
  );

  const createTask = useCallback(
    async (newTask: Partial<Task>): Promise<Task> => {
      try {
        const createdTask = (await createTaskService(newTask)) as Task;

        // Optimistic update: add to local state
        setTasks((prev) => [...prev, createdTask]);

        return createdTask;
      } catch (error) {
        console.error('Error creating task:', error);
        throw error;
      }
    },
    [],
  );

  const deleteTask = useCallback(async (taskId: number) => {
    try {
      await deleteTaskService(taskId);

      // Optimistic update: remove from local state
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      // Refresh productivity data as deleting affects it
      const prodData = await getDailyProductivity();
      setProductivityData(prodData || []);
    } catch (error) {
      console.error('Error deleting task:', error);
      // Rollback on error
      await fetchAllData();
      throw error;
    }
  }, []);

  const startTimer = useCallback(
    async (taskId: number, mode: 'normal' | 'pomodoro' = 'normal') => {
      const taskToUpdate = tasks.find((t) => t.id === taskId);
      if (!taskToUpdate) return;

      const updatedTask: Partial<Task> & { id: number } = {
        ...taskToUpdate,
        startTimer: Date.now().toString(),
        timerMode: mode,
      };

      if (taskToUpdate.status === StatusEnum.TO_DO) {
        updatedTask.status = StatusEnum.IN_PROGRESS;
      }

      if (mode === 'pomodoro') {
        setIsBoostMode(true);
      }

      // Start context-aware notification session
      window.electron.database.startNotificationSession().catch(console.error);

      await updateTask(updatedTask);
    },
    [tasks, updateTask],
  );

  const stopTimer = useCallback(
    async (taskId: number) => {
      try {
        // Use ref to get latest tasks to avoid race condition
        const currentTasks = tasksRef.current;
        const taskToUpdate = currentTasks.find((t) => t.id === taskId);
        if (!taskToUpdate) return;

        const rawStartTimer = taskToUpdate.startTimer;
        const startTime = Number(rawStartTimer);

        if (!rawStartTimer || Number.isNaN(startTime)) {
          if (rawStartTimer !== null) {
            await updateTaskService({ id: taskId, startTimer: null });
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId ? { ...t, startTimer: null } : t,
              ),
            );
          }
          return;
        }

        const timeSpent = Date.now() - startTime;
        const newSpendTime = (taskToUpdate.spendTime || 0) + timeSpent;

        // 1. First log the work session (atomic operation)
        await logWorkSessionService({
          taskId,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          duration: timeSpent,
        });

        // 2. Then update the task with new spend time
        const updatedTaskData = {
          id: taskId,
          spendTime: newSpendTime,
          startTimer: null,
          updateStatusDate: new Date().toISOString(),
        };

        await updateTaskService(updatedTaskData);

        // 3. Optimistically update local state
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  spendTime: newSpendTime,
                  startTimer: null,
                  updateStatusDate: new Date().toISOString(),
                }
              : t,
          ),
        );

        // End context-aware notification session
        window.electron.database.endNotificationSession().catch(console.error);

        // 4. Check achievements asynchronously (don't block)
        checkForAchievements('WORK_SESSION_ENDED', { duration: timeSpent })
          .then((earned) => {
            if (earned) triggerRewardAnimation('achievement');
          })
          .catch((err) => console.error('Achievement check failed:', err));

        // 5. Refresh productivity data in background
        getDailyProductivity()
          .then((prodData) => {
            if (prodData) setProductivityData(prodData);
          })
          .catch((err) =>
            console.error('Failed to refresh productivity:', err),
          );
      } catch (error) {
        console.error('Error in stopTimer:', error);
        // On error, refetch all data to ensure consistency
        await fetchAllData();
      }
    },
    [triggerRewardAnimation, fetchAllData],
  );

  const handleKeepIdleTime = useCallback(() => {
    setIdlePrompt(null);
  }, []);

  const handleDiscardIdleTime = useCallback(async () => {
    if (!idlePrompt) return;
    const { taskId, originalStartTime, idleTimeMs } = idlePrompt;
    setIdlePrompt(null);

    const currentTasks = tasksRef.current;
    const task = currentTasks.find((t) => t.id === taskId);

    if (!task) return;

    const now = Date.now();
    const effectiveEndTime = now - idleTimeMs;

    let duration = effectiveEndTime - originalStartTime;
    if (duration < 0) duration = 0;

    const newSpendTime = (task.spendTime || 0) + duration;

    try {
      await logWorkSessionService({
        taskId,
        startTime: new Date(originalStartTime).toISOString(),
        endTime: new Date(effectiveEndTime).toISOString(),
        duration,
      });

      await updateTaskService({
        id: taskId,
        spendTime: newSpendTime,
        startTimer: null,
        updateStatusDate: new Date().toLocaleDateString(),
      });

      // Optimistically update local state
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                spendTime: newSpendTime,
                startTimer: null,
                updateStatusDate: new Date().toLocaleDateString(),
              }
            : t,
        ),
      );

      // Refresh productivity in background
      getDailyProductivity()
        .then((prodData) => {
          if (prodData) setProductivityData(prodData);
        })
        .catch((err) => console.error('Failed to refresh productivity:', err));
    } catch (e) {
      console.error('Failed to discard idle time', e);
      await fetchAllData();
    }
  }, [idlePrompt, fetchAllData]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      tasks,
      setTasks,
      updateTask,
      createTask,
      deleteTask,
      startTimer,
      stopTimer,
      isLoading,
      productivityData,
      isLoadingProductivity,
      contributionData,
      isLoadingContribution,
      hourlyProductivity,
      insights,
      dailyChallenge,
      totalSpendTimeToday,
      refreshData: fetchAllData,
      idlePrompt,
      handleKeepIdleTime,
      handleDiscardIdleTime,
      isBoostMode,
      toggleBoostMode,
      dailyMode,
      setDailyMode,
    }),
    [
      tasks,
      updateTask,
      createTask,
      deleteTask,
      startTimer,
      stopTimer,
      isLoading,
      productivityData,
      isLoadingProductivity,
      contributionData,
      isLoadingContribution,
      hourlyProductivity,
      insights,
      dailyChallenge,
      totalSpendTimeToday,
      fetchAllData,
      idlePrompt,
      handleKeepIdleTime,
      handleDiscardIdleTime,
      isBoostMode,
      toggleBoostMode,
      dailyMode,
    ],
  );

  return (
    <TimerContext.Provider value={contextValue}>
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
