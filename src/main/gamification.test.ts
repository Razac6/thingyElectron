import {
  ACHIEVEMENTS,
  AchievementStats,
  applyXp,
  longestStreak,
  newlyEarned,
  totalXp,
} from './gamification';

const stats = (over: Partial<AchievementStats> = {}): AchievementStats => ({
  completedTasks: 0,
  completedBugs: 0,
  sprints: 0,
  longestSessionMin: 0,
  focusBlocksAchieved: 0,
  stepsCompleted: 0,
  onTargetTasks: 0,
  bestHabitStreak: 0,
  pomodoros: 0,
  meditationDays: 0,
  completedFeatures: 0,
  sprintsCompleted: 0,
  biggestChecklist: 0,
  workStreakDays: 0,
  bestDayMin: 0,
  questsCompleted: 0,
  notes: 0,
  water: 0,
  stretchingSessions: 0,
  ...over,
});

describe('gamification', () => {
  it('grants every task milestone already reached (retroactively)', () => {
    const ids = newlyEarned(stats({ completedTasks: 57 }), ['FIRST_TASK']).map(
      (a) => a.id,
    );
    expect(ids).toEqual(['FIVE_TASKS', 'TEN_TASKS', 'FIFTY_TASKS']);
  });

  it('does not grant twice', () => {
    expect(newlyEarned(stats({ completedTasks: 1 }), ['FIRST_TASK'])).toEqual(
      [],
    );
  });

  it('every achievement is reachable from its stat', () => {
    // A stats object at a huge value unlocks everything - i.e. no achievement depends
    // on data that is never recorded
    const all = Object.fromEntries(
      Object.keys(stats()).map((k) => [k, 10000]),
    ) as unknown as AchievementStats;
    expect(newlyEarned(all, []).length).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(
      ACHIEVEMENTS.length,
    );
  });

  it('levels up across several levels for big awards', () => {
    // level 1 needs 100, level 2 needs 200
    expect(applyXp({ level: 1, xp: 50 }, 300)).toEqual({
      level: 3,
      xp: 50,
      levelsGained: 2,
    });
    expect(applyXp({ level: 4, xp: 320 }, 10)).toEqual({
      level: 4,
      xp: 330,
      levelsGained: 0,
    });
    expect(totalXp(3, 50)).toBe(350);
  });

  it('longest streak of consecutive days', () => {
    expect(
      longestStreak([
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-05',
        '2026-01-02',
      ]),
    ).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});
