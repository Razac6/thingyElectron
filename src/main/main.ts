/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  Notification,
  powerMonitor,
} from 'electron';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  initDB,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTasksOrder,
  getSprints,
  createSprint,
  updateSprintStatus,
  updateSprint,
  getActiveSprint,
  getSprintTasks,
  getNotes,
  createNote,
  loginUser,
  getProfile,
  updateProfile,
  getEarnedAchievements,
  grantAchievement,
  globalSearch,
  getAverageTimeForTaskType,
  getAverageSprintCapacity,
  logWorkSession,
  adjustTaskWorkTime,
  getHourlyProductivity,
  getDailyProductivity,
  getWorkHistory,
  getContributionData,
  getRecentWorkSessions,
  getTaskWorkSessions,
  getLast14DaysProductivity,
  getDeepWorkHistory,
  getDailyChallenge,
  createDailyChallenge,
  updateDailyChallengeProgress,
  getTagAnalytics,
  getTagByName,
  getTagAnalyticsWithNames,
  getAllTags,
  getSystemLogs,
  logSystemEvent,
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
  setAppCategory,
  getLifetimeStats,
  getDistractionStats,
  getDailyDeepWorkStats,
  getSuggestedCommitMessage,
  updateNote,
  deleteNote,
  getFocusContext,
  startNewExpedition,
  getCurrentStreak,
  getAverageVelocity,
  getDailyHabitScores,
} from './db';
import { autoScheduleTasks, getProposedSchedule } from './TaskScheduler';
import { ProductivityAnalyst, AnalysisResult } from './ProductivityAnalysis';
import { neuralCore } from './NeuralCore';
import { personalityEngine } from './PersonalityEngine';
import {
  startServer,
  stopServer,
  updateServerState,
  restartServer,
  requestSync,
  serverEvents,
} from './server';
import { startAppMonitor, stopAppMonitor } from './AppMonitor';
import { generateDailyStandup } from './DailyStandupAI';
import { contextNotificationEngine } from './ContextAwareNotifications';
import { procrastinationDetector } from './ProcrastinationDetector';

// --- Aggressive Error Logging ---
log.transports.file.level = 'info';
log.catchErrors({
  showDialog: false,
  onError: (error) => {
    log.error('Unhandled error in main process:', error);
    app.quit();
  },
});

if (process.platform === 'win32') {
  app.setAppUserModelId(app.isPackaged ? 'org.erb.Thingy' : process.execPath);
}

require('dotenv').config();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// --- Smart Insights State ---
let cachedInsights: AnalysisResult | null = null;
let hasSentFatigueWarning = false;
let lastPeakHourNotificationDate: string | null = null;

let isMeditating = false;
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

// Notification Types
type NotificationType = 'NORMAL' | 'IMPORTANT';

const sendAiNotification = (
  title: string,
  body: string,
  type: NotificationType = 'NORMAL',
) => {
  if (isMeditating) return; // Always mute during meditation

  // Focus Mode Muting logic
  if (activeTaskInfo && type === 'NORMAL') {
    return;
  }

  const notification = new Notification({
    title,
    body,
    icon: appIconPath,
  });

  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('task:draft-received', draft);
    sendAiNotification(
      'Task Draft Received',
      `From: ${draft.title.substring(0, 30)}...`,
      'IMPORTANT',
    );
  }
});

const refreshInsights = async (userId: number) => {
  try {
    const recentSessions = getRecentWorkSessions(userId, 30);
    const trendData = getLast14DaysProductivity(userId);
    const tagData = getTagAnalyticsWithNames();
    const allTasks = getTasks(userId);

    const tagMap = new Map<number, string>();
    tagData.forEach((t: any) => tagMap.set(t.id, t.name));

    const newConsistency = ProductivityAnalyst.analyzeTagConsistency(
      tagData,
      tagMap,
    );
    const difficultyProfile =
      ProductivityAnalyst.analyzeTagDifficulty(allTasks);

    newConsistency.consistent = newConsistency.consistent.filter(
      (name) => !!name,
    );
    newConsistency.volatile = newConsistency.volatile.filter((name) => !!name);

    if (cachedInsights && cachedInsights.tagConsistency) {
      const oldConsistent = new Set(cachedInsights.tagConsistency.consistent);
      const oldVolatile = new Set(cachedInsights.tagConsistency.volatile);

      newConsistency.consistent.forEach((tag) => {
        if (!oldConsistent.has(tag)) {
          logSystemEvent(
            `Tag #${tag} achieved CONSISTENCY stability.`,
            'LEARNING',
          );
        }
      });

      newConsistency.volatile.forEach((tag) => {
        if (!oldVolatile.has(tag)) {
          logSystemEvent(`Tag #${tag} is now VOLATILE.`, 'LEARNING');
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
      dailyBio.meetingTime || 0,
    );

    const dailyHabitScores = getDailyHabitScores(userId, 30);
    const habitCorrelation = ProductivityAnalyst.analyzeHabitCorrelation(
      dailyHabitScores,
      recentSessions,
    );

    cachedInsights = {
      peakHours:
        ProductivityAnalyst.identifyPeakHours(recentSessions).peakHours,
      peakHourRange:
        ProductivityAnalyst.identifyPeakHours(recentSessions).formattedRange,
      fatigueProfile,
      trend,
      focusScore: ProductivityAnalyst.analyzeFocusQuality(recentSessions),
      tagConsistency: newConsistency,
      tagDifficulty: difficultyProfile,
      dailyTip: algoTip,
      dailyTipCategory: 'neutral',
      habitCorrelation,
    };

    log.info('Smart Insights Refreshed');

    const today = new Date().toISOString().split('T')[0];
    const existingChallenge = getDailyChallenge(userId, today);

    if (!existingChallenge && cachedInsights) {
      const config = ProductivityAnalyst.generateDailyChallenge(
        cachedInsights.trend,
        cachedInsights.fatigueProfile,
        dailyBio.mode,
      );
      createDailyChallenge({
        userId,
        date: today,
        ...config,
      });
      log.info('New Daily Challenge Generated:', config);
      logSystemEvent(
        `New Daily Challenge: ${config.description}`,
        'GAMIFICATION',
      );
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
let activeTaskInfo: {
  title: string;
  startTime: number;
  estimate: number;
  initialSpendTime: number;
  userId?: number;
  timerMode?: string;
  duration?: number;
} | null = null;

function formatTimeForTray(ms: number): string {
  if (ms <= 0) return '00:00';
  const seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  minutes %= 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

const updateTrayTitle = () => {
  if (!tray || !activeTaskInfo) return;
  const { title, startTime, estimate, initialSpendTime, timerMode } =
    activeTaskInfo;

  const currentTime = Date.now();
  const elapsedSinceStart = currentTime - startTime;

  let timeString = '';

  if (timerMode === 'pomodoro') {
    // Countdown
    const pomodoroDuration =
      Number(getSetting('pomodoro_duration') || 25) * 60 * 1000;
    const remaining = Math.max(0, pomodoroDuration - elapsedSinceStart);
    timeString = formatTimeForTray(remaining);
  } else {
    // Count up
    const totalTime = initialSpendTime + elapsedSinceStart;
    const estimateTime = (estimate || 0) * 3600 * 1000;
    // Count down from the estimate when one is set; otherwise count elapsed time up
    // (estimateTime - totalTime would go negative with no estimate and get clamped to
    // 00:00 by formatTimeForTray, freezing the tray display).
    const remaining = estimateTime > 0 ? estimateTime - totalTime : totalTime;
    timeString = formatTimeForTray(remaining);
  }

  const shortTitle = title.length > 10 ? `${title.substring(0, 10)}...` : title;
  const menubarTitle = `${shortTitle} ${timeString}`;
  tray.setTitle(menubarTitle);
  tray.setToolTip(`Working on: ${title} (${timerMode || 'normal'})`);

  if (cachedInsights && !hasSentFatigueWarning) {
    const elapsedMinutes = elapsedSinceStart / (1000 * 60);
    const limit = cachedInsights.fatigueProfile.maxRecommended;
    if (elapsedMinutes > limit && limit > 10) {
      sendAiNotification(
        '🧠 Brain Fatigue Detected',
        `Passed session limit of ${limit}m. A break is recommended.`,
        'IMPORTANT',
      );

      // Auto-show cat for interaction
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          'ai-companion:show-message',
          'Zrobiłeś sobie przerwę? ☕',
        );
      }

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
    const isDone = logs.some(
      (l: any) => l.habitId === habit.id && l.date === today && l.value >= 1,
    );
    if (isDone) return;
    if (!habit.reminderTime) return;
    const [remHour, remMin] = habit.reminderTime.split(':').map(Number);
    const targetTimeMin = remHour * 60 + remMin;
    const currentTimeMin = currentHour * 60 + currentMinute;
    if (currentTimeMin >= targetTimeMin + 180) {
      const key = `${habit.id}-${today}`;
      if (!notifiedHabits.has(key)) {
        sendAiNotification(
          '🎗 Habit Reminder',
          `Nie zapomnij o nawyku: ${habit.title}!`,
        );
        notifiedHabits.add(key);
      }
    }
  });
};

const createTray = () => {
  if (tray) return;
  const icon = nativeImage
    .createFromPath(trayIconPath)
    .resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow?.hide();
    } else {
      mainWindow?.show();
    }
  });
  if (activeTaskInfo) updateTrayTitle();
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
    const { userId } = activeTaskInfo;
    const today = new Date().toISOString().split('T')[0];
    const challenge: any = getDailyChallenge(userId, today);
    if (challenge && challenge.status === 'ACTIVE') {
      let newProgress = challenge.progress;
      if (challenge.type === 'TOTAL_DURATION')
        newProgress += Math.round(session.duration / 60000);
      else if (challenge.type === 'DEEP_WORK' && session.duration >= 1200000)
        newProgress += Math.round(session.duration / 60000);
      const status = newProgress >= challenge.target ? 'COMPLETED' : 'ACTIVE';
      updateDailyChallengeProgress(challenge.id, newProgress, status);
      if (status === 'COMPLETED')
        sendAiNotification('🎉 Challenge Completed!', challenge.description);
    }
  }
});

// Manual "Actual Time Spent" corrections - deliberately does not touch daily challenge
// progress (unlike db:log-work-session), since a correction isn't newly-performed work.
ipcMain.handle('db:adjust-task-work-time', (event, taskId, deltaMs) =>
  adjustTaskWorkTime(taskId, deltaMs),
);

ipcMain.handle('db:global-search', (event, userId, query) =>
  globalSearch(userId, query),
);
ipcMain.handle('db:get-daily-challenge', (event, userId) =>
  getDailyChallenge(userId, new Date().toISOString().split('T')[0]),
);
ipcMain.handle('db:get-tasks', (event, userId) => getTasks(userId));
ipcMain.handle('db:create-task', (event, task, userId) =>
  createTask(task, userId),
);
ipcMain.handle('db:update-task', (event, task) => {
  const updated = updateTask(task);
  if (task.status === 'Completed' && task.userId) {
    const today = new Date().toISOString().split('T')[0];
    const challenge: any = getDailyChallenge(task.userId, today);
    if (challenge && challenge.status === 'ACTIVE') {
      let newProgress = challenge.progress;
      let shouldUpdate = false;
      if (challenge.type === 'FROG_EATER' && task.priority === 'High') {
        newProgress += 1;
        shouldUpdate = true;
      } else if (challenge.type === 'BACKLOG_CLEANER') {
        newProgress += 1;
        shouldUpdate = true;
      } else if (
        challenge.type === 'TASK_SPRINTER' &&
        (task.estimate || 0) < 1
      ) {
        newProgress += 1;
        shouldUpdate = true;
      }
      if (shouldUpdate) {
        const status = newProgress >= challenge.target ? 'COMPLETED' : 'ACTIVE';
        updateDailyChallengeProgress(challenge.id, newProgress, status);
        if (status === 'COMPLETED') {
          sendAiNotification('🎉 Challenge Completed!', challenge.description);
          const profile = getProfile(task.userId);
          if (profile)
            updateProfile({
              userId: profile.userId as number,
              level: profile.level as number,
              xp: (profile.xp as number) + challenge.xpReward,
            });
        }
      }
    }
  }
  return updated;
});
ipcMain.handle('db:delete-task', (event, taskId) => deleteTask(taskId));
ipcMain.handle('db:update-tasks-order', (event, taskIds) =>
  updateTasksOrder(taskIds),
);
ipcMain.handle('db:auto-schedule-tasks', (event, userId) =>
  autoScheduleTasks(userId),
);
ipcMain.handle('db:get-proposed-schedule', (event, userId) =>
  getProposedSchedule(userId),
);
ipcMain.handle('db:get-sprints', () => getSprints());
ipcMain.handle('db:create-sprint', (event, sprint) => createSprint(sprint));
ipcMain.handle('db:update-sprint', (event, sprint) => updateSprint(sprint));
ipcMain.handle('db:update-sprint-status', (event, sprintId, status) =>
  updateSprintStatus(sprintId, status),
);
ipcMain.handle('db:get-sprint-analysis', (event, userId) => {
  const sprint = getActiveSprint();
  if (!sprint) return null;
  const tasks = getSprintTasks(sprint.id as number);
  const predictions = tasks
    .filter((t) => t.status !== 'Completed')
    .map((t) => neuralCore.predictForTask(t));
  return ProductivityAnalyst.analyzeSprintRisk(
    sprint,
    tasks,
    getRecentWorkSessions(userId, 14),
    predictions,
    {
      start: String(getSetting('workDayStart') || '09:00'),
      end: String(getSetting('workDayEnd') || '17:00'),
    },
  );
});
ipcMain.handle('db:get-notes', (event, userId) => getNotes(userId));
ipcMain.handle('db:create-note', (event, note, userId) =>
  createNote(note, userId),
);
ipcMain.handle('db:update-note', (event, note) => updateNote(note));
ipcMain.handle('db:delete-note', (event, noteId) => deleteNote(noteId));
ipcMain.handle('db:login', async (event, { username, password }) => {
  const user = loginUser(username, password);
  if (user) {
    await refreshInsights(user.id as number);
    getTasks(user.id as number); // Triggers training
    return { access_token: 'local-token', userId: user.id };
  }
  throw new Error('Invalid');
});
ipcMain.handle('db:get-profile', (event, userId) => getProfile(userId));
ipcMain.handle('db:update-profile', (event, profile) => updateProfile(profile));
ipcMain.handle('db:get-earned-achievements', (event, userId) =>
  getEarnedAchievements(userId),
);
ipcMain.handle('db:grant-achievement', (event, userId, achievementId) =>
  grantAchievement(userId, achievementId),
);
ipcMain.handle('db:get-average-time-for-task-type', (event, taskType) =>
  getAverageTimeForTaskType(taskType),
);
ipcMain.handle('db:get-average-sprint-capacity', () =>
  getAverageSprintCapacity(),
);
ipcMain.handle('db:get-hourly-productivity', () => getHourlyProductivity());
ipcMain.handle('db:get-daily-productivity', (event, userId) =>
  getDailyProductivity(userId),
);
ipcMain.handle('db:get-work-history', (event, userId, startDate, endDate) =>
  getWorkHistory(userId, startDate, endDate),
);
ipcMain.handle('db:get-contribution-data', (event, userId, days) =>
  getContributionData(userId, days),
);
ipcMain.handle('db:get-work-sessions', (event, userId, days) =>
  getRecentWorkSessions(userId, days),
);
ipcMain.handle('db:get-task-work-sessions', (event, taskId) =>
  getTaskWorkSessions(taskId),
);
ipcMain.handle('db:get-last-14-days-productivity', (event, userId) =>
  getLast14DaysProductivity(userId),
);
ipcMain.handle('db:get-deep-work-history', (event, userId, days) =>
  getDeepWorkHistory(userId, days),
); // New
ipcMain.handle('db:get-tag-analytics', (event, tid) => getTagAnalytics(tid));
ipcMain.handle('db:get-tag-analytics-with-names', () =>
  getTagAnalyticsWithNames(),
);
ipcMain.handle('db:get-tag-by-name', (event, n) => getTagByName(n));

ipcMain.handle('db:get-all-tags', () => getAllTags());
ipcMain.handle('db:get-system-logs', (event, limit) => getSystemLogs(limit));
ipcMain.handle('db:get-neural-confidence', () =>
  neuralCore.getPredictionAccuracy(1),
);
ipcMain.handle('db:get-ai-maturity', () => getAiMaturity());
ipcMain.handle('db:get-ai-stats', () => ({
  ...getAiStats(),
  confidence: neuralCore.getPredictionAccuracy(1),
}));

// Settings Handlers
ipcMain.handle('db:get-all-settings', () => getAllSettings());
ipcMain.handle('db:set-setting', (event, key, value) => setSetting(key, value));
ipcMain.handle('db:get-checklist-items', (event, taskId) =>
  getChecklistItems(taskId),
);
ipcMain.handle('db:add-checklist-item', (event, taskId, text) =>
  addChecklistItem(taskId, text),
);
ipcMain.handle('db:toggle-checklist-item', (event, itemId, isComp) =>
  toggleChecklistItem(itemId, isComp),
);
ipcMain.handle('db:delete-checklist-item', (event, itemId) =>
  deleteChecklistItem(itemId),
);
ipcMain.handle('db:get-daily-bio', (event, date) => getDailyBio(date));
ipcMain.handle('db:update-daily-bio', (event, date, data) => {
  const result = updateDailyBio(date, data);
  if (data.waterIntake !== undefined) {
    const challenge: any = getDailyChallenge(1, date);
    if (
      challenge &&
      challenge.status === 'ACTIVE' &&
      challenge.type === 'HYDRATION_HERO'
    ) {
      const status =
        data.waterIntake >= challenge.target ? 'COMPLETED' : 'ACTIVE';
      updateDailyChallengeProgress(challenge.id, data.waterIntake, status);
      if (status === 'COMPLETED') {
        sendAiNotification('🎉 Challenge Completed!', challenge.description);
        const p = getProfile(1);
        if (p)
          updateProfile({
            userId: p.userId as number,
            level: p.level as number,
            xp: (p.xp as number) + challenge.xpReward,
          });
      }
    }
  }
  return result;
});
ipcMain.handle('db:get-habits', (event, userId) => getHabits(userId));
ipcMain.handle('db:create-habit', (event, h, uid) => createHabit(h, uid));
ipcMain.handle('db:update-habit', (event, h) => updateHabit(h));
ipcMain.handle('db:delete-habit', (event, hid) => deleteHabit(hid));
ipcMain.handle('db:log-habit', (event, hid, d, v) => logHabit(hid, d, v));
ipcMain.handle('db:get-habit-logs', (event, uid, fd) => getHabitLogs(uid, fd));
ipcMain.handle('db:get-top-habit', (event, uid) => getTopHabit(uid));
ipcMain.handle('db:toggle-habit-favorite', (event, hid, uid) =>
  toggleHabitFavorite(hid, uid),
);
ipcMain.handle('db:predict-duration', (event, task) =>
  neuralCore.predict(task),
);
ipcMain.handle('db:get-ai-performance', (event, userId, days) =>
  neuralCore.getPerformanceHistory(userId, days),
);
ipcMain.handle('db:generate-daily-report', (event, userId) =>
  neuralCore.generateDailyReport(userId),
);
ipcMain.handle('db:force-neural-training', (event, userId) => {
  neuralCore.resetCooldown();
  const tasks = getTasks(userId);
  neuralCore
    .train(tasks)
    .catch((err) => log.error('Manual Neural Training Failed', err));
  return true;
});

ipcMain.handle('db:get-ai-message', (event, uid) => {
  const today = new Date().toISOString().split('T')[0];
  const bio = getDailyBio(today);
  const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;

  const habits = getHabits(uid);
  const logs = getHabitLogs(uid);
  const completedToday = logs.filter(
    (l: any) => l.date === today && l.value >= 1,
  ).length;
  const habitScore = habits.length > 0 ? completedToday / habits.length : 0.5;

  const { risk, tasksRemaining } = neuralCore.getSprintRiskContext(uid);
  const mood = neuralCore.determineMood(risk, sleep, habitScore);

  const context = {
    mood,
    userName: 'Marcin',
    sprintRisk: risk,
    habitScore,
    tasksRemaining,
    focusScore: Math.round(getFocusContext(Date.now()) * 100),
    idleTimeMin: Math.round(powerMonitor.getSystemIdleTime() / 60),
    currentStreak: getCurrentStreak(uid),
    avgVelocity: getAverageVelocity(uid),
  };
  return personalityEngine.generateMessage(context);
});
ipcMain.handle('db:get-productivity-insights', async (event, uid) => {
  refreshInsights(uid);
  return cachedInsights;
});
ipcMain.handle('db:suggest-best-time-for-task', (event, task) => {
  const peakHours = cachedInsights?.peakHours || [];
  return ProductivityAnalyst.suggestBestTimeForTask(task, peakHours);
});
ipcMain.handle('db:get-daily-standup', (event, uid) => {
  // New AI-powered standup generator
  return generateDailyStandup(uid);
});
ipcMain.handle('db:get-daily-standup-legacy', (event, uid) => {
  // Legacy handler for backward compatibility
  const stats = getDailyStandupData(uid);
  const schedule = getProposedSchedule(uid);
  const today = new Date().toISOString().split('T')[0];
  const challenge = getDailyChallenge(uid, today);
  let suggestion = null;
  if (schedule.length > 0)
    suggestion = {
      id: schedule[0].id,
      title: schedule[0].title,
      aiReason: schedule[0].aiReason,
      priority: schedule[0].priority,
    };
  return { ...stats, topSuggestion: suggestion, challenge };
});
ipcMain.handle('db:get-daily-report-data', (event, uid) =>
  getDailyReportData(uid),
);
ipcMain.handle('db:get-daily-deep-work', (event, uid) =>
  getDailyDeepWorkStats(uid),
); // New
ipcMain.handle('db:get-lifetime-stats', (event, uid) => getLifetimeStats(uid));
ipcMain.handle('db:get-suggested-commit-message', (event, taskId) =>
  getSuggestedCommitMessage(taskId),
);

// Procrastination Detection AI
ipcMain.handle('db:analyze-procrastination', async (event, userId) => {
  return await procrastinationDetector.analyzeTasks(userId);
});
ipcMain.handle('db:predict-task-procrastination', async (event, task) => {
  return await procrastinationDetector.predict(task);
});
ipcMain.handle('db:train-procrastination-model', async (event, userId) => {
  procrastinationDetector
    .train(userId)
    .catch((err) => log.error('Procrastination Training Failed', err));
  return true;
});

// Context-Aware Notifications
ipcMain.handle('notifications:start-session', () => {
  contextNotificationEngine.startSession();
});
ipcMain.handle('notifications:end-session', () => {
  contextNotificationEngine.endSession();
});
ipcMain.handle('notifications:check', async (event, userId) => {
  await contextNotificationEngine.checkAndNotify(userId);
});

ipcMain.handle('gamification:reward-fatigue-compliance', (event, uid) => {
  const p = getProfile(uid);
  if (p) {
    updateProfile({
      userId: p.userId as number,
      level: p.level as number,
      xp: (p.xp as number) + 15,
    });
    sendAiNotification(
      'Mindful Rest Reward',
      'Dobrze, że słuchasz swojego organizmu! +15 XP',
    );
  }
});
ipcMain.handle('db:get-web-settings', () => getWebBlockingSettings());
ipcMain.handle('db:save-web-settings', (event, s) => {
  saveWebBlockingSettings(s);
  return true;
});
ipcMain.handle('db:get-web-stats', (event, d) => getWebStats(d));
ipcMain.handle('db:get-distraction-stats', (event, d) =>
  getDistractionStats(d),
);
ipcMain.handle('db:set-domain-category', (event, d, c) => {
  setDomainCategory(d, c);
  return true;
});
ipcMain.handle('db:get-app-stats', (event, d) => getAppStats(d));
ipcMain.handle('db:set-app-category', (event, a, c) => {
  setAppCategory(a, c);
  return true;
});
ipcMain.handle('db:start-new-expedition', () => startNewExpedition());
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
ipcMain.handle('app:set-window-opacity', (event, o) => {
  mainWindow?.setOpacity(o);
});
ipcMain.handle('app:test-meditation-notif', () => {
  setTimeout(
    () =>
      sendAiNotification(
        '🧘‍♀️ Czas na Mindfulness',
        'Może krótka chwila na oddech?',
      ),
    3000,
  );
});
ipcMain.handle('app:test-daily-standup', () => {
  mainWindow?.webContents.send('ai-companion:show-message', 'STANDUP_TRIGGER');
});
ipcMain.handle('app:meditation-started', () => {
  isMeditating = true;
});
ipcMain.handle('app:meditation-cancelled', () => {
  isMeditating = false;
});
ipcMain.handle('app:meditation-completed', (event, uid, mins) => {
  isMeditating = false;
  shell.beep();
  const today = new Date().toISOString().split('T')[0];
  const current = getDailyBio(today);
  updateDailyBio(today, {
    meditationMinutes: (current.meditationMinutes || 0) + mins,
  });
  lastMeditationDate = new Date().toDateString();
  const challenge: any = getDailyChallenge(uid, today);
  if (
    challenge &&
    challenge.status === 'ACTIVE' &&
    challenge.type === 'MINDFULNESS_MOMENT'
  ) {
    const np = challenge.progress + mins;
    updateDailyChallengeProgress(
      challenge.id,
      np,
      np >= challenge.target ? 'COMPLETED' : 'ACTIVE',
    );
  }
  mainWindow?.webContents.send(
    'ai-companion:show-message',
    `Wspaniale! 🧘‍♀️ Zaliczono ${mins} min.`,
  );
  mainWindow?.webContents.send('gamification:check', 'HEALTH_ACTION');
});
ipcMain.handle('app:skip-meditation', () => {
  lastMeditationDate = new Date().toDateString();
});
ipcMain.handle('app:complete-pomodoro', (event, tid) => {
  console.log(`[DEBUG] Received app:complete-pomodoro for task ${tid}`);

  // Fetch task directly by ID (ignore userId for lookup)
  // We need to access db directly here or expose getTaskById
  // Since we don't have getTaskById exported, let's use a quick lookup via getTasks for all users? No, too heavy.
  // Let's assume userId is passed or fetch from DB directly if db object was exposed.
  // But db is in db.ts.
  // Workaround: We know tasks table structure.
  // Let's update db.ts to export getTaskById or make getTasks accept optional userId.

  // Actually, looking at imports... we can only use exported functions.
  // Let's modify db.ts to add getTaskById.
  // Wait, I can't modify db.ts here. I have to do it in a separate step or assume I can fix it here?
  // I will try to fix it by using getTasks with the userId from activeTaskInfo if available!

  let userId = 1;
  if (activeTaskInfo && activeTaskInfo.userId) userId = activeTaskInfo.userId;

  const task = getTasks(userId).find((t) => t.id === tid);

  if (task) {
    console.log(`[DEBUG] Task found: ${task.title}`);
    logSystemEvent(
      `Pomodoro Completed for task: ${task.title}`,
      'PRODUCTIVITY',
    );

    const now = Date.now();
    const startTime = Number(task.startTimer);
    let timeSpent = 0;

    if (startTime && !Number.isNaN(startTime)) {
      timeSpent = now - startTime;
    }

    const nc = (task.pomodoroCount || 0) + 1;
    const newSpendTime = (task.spendTime || 0) + timeSpent;

    // Update everything atomically: Count + Stop Timer + Time Spent
    updateTask({
      ...task,
      pomodoroCount: nc,
      spendTime: newSpendTime,
      startTimer: null,
      updateStatusDate: new Date().toISOString(),
    });

    // Also log work session
    if (timeSpent > 0) {
      logWorkSession({
        taskId: task.id,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(now).toISOString(),
        duration: timeSpent,
      });
    }

    console.log('[DEBUG] Playing beep...');
    shell.beep();

    console.log('[DEBUG] Attempting to show Notification...');
    try {
      const pomNotification = new Notification({
        title: '🍅 Pomodoro Ukończone!',
        body: `Zadanie "${task.title}" ma już ${nc} pomidorów.`,
        icon: appIconPath,
        silent: false,
      });

      pomNotification.on('show', () =>
        console.log("[DEBUG] Notification 'show' event fired."),
      );
      pomNotification.on('failed', (e) =>
        console.error('[DEBUG] Notification failed:', e),
      );

      pomNotification.on('click', () => {
        console.log('[DEBUG] Notification clicked.');
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.webContents.send(
            'ai-companion:show-message',
            `🍅 Pomodoro zakończone! Czas na przerwę.`,
          );
        }
      });
      pomNotification.show();
      console.log('[DEBUG] Notification.show() called.');
    } catch (e) {
      console.error('[DEBUG] CRITICAL: Failed to create/show notification:', e);
    }

    if (process.platform === 'darwin') {
      console.log('[DEBUG] Bouncing dock...');
      app.dock.bounce('critical');
    }

    // ... rest of logic
    const challenge: any = getDailyChallenge(
      1,
      new Date().toISOString().split('T')[0],
    );
    if (
      challenge &&
      challenge.status === 'ACTIVE' &&
      challenge.type === 'POMODORO_MARATHON'
    ) {
      updateDailyChallengeProgress(
        challenge.id,
        challenge.progress + 1,
        challenge.progress + 1 >= challenge.target ? 'COMPLETED' : 'ACTIVE',
      );
    }
    if (mainWindow) {
      mainWindow.webContents.send(
        'ai-companion:show-message',
        `Świetna sesja! 🍅 Zasłużyłeś na przerwę.`,
      );
      mainWindow.webContents.send('gamification:check', 'POMODORO_COMPLETED');
    }
  } else {
    console.error(`[DEBUG] Task ${tid} not found!`);
  }
});

ipcMain.on('tray:create', createTray);
ipcMain.on('tray:destroy', destroyTray);
ipcMain.on('tray:update-title', (event, t) => {
  tray?.setTitle(t);
});
ipcMain.on('tray:start-timer', (event, info) => {
  activeTaskInfo = info;
  if (trayTimerInterval) clearInterval(trayTimerInterval);

  hasSentFatigueWarning = false;
  isMeditating = false; // Reset just in case
  updateServerState({ focusMode: true });

  updateTrayTitle();
  trayTimerInterval = setInterval(updateTrayTitle, 1000);
});
ipcMain.on('tray:stop-timer', () => {
  activeTaskInfo = null;
  if (trayTimerInterval) clearInterval(trayTimerInterval);
  trayTimerInterval = null;
  updateServerState({ focusMode: false });
  tray?.setTitle('');
});
ipcMain.on('electron-shell-open-external', (event, url) => {
  shell.openExternal(url);
});

let lastFragmentationNotificationTime = 0;
let lastStretchingTime = Date.now();
let lastWaterTime = Date.now();
let lastMeditationDate: string | null = null;
let sentMorningNudge = false;
let standupShown = false;
let suggestedBoostModeToday = false;
let suggestedRecoveryModeToday = false;
let currentDayString = new Date().toDateString();

setInterval(() => {
  if (isQuitting) return;
  try {
    const now = Date.now();
    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();
    const dateString = currentDate.toDateString();

    // Reset daily flags at midnight
    if (dateString !== currentDayString) {
      sentMorningNudge = false;
      standupShown = false;
      suggestedBoostModeToday = false;
      suggestedRecoveryModeToday = false;
      lastMeditationDate = null;
      currentDayString = dateString;

      // Notify renderer to refresh daily stats (counters)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:day-changed');
      }
    }

    if (!standupShown && currentHour >= 8 && currentHour < 11) {
      if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        !mainWindow.isMinimized()
      ) {
        mainWindow.webContents.send(
          'ai-companion:show-message',
          'STANDUP_TRIGGER',
        );
        standupShown = true;
      }
    }

    const aiEnabled = getSetting('enable_ai_assistant') !== 'false';
    if (aiEnabled) {
      const workStart = getSetting('workDayStart') || '09:00';
      const workEnd = getSetting('workDayEnd') || '17:00';
      const [sh, sm] = String(workStart).split(':').map(Number);
      const [eh, em] = String(workEnd).split(':').map(Number);
      const nm = currentHour * 60 + currentMinute;
      const isWorkHours = nm >= sh * 60 + sm && nm <= eh * 60 + em;

      if (getSetting('enable_water_reminders') === 'true' && isWorkHours) {
        if (
          now - lastWaterTime >
            Number(getSetting('water_interval') || 90) * 60000 &&
          Math.random() < 0.3
        ) {
          sendAiNotification('💧 Nawodnienie', 'Pamiętasz o piciu wody?');
          lastWaterTime = now;
        }
      }
      if (getSetting('enable_stretching_reminders') === 'true' && isWorkHours) {
        if (
          now - lastStretchingTime >
            Number(getSetting('stretching_interval') || 60) * 60000 &&
          powerMonitor.getSystemIdleTime() < 60
        ) {
          sendAiNotification('🏃 Czas na ruch!', 'Wyprostuj plecy.');
          lastStretchingTime = now;
        }
      }
      if (
        getSetting('enable_meditation_reminders') === 'true' &&
        lastMeditationDate !== dateString
      ) {
        const [th, tm] = String(getSetting('meditation_time') || '09:00')
          .split(':')
          .map(Number);
        if (nm >= th * 60 + tm && nm < th * 60 + tm + 60) {
          sendAiNotification(
            '🧘‍♀️ Czas na Mindfulness',
            'Może krótka chwila na oddech?',
            'IMPORTANT',
          );
          lastMeditationDate = dateString;
        }
      }
      if (activeTaskInfo) sentMorningNudge = true;
      if (!sentMorningNudge && nm > sh * 60 + sm + 60 && nm < eh * 60 + em) {
        sendAiNotification('☕ Trudny poranek?', 'Zacznij od czegoś małego.');
        sentMorningNudge = true;
      }

      // 5. Golden Hour check
      if (cachedInsights && lastPeakHourNotificationDate !== dateString) {
        if (cachedInsights.peakHours.includes(currentHour)) {
          sendAiNotification(
            '🚀 Golden Hour',
            `To Twój czas najwyższej produktywności!`,
            'IMPORTANT',
          );
          lastPeakHourNotificationDate = dateString;
        }
      }

      // 6. Fragmented Focus check
      if (now - lastFragmentationNotificationTime > 1800000) {
        // 30 min
        if (activeTaskInfo && activeTaskInfo.userId) {
          const sessions = getRecentWorkSessions(activeTaskInfo.userId, 1);
          const oneHourAgo = now - 3600000;
          const recentShortSessions = sessions.filter((s: any) => {
            const endTime = new Date(s.endTime || s.startTime).getTime();
            return endTime > oneHourAgo && s.duration < 600000; // < 10m
          });
          if (recentShortSessions.length >= 5) {
            sendAiNotification(
              '⚠️ Fragmented Focus',
              'Skaczesz między zadaniami. Może czas na jeden blok głębokiej pracy?',
            );
            lastFragmentationNotificationTime = now;
          }
        }
      }

      // 7. Work Mode Suggestion (Boost / Recovery) - context-aware nudge to switch daily
      // mode, based on sprint risk (boost) or fatigue/sleep signals (recovery). At most one
      // suggestion per direction per day, and never suggesting a mode already active.
      if (!suggestedBoostModeToday || !suggestedRecoveryModeToday) {
        const todayISO = currentDate.toISOString().split('T')[0];
        const dailyBio = getDailyBio(todayISO);
        const currentMode = dailyBio.mode || 'normal';

        if (!suggestedBoostModeToday && currentMode !== 'boost') {
          const { risk } = neuralCore.getSprintRiskContext();
          if (risk && (risk.risk === 'Critical' || risk.risk === 'At Risk')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              // Note: risk.message (from ProductivityAnalyst) is in Polish - this modal's UI
              // is English, so build the reason text here instead of reusing it.
              mainWindow.webContents.send('ai:suggest-mode', {
                mode: 'boost',
                reason:
                  risk.risk === 'Critical'
                    ? 'Your sprint is critically behind schedule - boosting focus now could help you catch up.'
                    : 'Your sprint is at risk of missing its deadline - want to switch into a focused push?',
              });
            }
            suggestedBoostModeToday = true;
          }
        }

        if (!suggestedRecoveryModeToday && currentMode !== 'recovery') {
          const { sleepScore } = dailyBio;
          const isLowSleep = sleepScore !== null && sleepScore < 50;
          const fatigue = ProductivityAnalyst.analyzeFatigue(
            getRecentWorkSessions(1, 1),
          );
          if (isLowSleep || fatigue.isFatigued) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('ai:suggest-mode', {
                mode: 'recovery',
                reason: isLowSleep
                  ? 'Your sleep score is low today - maybe ease off the pace a bit?'
                  : "You've been working long stretches without a break - consider a recovery mode.",
              });
            }
            suggestedRecoveryModeToday = true;
          }
        }
      }
    }
    checkHabitReminders();
  } catch (e) {
    console.error('Interval error:', e);
  }
}, 300000);

let hasNotifiedIdle = false;

setInterval(() => {
  if (activeTaskInfo) {
    const idleThreshold = Number(getSetting('idleTimeout') || 300); // Default to 5 minutes
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds >= idleThreshold) {
      // Only notify once per continuous idle period - otherwise this fires every 30s for
      // as long as the user stays away, spamming a fresh OS notification each time.
      if (!hasNotifiedIdle) {
        hasNotifiedIdle = true;
        mainWindow?.webContents.send(
          'activity:idle-detected',
          idleSeconds * 1000,
        );
      }
    } else {
      hasNotifiedIdle = false;
    }
  } else {
    hasNotifiedIdle = false;
  }
}, 30000); // Check every 30 seconds

// Daily ML Model Training Scheduler
let lastNeuralTrainingDate: string | null = null;

setInterval(() => {
  try {
    const today = new Date().toDateString();

    // Train only once per day
    if (lastNeuralTrainingDate !== today) {
      log.info('[Daily Training] Starting daily ML model training...');

      // Get active user ID (fallback to 1 if no active task)
      const userId = activeTaskInfo?.userId || 1;
      const tasks = getTasks(userId);

      // Train NeuralCore for task duration predictions
      neuralCore
        .train(tasks)
        .then(() => {
          log.info(
            '[Daily Training] NeuralCore training completed successfully',
          );
        })
        .catch((err) => {
          log.error('[Daily Training] NeuralCore training failed:', err);
        });

      // Train Procrastination Detector
      procrastinationDetector
        .train(userId)
        .then(() => {
          log.info(
            '[Daily Training] Procrastination model training completed successfully',
          );
        })
        .catch((err) => {
          log.error(
            '[Daily Training] Procrastination model training failed:',
            err,
          );
        });

      lastNeuralTrainingDate = today;
      logSystemEvent('Daily ML Model Training initiated', 'LEARNING');
    }
  } catch (e) {
    log.error('[Daily Training] Training scheduler error:', e);
  }
}, 3600000); // Check every hour, but only trains once per day

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1254,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      devTools: true,
    },
    opacity: Number(getSetting('window_opacity')) || 1.0,
  });
  mainWindow.loadURL(resolveHtmlPath('index.html'));
  mainWindow.on('ready-to-show', () => {
    if (process.env.START_MINIMIZED) mainWindow?.minimize();
    else mainWindow?.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  new MenuBuilder(mainWindow).buildMenu();
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
app
  .whenReady()
  .then(async () => {
    await initDB();
    startServer();
    startAppMonitor();
    createWindow();
    globalShortcut.register('CommandOrControl+K', () => {
      mainWindow?.webContents.send('open-search');
    });
  })
  .catch(app.quit);

app.on('will-quit', () => {
  stopServer();
  stopAppMonitor();
  globalShortcut.unregisterAll();
});
