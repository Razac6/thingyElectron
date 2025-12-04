import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';

let db: Database | null = null;
const dbPath = path.join(app.getPath('userData'), 'thingy.sqlite');

// --- Helper Functions ---
const saveDB = () => {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// --- DB Initialization ---
export const initDB = async () => {
  const SQL = await initSqlJs();
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();

  // --- Schema Migration ---
  try {
    const columns = db.exec("PRAGMA table_info(tasks);");
    if (!columns[0]?.values.some(row => row[1] === 'sprintId')) {
      db.run('ALTER TABLE tasks ADD COLUMN sprintId INTEGER REFERENCES sprints(id) ON DELETE SET NULL');
    }
  } catch (e) { /* Fails if tasks table doesn't exist, which is fine */ }

  // --- Table Creation ---
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT, description TEXT, status TEXT, updateStatusDate TEXT, estimate INTEGER, priority TEXT, link TEXT, createdAt TEXT, spendTime INTEGER, startTimer TEXT, type TEXT, userId INTEGER, sprintId INTEGER, FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(sprintId) REFERENCES sprints(id) ON DELETE SET NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT, content TEXT, createdAt TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS sprints (id INTEGER PRIMARY KEY, name TEXT NOT NULL, startDate TEXT, endDate TEXT, status TEXT NOT NULL DEFAULT 'UPCOMING')`);
  db.run(`CREATE TABLE IF NOT EXISTS user_profile (userId INTEGER PRIMARY KEY, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, FOREIGN KEY(userId) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, xp INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS user_achievements (userId INTEGER, achievementId TEXT, earnedAt TEXT NOT NULL, PRIMARY KEY (userId, achievementId), FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(achievementId) REFERENCES achievements(id))`);

  // --- Seeding ---
  const achievementsToSeed = [
    { id: 'FIRST_TASK', name: 'First Step', description: 'Complete your first task.', xp: 10 },
    { id: 'FIVE_TASKS', name: 'Apprentice', description: 'Complete 5 tasks.', xp: 50 },
    { id: 'TEN_TASKS', name: 'Journeyman', description: 'Complete 10 tasks.', xp: 100 },
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO achievements (id, name, description, xp) VALUES (?, ?, ?, ?)');
  achievementsToSeed.forEach(ach => stmt.run([ach.id, ach.name, ach.description, ach.xp]));
  stmt.free();

  const userCount = db.exec('SELECT count(*) as count FROM users')[0]?.values[0][0] as number || 0;
  if (userCount === 0) {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashPassword('admin')]);
  }

  // Always ensure a profile exists for the default user
  db.run('INSERT OR IGNORE INTO user_profile (userId) VALUES (?)', [1]);

  saveDB();
};

// --- Gamification Functions ---
export const getProfile = (userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT * FROM user_profile WHERE userId = :userId');
  stmt.bind({ ':userId': userId });
  let profile = null;
  if (stmt.step()) {
    profile = stmt.getAsObject();
  }
  stmt.free();
  return profile;
};

export const updateProfile = (profile: { userId: number, level: number, xp: number }) => {
  if (!db) throw new Error('DB not initialized');
  db.run(
    'UPDATE user_profile SET level = ?, xp = ? WHERE userId = ?',
    [profile.level, profile.xp, profile.userId]
  );
  saveDB();
  return profile;
};

export const getEarnedAchievements = (userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT achievementId FROM user_achievements WHERE userId = :userId');
  stmt.bind({ ':userId': userId });
  const achievements: string[] = [];
  while (stmt.step()) {
    achievements.push(stmt.get()[0] as string);
  }
  stmt.free();
  return achievements;
};

export const grantAchievement = (userId: number, achievementId: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run(
    'INSERT OR IGNORE INTO user_achievements (userId, achievementId, earnedAt) VALUES (?, ?, ?)',
    [userId, achievementId, new Date().toISOString()]
  );
  saveDB();
  return { userId, achievementId };
};

// --- Other Functions (Tasks, Sprints, Notes, Users) ---
export const getTasks = (userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT * FROM tasks WHERE userId = :userId');
  stmt.bind({ ':userId': userId });
  const tasks: any[] = [];
  while (stmt.step()) { tasks.push(stmt.getAsObject()); }
  stmt.free();
  return tasks;
};

export const createTask = (task: any, userId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run(`INSERT INTO tasks (title, description, status, updateStatusDate, estimate, priority, link, createdAt, spendTime, startTimer, type, userId, sprintId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [task.title, task.description, task.status, task.updateStatusDate, task.estimate, task.priority, task.link, task.createdAt, task.spendTime || 0, task.startTimer, task.type, userId, task.sprintId || null]);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDB();
  return { ...task, id, userId };
};

export const updateTask = (task: any) => {
  if (!db) throw new Error('DB not initialized');
  db.run(`UPDATE tasks SET title = ?, description = ?, status = ?, updateStatusDate = ?, estimate = ?, priority = ?, link = ?, spendTime = ?, startTimer = ?, sprintId = ? WHERE id = ?`, [task.title, task.description, task.status, task.updateStatusDate, task.estimate, task.priority, task.link, task.spendTime, task.startTimer, task.sprintId, task.id]);
  saveDB();
  return task;
};

export const deleteTask = (taskId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  saveDB();
  return taskId;
};

export const getSprints = () => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT * FROM sprints ORDER BY startDate DESC');
  const sprints: any[] = [];
  while (stmt.step()) { sprints.push(stmt.getAsObject()); }
  stmt.free();
  return sprints;
};

export const createSprint = (sprint: { name: string, startDate: string, endDate: string }) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT INTO sprints (name, startDate, endDate, status) VALUES (?, ?, ?, ?)', [sprint.name, sprint.startDate, sprint.endDate, 'UPCOMING']);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDB();
  return { ...sprint, id, status: 'UPCOMING' };
};

export const getNotes = (userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT * FROM notes WHERE userId = :userId');
  stmt.bind({ ':userId': userId });
  const notes: any[] = [];
  while (stmt.step()) { notes.push(stmt.getAsObject()); }
  stmt.free();
  return notes;
};

export const createNote = (note: any, userId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT INTO notes (title, content, createdAt, userId) VALUES (?, ?, ?, ?)', [note.title, note.content, note.createdAt, userId]);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDB();
  return { ...note, id, userId };
};

export const updateNote = (note: any) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE notes SET title = ?, content = ? WHERE id = ?', [note.title, note.content, note.id]);
  saveDB();
  return note;
};

export const deleteNote = (noteId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run('DELETE FROM notes WHERE id = ?', [noteId]);
  saveDB();
  return noteId;
};

export const registerUser = (username: string, password: string) => {
  if (!db) throw new Error('DB not initialized');
  try {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashPassword(password)]);
    saveDB();
    return true;
  } catch (e) { return false; }
};

export const loginUser = (username: string, password: string) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT id, username FROM users WHERE username = :username AND password = :password');
  stmt.bind({ ':username': username, ':password': hashPassword(password) });
  if (stmt.step()) {
    const user = stmt.getAsObject();
    stmt.free();
    return user;
  }
  stmt.free();
  return null;
};

export const closeDB = () => {
  if (db) {
    saveDB();
    db.close();
  }
};
