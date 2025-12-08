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
  createTask as createTaskService, // Import the createTask service
} from '../services/DatabaseService';

interface DailyProgressEntry {
  date: string;
  totalDuration: number;
}

const getWorkdayISO = () => {
  const now = new Date();
  if (now.getHours() < 4) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
};

function formatTimeForMenubar(ms: number): string {
  if (ms <= 0) return '00:00';
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  minutes %= 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

interface TimerContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  updateTask: (updatedData: Partial<Task> & { id: number }) => Promise<void>;
  createTask: (newTask: Partial<Task>) => Promise<void>; // Add createTask to the type
  startTimer: (taskId: number) => Promise<void>;
  stopTimer: (taskId: number) => Promise<void>;
  isLoading: boolean;
  productivityData: DailyProgressEntry[];
  isLoadingProductivity: boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productivityData, setProductivityData] = useState<DailyProgressEntry[]>([]);
  const [isLoadingProductivity, setIsLoadingProductivity] = useState(true);
  const navigate = useNavigate();

  const fetchProductivity = async () => {
    try {
      setIsLoadingProductivity(true);
      const data = await getDailyProductivity();
      setProductivityData(data);
    } catch (error) {
      console.error('Failed to fetch productivity data', error);
    } finally {
      setIsLoadingProductivity(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const taskData = await fetchTasks(navigate);
        setTasks(taskData || []);
        await fetchProductivity();
      } catch (error) {
        console.error('Failed to fetch initial data for context', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [navigate]);

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
  }, [tasks]);

  const updateTask = async (updatedData: Partial<Task> & { id: number }) => {
    try {
      await updateTaskService(updatedData);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === updatedData.id ? { ...task, ...updatedData } : task,
        ),
      );
    } catch (error) {
      console.error('Failed to update task via context', error);
    }
  };

  const createTask = async (newTask: Partial<Task>) => {
    try {
      const createdTask = await createTaskService(newTask);
      setTasks((prev) => [...prev, createdTask]);
    } catch (error) {
      console.error('Failed to create task via context', error);
      throw error; // Re-throw to be caught by the caller
    }
  };

  const startTimer = async (taskId: number) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;
    const updatedTask = { ...taskToUpdate, startTimer: Date.now() };
    await updateTask({ ...updatedTask, id: taskId });
  };

  const stopTimer = async (taskId: number) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate || !taskToUpdate.startTimer || typeof taskToUpdate.startTimer !== 'number') {
      if (taskToUpdate) {
        await updateTask({ ...taskToUpdate, startTimer: null, id: taskId });
      }
      return;
    }

    const startTime = taskToUpdate.startTimer;
    const timeSpent = Date.now() - startTime;
    const newSpendTime = (taskToUpdate.spendTime || 0) + timeSpent;
    const updatedTask = {
      ...taskToUpdate,
      spendTime: newSpendTime,
      startTimer: null,
      updateStatusDate: new Date().toLocaleDateString(),
    };
    await updateTask({ ...updatedTask, id: taskId });

    await logWorkSessionService({
      taskId: taskId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: timeSpent,
    });

    // Refresh productivity data after logging a session
    await fetchProductivity();
  };

  return (
    <TimerContext.Provider
      value={{
        tasks,
        setTasks,
        updateTask,
        createTask, // Expose the new function
        startTimer,
        stopTimer,
        isLoading,
        productivityData,
        isLoadingProductivity,
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
