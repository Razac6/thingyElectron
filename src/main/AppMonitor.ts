import { powerMonitor } from 'electron';
import activeWin from 'active-win';
import log from 'electron-log';
import { logAppActivity } from './db';

let interval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL = 30000; // 30 seconds
const IDLE_THRESHOLD = 60; // 60 seconds of no movement = ignore

export const startAppMonitor = () => {
  if (interval) return;

  log.info('App Monitor started (Interval: 30s)');

  interval = setInterval(async () => {
    try {
      // 1. Check for system idle
      const idleTime = powerMonitor.getSystemIdleTime();
      if (idleTime > IDLE_THRESHOLD) {
        // User is away, don't record anything
        return;
      }

      // 2. Get active window
      const win = await activeWin();
      
      if (!win) return;

      // 3. Log to DB
      // We log the duration as the interval itself
      logAppActivity({
        appName: win.owner.name,
        windowTitle: win.title,
        duration: CHECK_INTERVAL,
        timestamp: Date.now()
      });

    } catch (e) {
      // Silently ignore errors (e.g. on system lock)
    }
  }, CHECK_INTERVAL);
};

export const stopAppMonitor = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};
