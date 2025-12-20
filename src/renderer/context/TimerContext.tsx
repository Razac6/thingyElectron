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
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { checkForAchievements, triggerRewardAnimation } = useGamification();
  
  // Ref to access latest tasks inside the event listener closure
  const tasksRef = React.useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const handleIdle = () => {
      const currentTasks = tasksRef.current;
      const activeTask = currentTasks.find(t => t.startTimer);
      
      if (activeTask) {
        // We need to call stopTimer. However, stopTimer defined in component scope uses stale 'tasks'.
        // We must replicate stopTimer logic here or make stopTimer use refs/functional updates.
        // Replicating logic for safety and simplicity in this context:
        
        const taskId = activeTask.id;
        const startTime = Number(activeTask.startTimer);
        const IDLE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
        
        if (taskId && startTime) {
             const now = Date.now();
             // Calculate duration but subtract the idle time because user wasn't working
             let timeSpent = now - startTime - IDLE_THRESHOLD;
             
             // Safety check: session cannot be negative (if entire session was idle)
             if (timeSpent < 0) timeSpent = 0;

             const newSpendTime = (activeTask.spendTime || 0) + timeSpent;
             
             // Stop the timer
             updateTaskService({ 
                 ...activeTask, 
                 spendTime: newSpendTime, 
                 startTimer: null, 
                 updateStatusDate: new Date().toLocaleDateString() 
             }).then(() => {
                 // Log session with corrected end time (10 mins ago)
                 logWorkSessionService({
                    taskId: taskId,
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(now - IDLE_THRESHOLD).toISOString(),
                    duration: timeSpent,
                 });
                 // Refresh UI
                 fetchAllData();
                 // Notify user
                 new Notification("💤 Idle Detected", { 
                    body: "Timer auto-stopped. The last 10 minutes of inactivity were discarded." 
                 });
             });
        }
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
      const insightsData = await getProductivityInsights();
      
      const [taskData, prodData, contData, hourlyData, challengeData] = await Promise.all([
        fetchTasks(navigate),
        getDailyProductivity(),
        getContributionData(Number(settings.activityGraphDays) || 365),
        getHourlyProductivity(),
        getDailyChallenge(), // Now fetched after insights generation trigger
      ]);
      
      setTasks(taskData || []);
      setProductivityData(prodData || []);
      setContributionData(contData || []);
      setHourlyProductivity(hourlyData || []);
      setInsights(insightsData);
      setDailyChallenge(challengeData);
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

  const startTimer = async (taskId: number) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;
    const updatedTask = { ...taskToUpdate, startTimer: Date.now() };
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
