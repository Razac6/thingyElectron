/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut, Notification, powerMonitor } from 'electron';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  initDB,
  getTasks, createTask, updateTask, deleteTask, updateTasksOrder,
  getSprints,
  createSprint,
  updateSprintStatus,
  updateSprint,
  getActiveSprint,
  getSprintTasks,
  getNotes,
  createNote,
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
  getNeuralConfidence,
  getAiMaturity,
  getAiStats,
  getChecklistItems,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  getAllSettings,
  getSetting,
  setSetting,
  getDailyBio,
  updateDailyBio,
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  logHabit,
  getHabitLogs,
  getTopHabit,
  toggleHabitFavorite,
  getDailyStandupData
} from './db';
import { autoScheduleTasks, getProposedSchedule } from './TaskScheduler';
import { ProductivityAnalyst, AnalysisResult } from './ProductivityAnalysis';
import { neuralCore } from './NeuralCore';

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

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// --- Smart Insights State ---
let cachedInsights: AnalysisResult | null = null;
let hasSentFatigueWarning = false;
let lastPeakHourNotificationDate: string | null = null;

const refreshInsights = async (userId: number) => {
  try {
    const recentSessions = getRecentWorkSessions(userId, 30);
    const trendData = getLast14DaysProductivity(userId);
    const tagData = getTagAnalyticsWithNames(); // This returns {id, name, ema, std_dev...}
    const allTasks = getTasks(userId);

    // Create a map for the analysis
    const tagMap = new Map<number, string>();
    tagData.forEach((t: any) => tagMap.set(t.id, t.name));

    const newConsistency = ProductivityAnalyst.analyzeTagConsistency(tagData, tagMap);
    const difficultyProfile = ProductivityAnalyst.analyzeTagDifficulty(allTasks);

    // Filter out undefined names just in case
    newConsistency.consistent = newConsistency.consistent.filter(name => !!name);
    newConsistency.volatile = newConsistency.volatile.filter(name => !!name);

    if (cachedInsights && cachedInsights.tagConsistency) {
        const oldConsistent = new Set(cachedInsights.tagConsistency.consistent);
        const oldVolatile = new Set(cachedInsights.tagConsistency.volatile);

        newConsistency.consistent.forEach(tag => {
            if (!oldConsistent.has(tag)) {
                logSystemEvent(`Tag #${tag} achieved CONSISTENCY stability. Standard Deviation is low.`, 'LEARNING');
            }
        });

        newConsistency.volatile.forEach(tag => {
            if (!oldVolatile.has(tag)) {
                logSystemEvent(`Tag #${tag} is now VOLATILE. High variance detected in session times.`, 'LEARNING');
            }
        });
    }

    const trend = ProductivityAnalyst.analyzeTrend(trendData);
    const fatigueProfile = ProductivityAnalyst.analyzeFatigue(recentSessions);
    const dailyBio = getDailyBio(new Date().toISOString().split('T')[0]);
    const algoTip = ProductivityAnalyst.generateDailyTip(
        trend,
        fatigueProfile,
        dailyBio.mode,
        dailyBio.sleepScore || 75,
        dailyBio.meetingTime || 0
    );

    cachedInsights = {
      peakHours: ProductivityAnalyst.identifyPeakHours(recentSessions).peakHours,
      peakHourRange: ProductivityAnalyst.identifyPeakHours(recentSessions).formattedRange,
      fatigueProfile,
      trend,
      focusScore: ProductivityAnalyst.analyzeFocusQuality(recentSessions),
      tagConsistency: newConsistency,
      tagDifficulty: difficultyProfile,
      dailyTip: algoTip,
      dailyTipCategory: 'neutral'
    };

    // Usunięto aktualizację porady przez AI
    log.info('Smart Insights Refreshed');

    const today = new Date().toISOString().split('T')[0];
    const existingChallenge = getDailyChallenge(userId, today);

    if (!existingChallenge && cachedInsights) {
      const config = ProductivityAnalyst.generateDailyChallenge(cachedInsights.trend, cachedInsights.fatigueProfile, dailyBio.mode);
      createDailyChallenge({
        userId,
        date: today,
        ...config
      });
      log.info('New Daily Challenge Generated:', config);
      logSystemEvent(`New Daily Challenge: ${config.description}`, 'GAMIFICATION');
    }

  } catch (e: any) {
    log.error('Failed to refresh insights', e);
    logSystemEvent(`Insights Refresh Error: ${e.message}`, 'DEBUG');
  }
};

const getAssetPath = (...paths: string[]): string => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
  return path.join(RESOURCES_PATH, ...paths);
};

const trayIconPath = getAssetPath('icon.png');

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

  if (cachedInsights && !hasSentFatigueWarning) {
    const elapsedMinutes = elapsedSinceStart / (1000 * 60);
    const limit = cachedInsights.fatigueProfile.maxRecommended;

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
      hasSentFatigueWarning = true;
    }
  }
};

const notifiedHabits = new Set<string>();

const checkHabitReminders = () => {
  const enabled = getSetting('habit_notifications_enabled') !== 'false';
  if (!enabled) return;

  const userId = activeTaskInfo?.userId || 1;

  const habits = getHabits(userId);
  const logs = getHabitLogs(userId);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  habits.forEach((habit: any) => {
      let isDue = false;
      if (habit.frequency.type === 'daily') isDue = true;
      else {
          const dayOfWeek = now.getDay();
          if (habit.frequency.days.includes(dayOfWeek)) isDue = true;
      }

      if (!isDue) return;

      const isDone = logs.some((l: any) => l.habitId === habit.id && l.date === today && l.value >= 1);
      if (isDone) return;

      if (!habit.reminderTime) return;
      const [remHour, remMin] = habit.reminderTime.split(':').map(Number);

      const targetTimeMin = (remHour * 60) + remMin;
      const currentTimeMin = (currentHour * 60) + currentMinute;
      const thresholdMin = targetTimeMin + 180;

      if (currentTimeMin >= thresholdMin) {
          const key = `${habit.id}-${today}`;
          if (!notifiedHabits.has(key)) {
              new Notification({
                  title: '🎗 Habit Reminder',
                  body: `Don't break the chain! You haven't marked "${habit.title}" as done yet.`,
                  icon: getAssetPath('icon.png')
              }).show();
              notifiedHabits.add(key);
              logSystemEvent(`Sent reminder for habit: ${habit.title}`, 'HABIT');
          }
      }
  });
};

const createTray = () => {
  if (tray) return;
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { 
        setCompactMode(false);
        mainWindow?.show(); 
    } },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Thingy App');
  tray.setTitle('');

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
        mainWindow.hide();
    } else {
        setCompactMode(false);
        mainWindow?.show();
    }
  });

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
ipcMain.handle('db:log-work-session', async (event, session) => {
  logWorkSession(session);

  if (activeTaskInfo && activeTaskInfo.userId) {
     const userId = activeTaskInfo.userId;
     const today = new Date().toISOString().split('T')[0];
     const challenge: any = getDailyChallenge(userId, today);

     if (challenge && challenge.status === 'ACTIVE') {
       let newProgress = challenge.progress;

       if (challenge.type === 'TOTAL_DURATION') {
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
ipcMain.handle('db:update-task', (event, task) => {
  const updated = updateTask(task);

  if (task.status === 'Completed' && task.userId) {
      const today = new Date().toISOString().split('T')[0];
      const challenge: any = getDailyChallenge(task.userId, today);

      if (challenge && challenge.status === 'ACTIVE') {
          let newProgress = challenge.progress;
          let shouldUpdate = false;

          if (challenge.type === 'FROG_EATER') {
              if (task.priority === 'High') {
                  newProgress += 1;
                  shouldUpdate = true;
              }
          } else if (challenge.type === 'BACKLOG_CLEANER') {
              newProgress += 1;
              shouldUpdate = true;
          }

          if (shouldUpdate) {
              const status = newProgress >= challenge.target ? 'COMPLETED' : 'ACTIVE';
              updateDailyChallengeProgress(challenge.id, newProgress, status);
              if (status === 'COMPLETED') {
                  new Notification({
                      title: '🎉 Challenge Completed!',
                      body: `You completed: ${challenge.description} (+${challenge.xpReward} XP)`,
                      icon: getAssetPath('icon.png'),
                  }).show();
                  const profile = getProfile(task.userId);
                  if (profile) updateProfile({ ...profile, xp: profile.xp + challenge.xpReward });
              }
          }
      }
  }
  return updated;
});
ipcMain.handle('db:delete-task', (event, taskId) => deleteTask(taskId));
ipcMain.handle('db:update-tasks-order', (event, taskIds) => updateTasksOrder(taskIds));
ipcMain.handle('db:auto-schedule-tasks', (event, userId) => autoScheduleTasks(userId));
ipcMain.handle('db:get-proposed-schedule', (event, userId) => getProposedSchedule(userId));
ipcMain.handle('db:get-sprints', () => getSprints());
ipcMain.handle('db:create-sprint', (event, sprint) => createSprint(sprint));
ipcMain.handle('db:update-sprint', (event, sprint) => updateSprint(sprint));
ipcMain.handle('db:update-sprint-status', (event, sprintId, status) => updateSprintStatus(sprintId, status));
ipcMain.handle('db:get-sprint-analysis', (event, userId) => {
    const sprint = getActiveSprint();
    if (!sprint) return null;
    const tasks = getSprintTasks(sprint.id);
    const unfinished = tasks.filter(t => t.status !== 'Completed');

    const predictions = unfinished.map(t => neuralCore.predictForTask(t));
    const sessions = getRecentWorkSessions(userId, 14);

    const workStart = getSetting('workDayStart') || '09:00';
    const workEnd = getSetting('workDayEnd') || '17:00';

    return ProductivityAnalyst.analyzeSprintRisk(sprint, tasks, sessions, predictions, { start: workStart, end: workEnd });
});
ipcMain.handle('db:get-notes', (event, userId) => getNotes(userId));
ipcMain.handle('db:create-note', (event, note, userId) => createNote(note, userId));
ipcMain.handle('db:update-note', (event, note) => updateNote(note));
ipcMain.handle('db:delete-note', (event, noteId) => deleteNote(noteId));
ipcMain.handle('db:login', async (event, { username, password }) => {
  const user = loginUser(username, password);
  if (user) {
    await refreshInsights(user.id);

    try {
        const tasks = getTasks(user.id);
        neuralCore.train(tasks).catch(err => log.error('Neural Training Failed', err));
    } catch (e) {
        log.error('Failed to trigger neural training', e);
    }

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
ipcMain.handle('db:get-contribution-data', (event, userId, days) => getContributionData(userId, days));
ipcMain.handle('db:get-tag-analytics', (event, tagId) => getTagAnalytics(tagId));
ipcMain.handle('db:get-tag-by-name', (event, name) => getTagByName(name));
ipcMain.handle('db:get-all-tags', () => getAllTags());
ipcMain.handle('db:get-system-logs', (event, limit) => getSystemLogs(limit));
ipcMain.handle('db:get-neural-confidence', () => getNeuralConfidence());
ipcMain.handle('db:get-ai-maturity', () => getAiMaturity());
ipcMain.handle('db:get-ai-stats', () => getAiStats());
ipcMain.handle('db:get-energy-level', () => neuralCore.getEnergyLevel());

// Settings Handlers
ipcMain.handle('db:get-all-settings', () => getAllSettings());
ipcMain.handle('db:set-setting', (event, key, value) => setSetting(key, value));

// Checklist Handlers
ipcMain.handle('db:get-checklist-items', (event, taskId) => getChecklistItems(taskId));
ipcMain.handle('db:add-checklist-item', (event, taskId, text) => addChecklistItem(taskId, text));
ipcMain.handle('db:toggle-checklist-item', (event, itemId, isCompleted) => toggleChecklistItem(itemId, isCompleted));
ipcMain.handle('db:delete-checklist-item', (event, itemId) => deleteChecklistItem(itemId));

// Daily Bio Handlers
ipcMain.handle('db:get-daily-bio', (event, date) => getDailyBio(date));
ipcMain.handle('db:update-daily-bio', (event, date, data) => updateDailyBio(date, data));

// Habit Tracker Handlers
ipcMain.handle('db:get-habits', (event, userId) => getHabits(userId));
ipcMain.handle('db:create-habit', (event, habit, userId) => createHabit(habit, userId));
ipcMain.handle('db:update-habit', (event, habit) => updateHabit(habit));
ipcMain.handle('db:delete-habit', (event, habitId) => deleteHabit(habitId));
ipcMain.handle('db:log-habit', (event, habitId, date, value) => logHabit(habitId, date, value));
ipcMain.handle('db:get-habit-logs', (event, userId, fromDate) => getHabitLogs(userId, fromDate));
ipcMain.handle('db:get-top-habit', (event, userId) => getTopHabit(userId));
ipcMain.handle('db:toggle-habit-favorite', (event, habitId, userId) => toggleHabitFavorite(habitId, userId));

// Neural Handlers
ipcMain.handle('db:predict-duration', (event, task) => neuralCore.predict(task));
ipcMain.handle('db:get-ai-performance', (event, userId, days) => neuralCore.getPerformanceHistory(userId, days));
ipcMain.handle('db:generate-daily-report', (event, userId) => neuralCore.generateDailyReport(userId));
ipcMain.handle('db:force-neural-training', (event, userId) => {
    neuralCore.resetCooldown();
    const tasks = getTasks(userId);
    neuralCore.train(tasks).catch(err => log.error('Manual Neural Training Failed', err));
    return true;
});

ipcMain.handle('db:get-productivity-insights', async (event, userId) => {
  refreshInsights(userId); // Ensure fresh data

  // Trigger Neural Training in background
  try {
      const tasks = getTasks(userId);
      neuralCore.train(tasks).catch(err => log.error('Neural Training Failed', err));
  } catch (err) {
      log.error('Failed to trigger neural training', err);
  }

  return cachedInsights;
});

ipcMain.handle('db:get-daily-standup', (event, userId) => getDailyStandupData(userId));

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

  hasSentFatigueWarning = false;

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

ipcMain.on('tray:get-icon-path', (event) => {
  event.returnValue = trayIconPath;
});

let lastFragmentationNotificationTime = 0;

setInterval(() => {
  const now = Date.now();

  if (cachedInsights) {
    const currentHour = new Date().getHours();
    const dateString = new Date().toDateString();

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
  }

  if (now - lastFragmentationNotificationTime > 30 * 60 * 1000) {
      if (activeTaskInfo && activeTaskInfo.userId) {
          const sessions = getRecentWorkSessions(activeTaskInfo.userId, 1);
          const oneHourAgo = now - (60 * 60 * 1000);

          const recentShortSessions = sessions.filter((s: any) => {
              const endTime = new Date(s.endTime || s.startTime).getTime();
              return endTime > oneHourAgo && s.duration < (10 * 60 * 1000);
          });

          if (recentShortSessions.length >= 5) {
              logSystemEvent(`High Fragmentation Detected: ${recentShortSessions.length} short sessions (<10m) in the last hour.`, 'PRODUCTIVITY');

              new Notification({
                  title: '⚠️ Fragmented Focus',
                  body: 'You are switching contexts rapidly. Consider sticking to one task for at least 20 minutes.',
                  icon: getAssetPath('icon.png')
              }).show();

              lastFragmentationNotificationTime = now;
          }
      }
  }

  checkHabitReminders();

}, 5 * 60 * 1000);

setInterval(() => {
  if (activeTaskInfo) {
    const idleTime = powerMonitor.getSystemIdleTime();
    if (idleTime >= 600) {
      if (mainWindow) {
        mainWindow.webContents.send('activity:idle-detected');
      }
    }
  }
}, 60000);


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

// --- Notch Island / Compact Mode Logic ---
const setCompactMode = (enabled: boolean) => {
  if (!mainWindow) return;

      if (enabled) {

        const { screen } = require('electron');

        const primaryDisplay = screen.getPrimaryDisplay();

        const { width } = primaryDisplay.bounds; // Use bounds (full screen)

  

        mainWindow.setAlwaysOnTop(true, 'screen-saver');

        mainWindow.setVisibleOnAllWorkspaces(true);

        

        if (process.platform === 'win32') {

            mainWindow.setSkipTaskbar(true);

            mainWindow.setFullScreenable(false);

            mainWindow.setMenu(null);

        }

  

        mainWindow.setResizable(false);

        mainWindow.setFullScreen(false);

        

        mainWindow.setHasShadow(false);

  

        // Start as small pill (200px width), height 300px to allow expansion without clipping

        mainWindow.setBounds({

          width: 200, 

          height: 300, 

          x: Math.floor(width / 2 - 100),

          y: 0,

        }, true);

  

        // Crucial for Windows: Ensure window is visible/restored if minimize wasn't fully prevented

        if (mainWindow.isMinimized()) mainWindow.restore();

        mainWindow.show();

  

        mainWindow.webContents.send('enter-compact-mode');

      } else {    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    
    if (process.platform === 'win32') {
        mainWindow.setSkipTaskbar(false);
        mainWindow.setResizable(true);
    }

    mainWindow.setHasShadow(true);

    mainWindow.setBounds({
      width: 1254,
      height: 728,
    }, true);
    
    mainWindow.center();
    mainWindow.webContents.send('exit-compact-mode');
  }
};

const createWindow = async () => {
  if (isDebug) await installExtensions();

  mainWindow = new BrowserWindow({
    show: false,
    width: 1254,
    height: 728,
    icon: getAssetPath('icon.png'),
    transparent: true, // Crucial for Notch Island effect
    backgroundColor: '#00000000', // Fully transparent by default
    frame: process.platform === 'darwin' ? false : true, // Frameless on Mac for Notch, native on Windows
    titleBarStyle: 'hiddenInset', // Better integration on Mac
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

  // Intercept minimize to enter compact mode if setting is enabled
  mainWindow.on('minimize', (event) => {
    const isMac = process.platform === 'darwin';
    const useNotch = getSetting('enableMacosNotch') === 'true';

    if (isMac && useNotch) {
      event.preventDefault();
      setCompactMode(true);
    }
  });

  ipcMain.on('restore-window', () => {
    setCompactMode(false);
    mainWindow?.show();
    mainWindow?.focus();
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

  globalShortcut.register('CommandOrControl+K', () => {
    mainWindow?.webContents.send('open-search');
  });

}).catch((error) => {
  log.error('CRITICAL: Unhandled error in app.whenReady.', error);
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
