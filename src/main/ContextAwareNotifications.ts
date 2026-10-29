import { Notification } from 'electron';
import log from 'electron-log';
import {
  getFocusContextDetail,
  getDailyBio,
  getHabits,
  getHabitLogs,
} from './db';
import { computeHabitStatus, localDateKey } from './habitStatus';

export interface NotificationContext {
  userId: number;
  // 0-100, or null when nothing was tracked recently - no data is not "100% focused"
  focusScore: number | null;
  sessionTime: number; // minutes
  meetingTime: number; // minutes
  sleepScore: number; // 0-100
  habitsDue: number; // habits scheduled for today
  // Due habits not done yet that have no reminder time of their own (those get a
  // dedicated reminder from main.ts - don't nag twice)
  pendingHabits: string[];
  recentPattern: 'focused' | 'distracted' | 'fatigued' | 'normal';
}

export interface SmartNotification {
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  // Water reminders live in main.ts, driven by the user's settings
  category: 'break' | 'focus' | 'productivity' | 'health';
}

const COOLDOWN_MS = 15 * 60 * 1000;
const FLOW_QUIET_MS = 30 * 60 * 1000; // promised silence after "you're in flow"
const HABIT_NUDGE_HOUR = 14; // local time after which unfinished habits get one nudge

export class ContextAwareNotificationEngine {
  // No notification before this time (cooldown, or quiet time after a flow message)
  private quietUntil: number = 0;

  private sessionStartTime: number | null = null;

  private lastHabitNudgeDate: string | null = null;

  startSession() {
    this.sessionStartTime = Date.now();
  }

  endSession() {
    this.sessionStartTime = null;
  }

  private getSessionDuration(): number {
    if (!this.sessionStartTime) return 0;
    return (Date.now() - this.sessionStartTime) / (1000 * 60); // minutes
  }

  private markNotificationShown(now: Date, quietMs: number = COOLDOWN_MS) {
    this.quietUntil = now.getTime() + quietMs;
  }

  async analyzeContext(userId: number): Promise<NotificationContext> {
    const now = Date.now();

    const focus = getFocusContextDetail(now);
    const focusScore = focus.hasActivity ? Math.round(focus.score * 100) : null;

    const sessionTime = this.getSessionDuration();

    // Daily bio is keyed by the UTC date everywhere (renderer and main alike)
    const bio = getDailyBio(new Date().toISOString().split('T')[0]);
    const meetingTime = bio.meetingTime || 0;
    const sleepScore = bio.sleepScore || 75;

    const habitStatus = computeHabitStatus(
      getHabits(userId) as any[],
      getHabitLogs(userId) as any[],
    );

    let recentPattern: NotificationContext['recentPattern'] = 'normal';
    if (focusScore !== null) {
      if (focusScore < 30) recentPattern = 'distracted';
      else if (focusScore > 75 && sessionTime > 90) recentPattern = 'fatigued';
      else if (focusScore > 70) recentPattern = 'focused';
    }

    return {
      userId,
      focusScore,
      sessionTime,
      meetingTime,
      sleepScore,
      habitsDue: habitStatus.due.length,
      pendingHabits: habitStatus.pending
        .filter((h: any) => !h.reminderTime)
        .map((h: any) => h.title),
      recentPattern,
    };
  }

  generateSmartNotification(
    context: NotificationContext,
    now: Date = new Date(),
  ): SmartNotification | null {
    // Don't spam - respect cooldown / quiet time
    if (now.getTime() < this.quietUntil) {
      return null;
    }

    const { focusScore } = context;

    // Priority 1: Fatigue after long session
    if (focusScore !== null && context.sessionTime > 90 && focusScore < 50) {
      this.markNotificationShown(now);
      return {
        title: '🧠 Zmęczony mózg wykryty',
        body: `Pracujesz już ${Math.round(context.sessionTime)} min i tracisz fokus. Twój mózg potrzebuje 5-10 min przerwy.`,
        priority: 'high',
        category: 'break',
      };
    }

    // Priority 2: Meeting overload
    if (focusScore !== null && context.meetingTime > 180 && focusScore < 40) {
      this.markNotificationShown(now);
      return {
        title: '📅 Meeting Overload',
        body: `${Math.floor(context.meetingTime / 60)}h spotkań to dużo. Zostaw na dziś proste, mało wymagające zadania.`,
        priority: 'high',
        category: 'productivity',
      };
    }

    // Priority 3: Sleep deprivation
    if (context.sleepScore < 50 && context.sessionTime > 60) {
      this.markNotificationShown(now);
      return {
        title: '😴 Niski sen wykryty',
        body: `Sen: ${context.sleepScore}/100. Skup się dziś na prostszych zadaniach, nie na najtrudniejszych problemach.`,
        priority: 'medium',
        category: 'health',
      };
    }

    // Priority 4: Distraction pattern
    if (context.recentPattern === 'distracted' && context.sessionTime > 20) {
      this.markNotificationShown(now);
      return {
        title: '🎯 Rozproszenie wykryte',
        body: `Skupienie w ostatniej godzinie: ${focusScore}%. Zamknij rozpraszające karty i wycisz komunikatory na 25 min?`,
        priority: 'medium',
        category: 'focus',
      };
    }

    // Priority 5: Unfinished habits - once a day, in the afternoon, naming them
    const today = localDateKey(now);
    if (
      context.pendingHabits.length > 0 &&
      now.getHours() >= HABIT_NUDGE_HOUR &&
      this.lastHabitNudgeDate !== today
    ) {
      this.lastHabitNudgeDate = today;
      this.markNotificationShown(now);
      const names = context.pendingHabits.join(', ');
      return {
        title: '📋 Nawyki na dziś',
        body:
          context.pendingHabits.length === 1
            ? `Został jeszcze jeden nawyk: ${names}.`
            : `Zostało ${context.pendingHabits.length} z ${context.habitsDue} nawyków: ${names}.`,
        priority: 'low',
        category: 'productivity',
      };
    }

    // Priority 6: Flow state encouragement - and actually stay quiet afterwards
    if (
      context.recentPattern === 'focused' &&
      context.sessionTime > 45 &&
      context.sessionTime < 90
    ) {
      this.markNotificationShown(now, FLOW_QUIET_MS);
      return {
        title: '🔥 Jesteś w strefie',
        body: `Skupienie: ${focusScore}%. Nie przeszkadzam przez następne 30 min.`,
        priority: 'low',
        category: 'productivity',
      };
    }

    return null; // No notification needed
  }

  async checkAndNotify(userId: number): Promise<void> {
    try {
      const context = await this.analyzeContext(userId);
      const notification = this.generateSmartNotification(context);

      if (notification) {
        this.showNotification(notification);
        log.info(
          '[ContextAwareNotification]',
          notification.title,
          notification.body,
        );
      }
    } catch (error) {
      log.error('[ContextAwareNotification] Error:', error);
    }
  }

  private showNotification(notif: SmartNotification) {
    const n = new Notification({
      title: notif.title,
      body: notif.body,
      urgency:
        notif.priority === 'high'
          ? 'critical'
          : notif.priority === 'medium'
            ? 'normal'
            : 'low',
      timeoutType: 'default',
    });

    n.show();
  }
}

export const contextNotificationEngine = new ContextAwareNotificationEngine();
