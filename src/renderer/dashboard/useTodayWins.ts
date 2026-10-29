import { useEffect, useState } from 'react';
import { useTimer } from '../context/TimerContext';

// Today's progress as finished things (steps, focus blocks, tasks) rather than totals -
// developers often work all day and feel they got nothing done; the dashboard's top row
// shows these small wins. Steps and blocks come from FocusBlockCard and task checklists.

export type TodayWins = Awaited<
  ReturnType<typeof window.electron.database.getTodayWins>
>;

export default function useTodayWins(): TodayWins | null {
  const { tasks } = useTimer();
  const [wins, setWins] = useState<TodayWins | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const userStr = localStorage.getItem('userId');
        const userId = userStr ? JSON.parse(userStr) : null;
        const data = await window.electron.database.getTodayWins(userId);
        if (!cancelled) setWins(data);
      } catch (e) {
        if (!cancelled) setWins(null);
      }
    };
    load();
    // Steps/blocks are finished outside the dashboard - refresh now and then
    const interval = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tasks]);

  return wins;
}
