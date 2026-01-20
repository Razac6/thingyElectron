import { powerMonitor, systemPreferences, dialog, shell } from 'electron';
import activeWin from 'active-win';
import log from 'electron-log';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logAppActivity, getSetting } from './db';

const execAsync = promisify(exec);

let interval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL = 30000; // 30 seconds
const IDLE_THRESHOLD = 60; // 60 seconds of no movement = ignore

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
    // Escape single quotes for the shell command if necessary, though this simple script avoids them
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const [appName, title] = stdout.trim().split('::');
    return {
      owner: { name: appName || 'Unknown' },
      title: title || ''
    };
  } catch (e) {
    // Suppress errors to avoid spamming logs or UI
    return null;
  }
}

export const startAppMonitor = async () => {
  if (interval) return;

  log.info('App Monitor started (Interval: 30s)');

  // macOS Permission Check (One-time prompt on start)
  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!isTrusted) {
      const selection = await dialog.showMessageBox({
        type: 'warning',
        title: 'Accessibility Permissions Needed',
        message: 'Thingy needs accessibility permissions to track your active applications for productivity analytics.',
        detail: 'Please enable Thingy in System Settings -> Privacy & Security -> Accessibility.',
        buttons: ['Open Settings', 'Ignore'],
        defaultId: 0,
        cancelId: 1,
      });

      if (selection.response === 0) {
        // Trigger the system prompt which has a button to open settings
        systemPreferences.isTrustedAccessibilityClient(true);
        // Fallback: Open the preference pane manually if possible (best effort)
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      }
    }
  }

  interval = setInterval(async () => {
    try {
      // 0. Check setting
      const enabled = getSetting('desktop_app_monitoring_enabled');
      if (enabled === 'false') return; // Enabled by default if not set, or set to 'false' to disable

      // 1. Check for system idle
      const idleTime = powerMonitor.getSystemIdleTime();
      if (idleTime > IDLE_THRESHOLD) {
        // User is away, don't record anything
        return;
      }

      // 2. Get active window
      let win;
      if (process.platform === 'darwin') {
         // Use AppleScript on macOS to avoid binary permission issues
         win = await getActiveWindowMac();
      } else {
         // Use active-win library on Windows/Linux
         win = await activeWin();
      }
      
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
