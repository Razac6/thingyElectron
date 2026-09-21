import fs from 'fs';
import path from 'path';
import {
  initDB,
  logSystemEvent,
  getSystemLogs,
  getSetting,
  setSetting,
  createHabit,
  logHabit,
  getCurrentStreak,
  getDailyHabitScores,
  getAverageVelocity,
  createTask,
  updateTask,
  logWebActivity,
  logAppActivity,
  getWebDistractionRatio,
  getAppSwitchCount,
  getDaysSinceLastSimilarTask,
} from './db';

// Prefix variable with 'mock' so Jest allows its use in jest.mock()
const mockTempDbPath = path.join(__dirname, '../../temp_db_test');

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest
      .fn()
      .mockReturnValue(require('path').join(__dirname, '../../temp_db_test')),
    isPackaged: false,
  },
}));

// We need a way to mock writeFileSync but keep readFileSync for wasm
jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

describe('Database Layer (db.ts)', () => {
  beforeAll(async () => {
    // Ensure the temp directory exists for the sqlite file (even if we mock write)
    if (!fs.existsSync(mockTempDbPath)) {
      fs.mkdirSync(mockTempDbPath, { recursive: true });
    }

    // A prior run's sqlite file can persist here (writeFileSync is mocked for THIS test's
    // calls, but sql.js's own WASM-side persistence isn't) - remove it so every run of this
    // suite starts from a genuinely empty db, matching the "temp" directory's intent.
    const dbFilePath = path.join(mockTempDbPath, 'thingy.sqlite');
    if (fs.existsSync(dbFilePath)) {
      fs.unlinkSync(dbFilePath);
    }

    await initDB();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    // Clean up temp dir if you want, but it's fine for now
  });

  it('should initialize tables and seed default settings', async () => {
    const threshold = getSetting('complexityThreshold');
    expect(threshold).toBe('8');

    const animations = getSetting('enableRewardAnimations');
    expect(animations).toBe('true');
  });

  it('should log and retrieve system events', () => {
    logSystemEvent('Test Message', 'TEST');
    const logs = getSystemLogs(1);
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Test Message');
    expect(logs[0].event_type).toBe('TEST');
  });

  it('should update and retrieve settings', () => {
    setSetting('test_key', 'test_value');
    expect(getSetting('test_key')).toBe('test_value');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});

// Dedicated userId so these don't collide with rows created by other tests/describe blocks
// sharing the same in-memory db.
const TEST_USER_ID = 999;

const daysAgoStr = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// sql.js rejects binding `undefined`, so every field these INSERTs touch must be given an
// explicit value (null is fine) rather than left to a JS default.
const makeHabit = (overrides: any = {}) => ({
  title: 'Test Habit',
  description: null,
  frequency: 'daily',
  category: null,
  targetStreak: 0,
  reminderTime: null,
  isFavorite: 0,
  ...overrides,
});

const makeTask = (overrides: any = {}) => ({
  title: 'Test Task',
  description: null,
  status: 'To Do',
  estimate: 1,
  priority: 'Medium',
  link: null,
  spendTime: 0,
  startTimer: null,
  type: 'TASK',
  sprintId: null,
  storyPoints: 0,
  timerMode: null,
  ...overrides,
});

// getCurrentStreak/getDailyHabitScores aggregate over ALL of a user's habits, so each test
// needs its own userId - otherwise habits created by an earlier test in the same describe
// leak into a later test's streak/score calculation.
describe('getCurrentStreak', () => {
  it('returns 0 when there are no habit logs', () => {
    const userId = TEST_USER_ID + 100;
    const habit = createHabit(makeHabit({ title: 'Streak Habit A' }), userId);
    expect(getCurrentStreak(userId)).toBe(0);
    // sanity: habit was actually created under this user
    expect(habit.userId).toBe(userId);
  });

  it('counts a consecutive streak ending today', () => {
    const userId = TEST_USER_ID + 101;
    const habit = createHabit(makeHabit({ title: 'Streak Habit B' }), userId);
    logHabit(habit.id, daysAgoStr(2), 1);
    logHabit(habit.id, daysAgoStr(1), 1);
    logHabit(habit.id, daysAgoStr(0), 1);

    expect(getCurrentStreak(userId)).toBe(3);
  });

  it('only counts the unbroken tail when there is a gap', () => {
    const userId = TEST_USER_ID + 102;
    const habit = createHabit(makeHabit({ title: 'Streak Habit C' }), userId);
    logHabit(habit.id, daysAgoStr(5), 1); // isolated day, before the gap
    logHabit(habit.id, daysAgoStr(1), 1);
    logHabit(habit.id, daysAgoStr(0), 1);

    expect(getCurrentStreak(userId)).toBe(2);
  });
});

describe('getDailyHabitScores', () => {
  it('returns a per-day completion ratio, only for days with a log', () => {
    const userId = TEST_USER_ID + 103;
    const h1 = createHabit(makeHabit({ title: 'Score Habit 1' }), userId);
    const h2 = createHabit(makeHabit({ title: 'Score Habit 2' }), userId);

    const fullDay = daysAgoStr(3);
    const halfDay = daysAgoStr(2);
    logHabit(h1.id, fullDay, 1);
    logHabit(h2.id, fullDay, 1);
    logHabit(h1.id, halfDay, 1); // h2 not logged this day

    const scores = getDailyHabitScores(userId, 30);
    const fullEntry = scores.find((s) => s.date === fullDay);
    const halfEntry = scores.find((s) => s.date === halfDay);

    expect(fullEntry?.score).toBe(1);
    expect(halfEntry?.score).toBe(0.5);
    // a day with no log at all shouldn't appear
    expect(scores.find((s) => s.date === daysAgoStr(10))).toBeUndefined();
  });
});

describe('getAverageVelocity', () => {
  it('returns 0 when there are no completed tasks', () => {
    expect(getAverageVelocity(TEST_USER_ID + 1, 30)).toBe(0);
  });

  it('averages story points per active completed-task day', () => {
    // Task A: completed "today" with 5 points
    const taskA = createTask(
      makeTask({ title: 'Velocity A', status: 'Completed', storyPoints: 5 }),
      TEST_USER_ID,
    );
    updateTask({
      id: taskA.id,
      status: 'Completed',
      updateStatusDate: new Date().toISOString(),
    });

    // Task B: completed 1 day ago with 3 points (same day as Task C below)
    const taskB = createTask(
      makeTask({ title: 'Velocity B', status: 'Completed', storyPoints: 3 }),
      TEST_USER_ID,
    );
    const oneDayAgoIso = new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000,
    ).toISOString();
    updateTask({
      id: taskB.id,
      status: 'Completed',
      updateStatusDate: oneDayAgoIso,
    });

    // Task C: also completed 1 day ago (same day as B), 1 point -> that day totals 4 points
    const taskC = createTask(
      makeTask({ title: 'Velocity C', status: 'Completed', storyPoints: 1 }),
      TEST_USER_ID,
    );
    updateTask({
      id: taskC.id,
      status: 'Completed',
      updateStatusDate: oneDayAgoIso,
    });

    // Two active days: "today" (5 points) and "1 day ago" (3 + 1 = 4 points) -> avg 4.5
    expect(getAverageVelocity(TEST_USER_ID, 30)).toBeCloseTo(4.5, 5);
  });
});

describe('getWebDistractionRatio', () => {
  it('computes the ratio of distracting time to total tracked time', () => {
    const start = Date.now() - 60 * 60 * 1000;
    const end = Date.now() + 60 * 60 * 1000;

    // 'facebook.com' is in the default blockedSites list -> counts as distraction
    logWebActivity({
      domain: 'facebook.com',
      url: 'https://facebook.com',
      duration: 300,
      timestamp: Date.now(),
    });
    // Not blocked / not categorized -> counts as productive
    logWebActivity({
      domain: 'internal-docs-tool.example',
      url: 'https://internal-docs-tool.example',
      duration: 700,
      timestamp: Date.now(),
    });

    // total = 1000, distraction = 300 -> ratio 0.3
    expect(getWebDistractionRatio(start, end)).toBeCloseTo(0.3, 5);
  });

  it('returns 0 when there is no tracked web time in the window', () => {
    const farPast = Date.now() - 1000 * 60 * 60 * 24 * 365 * 5;
    expect(getWebDistractionRatio(farPast, farPast + 1000)).toBe(0);
  });
});

describe('getAppSwitchCount', () => {
  it('counts transitions between different apps, not repeats of the same app', () => {
    const start = Date.now();
    logAppActivity({
      appName: 'VSCode',
      windowTitle: 'a',
      duration: 1000,
      timestamp: start + 1,
    });
    logAppActivity({
      appName: 'VSCode',
      windowTitle: 'a',
      duration: 1000,
      timestamp: start + 2,
    }); // same app, not a switch
    logAppActivity({
      appName: 'Slack',
      windowTitle: 'b',
      duration: 1000,
      timestamp: start + 3,
    }); // switch #1
    logAppActivity({
      appName: 'VSCode',
      windowTitle: 'a',
      duration: 1000,
      timestamp: start + 4,
    }); // switch #2

    expect(getAppSwitchCount(start, start + 10)).toBe(2);
  });
});

describe('getDaysSinceLastSimilarTask', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 14 when no prior task of that type exists', () => {
    expect(
      getDaysSinceLastSimilarTask(TEST_USER_ID, 'UNIQUE_TYPE_NEVER_SEEN'),
    ).toBe(14);
  });

  it('returns days since the most recent prior task, excludes itself, and ignores future tasks', () => {
    const asOf = new Date('2026-01-10T12:00:00.000Z').getTime();
    const taskType = 'SIMILARITY_TEST_TYPE';

    jest.useFakeTimers({ doNotFake: ['nextTick'] });

    // Created 5 days before `asOf`
    jest.setSystemTime(asOf - 5 * 24 * 60 * 60 * 1000);
    const priorTask = createTask(
      makeTask({ title: 'Prior', status: 'To Do', type: taskType }),
      TEST_USER_ID,
    );

    // Created after `asOf` - must NOT be treated as "the last similar task" relative to asOf
    // (this guards against the temporal-leakage bug fixed earlier this session).
    jest.setSystemTime(asOf + 2 * 24 * 60 * 60 * 1000);
    createTask(
      makeTask({ title: 'Future', status: 'To Do', type: taskType }),
      TEST_USER_ID,
    );

    jest.useRealTimers();

    const days = getDaysSinceLastSimilarTask(
      TEST_USER_ID,
      taskType,
      undefined,
      asOf,
    );
    expect(days).toBeCloseTo(5, 1);

    // Excluding the prior task itself leaves no other candidate before `asOf`
    const daysExcludingSelf = getDaysSinceLastSimilarTask(
      TEST_USER_ID,
      taskType,
      priorTask.id,
      asOf,
    );
    expect(daysExcludingSelf).toBe(14);
  });
});
