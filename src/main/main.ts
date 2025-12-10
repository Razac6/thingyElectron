/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut, Notification, powerMonitor } from 'electron';
// import { autoUpdater } from 'electron-updater'; // Commented out: electron-updater
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  initDB,
  getTasks, createTask, updateTask, deleteTask, updateTasksOrder, // Use deleteTask directly
  getSprints, createSprint, updateSprintStatus,
  getNotes, createNote, updateNote, deleteNote,
  loginUser, registerUser,
  getProfile, updateProfile, getEarnedAchievements, grantAchievement,
  globalSearch,
  getAverageTimeForTaskType, getAverageSprintCapacity,
  logWorkSession,
  getHourlyProductivity,
  getDailyProductivity,
  getContributionData,
  getRecentWorkSessions,
  getLast14DaysProductivity,
  getDailyChallenge,
  createDailyChallenge,
  updateDailyChallengeProgress,
  getTagAnalytics,
  getTagByName,
  getTagAnalyticsWithNames,
  getAllTags,
  getSystemLogs,
  logSystemEvent,
} from './db';
import { ProductivityAnalyst, AnalysisResult } from './ProductivityAnalysis';

// --- Aggressive Error Logging ---
log.transports.file.level = 'info';
log.catchErrors({
  showDialog: false,
  onError: (error) => {
    log.error('Unhandled error in main process:', error);
    app.quit();
  }
});

require('dotenv').config();

// Commented out: electron-updater class definition
// class AppUpdater {
//   constructor() {
//     autoUpdater.logger = log;
//     autoUpdater.checkForUpdatesAndNotify();
//   }
// }

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// --- Smart Insights State ---
let cachedInsights: AnalysisResult | null = null;
let hasSentFatigueWarning = false;
let lastPeakHourNotificationDate: string | null = null;

const refreshInsights = (userId: number) => {
  try {
    const recentSessions = getRecentWorkSessions(userId, 30);
    const trendData = getLast14DaysProductivity(userId);
    const tagData = getTagAnalyticsWithNames();
    
    // Create a map for the analysis
    const tagMap = new Map<number, string>();
    tagData.forEach((t: any) => tagMap.set(t.id, t.name));

    cachedInsights = {
      peakHours: ProductivityAnalyst.identifyPeakHours(recentSessions).peakHours,
      peakHourRange: ProductivityAnalyst.identifyPeakHours(recentSessions).formattedRange,
      fatigueProfile: ProductivityAnalyst.analyzeFatigue(recentSessions),
      trend: ProductivityAnalyst.analyzeTrend(trendData),
      focusScore: ProductivityAnalyst.analyzeFocusQuality(recentSessions),
      tagConsistency: ProductivityAnalyst.analyzeTagConsistency(tagData, tagMap),
    };
    log.info('Smart Insights Refreshed:', cachedInsights);

    // --- Daily Challenge Generation ---
    const today = new Date().toISOString().split('T')[0];
    const existingChallenge = getDailyChallenge(userId, today);
    if (!existingChallenge && cachedInsights) {
      const config = ProductivityAnalyst.generateDailyChallenge(cachedInsights.trend, cachedInsights.fatigueProfile);
      createDailyChallenge({
        userId,
        date: today,
        ...config
      });
      log.info('New Daily Challenge Generated:', config);
    }

  } catch (e) {
    log.error('Failed to refresh insights', e);
  }
};

// --- Global Asset Path Resolver ---
const getAssetPath = (...paths: string[]): string => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
  return path.join(RESOURCES_PATH, ...paths);
};

const trayIconPath = getAssetPath('icon.png'); // Resolve icon path once for the tray

// --- Tray Timer Logic ---
let trayTimerInterval: NodeJS.Timeout | null = null;
let activeTaskInfo: { title: string; startTime: number; estimate: number; initialSpendTime: number; userId?: number } | null = null;

function formatTimeForTray(ms: number): string {
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

const updateTrayTitle = () => {
  if (!tray || !activeTaskInfo) return;

  const { title, startTime, estimate, initialSpendTime } = activeTaskInfo;
  const estimateTime = (estimate || 0) * 3600 * 1000;
  const currentTime = Date.now();
  const elapsedSinceStart = currentTime - startTime;
  const totalTime = initialSpendTime + elapsedSinceStart;

  const remaining = estimateTime - totalTime;
  const timeString = formatTimeForTray(remaining);
  const shortTitle = title.length > 10 ? `${title.substring(0, 10)}...` : title;
  const menubarTitle = `${shortTitle} ${timeString}`;
  const menubarTooltip = `Working on: ${title}`;

  tray.setTitle(menubarTitle);
  tray.setToolTip(menubarTooltip);

  // --- Smart Notification: Fatigue Check ---
  if (cachedInsights && !hasSentFatigueWarning) {
    const elapsedMinutes = elapsedSinceStart / (1000 * 60);
    const limit = cachedInsights.fatigueProfile.maxRecommended;

    // Notify if exceeded limit (and limit is reasonable > 10m)
    if (elapsedMinutes > limit && limit > 10) {
      const notification = new Notification({
        title: '🧠 Brain Fatigue Detected',
        body: `You've passed your optimal session limit of ${limit}m. A 5m break increases subsequent efficiency by 40%.`,
        icon: getAssetPath('icon.png'),
        actions: [{ type: 'button', text: 'Stop Timer & Rest' }]
      });
      
      notification.on('action', () => {
        log.info('User clicked Stop Timer on Fatigue Notification');
        if (mainWindow) {
          mainWindow.webContents.send('timer:stop-requested');
        }
      });

      notification.show();
      hasSentFatigueWarning = true; // Don't spam
    }
  }
};

// --- Tray Management Functions ---
const createTray = () => {
  if (tray) return; // Tray already exists
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow?.show(); } },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Thingy App');
  tray.setTitle('');

  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow?.hide() : mainWindow?.show();
  });

  // Update title immediately if we have active task info
  if (activeTaskInfo) {
      updateTrayTitle();
  }
};

const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

// --- IPC Handlers ---
// Better approach: Let the Frontend trigger a "check challenge" or simply recalculate on getDailyChallenge call?
// Actually, `updateDailyChallengeProgress` needs to be called.
// Let's enhance logWorkSession in db.ts to handle this? No, keep logic here.
// Re-implementing the handler to be async and do the logic.

ipcMain.handle('db:log-work-session', async (event, session) => {
  logWorkSession(session);

  // Retrieve userId from the task to identify the user
  // This is a bit roundabout but necessary if session doesn't have userId
  // We can pass userId in session object from frontend? Yes, let's assume we will add userId to session log payload from frontend.
  // BUT the interface in db.ts for logWorkSession is specific.
  // Let's just fetch the challenge for the user involved.
  // Optimization: activeTaskInfo has userId if we add it.

  if (activeTaskInfo && activeTaskInfo.userId) {
     const userId = activeTaskInfo.userId;
     const today = new Date().toISOString().split('T')[0];
     const challenge: any = getDailyChallenge(userId, today);

     if (challenge && challenge.status === 'ACTIVE') {
       let newProgress = challenge.progress;

       if (challenge.type === 'TOTAL_DURATION') {
         // Add duration (ms) converted to minutes
         newProgress += Math.round(session.duration / (1000 * 60));
       } else if (challenge.type === 'DEEP_WORK') {
         const durationMin = session.duration / (1000 * 60);
         if (durationMin >= 20) {
            newProgress += Math.round(durationMin);
         }
       }

       const status = newProgress >= challenge.target ? 'COMPLETED' : 'ACTIVE';
       updateDailyChallengeProgress(challenge.id, newProgress, status);

       if (status === 'COMPLETED') {
         // Grant XP
         // grantAchievement(userId, 'DAILY_CHALLENGE_COMPLETED'); // Optional
         new Notification({
            title: '🎉 Challenge Completed!',
            body: `You completed: ${challenge.description} (+${challenge.xpReward} XP)`,
            icon: getAssetPath('icon.png'),
         }).show();
       }
     }
  }
});

ipcMain.handle('db:global-search', (event, userId, query) => globalSearch(userId, query));
ipcMain.handle('db:get-daily-challenge', (event, userId) => {
  const today = new Date().toISOString().split('T')[0];
  return getDailyChallenge(userId, today);
});
ipcMain.handle('db:get-tasks', (event, userId) => getTasks(userId));
ipcMain.handle('db:create-task', (event, task, userId) => createTask(task, userId));
ipcMain.handle('db:update-task', (event, task) => updateTask(task));
ipcMain.handle('db:delete-task', (event, taskId) => deleteTask(taskId)); // Use deleteTask directly
ipcMain.handle('db:update-tasks-order', (event, taskIds) => updateTasksOrder(taskIds));
ipcMain.handle('db:get-sprints', () => getSprints());
ipcMain.handle('db:create-sprint', (event, sprint) => createSprint(sprint));
ipcMain.handle('db:update-sprint-status', (event, sprintId, status) => updateSprintStatus(sprintId, status));
ipcMain.handle('db:get-notes', (event, userId) => getNotes(userId));
ipcMain.handle('db:create-note', (event, note, userId) => createNote(note, userId));
ipcMain.handle('db:update-note', (event, note) => updateNote(note));
ipcMain.handle('db:delete-note', (event, noteId) => deleteNote(noteId));
ipcMain.handle('db:login', (event, { username, password }) => {
  const user = loginUser(username, password);
  if (user) {
    refreshInsights(user.id); // Load insights on login
    return { access_token: 'local-session-token', userId: user.id };
  }
  throw new Error('Invalid credentials');
});
ipcMain.handle('db:register', (event, { username, password }) => registerUser(username, password));
ipcMain.handle('db:get-profile', (event, userId) => getProfile(userId));
ipcMain.handle('db:update-profile', (event, profile) => updateProfile(profile));
ipcMain.handle('db:get-earned-achievements', (event, userId) => getEarnedAchievements(userId));
ipcMain.handle('db:grant-achievement', (event, userId, achievementId) => grantAchievement(userId, achievementId));
ipcMain.handle('db:get-average-time-for-task-type', (event, taskType) => getAverageTimeForTaskType(taskType));
ipcMain.handle('db:get-average-sprint-capacity', () => getAverageSprintCapacity());
ipcMain.handle('db:get-hourly-productivity', () => getHourlyProductivity());
ipcMain.handle('db:get-daily-productivity', (event, userId) => getDailyProductivity(userId));
ipcMain.handle('db:get-contribution-data', (event, userId) => getContributionData(userId));
ipcMain.handle('db:get-tag-analytics', (event, tagId) => getTagAnalytics(tagId));
ipcMain.handle('db:get-tag-by-name', (event, name) => getTagByName(name));
ipcMain.handle('db:get-all-tags', () => getAllTags());
ipcMain.handle('db:get-system-logs', (event, limit) => getSystemLogs(limit));

ipcMain.handle('db:get-productivity-insights', async (event, userId) => {
  refreshInsights(userId); // Ensure fresh data
  return cachedInsights;
});

ipcMain.handle('gamification:reward-fatigue-compliance', (event, userId) => {
  const profile = getProfile(userId);
  if (profile) {
    updateProfile({ ...profile, xp: profile.xp + 15 });
    logSystemEvent('Fatigue Model Validated: User accepted warning. (+15 XP)', 'LEARNING');
    new Notification({
       title: 'Mindful Rest Reward',
       body: 'Good job listening to your body! +15 XP',
       icon: getAssetPath('icon.png')
    }).show();
  }
});

// --- Tray IPC Handlers ---
ipcMain.on('tray:create', createTray);
ipcMain.on('tray:destroy', destroyTray);
ipcMain.on('tray:update-title', (event, title) => {
  if (tray) {
    tray.setTitle(title);
  }
});

ipcMain.on('tray:update-tooltip', (event, tooltip) => {
  if (tray) {
    tray.setToolTip(tooltip);
  }
});

ipcMain.on('tray:start-timer', (event, info) => {
  activeTaskInfo = info;
  if (trayTimerInterval) clearInterval(trayTimerInterval);

  // Reset fatigue warning state for new session
  hasSentFatigueWarning = false;
  // Try to refresh insights (need userId in info ideally, or use global if single user)
  // For now, assuming insights are loaded via login or dashboard load.

  updateTrayTitle();
  trayTimerInterval = setInterval(updateTrayTitle, 1000);
});

ipcMain.on('tray:stop-timer', () => {
  activeTaskInfo = null;
  if (trayTimerInterval) clearInterval(trayTimerInterval);
  trayTimerInterval = null;
  if (tray) {
    tray.setTitle('');
    tray.setToolTip('Thingy App');
  }
});

// Add handler for tray:get-icon-path
ipcMain.on('tray:get-icon-path', (event) => {
  event.returnValue = trayIconPath; // Return the icon path synchronously
});

// --- Background Productivity Checks (Peak Hours) ---
setInterval(() => {
  if (!cachedInsights) return;

  const now = new Date();
  const currentHour = now.getHours();
  const dateString = now.toDateString(); // "Tue Dec 09 2025"

  // Only notify once per day
  if (lastPeakHourNotificationDate !== dateString) {
    if (cachedInsights.peakHours.includes(currentHour)) {
      logSystemEvent(`Golden Hour Detected: It's ${currentHour}:00 - your peak productivity time.`, 'PRODUCTIVITY');
      new Notification({
        title: '🚀 Golden Hour',
        body: `It's ${currentHour}:00! Statistics show this is your most productive time of day. Focus on High Priority tasks.`,
        icon: getAssetPath('icon.png'),
      }).show();
      lastPeakHourNotificationDate = dateString;
    }
  }
}, 15 * 60 * 1000); // Check every 15 minutes

// --- Activity Monitor (Idle Detection) ---
setInterval(() => {
  // Only check if a task is actively running
  if (activeTaskInfo) {
    const idleTime = powerMonitor.getSystemIdleTime(); // Returns seconds
    // Threshold: 10 minutes (600 seconds)
    if (idleTime >= 600) {
      if (mainWindow) {
        mainWindow.webContents.send('activity:idle-detected');
      }

      // Optionally notify immediately here, but better to let Renderer handle the stop logic
      // so it updates the UI state correctly.
    }
  }
}, 60000); // Check every 1 minute


if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  // require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];
  return installer.default(extensions.map((name) => installer[name]), forceDownload).catch(console.log);
};

const createWindow = async () => {
  if (isDebug) await installExtensions();

  mainWindow = new BrowserWindow({
    show: false,
    width: 1254,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged ? path.join(__dirname, 'preload.js') : path.join(__dirname, '../../.erb/dll/preload.js'),
      devTools: true,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  try {
    log.info('Initializing database...');
    await initDB();
    log.info('Database initialized successfully.');
  } catch (error) {
    log.error('CRITICAL: Failed to initialize database on startup.', error);
    app.quit();
    return;
  }

  createWindow();

  // Register global shortcut for search
  globalShortcut.register('CommandOrControl+K', () => {
    mainWindow?.webContents.send('open-search');
  });

}).catch((error) => {
  log.error('CRITICAL: Unhandled error in app.whenReady.', error);
  app.quit();
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});
