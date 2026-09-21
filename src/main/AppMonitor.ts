import { powerMonitor, systemPreferences, dialog, shell } from 'electron';
import activeWin from 'active-win';
import log from 'electron-log';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logAppActivity, getSetting } from './db';

const execAsync = promisify(exec);

let interval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL = 10000; // 10 seconds for better resolution
const IDLE_THRESHOLD = 40; // 40 seconds of no movement = ignore

// Helper for macOS to avoid active-win binary permission issues
async function getActiveWindowMac() {
  const script = `
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set frontAppName to name of frontApp
      set windowTitle to ""
      try
        tell process frontAppName
          set windowTitle to name of window 1
        end tell
      end try
      return frontAppName & "::" & windowTitle
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const [appName, title] = stdout.trim().split('::');
    return {
      owner: { name: appName || 'Unknown' },
      title: title || '',
    };
  } catch (e) {
    return null;
  }
}

export const startAppMonitor = async () => {
  if (interval) return;

  log.info('App Monitor started (Interval: 10s)');

  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!isTrusted) {
      const selection = await dialog.showMessageBox({
        type: 'warning',
        title: 'Accessibility Permissions Needed',
        message:
          'Thingy needs accessibility permissions to track your active applications for productivity analytics.',
        detail:
          'Please enable Thingy in System Settings -> Privacy & Security -> Accessibility.',
        buttons: ['Open Settings', 'Ignore'],
        defaultId: 0,
        cancelId: 1,
      });

      if (selection.response === 0) {
        systemPreferences.isTrustedAccessibilityClient(true);
        shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
        );
      }
    }
  }

  interval = setInterval(async () => {
    try {
      const enabled = getSetting('desktop_app_monitoring_enabled');
      if (enabled === 'false') return;

      const idleTime = powerMonitor.getSystemIdleTime();
      if (idleTime > IDLE_THRESHOLD) return;

      let win;
      if (process.platform === 'darwin') {
        win = await getActiveWindowMac();
      } else {
        win = await activeWin();
      }

      if (!win) return;

      logAppActivity({
        appName:
          (win.owner as any).name || (win.owner as any).path || 'Unknown',
        windowTitle: win.title || 'Untitled',
        duration: CHECK_INTERVAL,
        timestamp: Date.now(),
      });
    } catch (e) {
      // Silently ignore errors
    }
  }, CHECK_INTERVAL);
};

export const stopAppMonitor = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};
