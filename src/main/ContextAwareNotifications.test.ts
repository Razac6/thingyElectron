import {
  ContextAwareNotificationEngine,
  NotificationContext,
} from './ContextAwareNotifications';

jest.mock('electron', () => ({ Notification: jest.fn() }));
jest.mock('electron-log', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('./db', () => ({}));

const baseContext: NotificationContext = {
  userId: 1,
  focusScore: null,
  sessionTime: 0,
  meetingTime: 0,
  sleepScore: 75,
  habitsDue: 0,
  pendingHabits: [],
  recentPattern: 'normal',
};

const afternoon = new Date(2026, 9, 28, 16, 0, 0);
const morning = new Date(2026, 9, 28, 10, 0, 0);

describe('ContextAwareNotificationEngine', () => {
  it('names unfinished habits instead of reporting a percentage', () => {
    const engine = new ContextAwareNotificationEngine();
    const result = engine.generateSmartNotification(
      { ...baseContext, habitsDue: 2, pendingHabits: ['Blog'] },
      afternoon,
    );
    expect(result?.body).toBe('Został jeszcze jeden nawyk: Blog.');
    expect(result?.body).not.toMatch(/%/);
  });

  it('nudges about habits at most once a day, and not in the morning', () => {
    const engine = new ContextAwareNotificationEngine();
    const ctx = { ...baseContext, habitsDue: 1, pendingHabits: ['Blog'] };
    expect(engine.generateSmartNotification(ctx, morning)).toBeNull();
    expect(engine.generateSmartNotification(ctx, afternoon)).not.toBeNull();
    // Next day's afternoon may nudge again; a later hour the same day may not
    const later = new Date(afternoon.getTime() + 60 * 60 * 1000);
    expect(engine.generateSmartNotification(ctx, later)).toBeNull();
    const nextDay = new Date(afternoon.getTime() + 24 * 60 * 60 * 1000);
    expect(engine.generateSmartNotification(ctx, nextDay)).not.toBeNull();
  });

  it('stays silent about habits when none are pending', () => {
    const engine = new ContextAwareNotificationEngine();
    expect(
      engine.generateSmartNotification(
        { ...baseContext, habitsDue: 1 },
        afternoon,
      ),
    ).toBeNull();
  });

  it('never claims focus or distraction without tracked activity', () => {
    const engine = new ContextAwareNotificationEngine();
    const result = engine.generateSmartNotification(
      { ...baseContext, focusScore: null, sessionTime: 120 },
      morning,
    );
    expect(result).toBeNull();
  });

  it('keeps the promised 30 minutes of quiet after a flow message', () => {
    const engine = new ContextAwareNotificationEngine();
    const flow = {
      ...baseContext,
      focusScore: 90,
      sessionTime: 60,
      recentPattern: 'focused' as const,
    };
    expect(engine.generateSmartNotification(flow, morning)?.title).toMatch(
      /strefie/,
    );
    const in20min = new Date(morning.getTime() + 20 * 60 * 1000);
    expect(
      engine.generateSmartNotification(
        { ...flow, recentPattern: 'distracted', focusScore: 10 },
        in20min,
      ),
    ).toBeNull();
  });
});
