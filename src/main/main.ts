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
  getTaskWorkSessions,
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
  getDailyStandupData,
  getDailyReportData,
  getWebBlockingSettings,
  saveWebBlockingSettings,
  getWebStats,
  setDomainCategory,
  getAppStats,
  setAppCategory
} from './db';
import { autoScheduleTasks, getProposedSchedule } from './TaskScheduler';
import { ProductivityAnalyst, AnalysisResult } from './ProductivityAnalysis';
import { neuralCore } from './NeuralCore';
import { startServer, stopServer, updateServerState, restartServer, requestSync, serverEvents } from './server';
import { startAppMonitor, stopAppMonitor } from './AppMonitor';

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

const sendAiNotification = (title: string, body: string) => {
    const notification = new Notification({
        title,
        body,
        icon: appIconPath
    });

    notification.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            setTimeout(() => {
                mainWindow?.webContents.send('ai-companion:show-message', body);
            }, 500);
        }
    });

    notification.show();
};

// --- Listen for Extension Events ---
serverEvents.on('task-draft', (draft) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    // Send to renderer
    mainWindow.webContents.send('task:draft-received', draft);
    
    // Use unified notification
    sendAiNotification('Task Draft Received', `From: ${draft.title.substring(0, 30)}...`);
  }
});

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

const trayIconPath = getAssetPath('icons', 'tray-icon.png');
const appIconPath = getAssetPath('icons', 'icon.png');

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

      notification.on('click', () => {
          if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('ai-companion:show-message', "Zrobiłeś sobie przerwę? ☕");
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
              sendAiNotification('🎗 Habit Reminder', `Nie zapomnij o nawyku: ${habit.title}!`);
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
    { label: 'Show App', click: () => { mainWindow?.show(); } },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Thingy App');
  tray.setTitle('');

  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow?.hide() : mainWindow?.show();
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
         sendAiNotification('🎉 Challenge Completed!', `Ukończyłeś: ${challenge.description} (+${challenge.xpReward} XP)`);
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
                  sendAiNotification('🎉 Challenge Completed!', `Ukończyłeś: ${challenge.description} (+${challenge.xpReward} XP)`);
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
ipcMain.handle('db:get-work-sessions', (event, userId, days) => getRecentWorkSessions(userId, days));
ipcMain.handle('db:get-task-work-sessions', (event, taskId) => getTaskWorkSessions(taskId));
ipcMain.handle('db:get-last-14-days-productivity', (event, userId) => getLast14DaysProductivity(userId));
ipcMain.handle('db:get-tag-analytics', (event, tagId) => getTagAnalytics(tagId));
ipcMain.handle('db:get-tag-by-name', (event, name) => getTagByName(name));
ipcMain.handle('db:get-all-tags', () => getAllTags());
ipcMain.handle('db:get-system-logs', (event, limit) => getSystemLogs(limit));
ipcMain.handle('db:get-neural-confidence', () => getNeuralConfidence());
ipcMain.handle('db:get-ai-maturity', () => getAiMaturity());
ipcMain.handle('db:get-ai-stats', () => getAiStats());

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

import { personalityEngine } from './PersonalityEngine';
import { getFocusContext } from './db';

// ... (existing imports)

// --- Listen for Extension Events ---
// ... (existing listeners)

ipcMain.handle('db:get-ai-message', (event, userId) => {
    // Gather Context
    const focusScore = getFocusContext(Date.now()) * 100; // 0-100
    const idleTimeMin = (powerMonitor.getSystemIdleTime()) / 60;
    
    // Get Task Info if available
    let tasksRemaining = 0;
    const sprint = getActiveSprint();
    if (sprint) {
        const tasks = getSprintTasks(sprint.id);
        tasksRemaining = tasks.filter(t => t.status !== 'Completed').length;
    }

    const context = {
        mood: 'STABLE' as any, // Will be overridden by generateMessage logic
        userName: 'Marcin', // Hardcoded or fetch from profile
        focusScore: Math.round(focusScore),
        idleTimeMin: Math.round(idleTimeMin),
        tasksRemaining,
        habitScore: 0.5 // Simplified
    };

    return personalityEngine.generateMessage(context);
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

ipcMain.handle('db:get-daily-standup', (event, userId) => {
  const stats = getDailyStandupData(userId);
  const schedule = getProposedSchedule(userId);
  const topTask = schedule.length > 0 ? schedule[0] : null;

  let suggestion = null;
  if (topTask) {
      suggestion = {
          id: topTask.id,
          title: topTask.title,
          link: topTask.link,
          aiReason: topTask.aiReason,
          neuralEst: (topTask.neuralEstimate || topTask.estimate || 0.5) * 60, // minutes
          priority: topTask.priority
      };
  }

  return {
      ...stats,
      topSuggestion: suggestion,
      isPeakHour: cachedInsights?.peakHours?.includes(new Date().getHours()) || false
  };
});

ipcMain.handle('db:get-daily-report-data', (event, userId) => getDailyReportData(userId));

ipcMain.handle('gamification:reward-fatigue-compliance', (event, userId) => {
  const profile = getProfile(userId);
  if (profile) {
    updateProfile({ ...profile, xp: profile.xp + 15 });
    logSystemEvent('Fatigue Model Validated: User accepted warning. (+15 XP)', 'LEARNING');
    sendAiNotification('Mindful Rest Reward', 'Dobrze, że słuchasz swojego organizmu! +15 XP');
  }
});

// --- Web Blocking IPC ---
ipcMain.handle('db:get-web-settings', () => getWebBlockingSettings());
ipcMain.handle('db:save-web-settings', (event, settings) => {
    saveWebBlockingSettings(settings);
    return true;
});
ipcMain.handle('db:get-web-stats', (event, days) => getWebStats(days));
ipcMain.handle('db:set-domain-category', (event, domain, category) => {
    setDomainCategory(domain, category);
    return true;
});
ipcMain.handle('db:get-app-stats', (event, days) => getAppStats(days));
ipcMain.handle('db:set-app-category', (event, appName, category) => {
    setAppCategory(appName, category);
    return true;
});
ipcMain.handle('server:restart', () => {
    restartServer();
    return true;
});

ipcMain.handle('server:request-sync', () => {
    requestSync();
    return true;
});

ipcMain.handle('app:open-devtools', () => {
  mainWindow?.webContents.openDevTools();
});

ipcMain.handle('app:set-window-opacity', (event, opacity) => {
    if (mainWindow) {
        mainWindow.setOpacity(opacity);
    }
});

ipcMain.handle('app:test-meditation-notif', () => {
    setTimeout(() => {
        sendAiNotification('🧘‍♀️ Czas na Mindfulness', 'Może krótka chwila na oddech?');
    }, 3000);
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
  updateServerState({ focusMode: true });

  updateTrayTitle();
  trayTimerInterval = setInterval(updateTrayTitle, 1000);
});

ipcMain.on('tray:stop-timer', () => {
  activeTaskInfo = null;
  if (trayTimerInterval) clearInterval(trayTimerInterval);
  trayTimerInterval = null;
  updateServerState({ focusMode: false });
  if (tray) {
    tray.setTitle('');
    tray.setToolTip('Thingy App');
  }
});

ipcMain.on('tray:get-icon-path', (event) => {
  event.returnValue = trayIconPath;
});

ipcMain.on('electron-shell-open-external', (event, url) => {
  shell.openExternal(url);
});

let lastFragmentationNotificationTime = 0;
let lastStretchingTime = Date.now();
let lastWaterTime = Date.now();
let lastMeditationDate: string | null = null;

// Smart Notification States
let sentMorningNudge = false;
let sentEveningNudge = false;
let lastStaleTaskCheck = 0;
let currentDayString = new Date().toDateString();

setInterval(() => {
  const now = Date.now();
  const currentDate = new Date();
  const currentHour = currentDate.getHours();
  const currentMinute = currentDate.getMinutes();
  const dateString = currentDate.toDateString();

  // Reset daily flags at midnight
  if (dateString !== currentDayString) {
      sentMorningNudge = false;
      sentEveningNudge = false;
      lastMeditationDate = null;
      currentDayString = dateString;
  }

  // --- Health Reminders ---
  const aiEnabled = getSetting('enable_ai_assistant') !== 'false';
  
  if (aiEnabled) {
      // 1. Water (Random interval ~60-90 min)
      if (getSetting('enable_water_reminders') === 'true') {
          // Check if at least 60 mins passed
          if (now - lastWaterTime > 60 * 60 * 1000) {
              // 30% chance every 5 mins check after 1h (effectively random within 1-1.5h range usually)
              if (Math.random() < 0.3) {
                  sendAiNotification('💧 Nawodnienie', 'Pamiętasz o piciu wody?');
                  lastWaterTime = now;
              }
          }
      }

      // 2. Stretching (Interval based, only during work hours)
      const stretchingEnabled = getSetting('enable_stretching_reminders') === 'true';
      if (stretchingEnabled) {
          const workStart = getSetting('workDayStart') || '09:00';
          const workEnd = getSetting('workDayEnd') || '17:00';
          const [startH, startM] = workStart.split(':').map(Number);
          const [endH, endM] = workEnd.split(':').map(Number);
          
          const nowMinutes = currentHour * 60 + currentMinute;
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;

          if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
              const interval = Number(getSetting('stretching_interval') || 60) * 60 * 1000;
              if (now - lastStretchingTime > interval) {
                  // Sprawdź czy użytkownik nie jest idle (nie ma sensu przypominać jak go nie ma)
                  const idleTime = powerMonitor.getSystemIdleTime();
                  if (idleTime < 60) { // Mniej niż minuta idle
                      sendAiNotification('🏃 Czas na ruch!', 'Wyprostuj plecy i rozluźnij szyję. Zrobione?');
                      lastStretchingTime = now;
                  } else {
                      // Jeśli idle, przesuń sprawdzanie (żeby odpaliło jak wróci)
                      lastStretchingTime = now - interval + (5 * 60 * 1000); 
                  }
              }
          }
      }

      // 2. Meditation (Time based)
      const meditationEnabled = getSetting('enable_meditation_reminders') === 'true';
      if (meditationEnabled && lastMeditationDate !== dateString) {
          const targetTime = getSetting('meditation_time') || '09:00';
          const [targetH, targetM] = targetTime.split(':').map(Number);
          
          const nowMins = currentHour * 60 + currentMinute;
          const targetMins = targetH * 60 + targetM;
          
          // Check if we passed the target time (with a tolerance window, e.g., within the last 15 mins to avoid spam on startup if missed)
          if (nowMins >= targetMins && nowMins < targetMins + 60) {
               sendAiNotification('🧘‍♀️ Czas na Mindfulness', 'Może krótka chwila na oddech?');
               lastMeditationDate = dateString;
          }
      }

      // --- Advanced Productivity Algorithms ---
      
      const workStart = getSetting('workDayStart') || '09:00';
      const workEnd = getSetting('workDayEnd') || '17:00';
      const [startH, startM] = workStart.split(':').map(Number);
      const [endH, endM] = workEnd.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // 3. Morning Nudge (Anti-Procrastination)
      // If 1 hour passed since work start, and NO work logged yet
      if (!sentMorningNudge && currentMinutes > startMinutes + 60 && currentMinutes < endMinutes) {
          const userId = activeTaskInfo?.userId || 1; // Default or active
          const todayStats = getDailyProductivity(userId).find((d:any) => d.date === new Date().toISOString().split('T')[0]);
          
          if (!todayStats || todayStats.totalDuration === 0) {
              sendAiNotification('☕ Trudny poranek?', 'Minęła godzina pracy, a licznik stoi. Zacznij od czegoś małego (5 min)!');
              sentMorningNudge = true;
          }
      }

      // 4. Evening Wrap-up
      // 30 mins before end of day
      if (!sentEveningNudge && currentMinutes >= endMinutes - 30 && currentMinutes < endMinutes) {
          sendAiNotification('🏁 Ostatnia prosta', 'Koniec dnia blisko. Czas na podsumowanie i plan na jutro!');
          sentEveningNudge = true;
      }

      // 5. "Eat the Frog" (Stale High Priority Tasks) - Check every 2 hours
      if (now - lastStaleTaskCheck > 2 * 60 * 60 * 1000) {
          const userId = activeTaskInfo?.userId || 1;
          const tasks = getTasks(userId);
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

          const frog = tasks.find((t: any) => 
              t.priority === 'High' && 
              t.status !== 'Completed' && 
              new Date(t.createdAt) < twoDaysAgo
          );

          if (frog) {
              sendAiNotification('🐸 Zjedz tę żabę!', `Zadanie "${frog.title}" czeka już długo. Może zajmiemy się tym teraz?`);
          }
          lastStaleTaskCheck = now;
      }
  }

  if (cachedInsights) {
    const currentHour = new Date().getHours();
    const dateString = new Date().toDateString();

    if (lastPeakHourNotificationDate !== dateString) {
      if (cachedInsights.peakHours.includes(currentHour)) {
        logSystemEvent(`Golden Hour Detected: It's ${currentHour}:00 - your peak productivity time.`, 'PRODUCTIVITY');
        sendAiNotification('🚀 Golden Hour', `It's ${currentHour}:00! To Twój czas najwyższej produktywności.`);
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

              sendAiNotification('⚠️ Fragmented Focus', 'Skaczesz między zadaniami. Może czas skupić się na jednym?');

              lastFragmentationNotificationTime = now;
          }
      }
  }

  checkHabitReminders();

}, 5 * 60 * 1000);

setInterval(() => {
  if (activeTaskInfo) {
    const idleTime = powerMonitor.getSystemIdleTime();
    const threshold = Number(getSetting('idleTimeout') || 600);
    if (idleTime >= threshold) {
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
    opacity: Number(getSetting('window_opacity')) || 1.0
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
    startServer();
    startAppMonitor();
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

  globalShortcut.register('CommandOrControl+Shift+T', () => {
    sendAiNotification('Testowe Powiadomienie', 'To jest wiadomość testowa od Twojego Kota! 🐾');
  });

}).catch((error) => {
  log.error('CRITICAL: Unhandled error in app.whenReady.', error);
  app.quit();
});

app.on('will-quit', () => {
  stopServer();
  stopAppMonitor();
  globalShortcut.unregisterAll();
});
