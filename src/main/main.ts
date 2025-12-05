/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
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
} from './db';

require('dotenv').config();

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

// --- IPC Handlers ---
// Tasks
ipcMain.handle('db:get-tasks', (event, userId) => getTasks(userId));
ipcMain.handle('db:create-task', (event, task, userId) => createTask(task, userId));
ipcMain.handle('db:update-task', (event, task) => updateTask(task));
ipcMain.handle('db:delete-task', (event, taskId) => deleteTask(taskId));
ipcMain.handle('db:update-tasks-order', (event, taskIds) => updateTasksOrder(taskIds));

// Sprints
ipcMain.handle('db:get-sprints', () => getSprints());
ipcMain.handle('db:create-sprint', (event, sprint) => createSprint(sprint));
ipcMain.handle('db:update-sprint-status', (event, sprintId, status) => updateSprintStatus(sprintId, status));

// Notes
ipcMain.handle('db:get-notes', (event, userId) => getNotes(userId));
ipcMain.handle('db:create-note', (event, note, userId) => createNote(note, userId));
ipcMain.handle('db:update-note', (event, note) => updateNote(note));
ipcMain.handle('db:delete-note', (event, noteId) => deleteNote(noteId));

// Users
ipcMain.handle('db:login', (event, { username, password }) => {
  const user = loginUser(username, password);
  if (user) return { access_token: 'local-session-token', userId: user.id };
  throw new Error('Invalid credentials');
});
ipcMain.handle('db:register', (event, { username, password }) => registerUser(username, password));

// Gamification
ipcMain.handle('db:get-profile', (event, userId) => getProfile(userId));
ipcMain.handle('db:update-profile', (event, profile) => updateProfile(profile));
ipcMain.handle('db:get-earned-achievements', (event, userId) => getEarnedAchievements(userId));
ipcMain.handle('db:grant-achievement', (event, userId, achievementId) => grantAchievement(userId, achievementId));


if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  // require('electron-debug')(); // Commented out to prevent auto-opening dev tools
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];
  return installer.default(extensions.map((name) => installer[name]), forceDownload).catch(console.log);
};

const createWindow = async () => {
  if (isDebug) await installExtensions();

  const RESOURCES_PATH = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../assets');
  const getAssetPath = (...paths: string[]): string => path.join(RESOURCES_PATH, ...paths);

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

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');
    if (process.env.START_MINIMIZED) mainWindow.minimize();
    else mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  new AppUpdater();
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(async () => {
  await initDB();
  createWindow();
  app.on('activate', () => {
    if (mainWindow === null) createWindow();
  });
}).catch(console.log);
