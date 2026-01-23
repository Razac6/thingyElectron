import React, {
  createContext,
  useState,
  useContext,
  useEffect,
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
  getDailyBio
} from '../services/DatabaseService';

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
  focusScore: number;
  tagConsistency: {
    consistent: string[];
    volatile: string[];
  };
  dailyTip?: string;
  dailyTipCategory?: 'high' | 'low' | 'neutral' | 'focus';
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
  createTask: (newTask: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  startTimer: (taskId: number) => Promise<void>;
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
  createTask: (newTask: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  startTimer: (taskId: number) => Promise<void>;
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

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productivityData, setProductivityData] = useState<DailyProgressEntry[]>([]);
  const [isLoadingProductivity, setIsLoadingProductivity] = useState(true);
  const [contributionData, setContributionData] = useState<any[]>([]);
  const [isLoadingContribution, setIsLoadingContribution] = useState(true);
  const [hourlyProductivity, setHourlyProductivity] = useState<any[]>([]);
  const [insights, setInsights] = useState<AnalysisResult | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [totalSpendTimeToday, setTotalSpendTimeToday] = useState(0);
  const [idlePrompt, setIdlePrompt] = useState<IdlePromptState | null>(null);
  const [isBoostMode, setIsBoostMode] = useState(false);
  const [dailyMode, setDailyMode] = useState('normal');
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { checkForAchievements, triggerRewardAnimation } = useGamification();

  const toggleBoostMode = (forceState?: boolean) => {
      setIsBoostMode(prev => forceState !== undefined ? forceState : !prev);
  };
  
  // Ref to access latest tasks inside the event listener closure
  const tasksRef = React.useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const handleIdle = () => {
      const currentTasks = tasksRef.current;
      const activeTask = currentTasks.find(t => t.startTimer);
      
      if (activeTask && activeTask.startTimer) {
        const IDLE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
        
        // Don't auto-stop. Ask user.
        setIdlePrompt({
            isOpen: true,
            idleTimeMs: IDLE_THRESHOLD,
            taskId: activeTask.id,
            taskTitle: activeTask.title,
            originalStartTime: Number(activeTask.startTimer)
        });
        
        // Notify user about the prompt
        new Notification("💤 Idle Detected", { 
           body: "Are you still working? Click to confirm." 
        });
      }
    };

    // Register listener (using the generic 'on' from preload)
    window.electron.ipcRenderer.on('activity:idle-detected', handleIdle);
    
    // Listener for notification action "Stop Timer"
    const handleStopRequest = () => {
        const currentTasks = tasksRef.current;
        const activeTask = currentTasks.find(t => t.startTimer);
        if (activeTask) {
            stopTimer(activeTask.id);
            
            const userStr = localStorage.getItem('userId');
            if (userStr) {
                const userId = JSON.parse(userStr);
                window.electron.rewardFatigueCompliance(userId);
            }
        }
    };
    window.electron.ipcRenderer.on('timer:stop-requested', handleStopRequest);

    // Refresh data on gamification events (e.g. daily challenge progress update)
    const handleGamificationUpdate = () => {
        fetchAllData();
    };
    window.electron.ipcRenderer.on('gamification:check', handleGamificationUpdate);

    // Cleanup (optional for singleton, but good practice if we had a working removeListener)
    return () => {
       // window.electron.ipcRenderer.removeListener('activity:idle-detected', handleIdle);
       // window.electron.ipcRenderer.removeListener('timer:stop-requested', handleStopRequest);
    };
  }, []); // Mount once

  const fetchAllData = async () => {
    setIsLoading(true);
    setIsLoadingProductivity(true);
    setIsLoadingContribution(true);
    try {
      // Fetch insights first to ensure Daily Challenge is generated if missing
      const todayISO = getWorkdayISO();
      const insightsData = await getProductivityInsights();
      
      const [taskData, prodData, contData, hourlyData, challengeData, bioData] = await Promise.all([
        fetchTasks(navigate),
        getDailyProductivity(),
        getContributionData(Number(settings.activityGraphDays) || 365),
        getHourlyProductivity(),
        getDailyChallenge(), 
        getDailyBio(todayISO)
      ]);
      
      setTasks(taskData || []);
      setProductivityData(prodData || []);
      setContributionData(contData || []);
      setHourlyProductivity(hourlyData || []);
      setInsights(insightsData);
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
  }, [settings.activityGraphDays]); // Fetch on mount and when graph settings change

  useEffect(() => {
    const todayISO = getWorkdayISO();
    const todayData = productivityData.find(d => d.date === todayISO);
    setTotalSpendTimeToday(todayData?.totalDuration || 0);
  }, [productivityData]);

  useEffect(() => {
    const activeTask = tasks.find(task => task.startTimer !== null);
    if (activeTask && activeTask.startTimer) {
      // Get userId from localStorage for the tray
      const userStr = localStorage.getItem('userId');
      const userId = userStr ? JSON.parse(userStr) : undefined;
      
      window.electron.ipcRenderer.send('tray:start-timer', {
        title: activeTask.title,
        startTime: activeTask.startTimer,
        estimate: activeTask.estimate || 0,
        initialSpendTime: activeTask.spendTime || 0,
        userId: userId
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

  const updateTask = async (updatedData: Partial<Task> & { id: number }) => {
    await updateTaskService(updatedData);
    await fetchAllData();
  };

  const createTask = async (newTask: Partial<Task>): Promise<Task> => {
    const createdTask = await createTaskService(newTask);
    await fetchAllData();
    return createdTask;
  };

  const deleteTask = async (taskId: number) => {
    await deleteTaskService(taskId);
    await fetchAllData();
  };

  const startTimer = async (taskId: number, mode: 'normal' | 'pomodoro' = 'normal') => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;
    
    const updatedTask = { 
        ...taskToUpdate, 
        startTimer: Date.now().toString(),
        timerMode: mode 
    };
    
    // Auto-enable Boost Mode for Pomodoro
    if (mode === 'pomodoro') {
        setIsBoostMode(true);
    }

    await updateTask(updatedTask);
  };

  const stopTimer = async (taskId: number) => {
    try {
      const taskToUpdate = tasks.find((t) => t.id === taskId);
      if (!taskToUpdate) return;

      const rawStartTimer = taskToUpdate.startTimer;
      const startTime = Number(rawStartTimer);

      if (!rawStartTimer || isNaN(startTime)) {
        // Just reset the timer state if it's invalid but exists (or clean up if it was "running" but invalid)
        if (rawStartTimer !== null) {
             await updateTask({ ...taskToUpdate, startTimer: null, id: taskId });
        }
        return;
      }

      const timeSpent = Date.now() - startTime;
      const newSpendTime = (taskToUpdate.spendTime || 0) + timeSpent;
      const updatedTaskData = {
        ...taskToUpdate,
        spendTime: newSpendTime,
        startTimer: null,
        updateStatusDate: new Date().toLocaleDateString(),
      };

      console.log('Stopping timer for task:', taskId, 'Duration:', timeSpent);

      // 1. Log the session first
      await logWorkSessionService({
        taskId: taskId,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: timeSpent,
      });

      // Achievement Check
      const earned = await checkForAchievements('WORK_SESSION_ENDED', { duration: timeSpent });
      if (earned) triggerRewardAnimation('achievement');

      // 2. Update the task state (stop timer, update spendTime)
      await updateTaskService(updatedTaskData);

      console.log('Timer stopped and data saved. Fetching updated data...');

      // 3. Fetch all data immediately to update UI
      await fetchAllData();
      
      console.log('Data refreshed.');
    } catch (error) {
      console.error('Error in stopTimer:', error);
    }
  };

  const handleKeepIdleTime = () => {
      setIdlePrompt(null);
      // User was working, just close prompt and let timer continue.
  };

  const handleDiscardIdleTime = async () => {
      if (!idlePrompt) return;
      const { taskId, originalStartTime, idleTimeMs } = idlePrompt;
      setIdlePrompt(null); // Close prompt immediately

      const currentTasks = tasksRef.current; // Use ref to get latest tasks
      const task = currentTasks.find(t => t.id === taskId);
      
      if (!task) return;

      const now = Date.now();
      // "Effective" end time is NOW minus the idle time (since we discard it)
      const effectiveEndTime = now - idleTimeMs;
      
      // Calculate duration of valid work
      let duration = effectiveEndTime - originalStartTime;
      if (duration < 0) duration = 0;

      const newSpendTime = (task.spendTime || 0) + duration;

      try {
          // Log session
          await logWorkSessionService({
              taskId,
              startTime: new Date(originalStartTime).toISOString(),
              endTime: new Date(effectiveEndTime).toISOString(),
              duration: duration
          });

          // Stop timer & Update task
          await updateTaskService({
              ...task,
              spendTime: newSpendTime,
              startTimer: null,
              updateStatusDate: new Date().toLocaleDateString()
          });

          await fetchAllData();
      } catch (e) {
          console.error("Failed to discard idle time", e);
      }
  };

  return (
    <TimerContext.Provider
      value={{
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
        setDailyMode
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
