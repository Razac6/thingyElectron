import { IpcRendererEvent } from 'electron';

export interface IElectronAPI {
  ipcRenderer: {
    sendMessage(channel: string, ...args: unknown[]): void;
    on(channel: string, func: (...args: unknown[]) => void): (() => void) | undefined;
    once(channel: string, func: (...args: unknown[]) => void): void;
    invoke(channel: string, ...args: unknown[]): Promise<any>;
    removeAllListeners(channel: string): void;
  };
  app: {
    getIconPath: () => string;
    openExternal: (url: string) => void;
    startTimer: (info: any) => void;
    stopTimer: () => void;
    updateTitle: (title: string) => void;
    openDevTools: () => void;
    setWindowOpacity: (opacity: number) => void;
    testMeditationNotif: () => void;
    testDailyStandup: () => void;
    meditationStarted: () => void;
    meditationCancelled: () => void;
    meditationCompleted: (userId: number, minutes: number) => void;
    skipMeditation: () => void;
    completePomodoro: (taskId: number) => void;
  };
  database: {
      logWorkSession: (session: any) => Promise<void>;
      getTasks: (userId: number) => Promise<any[]>;
      createTask: (task: any, userId?: number) => Promise<number>;
      updateTask: (task: any) => Promise<void>;
      deleteTask: (taskId: number) => Promise<void>;
      updateTasksOrder: (taskIds: number[]) => Promise<void>;
      autoScheduleTasks: (userId: number) => Promise<void>;
      getProposedSchedule: (userId: number) => Promise<any[]>;
      getSprints: () => Promise<any[]>;
      createSprint: (sprint: any) => Promise<number>;
      updateSprint: (sprint: any) => Promise<void>;
      updateSprintStatus: (sprintId: number, status: string) => Promise<void>;
      getSprintAnalysis: (userId: number) => Promise<any>;
      getNotes: (userId: number) => Promise<any[]>;
      createNote: (note: any, userId?: number) => Promise<number>;
      updateNote: (note: any) => Promise<void>;
      deleteNote: (noteId: number) => Promise<void>;
      globalSearch: (userId: number, query: string) => Promise<any[]>;
      getDailyChallenge: (userId: number) => Promise<any>;
      getAverageTimeForTaskType: (taskType: string) => Promise<number>;
      getAverageSprintCapacity: () => Promise<number>;
      getHourlyProductivity: () => Promise<any[]>;
      getDailyProductivity: (userId: number) => Promise<any[]>;
      getContributionData: (userId: number, days: number) => Promise<any[]>;
      getWorkSessions: (userId: number, days: number) => Promise<any[]>;
      getTaskWorkSessions: (taskId: number) => Promise<any[]>;
      getLast14DaysProductivity: (userId: number) => Promise<any[]>;
      getDeepWorkHistory: (userId: number, days: number) => Promise<any[]>;
      getTagAnalytics: (tagId: number) => Promise<any>;
      getTagByName: (name: string) => Promise<number[]>;
      getAllTags: () => Promise<string[]>;
      getSystemLogs: (limit: number) => Promise<any[]>;
      getNeuralConfidence: () => Promise<number>;
      getAiMaturity: () => Promise<number>;
      getAiStats: () => Promise<any>;
      login: (creds: any) => Promise<any>;
      register: (creds: any) => Promise<any>;
      getProfile: (userId: number) => Promise<any>;
      updateProfile: (profile: any) => Promise<void>;
      getEarnedAchievements: (userId: number) => Promise<any[]>;
      grantAchievement: (userId: number, achievementId: string) => Promise<void>;
      getAllSettings: () => Promise<any[]>;
      setSetting: (key: string, value: string) => Promise<void>;
      getChecklistItems: (taskId: number) => Promise<any[]>;
      addChecklistItem: (taskId: number, text: string) => Promise<any>;
      toggleChecklistItem: (itemId: number, isCompleted: boolean) => Promise<void>;
      deleteChecklistItem: (itemId: number) => Promise<void>;
      getDailyBio: (date: string) => Promise<any>;
      updateDailyBio: (date: string, data: any) => Promise<any>;
      getHabits: (userId: number) => Promise<any[]>;
      createHabit: (habit: any, userId?: number) => Promise<number>;
      updateHabit: (habit: any) => Promise<void>;
      deleteHabit: (habitId: number) => Promise<void>;
      logHabit: (habitId: number, date: string, value: number) => Promise<void>;
      getHabitLogs: (userId: number, fromDate: string) => Promise<any[]>;
      getTopHabit: (userId: number) => Promise<any>;
      toggleHabitFavorite: (habitId: number, userId: number) => Promise<void>;
      predictDuration: (task: any) => Promise<number>;
      getAiMessage: (userId: number) => Promise<string>;
      getProductivityInsights: (userId: number) => Promise<any>;
      getAiPerformance: (userId: number, days: number) => Promise<any[]>;
      generateDailyReport: (userId: number) => Promise<string>;
      forceNeuralTraining: (userId: number) => Promise<boolean>;
      getDailyStandup: (userId: number) => Promise<any>;
      getDailyReportData: (userId: number) => Promise<any>;
      getDailyDeepWork: (userId: number) => Promise<{ score: number, duration: number }>;
      getLifetimeStats: (userId: number) => Promise<any>;
      rewardFatigueCompliance: (userId: number) => Promise<void>;
      getWebSettings: () => Promise<any>;
      saveWebSettings: (settings: any) => Promise<void>;
      getWebStats: (days: number) => Promise<any>;
      getDistractionStats: (days: number) => Promise<any>;
      setDomainCategory: (domain: string, category: string) => Promise<void>;
      getAppStats: (days: number) => Promise<any>;
      setAppCategory: (appName: string, category: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}