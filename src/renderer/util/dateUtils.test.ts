import {
  toLocalISOString,
  addDays,
  getMonday,
  calculateStreak,
} from './dateUtils';

describe('dateUtils', () => {
  describe('toLocalISOString', () => {
    it('should format date correctly as YYYY-MM-DD', () => {
      const date = new Date(2023, 0, 15); // Jan 15, 2023
      expect(toLocalISOString(date)).toBe('2023-01-15');
    });
  });

  describe('addDays', () => {
    it('should add days correctly', () => {
      const date = new Date(2023, 0, 1);
      const newDate = addDays(date, 5);
      expect(newDate.getDate()).toBe(6);
    });

    it('should handle negative days', () => {
      const date = new Date(2023, 0, 6);
      const newDate = addDays(date, -5);
      expect(newDate.getDate()).toBe(1);
    });
  });

  describe('getMonday', () => {
    it('should return Monday of the same week for a Wednesday', () => {
      // 2023-10-25 is Wednesday
      const date = new Date(2023, 9, 25);
      const monday = getMonday(date);
      expect(monday.getDay()).toBe(1); // Monday
      expect(monday.getDate()).toBe(23); // Oct 23
    });

    it('should return the same day if it is already Monday', () => {
      // 2023-10-23 is Monday
      const date = new Date(2023, 9, 23);
      const monday = getMonday(date);
      expect(monday.getDate()).toBe(23);
    });

    it('should return previous Monday if it is Sunday', () => {
      // 2023-10-29 is Sunday
      const date = new Date(2023, 9, 29);
      const monday = getMonday(date);
      expect(monday.getDate()).toBe(23);
    });
  });

  describe('calculateStreak', () => {
    const today = toLocalISOString(new Date());
    const yesterday = toLocalISOString(addDays(new Date(), -1));
    const dayBeforeYesterday = toLocalISOString(addDays(new Date(), -2));

    it('should return 0 for empty logs', () => {
      expect(calculateStreak([])).toBe(0);
    });

    it('should return 1 if only today is completed', () => {
      const logs = [{ date: today, value: 1 }];
      expect(calculateStreak(logs)).toBe(1);
    });

    it('should return 2 if today and yesterday are completed', () => {
      const logs = [
        { date: today, value: 1 },
        { date: yesterday, value: 1 },
      ];
      expect(calculateStreak(logs)).toBe(2);
    });

    it('should return 3 if today, yesterday and day before are completed', () => {
      const logs = [
        { date: today, value: 1 },
        { date: yesterday, value: 1 },
        { date: dayBeforeYesterday, value: 1 },
      ];
      expect(calculateStreak(logs)).toBe(3);
    });

    it('should return 0 if last completion was more than 1 day ago', () => {
      const logs = [{ date: dayBeforeYesterday, value: 1 }];
      expect(calculateStreak(logs)).toBe(0);
    });

    it('should return streak even if today is not completed but yesterday is', () => {
      const logs = [
        { date: yesterday, value: 1 },
        { date: dayBeforeYesterday, value: 1 },
      ];
      expect(calculateStreak(logs)).toBe(2);
    });
  });
});
