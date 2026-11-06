// Which habits count "today" and how many are done - shared by notifications, habit
// reminders and AI messages so they all agree. Two things they used to get wrong:
// habits scheduled for other weekdays were counted as missed (a false "0% of habits"),
// and "today" was the UTC date while habit logs are keyed by the local date.

export interface HabitLike {
  id: number;
  title: string;
  reminderTime?: string | null;
  frequency?: { type?: string; days?: number[] } | null;
}

export interface HabitLogLike {
  habitId: number;
  date: string;
  value: number;
}

// Local calendar date (YYYY-MM-DD), the key the renderer uses for habit logs
export const localDateKey = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const isHabitDueOn = (habit: HabitLike, date: Date): boolean => {
  const { frequency } = habit;
  if (!frequency || !frequency.type || frequency.type === 'daily') return true;
  return (
    Array.isArray(frequency.days) && frequency.days.includes(date.getDay())
  );
};

export const computeHabitStatus = <H extends HabitLike>(
  habits: H[],
  logs: HabitLogLike[],
  now: Date = new Date(),
) => {
  const today = localDateKey(now);
  const due = habits.filter((h) => isHabitDueOn(h, now));
  const isDone = (h: H) =>
    logs.some((l) => l.habitId === h.id && l.date === today && l.value >= 1);
  const done = due.filter(isDone);
  const pending = due.filter((h) => !isDone(h));
  return {
    due,
    done,
    pending,
    // null = no habits due today, so there is nothing to score (not "0%")
    score: due.length > 0 ? done.length / due.length : null,
  };
};
