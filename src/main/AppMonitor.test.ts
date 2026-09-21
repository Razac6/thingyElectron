import { powerMonitor } from 'electron';
import activeWin from 'active-win';
import { startAppMonitor, stopAppMonitor } from './AppMonitor';

import { logAppActivity, getSetting } from './db';

// Mock electron
jest.mock('electron', () => ({
  powerMonitor: {
    getSystemIdleTime: jest.fn(),
  },
  systemPreferences: {
    isTrustedAccessibilityClient: jest.fn().mockReturnValue(true),
  },
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 1 }),
  },
  shell: {
    openExternal: jest.fn(),
  },
}));

// Mock active-win
jest.mock('active-win', () => jest.fn());

// Mock db
jest.mock('./db', () => ({
  logAppActivity: jest.fn(),
  getSetting: jest.fn(),
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('AppMonitor', () => {
  let intervalCallback: any;

  beforeEach(() => {
    jest.clearAllMocks();
    stopAppMonitor();

    // Default mock values
    (getSetting as jest.Mock).mockReturnValue('true');
    (powerMonitor.getSystemIdleTime as jest.Mock).mockReturnValue(0);

    // Manual intercept setInterval
    jest.spyOn(global, 'setInterval').mockImplementation(((cb: any) => {
      intervalCallback = cb;
      return 123 as any;
    }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    stopAppMonitor();
  });

  it('should not log activity if monitoring is disabled in settings', async () => {
    (getSetting as jest.Mock).mockReturnValue('false');
    await startAppMonitor();

    await intervalCallback();

    expect(logAppActivity).not.toHaveBeenCalled();
  });

  it('should not log activity if system is idle', async () => {
    (powerMonitor.getSystemIdleTime as jest.Mock).mockReturnValue(50);
    await startAppMonitor();

    await intervalCallback();

    expect(logAppActivity).not.toHaveBeenCalled();
  });

  it('should log activity if active window found and system not idle', async () => {
    (powerMonitor.getSystemIdleTime as jest.Mock).mockReturnValue(10);
    (activeWin as unknown as jest.Mock).mockResolvedValue({
      owner: { name: 'WebStorm' },
      title: 'AppMonitor.ts',
    });

    await startAppMonitor();
    await intervalCallback();

    expect(activeWin).toHaveBeenCalled();
    expect(logAppActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: 'WebStorm',
        windowTitle: 'AppMonitor.ts',
        duration: 10000,
      }),
    );
  });

  it('should handle unknown window owner names', async () => {
    (powerMonitor.getSystemIdleTime as jest.Mock).mockReturnValue(10);
    (activeWin as unknown as jest.Mock).mockResolvedValue({
      owner: { path: '/path/to/app' },
      title: 'Untitled',
    });

    await startAppMonitor();
    await intervalCallback();

    expect(activeWin).toHaveBeenCalled();
    expect(logAppActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: '/path/to/app',
      }),
    );
  });
});
