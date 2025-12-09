import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../interfaces/task.interface';
import {
  fetchData as fetchTasks,
  updateTask as updateTaskService,
  logWorkSession as logWorkSessionService,
  getDailyProductivity,
  getContributionData,
  getHourlyProductivity,
  createTask as createTaskService,
  deleteTask as deleteTaskService,
} from '../services/DatabaseService';

interface DailyProgressEntry {
  date: string;
  totalDuration: number;
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
  const [totalSpendTimeToday, setTotalSpendTimeToday] = useState(0);
  const navigate = useNavigate();

  const fetchAllData = async () => {
    setIsLoading(true);
    setIsLoadingProductivity(true);
    setIsLoadingContribution(true);
    try {
      const [taskData, prodData, contData, hourlyData] = await Promise.all([
        fetchTasks(navigate),
        getDailyProductivity(),
        getContributionData(),
        getHourlyProductivity(),
      ]);
      setTasks(taskData || []);
      setProductivityData(prodData || []);
      setContributionData(contData || []);
      setHourlyProductivity(hourlyData || []);
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
  }, [navigate]);

  useEffect(() => {
    const todayISO = getWorkdayISO();
    const todayData = productivityData.find(d => d.date === todayISO);
    setTotalSpendTimeToday(todayData?.totalDuration || 0);
  }, [productivityData]);

  useEffect(() => {
    const activeTask = tasks.find(task => task.startTimer !== null);
    if (activeTask && activeTask.startTimer) {
      window.electron.ipcRenderer.send('tray:start-timer', {
        title: activeTask.title,
        startTime: activeTask.startTimer,
        estimate: activeTask.estimate || 0,
        initialSpendTime: activeTask.spendTime || 0
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

  const createTask = async (newTask: Partial<Task>) => {
    await createTaskService(newTask);
    await fetchAllData();
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
