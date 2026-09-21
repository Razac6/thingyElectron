/**
 * Converts a Date object to a local ISO date string (YYYY-MM-DD).
 */
export const toLocalISOString = (date: Date): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

/**
 * Adds a specified number of days to a Date object.
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Returns a new Date object representing the Monday of the week for the given date.
 */
export const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const newDate = new Date(date.setDate(diff));
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

/**
 * Calculates the current streak from a list of logs.
 * Expects logs to have a 'date' property in YYYY-MM-DD format and a 'value' property.
 */
export const calculateStreak = (
  logs: { date: string; value: number }[],
): number => {
  const completedLogs = logs.filter((l) => l.value >= 1);
  if (completedLogs.length === 0) return 0;

  const sortedDates = [...new Set(completedLogs.map((l) => l.date))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  const today = toLocalISOString(new Date());
  const yesterday = toLocalISOString(addDays(new Date(), -1));

  const lastLogDate = sortedDates[0];
  if (lastLogDate !== today && lastLogDate !== yesterday) return 0;

  let streak = 0;
  let currentDate = new Date(lastLogDate);

  for (let i = 0; i < sortedDates.length; i++) {
    const logDate = sortedDates[i];
    if (logDate === toLocalISOString(currentDate)) {
      streak++;
      currentDate = addDays(currentDate, -1);
    } else break;
  }
  return streak;
};
