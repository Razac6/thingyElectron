import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Database } from 'sql.js';
import crypto from 'crypto';

const initSqlJs = require('sql.js');

let db: Database | null = null;
const dbPath = path.join(app.getPath('userData'), 'thingy.sqlite');

const saveDB = () => {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export const initDB = async () => {
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    : path.join(require.resolve('sql.js'), '..', 'sql-wasm.wasm');

  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();

  // --- Schema Migrations & Table Creation ---
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT, description TEXT, status TEXT, updateStatusDate TEXT, estimate INTEGER, priority TEXT, link TEXT, createdAt TEXT, spendTime INTEGER, startTimer TEXT, type TEXT DEFAULT 'TASK', userId INTEGER, sprintId INTEGER, displayOrder INTEGER, FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(sprintId) REFERENCES sprints(id) ON DELETE SET NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT, content TEXT, createdAt TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS sprints (id INTEGER PRIMARY KEY, name TEXT NOT NULL, startDate TEXT, endDate TEXT, status TEXT NOT NULL DEFAULT 'UPCOMING')`);
  db.run(`CREATE TABLE IF NOT EXISTS user_profile (userId INTEGER PRIMARY KEY, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, FOREIGN KEY(userId) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, xp INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS user_achievements (userId INTEGER, achievementId TEXT, earnedAt TEXT NOT NULL, PRIMARY KEY (userId, achievementId), FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(achievementId) REFERENCES achievements(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS task_tags (taskId INTEGER, tagId INTEGER, PRIMARY KEY (taskId, tagId), FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS work_sessions (id INTEGER PRIMARY KEY, taskId INTEGER, startTime TEXT, endTime TEXT, duration INTEGER, FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE)`);


  try {
    const columns = db.exec("PRAGMA table_info(tasks);")[0].values;
    if (!columns.some(row => row[1] === 'displayOrder')) {
      db.run('ALTER TABLE tasks ADD COLUMN displayOrder INTEGER');
      db.run('UPDATE tasks SET displayOrder = id WHERE displayOrder IS NULL');
    }
    if (!columns.some(row => row[1] === 'type')) {
      db.run("ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'TASK'");
    }
  } catch (e) { /* ignore */ }


  const achievementsToSeed = [
    { id: 'FIRST_TASK', name: 'First Step', description: 'Complete your first task.', xp: 10 },
    { id: 'FIVE_TASKS', name: 'Apprentice', description: 'Complete 5 tasks.', xp: 50 },
    { id: 'TEN_TASKS', name: 'Journeyman', description: 'Complete 10 tasks.', xp: 100 },
    { id: 'BUG_SQUASHER', name: 'Bug Squasher', description: 'Complete your first bug task.', xp: 20 },
    { id: 'THE_PLANNER', name: 'The Planner', description: 'Create your first sprint.', xp: 25 },
    { id: 'DEEP_DIVE', name: 'Deep Dive', description: 'Spend over 2 hours on a single task.', xp: 50 },
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO achievements (id, name, description, xp) VALUES (?, ?, ?, ?)');
  achievementsToSeed.forEach(ach => stmt.run([ach.id, ach.name, ach.description, ach.xp]));
  stmt.free();

  saveDB();
};

// --- Work Session Logging ---
export const logWorkSession = (session: { taskId: number, startTime: string, endTime: string, duration: number }) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT INTO work_sessions (taskId, startTime, endTime, duration) VALUES (?, ?, ?, ?)', [session.taskId, session.startTime, session.endTime, session.duration]);
  saveDB();
};


// --- Analytics Functions ---
export const getAverageTimeForTaskType = (taskType: string) => {
  if (!db) return 0;
  const stmt = db.prepare(`SELECT AVG(spendTime) as avgTime FROM tasks WHERE type = :type AND status = 'COMPLETED'`);
  stmt.bind({ ':type': taskType });
  let result = 0;
  if (stmt.step()) {
    result = stmt.get()[0] as number || 0;
  }
  stmt.free();
  return result;
};

export const getAverageSprintCapacity = () => {
  if (!db) return 0;
  const sprintIdsStmt = db.prepare(`SELECT id FROM sprints WHERE status = 'COMPLETED' ORDER BY endDate DESC LIMIT 3`);
  const sprintIds: number[] = [];
  while (sprintIdsStmt.step()) {
    sprintIds.push(sprintIdsStmt.get()[0] as number);
  }
  sprintIdsStmt.free();

  if (sprintIds.length === 0) return 0;

  let totalCapacity = 0;
  const taskSumStmt = db.prepare(`SELECT SUM(estimate) FROM tasks WHERE sprintId = ?`);
  sprintIds.forEach(id => {
    taskSumStmt.bind([id]);
    if (taskSumStmt.step()) {
      totalCapacity += taskSumStmt.get()[0] as number || 0;
    }
    taskSumStmt.reset();
  });
  taskSumStmt.free();

  return totalCapacity / sprintIds.length;
};


// --- Global Search ---
export const globalSearch = (userId: number, query: string) => {
  if (!db) throw new Error('DB not initialized');
  const results: any[] = [];
  const likeQuery = `%${query}%`;

  const taskStmt = db.prepare(`
    SELECT id, title, 'task' as resultType
    FROM tasks
    WHERE userId = :userId AND (title LIKE :query COLLATE NOCASE OR description LIKE :query COLLATE NOCASE)
  `);
  taskStmt.bind({ ':userId': userId, ':query': likeQuery });
  while (taskStmt.step()) {
    results.push(taskStmt.getAsObject());
  }
  taskStmt.free();

  const noteStmt = db.prepare(`
    SELECT id, title, 'note' as resultType
    FROM notes
    WHERE userId = :userId AND (title LIKE :query COLLATE NOCASE OR content LIKE :query COLLATE NOCASE)
  `);
  noteStmt.bind({ ':userId': userId, ':query': likeQuery });
  while (noteStmt.step()) {
    results.push(noteStmt.getAsObject());
  }
  noteStmt.free();

  return results;
};

// ... (rest of the file)
export const updateTasksOrder = (taskIds: number[]) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('UPDATE tasks SET displayOrder = ? WHERE id = ?');
  try {
    db.run('BEGIN TRANSACTION');
    taskIds.forEach((id, index) => {
      stmt.run([index, id]);
    });
    db.run('COMMIT');
  } finally {
    stmt.free();
    saveDB();
  }
};

export const getTasks = (userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const query = `
    SELECT
      t.*,
      (SELECT GROUP_CONCAT(tags.name) FROM task_tags JOIN tags ON tags.id = task_tags.tagId WHERE task_tags.taskId = t.id) as tags
    FROM tasks t
    WHERE t.userId = :userId
    ORDER BY t.displayOrder ASC
  `;
  const stmt = db.prepare(query);
  stmt.bind({ ':userId': userId });
  const tasks: any[] = [];
  while (stmt.step()) {
    const task = stmt.getAsObject();
    task.tags = task.tags ? (task.tags as string).split(',') : [];
    tasks.push(task);
  }
  stmt.free();
  return tasks;
};

export const createTask = (task: any, userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const maxOrderResult = db.exec('SELECT MAX(displayOrder) FROM tasks');
  const maxOrder = maxOrderResult[0]?.values[0][0] as number | null;
  const newOrder = (maxOrder === null) ? 0 : maxOrder + 1;

  const stmt = db.prepare(`INSERT INTO tasks (title, description, status, updateStatusDate, estimate, priority, link, createdAt, spendTime, startTimer, type, userId, sprintId, displayOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run([task.title, task.description, task.status, task.updateStatusDate, task.estimate, task.priority, task.link, task.createdAt, task.spendTime || 0, task.startTimer, task.type || 'TASK', userId, task.sprintId || null, newOrder]);
  stmt.free();

  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDB();
  return { ...task, id, userId, displayOrder: newOrder };
};

export const updateTask = (task: any) => {
  if (!db) throw new Error('DB not initialized');
  if (task.tags && Array.isArray(task.tags)) {
    setTaskTags(task.id, task.tags);
  }
  db.run(`UPDATE tasks SET title = ?, description = ?, status = ?, updateStatusDate = ?, estimate = ?, priority = ?, link = ?, spendTime = ?, startTimer = ?, sprintId = ?, type = ? WHERE id = ?`, [task.title, task.description, task.status, task.updateStatusDate, task.estimate, task.priority, task.link, task.spendTime, task.startTimer, task.sprintId, task.type || 'TASK', task.id]);
  saveDB();
  return task;
};

export const getOrCreateTag = (name: string): number => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name]);
  const tag = db.getAsObject('SELECT id FROM tags WHERE name = ?', [name]);
  return tag.id as number;
};

export const setTaskTags = (taskId: number, tagNames: string[]) => {
  if (!db) throw new Error('DB not initialized');
  db.run('DELETE FROM task_tags WHERE taskId = ?', [taskId]);
  const stmt = db.prepare('INSERT INTO task_tags (taskId, tagId) VALUES (?, ?)');
  tagNames.forEach(name => {
    const tagId = getOrCreateTag(name);
    stmt.run([taskId, tagId]);
  });
  stmt.free();
  saveDB();
};

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
  db.run('UPDATE user_profile SET level = ?, xp = ? WHERE userId = ?', [profile.level, profile.xp, profile.userId]);
  saveDB();
  return profile;
};

export const getEarnedAchievements = (userId: number) => {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('SELECT achievementId FROM user_achievements WHERE userId = :userId');
  stmt.bind({ ':userId': userId });
  const achievements: string[] = [];
  while (stmt.step()) { achievements.push(stmt.get()[0] as string); }
  stmt.free();
  return achievements;
};

export const grantAchievement = (userId: number, achievementId: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT OR IGNORE INTO user_achievements (userId, achievementId, earnedAt) VALUES (?, ?, ?)', [userId, achievementId, new Date().toISOString()]);
  saveDB();
  return { userId, achievementId };
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

export const updateSprintStatus = (sprintId: number, status: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE sprints SET status = ? WHERE id = ?', [status, sprintId]);
  saveDB();
  return { id: sprintId, status };
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
