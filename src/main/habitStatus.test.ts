import { computeHabitStatus, isHabitDueOn, localDateKey } from './habitStatus';

describe('habitStatus', () => {
  // Wednesday
  const now = new Date(2026, 9, 28, 16, 0, 0);
  const today = localDateKey(now);

  it('keys days by the local calendar date', () => {
    const lateEvening = new Date(2026, 9, 28, 23, 30, 0);
    expect(localDateKey(lateEvening)).toBe('2026-10-28');
  });

  it('only counts habits scheduled for today', () => {
    const daily = { id: 1, title: 'Read', frequency: { type: 'daily' } };
    const mondays = {
      id: 2,
      title: 'Gym',
      frequency: { type: 'weekly', days: [1] },
    };
    expect(isHabitDueOn(daily, now)).toBe(true);
    expect(isHabitDueOn(mondays, now)).toBe(false);

    const status = computeHabitStatus([daily, mondays], [], now);
    expect(status.due.map((h) => h.id)).toEqual([1]);
    expect(status.score).toBe(0);
  });

  it('has no score (not 0%) when nothing is due today', () => {
    const mondays = {
      id: 2,
      title: 'Gym',
      frequency: { type: 'weekly', days: [1] },
    };
    expect(computeHabitStatus([mondays], [], now).score).toBeNull();
    expect(computeHabitStatus([], [], now).score).toBeNull();
  });

  it('splits due habits into done and pending using today logs only', () => {
    const habits = [
      { id: 1, title: 'Read' },
      { id: 2, title: 'Walk' },
    ];
    const logs = [
      { habitId: 1, date: today, value: 1 },
      { habitId: 2, date: '2026-10-27', value: 1 }, // yesterday doesn't count
    ];
    const status = computeHabitStatus(habits, logs, now);
    expect(status.done.map((h) => h.title)).toEqual(['Read']);
    expect(status.pending.map((h) => h.title)).toEqual(['Walk']);
    expect(status.score).toBe(0.5);
  });
});
