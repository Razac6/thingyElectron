import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  database: {
    // Tasks
    getTasks: (userId: number) => ipcRenderer.invoke('db:get-tasks', userId),
    createTask: (task: any, userId: number) => ipcRenderer.invoke('db:create-task', task, userId),
    updateTask: (task: any) => ipcRenderer.invoke('db:update-task', task),
    deleteTask: (taskId: number) => ipcRenderer.invoke('db:delete-task', taskId),

    // Sprints
    getSprints: () => ipcRenderer.invoke('db:get-sprints'),
    createSprint: (sprint: any) => ipcRenderer.invoke('db:create-sprint', sprint),

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
  },
  ipcRenderer: {
    on(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    once(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    },
  },
});
