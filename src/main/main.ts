/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Tray, Menu } from 'electron';
// import { autoUpdater } from 'electron-updater'; // Commented out: electron-updater
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  initDB,
  getTasks, createTask, updateTask, deleteTask, updateTasksOrder,
  getSprints, createSprint, updateSprintStatus,
  getNotes, createNote, updateNote, deleteNote,
  loginUser, registerUser,
  getProfile, updateProfile, getEarnedAchievements, grantAchievement,
  globalSearch,
  getAverageTimeForTaskType, getAverageSprintCapacity,
  logWorkSession,
} from './db';

// --- Aggressive Error Logging ---
log.transports.file.level = 'info';
log.catchErrors({
  showDialog: false,
  onError: (error) => {
    log.error('Unhandled error in main process:', error);
    app.quit();
  }
});

require('dotenv').config();

// Commented out: electron-updater class definition
// class AppUpdater {
//   constructor() {
//     autoUpdater.logger = log;
//     autoUpdater.checkForUpdatesAndNotify();
//   }
// }

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// --- Global Asset Path Resolver ---
const getAssetPath = (...paths: string[]): string => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
  return path.join(RESOURCES_PATH, ...paths);
};

const trayIconPath = getAssetPath('icon.png'); // Resolve icon path once for the tray

// --- Tray Management Functions ---
const createTray = () => {
  if (tray) return; // Tray already exists
  tray = new Tray(trayIconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow?.show(); } },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Thingy App');
  tray.setTitle('');

  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow?.hide() : mainWindow?.show();
  });
};

const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

// --- IPC Handlers ---
ipcMain.handle('db:log-work-session', (event, session) => logWorkSession(session));
ipcMain.handle('db:global-search', (event, userId, query) => globalSearch(userId, query));
ipcMain.handle('db:get-tasks', (event, userId) => getTasks(userId));
ipcMain.handle('db:create-task', (event, task, userId) => createTask(task, userId));
ipcMain.handle('db:update-task', (event, task) => updateTask(task));
ipcMain.handle('db:delete-task', (event, taskId) => deleteTask(taskId));
ipcMain.handle('db:update-tasks-order', (event, taskIds) => updateTasksOrder(taskIds));
ipcMain.handle('db:get-sprints', () => getSprints());
ipcMain.handle('db:create-sprint', (event, sprint) => createSprint(sprint));
ipcMain.handle('db:update-sprint-status', (event, sprintId, status) => updateSprintStatus(sprintId, status));
ipcMain.handle('db:get-notes', (event, userId) => getNotes(userId));
ipcMain.handle('db:create-note', (event, note, userId) => createNote(note, userId));
ipcMain.handle('db:update-note', (event, note) => updateNote(note));
ipcMain.handle('db:delete-note', (event, noteId) => deleteNote(noteId));
ipcMain.handle('db:login', (event, { username, password }) => {
  const user = loginUser(username, password);
  if (user) return { access_token: 'local-session-token', userId: user.id };
  throw new Error('Invalid credentials');
});
ipcMain.handle('db:register', (event, { username, password }) => registerUser(username, password));
ipcMain.handle('db:get-profile', (event, userId) => getProfile(userId));
ipcMain.handle('db:update-profile', (event, profile) => updateProfile(profile));
ipcMain.handle('db:get-earned-achievements', (event, userId) => getEarnedAchievements(userId));
ipcMain.handle('db:grant-achievement', (event, userId, achievementId) => grantAchievement(userId, achievementId));
ipcMain.handle('db:get-average-time-for-task-type', (event, taskType) => getAverageTimeForTaskType(taskType));
ipcMain.handle('db:get-average-sprint-capacity', () => getAverageSprintCapacity());

// --- Tray IPC Handlers ---
ipcMain.on('tray:create', createTray);
ipcMain.on('tray:destroy', destroyTray);
ipcMain.on('tray:update-title', (event, title) => {
  if (tray) {
    tray.setTitle(title);
  }
});

ipcMain.on('tray:update-tooltip', (event, tooltip) => {
  if (tray) {
    tray.setToolTip(tooltip);
  }
});

// Add handler for tray:get-icon-path
ipcMain.on('tray:get-icon-path', (event) => {
  event.returnValue = trayIconPath; // Return the icon path synchronously
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  // require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];
  return installer.default(extensions.map((name) => installer[name]), forceDownload).catch(console.log);
};

const createWindow = async () => {
  if (isDebug) await installExtensions();

  // const RESOURCES_PATH = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../assets'); // Moved to global getAssetPath
  // const getAssetPath = (...paths: string[]): string => path.join(RESOURCES_PATH, ...paths); // Moved to global getAssetPath

  mainWindow = new BrowserWindow({
    show: false,
    width: 1254,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged ? path.join(__dirname, 'preload.js') : path.join(__dirname, '../../.erb/dll/preload.js'),
      devTools: true,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Commented out: electron-updater instantiation
  // new AppUpdater();
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  try {
    log.info('Initializing database...');
    await initDB();
    log.info('Database initialized successfully.');
  } catch (error) {
    log.error('CRITICAL: Failed to initialize database on startup.', error);
    app.quit();
    return;
  }

  createWindow();

  // Remove default tray creation here
  // Tray will be managed by renderer process via IPC

}).catch((error) => {
  log.error('CRITICAL: Unhandled error in app.whenReady.', error);
  app.quit();
});
