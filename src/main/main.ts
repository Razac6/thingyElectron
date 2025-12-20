/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut, Notification, powerMonitor } from 'electron';
// import { autoUpdater } from 'electron-updater'; // Commented out: electron-updater
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
  toggleHabitFavorite
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
    const allTasks = getTasks(userId); // Fetch all tasks for difficulty analysis
    
    // Create a map for the analysis
    const tagMap = new Map<number, string>();
    tagData.forEach((t: any) => tagMap.set(t.id, t.name));

    const newConsistency = ProductivityAnalyst.analyzeTagConsistency(tagData, tagMap);
    const difficultyProfile = ProductivityAnalyst.analyzeTagDifficulty(allTasks); // Calculate difficulty

    // --- Detect & Log Consistency Shifts ---
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
    const neuralResult = neuralCore.getNeuralAdvice(activeTaskInfo?.title);

    let finalTip = neuralResult.text;
    let finalCategory = neuralResult.category;

    // Prioritize Meeting Overload Tip
    if ((dailyBio.meetingTime || 0) > 90) {
        finalTip = algoTip;
        finalCategory = (dailyBio.meetingTime || 0) > 180 ? 'high' : 'neutral';
    }

    cachedInsights = {
      peakHours: ProductivityAnalyst.identifyPeakHours(recentSessions).peakHours,
      peakHourRange: ProductivityAnalyst.identifyPeakHours(recentSessions).formattedRange,
      fatigueProfile,
      trend,
      focusScore: ProductivityAnalyst.analyzeFocusQuality(recentSessions),
      tagConsistency: newConsistency,
      tagDifficulty: difficultyProfile, // Include in insights
      dailyTip: finalTip,
      dailyTipCategory: finalCategory
    };
    log.info('Smart Insights Refreshed:', cachedInsights);

    // --- Daily Challenge Generation ---
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

// --- Habit Reminders ---
const notifiedHabits = new Set<string>(); // Key: "habitId-YYYY-MM-DD"

const checkHabitReminders = () => {
  const enabled = getSetting('habit_notifications_enabled') !== 'false'; // Default true
  if (!enabled) return;

  // We need a userId. For local single-user app, we can iterate all users or just use the last active one.
  // Since we don't have global user context easily here without session, we'll try to get it from activeTaskInfo or just assume userId=1 for MVP if single user.
  // Better approach: Fetch all habits for all users? No, iterate known users?
  // Let's assume userId=1 for now as per other parts of the app (localStorage userId default).
  // Or better: pass userId if we can.
  // Actually, we can just fetch ALL habits if we had a getAllHabits. But we only have getHabits(userId).
  // Let's assume single user (ID 1) or try to rely on `activeTaskInfo.userId`.
  
  const userId = activeTaskInfo?.userId || 1; 

  const habits = getHabits(userId);
  const logs = getHabitLogs(userId);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  habits.forEach((habit: any) => {
      // 1. Is it due today?
      let isDue = false;
      if (habit.frequency.type === 'daily') isDue = true;
      else {
          const dayOfWeek = now.getDay();
          if (habit.frequency.days.includes(dayOfWeek)) isDue = true;
      }

      if (!isDue) return;

      // 2. Is it done?
      const isDone = logs.some((l: any) => l.habitId === habit.id && l.date === today && l.value >= 1);
      if (isDone) return;

      // 3. Is it time? (Reminder + 3 hours)
      if (!habit.reminderTime) return;
      const [remHour, remMin] = habit.reminderTime.split(':').map(Number);
      
      // Target time in minutes from midnight
      const targetTimeMin = (remHour * 60) + remMin;
      // Current time in minutes
      const currentTimeMin = (currentHour * 60) + currentMinute;
      
      // Threshold: 3 hours later (180 mins)
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
ipcMain.handle('db:log-work-session', async (event, session) => {
  logWorkSession(session);

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
ipcMain.handle('db:update-task', (event, task) => {
  const updated = updateTask(task);

  // --- Check Daily Challenge (Task-based) ---
  if (task.status === 'Completed' && task.userId) { // Ensure we have userId
      const today = new Date().toISOString().split('T')[0];
      const challenge: any = getDailyChallenge(task.userId, today);

      if (challenge && challenge.status === 'ACTIVE') {
          let newProgress = challenge.progress;
          let shouldUpdate = false;

          if (challenge.type === 'FROG_EATER') {
              // High Priority Task
              if (task.priority === 'High') {
                  newProgress += 1;
                  shouldUpdate = true;
              }
          } else if (challenge.type === 'BACKLOG_CLEANER') {
              // Any task (or maybe small tasks? Let's say any for now to be simple, or < 1h)
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
                  // Grant XP
                  const profile = getProfile(task.userId);
                  if (profile) updateProfile({ ...profile, xp: profile.xp + challenge.xpReward });
              }
          }
      }
  }
  return updated;
});
ipcMain.handle('db:delete-task', (event, taskId) => deleteTask(taskId)); // Use deleteTask directly
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

    // Fetch work hours from settings
    const workStart = getSetting('workDayStart') || '09:00';
    const workEnd = getSetting('workDayEnd') || '17:00';

    return ProductivityAnalyst.analyzeSprintRisk(sprint, tasks, sessions, predictions, { start: workStart, end: workEnd });
});
ipcMain.handle('db:get-notes', (event, userId) => getNotes(userId));
ipcMain.handle('db:create-note', (event, note, userId) => createNote(note, userId));
ipcMain.handle('db:update-note', (event, note) => updateNote(note));
ipcMain.handle('db:delete-note', (event, noteId) => deleteNote(noteId));
ipcMain.handle('db:login', (event, { username, password }) => {
  const user = loginUser(username, password);
  if (user) {
    refreshInsights(user.id); // Load insights on login
    
    // Train Neural Core
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

// --- Background Productivity Checks (Peak Hours & Fragmentation) ---
let lastFragmentationNotificationTime = 0;

setInterval(() => {
  const now = Date.now();
  
  // 1. Peak Hours Check (Existing)
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

  // 2. Fragmentation / Context Switching Check
  // Run this check max once every 30 minutes to avoid spam
  if (now - lastFragmentationNotificationTime > 30 * 60 * 1000) {
      // We need a userId. This background task is global, so it's tricky in multi-user, 
      // but for local app we can use activeTaskInfo.userId if available, or just skip if no active user context.
      // Alternatively, check for the last logged in user if available? 
      // Safe bet: only check if a timer is active or recently active.
      
      if (activeTaskInfo && activeTaskInfo.userId) {
          const sessions = getRecentWorkSessions(activeTaskInfo.userId, 1); // Get last 1 day sessions
          const oneHourAgo = now - (60 * 60 * 1000);
          
          // Filter sessions from last hour
          const recentShortSessions = sessions.filter((s: any) => {
              const endTime = new Date(s.endTime || s.startTime).getTime(); // Fallback if endTime missing
              return endTime > oneHourAgo && s.duration < (10 * 60 * 1000); // Less than 10 mins
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
  
  // 3. Habit Reminders
  checkHabitReminders();

}, 5 * 60 * 1000); // Check every 5 minutes (reduced from 15 for better responsiveness)

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