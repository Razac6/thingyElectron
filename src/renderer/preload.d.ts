import { IpcRendererEvent } from 'electron';
import { StandupData } from '../main/DailyStandupAI';
import type { DockerStatus } from '../main/docker';
import type { RunSnapshot, RunStepInput } from '../main/commandRunner';
import type { ConnectionString, DockerContainer } from '../main/dockerTools';

export interface IElectronAPI {
  ipcRenderer: {
    on(channel: string, func: (...args: unknown[]) => void): () => void;
    once(channel: string, func: (...args: unknown[]) => void): () => void;
    send(channel: string, ...args: any[]): void;
    sendSync(channel: string, ...args: any[]): any;
    removeListener(channel: string, func: (...args: unknown[]) => void): void;
    invoke(channel: string, ...args: unknown[]): Promise<any>;
  };
  commands: {
    run: (
      steps: RunStepInput[],
      options: {
        label: string;
        groupId?: string | null;
        stopOnError?: boolean;
      },
    ) => Promise<RunSnapshot | null>;
    stop: (runId: string) => Promise<boolean>;
    runs: () => Promise<RunSnapshot[]>;
    output: (runId: string, step?: number | null) => Promise<string>;
    rerun: (
      runId: string,
      options?: { from?: number; only?: number },
    ) => Promise<RunSnapshot | null>;
    clear: () => Promise<boolean>;
    pickFolder: (current?: string) => Promise<string | null>;
  };
  docker: {
    status: () => Promise<DockerStatus>;
    list: () => Promise<{
      containers: DockerContainer[];
      error: string | null;
    }>;
    action: (
      ids: string[],
      action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause',
    ) => Promise<{ ok: boolean; error: string | null }>;
    logs: (id: string, tail?: number) => Promise<{ ok: boolean; text: string }>;
    connections: (id: string) => Promise<ConnectionString[]>;
    startColima: () => Promise<{ ok: boolean; error: string | null }>;
  };
  shell: {
    openExternal: (url: string) => void;
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
    adjustTaskWorkTime: (taskId: number, deltaMs: number) => Promise<void>;
    getTasks: (userId: number) => Promise<any[]>;
    createTask: (task: any, userId?: number) => Promise<any>;
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
    updateNote: (
      note: any,
      options?: { forceVersion?: boolean },
    ) => Promise<any>;
    getNoteVersions: (noteId: number) => Promise<any[]>;
    deleteNote: (noteId: number) => Promise<void>;
    importNoteFiles: () => Promise<{ fileName: string; text: string }[]>;
    saveBase64File: (
      fileName: string,
      base64: string,
    ) => Promise<string | null>;
    openBase64File: (
      fileName: string,
      base64: string,
    ) => Promise<string | null>;
    exportNoteFiles: (
      files: { fileName: string; content: string }[],
    ) => Promise<number>;
    globalSearch: (userId: number, query: string) => Promise<any[]>;
    getDailyChallenge: (userId: number) => Promise<any>;
    getAverageTimeForTaskType: (taskType: string) => Promise<number>;
    getAverageSprintCapacity: () => Promise<number>;
    getHourlyProductivity: () => Promise<any[]>;
    getDailyProductivity: (userId: number) => Promise<any[]>;
    getWorkHistory: (
      userId: number,
      startDate: string,
      endDate: string,
    ) => Promise<any[]>;
    getContributionData: (userId: number, days: number) => Promise<any[]>;
    getWorkSessions: (userId: number, days: number) => Promise<any[]>;
    getTaskWorkSessions: (taskId: number) => Promise<any[]>;
    getLast14DaysProductivity: (userId: number) => Promise<any[]>;
    getDeepWorkHistory: (userId: number, days: number) => Promise<any[]>;
    getTagAnalytics: (tagId: number) => Promise<any>;
    getTagAnalyticsWithNames: () => Promise<any[]>;
    getTagByName: (name: string) => Promise<number[]>;
    getAllTags: () => Promise<string[]>;
    getSystemLogs: (limit?: number) => Promise<any[]>;
    getNeuralConfidence: () => Promise<number | null>;
    getAiMaturity: () => Promise<number>;
    getAiStats: () => Promise<any>;
    login: (creds: any) => Promise<any>;
    register: (creds: any) => Promise<any>;
    getGamificationState: () => Promise<any>;
    getJourney: () => Promise<any>;
    rollJourney: () => Promise<any>;
    equipJourneyItem: (uid: string) => Promise<any>;
    upgradeJourneyItem: (uid: string) => Promise<any>;
    sellJourneyItem: (uid: string) => Promise<any>;
    awardXp: (amount: number, reason: string, key?: string) => Promise<any>;
    syncAchievements: () => Promise<{
      profile: any;
      newAchievements: { id: string; name: string; xp: number }[];
    }>;
    getProfile: (userId: number) => Promise<any>;
    updateProfile: (profile: any) => Promise<void>;
    getEarnedAchievements: (userId: number) => Promise<any[]>;
    grantAchievement: (userId: number, achievementId: string) => Promise<void>;
    getAllSettings: () => Promise<any[]>;
    setSetting: (key: string, value: string) => Promise<void>;
    getDailyBio: (date: string) => Promise<any>;
    updateDailyBio: (date: string, data: any) => Promise<any>;
    getHabits: (userId: number) => Promise<any[]>;
    createHabit: (habit: any, userId?: number) => Promise<number>;
    updateHabit: (habit: any) => Promise<void>;
    deleteHabit: (habitId: number) => Promise<void>;
    logHabit: (habitId: number, date: string, value?: number) => Promise<void>;
    getHabitLogs: (userId: number, fromDate?: string) => Promise<any[]>;
    getTopHabit: (userId: number) => Promise<any>;
    toggleHabitFavorite: (habitId: number, userId: number) => Promise<void>;
    predictDuration: (task: any) => Promise<number>;
    // See src/main/TaskEstimator.ts (EstimateSuggestion)
    suggestEstimate: (task: any) => Promise<{
      minutes: number;
      basis: 'ratio' | 'duration';
      ratio: number | null;
      sampleSize: number;
      matchedOn: string[];
      similarTasks: boolean;
      confidence: 'low' | 'medium' | 'high';
    } | null>;
    getAiMessage: (userId: number) => Promise<string>;
    getProductivityInsights: (userId: number) => Promise<any>;
    suggestBestTimeForTask: (
      task: any,
    ) => Promise<{ icon: string; text: string; color: string }>;
    getAiPerformance: (userId: number, days: number) => Promise<any[]>;
    generateDailyReport: (userId: number) => Promise<string>;
    forceNeuralTraining: (userId: number) => Promise<boolean>;
    getDailyStandup: (userId: number) => Promise<StandupData>;
    getDailyReportData: (userId: number) => Promise<any>;
    getDailyDeepWork: (
      userId: number,
    ) => Promise<{ score: number; duration: number; longestSession: number }>;
    getLifetimeStats: (userId: number) => Promise<any>;
    getSuggestedCommitMessage: (taskId: number) => Promise<string>;
    getChecklistItems: (taskId: number) => Promise<any[]>;
    addChecklistItem: (taskId: number, text: string) => Promise<any[]>;
    toggleChecklistItem: (
      itemId: number,
      isCompleted: boolean,
    ) => Promise<any[]>;
    // Procrastination Detection
    analyzeProcrastination: (userId: number) => Promise<any[]>;
    predictTaskProcrastination: (task: any) => Promise<any>;
    trainProcrastinationModel: (userId: number) => Promise<boolean>;
    // Context-Aware Notifications
    startNotificationSession: () => Promise<void>;
    endNotificationSession: () => Promise<void>;
    checkContextNotifications: (userId: number) => Promise<void>;
    deleteChecklistItem: (itemId: number) => Promise<any[]>;
    rewardFatigueCompliance: (userId: number) => Promise<void>;
    getWebSettings: () => Promise<any>;
    saveWebSettings: (settings: any) => Promise<void>;
    getWebStats: (days: number) => Promise<any>;
    getDistractionStats: (days: number) => Promise<any>;
    setDomainCategory: (domain: string, category: string) => Promise<void>;
    getAppStats: (days: number) => Promise<any>;
    getLastActivityTime: (start: number, end: number) => Promise<number | null>;
    startFocusBlock: (block: {
      taskId: number;
      goal: string;
      checklistItemId?: number | null;
      plannedMinutes: number;
    }) => Promise<number | null>;
    finishFocusBlock: (id: number, achieved: boolean) => Promise<void>;
    getTodayWins: (userId: any) => Promise<{
      tasksCompleted: number;
      stepsCompleted: number;
      focusBlocks: number;
      focusBlocksAchieved: number;
      focusMinutes: number;
    }>;
    setAppCategory: (appName: string, category: string) => Promise<void>;
    startNewExpedition: () => Promise<any>;
    requestSync: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
