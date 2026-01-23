import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  database: {
    // Global Search
    globalSearch: (userId: number, query: string) => ipcRenderer.invoke('db:global-search', userId, query),

    // Tasks
    getTasks: (userId: number) => ipcRenderer.invoke('db:get-tasks', userId),
    createTask: (task: any, userId: number) => ipcRenderer.invoke('db:create-task', task, userId),
    updateTask: (task: any) => ipcRenderer.invoke('db:update-task', task),
    deleteTask: (taskId: number) => ipcRenderer.invoke('db:delete-task', taskId),
    updateTasksOrder: (taskIds: number[]) => ipcRenderer.invoke('db:update-tasks-order', taskIds),
    autoScheduleTasks: (userId: number) => ipcRenderer.invoke('db:auto-schedule-tasks', userId),
    getProposedSchedule: (userId: number) => ipcRenderer.invoke('db:get-proposed-schedule', userId),

    // Sprints
    getSprints: () => ipcRenderer.invoke('db:get-sprints'),
    createSprint: (sprint: any) => ipcRenderer.invoke('db:create-sprint', sprint),
    updateSprint: (sprint: any) => ipcRenderer.invoke('db:update-sprint', sprint),
    updateSprintStatus: (sprintId: number, status: string) => ipcRenderer.invoke('db:update-sprint-status', sprintId, status),
    getSprintAnalysis: (userId: number) => ipcRenderer.invoke('db:get-sprint-analysis', userId),

    // Notes
    getNotes: (userId: number) => ipcRenderer.invoke('db:get-notes', userId),
    createNote: (note: any, userId: number) => ipcRenderer.invoke('db:create-note', note, userId),
    updateNote: (note: any) => ipcRenderer.invoke('db:update-note', note),
    deleteNote: (noteId: number) => ipcRenderer.invoke('db:delete-note', noteId),

    // Users
    login: (credentials: any) => ipcRenderer.invoke('db:login', credentials),
    register: (credentials: any) => ipcRenderer.invoke('db:register', credentials),

    // Gamification
    getProfile: (userId: number) => ipcRenderer.invoke('db:get-profile', userId),
    updateProfile: (profile: any) => ipcRenderer.invoke('db:update-profile', profile),
    getEarnedAchievements: (userId: number) => ipcRenderer.invoke('db:get-earned-achievements', userId),
    grantAchievement: (userId: number, achievementId: string) => ipcRenderer.invoke('db:grant-achievement', userId, achievementId),

    // Analytics
    getAverageTimeForTaskType: (taskType: string) => ipcRenderer.invoke('db:get-average-time-for-task-type', taskType),
    getAverageSprintCapacity: () => ipcRenderer.invoke('db:get-average-sprint-capacity'),
    logWorkSession: (session: any) => ipcRenderer.invoke('db:log-work-session', session),
    getHourlyProductivity: () => ipcRenderer.invoke('db:get-hourly-productivity'),
    getDailyProductivity: (userId: number) => ipcRenderer.invoke('db:get-daily-productivity', userId),
    getContributionData: (userId: number, days?: number) => ipcRenderer.invoke('db:get-contribution-data', userId, days),
    getTaskWorkSessions: (taskId: number) => ipcRenderer.invoke('db:get-task-work-sessions', taskId),
    getTagByName: (name: string) => ipcRenderer.invoke('db:get-tag-by-name', name),
    getAllTags: () => ipcRenderer.invoke('db:get-all-tags'),
    getSystemLogs: (limit?: number) => ipcRenderer.invoke('db:get-system-logs', limit),
    getNeuralConfidence: () => ipcRenderer.invoke('db:get-neural-confidence'),
    getAiMaturity: () => ipcRenderer.invoke('db:get-ai-maturity'),
    getAiStats: () => ipcRenderer.invoke('db:get-ai-stats'),
    getAllSettings: () => ipcRenderer.invoke('db:get-all-settings'),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('db:set-setting', key, value),
        getDailyBio: (date: string) => ipcRenderer.invoke('db:get-daily-bio', date),
        updateDailyBio: (date: string, data: any) => ipcRenderer.invoke('db:update-daily-bio', date, data),

        // Habits
        getHabits: (userId: number) => ipcRenderer.invoke('db:get-habits', userId),
        createHabit: (habit: any, userId: number) => ipcRenderer.invoke('db:create-habit', habit, userId),
        updateHabit: (habit: any) => ipcRenderer.invoke('db:update-habit', habit),
            deleteHabit: (habitId: number) => ipcRenderer.invoke('db:delete-habit', habitId),
                logHabit: (habitId: number, date: string, value?: number) => ipcRenderer.invoke('db:log-habit', habitId, date, value),
                getHabitLogs: (userId: number, fromDate?: string) => ipcRenderer.invoke('db:get-habit-logs', userId, fromDate),
                getTopHabit: (userId: number) => ipcRenderer.invoke('db:get-top-habit', userId),
                toggleHabitFavorite: (habitId: number, userId: number) => ipcRenderer.invoke('db:toggle-habit-favorite', habitId, userId),

                getChecklistItems: (taskId: number) => ipcRenderer.invoke('db:get-checklist-items', taskId),    addChecklistItem: (taskId: number, text: string) => ipcRenderer.invoke('db:add-checklist-item', taskId, text),
    toggleChecklistItem: (itemId: number, isCompleted: boolean) => ipcRenderer.invoke('db:toggle-checklist-item', itemId, isCompleted),
    deleteChecklistItem: (itemId: number) => ipcRenderer.invoke('db:delete-checklist-item', itemId),
    predictDuration: (task: any) => ipcRenderer.invoke('db:predict-duration', task),
    getAiPerformance: (userId: number, days?: number) => ipcRenderer.invoke('db:get-ai-performance', userId, days),
    generateDailyReport: (userId: number) => ipcRenderer.invoke('db:generate-daily-report', userId),
    forceNeuralTraining: (userId: number) => ipcRenderer.invoke('db:force-neural-training', userId),
    getDailyChallenge: (userId: number) => ipcRenderer.invoke('db:get-daily-challenge', userId),
    getProductivityInsights: (userId: number) => ipcRenderer.invoke('db:get-productivity-insights', userId),
    getAiMessage: (userId: number) => ipcRenderer.invoke('db:get-ai-message', userId),
    getDailyStandup: (userId: number) => ipcRenderer.invoke('db:get-daily-standup', userId),
    getDailyReportData: (userId: number) => ipcRenderer.invoke('db:get-daily-report-data', userId),
    // Web Integration
    getWebSettings: () => ipcRenderer.invoke('db:get-web-settings'),
    saveWebSettings: (settings: any) => ipcRenderer.invoke('db:save-web-settings', settings),
    getWebStats: (days: number) => ipcRenderer.invoke('db:get-web-stats', days),
    setDomainCategory: (domain: string, category: string) => ipcRenderer.invoke('db:set-domain-category', domain, category),
    getAppStats: (days: number) => ipcRenderer.invoke('db:get-app-stats', days),
    setAppCategory: (appName: string, category: string) => ipcRenderer.invoke('db:set-app-category', appName, category),
    requestSync: () => ipcRenderer.invoke('server:request-sync'),
  },
  app: {
    openDevTools: () => ipcRenderer.invoke('app:open-devtools'),
    setWindowOpacity: (opacity: number) => ipcRenderer.invoke('app:set-window-opacity', opacity),
    testMeditationNotif: () => ipcRenderer.invoke('app:test-meditation-notif'),
  },
  ipcRenderer: {
    on(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    once(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    },
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    sendSync: (channel: string, ...args: any[]) => ipcRenderer.sendSync(channel, ...args),
    removeListener: (channel: string, func: (...args: unknown[]) => void) => {
      ipcRenderer.removeListener(channel, (event, ...args) => func(...args));
    },
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.send('electron-shell-open-external', url),
  },
  rewardFatigueCompliance: (userId: number) => ipcRenderer.invoke('gamification:reward-fatigue-compliance', userId),
});
