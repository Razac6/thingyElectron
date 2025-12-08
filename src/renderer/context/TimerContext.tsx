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
} from '../services/DatabaseService';

// Helper to get a consistent YYYY-MM-DD string for the workday.
const getWorkdayISO = () => {
  const now = new Date();
  // If it's before 4 AM, we're still in the previous workday.
  if (now.getHours() < 4) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
};

// Helper to format time for display in menubar
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
  startTimer: (taskId: number) => Promise<void>;
  stopTimer: (taskId: number) => Promise<void>;
  isLoading: boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setIsLoading(true);
        const data = await fetchTasks(navigate);
        setTasks(data || []);
      } catch (error) {
        console.error('Failed to fetch tasks for context', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [navigate]);

  // useEffect to update daily progress in localStorage
  useEffect(() => {
    if (isLoading) return;

    const workday = getWorkdayISO();
    const storedProgressData =
      JSON.parse(localStorage.getItem('dailyProgress') || '[]') || [];
    let todayEntry = storedProgressData.find(
      (entry: any) => entry.date === workday,
    );

    const totalSpendTime = tasks.reduce(
      (total, task) => total + (task.spendTime || 0),
      0,
    );

    if (todayEntry) {
      todayEntry.dayTimeSpend = totalSpendTime;
    } else {
      todayEntry = {
        date: workday,
        dayTimeSpend: totalSpendTime,
      };
      storedProgressData.push(todayEntry);
    }

    localStorage.setItem('dailyProgress', JSON.stringify(storedProgressData));
  }, [tasks, isLoading]);

  // --- Menubar Timer Logic ---
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
      if (document.hidden) { // App is minimized/hidden
        window.electron.ipcRenderer.send('tray:create'); // Request to create tray
      } else { // App is visible
        window.electron.ipcRenderer.send('tray:destroy'); // Request to destroy tray
      }
    };
    // Initial check
    handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.electron.ipcRenderer.send('tray:destroy'); // Ensure tray is destroyed on unmount
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

  const startTimer = async (taskId: number) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;

    const updatedTask = { ...taskToUpdate, startTimer: Date.now() };
    await updateTask({ ...updatedTask, id: taskId });
  };

  const stopTimer = async (taskId: number) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate || !taskToUpdate.startTimer) return;

    const timeSpent = Date.now() - taskToUpdate.startTimer;
    const newSpendTime = (taskToUpdate.spendTime || 0) + timeSpent;
    const updatedTask = {
      ...taskToUpdate,
      spendTime: newSpendTime,
      startTimer: null,
      updateStatusDate: new Date().toLocaleDateString(),
    };
    await updateTask({ ...updatedTask, id: taskId });

    // Log work session
    await logWorkSessionService({
      taskId: taskId,
      startTime: new Date(taskToUpdate.startTimer).toISOString(),
      endTime: new Date().toISOString(),
      duration: timeSpent,
    });
  };

  return (
    <TimerContext.Provider
      value={{ tasks, setTasks, updateTask, startTimer, stopTimer, isLoading }}
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
