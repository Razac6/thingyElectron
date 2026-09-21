import { Notification } from 'electron';
import log from 'electron-log';
import { getFocusContext, getDailyBio, getHabits, getHabitLogs } from './db';

export interface NotificationContext {
  userId: number;
  focusScore: number; // 0-100
  sessionTime: number; // minutes
  meetingTime: number; // minutes
  sleepScore: number; // 0-100
  habitScore: number; // 0-1
  recentPattern: 'focused' | 'distracted' | 'fatigued' | 'normal';
}

export interface SmartNotification {
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  category: 'break' | 'hydration' | 'focus' | 'productivity' | 'health';
  actionable?: {
    label: string;
    action: string;
  };
}

export class ContextAwareNotificationEngine {
  private lastNotificationTime: number = 0;

  private notificationCooldown: number = 15 * 60 * 1000; // 15 minutes

  private sessionStartTime: number | null = null;

  private nextHydrationCheckpointMin: number = 60;

  startSession() {
    this.sessionStartTime = Date.now();
    this.nextHydrationCheckpointMin = 60;
  }

  endSession() {
    this.sessionStartTime = null;
  }

  private getSessionDuration(): number {
    if (!this.sessionStartTime) return 0;
    return (Date.now() - this.sessionStartTime) / (1000 * 60); // minutes
  }

  private canShowNotification(): boolean {
    const now = Date.now();
    return now - this.lastNotificationTime > this.notificationCooldown;
  }

  private markNotificationShown() {
    this.lastNotificationTime = Date.now();
  }

  async analyzeContext(userId: number): Promise<NotificationContext> {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Get current focus score
    const focusScore = Math.round(getFocusContext(now) * 100);

    // Get session time
    const sessionTime = this.getSessionDuration();

    // Get bio data
    const bio = getDailyBio(today);
    const meetingTime = bio.meetingTime || 0;
    const sleepScore = bio.sleepScore || 75;

    // Get habit score
    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);
    const completedToday = logs.filter(
      (l: any) => l.date === today && l.value >= 1,
    ).length;
    const habitScore = habits.length > 0 ? completedToday / habits.length : 0.5;

    // Analyze recent pattern
    let recentPattern: 'focused' | 'distracted' | 'fatigued' | 'normal' =
      'normal';

    if (focusScore < 30) {
      recentPattern = 'distracted';
    } else if (focusScore > 75 && sessionTime > 90) {
      recentPattern = 'fatigued';
    } else if (focusScore > 70) {
      recentPattern = 'focused';
    }

    return {
      userId,
      focusScore,
      sessionTime,
      meetingTime,
      sleepScore,
      habitScore,
      recentPattern,
    };
  }

  generateSmartNotification(
    context: NotificationContext,
  ): SmartNotification | null {
    // Don't spam - respect cooldown
    if (!this.canShowNotification()) {
      return null;
    }

    // Priority 1: Fatigue after long session
    if (context.sessionTime > 90 && context.focusScore < 50) {
      this.markNotificationShown();
      return {
        title: '🧠 Zmęczony mózg wykryty',
        body: `Pracujesz już ${Math.round(context.sessionTime)}min i tracisz fokus. Twój mózg potrzebuje 5-10min przerwy.`,
        priority: 'high',
        category: 'break',
        actionable: {
          label: 'Zrób przerwę',
          action: 'take-break',
        },
      };
    }

    // Priority 2: Meeting overload
    if (context.meetingTime > 180 && context.focusScore < 40) {
      this.markNotificationShown();
      return {
        title: '📅 Meeting Overload',
        body: `${Math.floor(context.meetingTime / 60)}h meetingów wypaliło Twoje CPU. Zostaw dziś tylko proste, mało wymagające zadania.`,
        priority: 'high',
        category: 'productivity',
      };
    }

    // Priority 3: Sleep deprivation
    if (context.sleepScore < 50 && context.sessionTime > 60) {
      this.markNotificationShown();
      return {
        title: '😴 Niski sen wykryty',
        body: `Sen: ${context.sleepScore}/100. Twoja funkcja kognitywna jest obniżona. Skup się na admin tasks, nie na hard problems.`,
        priority: 'medium',
        category: 'health',
      };
    }

    // Priority 4: Distraction pattern
    if (context.recentPattern === 'distracted' && context.sessionTime > 20) {
      this.markNotificationShown();
      return {
        title: '🎯 Rozproszenie wykryte',
        body: `Twój focus score: ${context.focusScore}%. Widzę rozproszenia. Zamknij karty, wyłącz komunikatory na 25 min?`,
        priority: 'medium',
        category: 'focus',
        actionable: {
          label: 'Pomodoro 25min',
          action: 'start-pomodoro',
        },
      };
    }

    // Priority 5: Hydration reminder (context-aware) - fires once per hour of session time
    if (context.sessionTime >= this.nextHydrationCheckpointMin) {
      this.nextHydrationCheckpointMin += 60;
      this.markNotificationShown();
      return {
        title: '💧 Hydration Check',
        body: 'Pracujesz już godzinę. Twój mózg to 73% wody - czas go uzupełnić!',
        priority: 'low',
        category: 'hydration',
      };
    }

    // Priority 6: Habit score low
    if (context.habitScore < 0.3 && new Date().getHours() > 14) {
      this.markNotificationShown();
      return {
        title: '📋 Nawyki zapomniane',
        body: `Dzisiaj zaliczyłeś tylko ${Math.round(context.habitScore * 100)}% nawyków. Jeszcze jest czas!`,
        priority: 'low',
        category: 'productivity',
      };
    }

    // Priority 7: Flow state encouragement
    if (
      context.recentPattern === 'focused' &&
      context.sessionTime > 45 &&
      context.sessionTime < 90
    ) {
      this.markNotificationShown();
      return {
        title: '🔥 Flow State aktywny!',
        body: `Focus score: ${context.focusScore}%. Jesteś w strefie. Wyłączam powiadomienia na next 30min.`,
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

    // Handle actionable notifications
    if (notif.actionable) {
      n.on('click', () => {
        log.info('[Notification Action]', notif.actionable?.action);
        // Emit event to main process to handle action
        // e.g., start-pomodoro, take-break, etc.
      });
    }
  }
}

export const contextNotificationEngine = new ContextAwareNotificationEngine();
