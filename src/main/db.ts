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
  console.log('[DB] Database saved to disk.');
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
  db.run(`CREATE TABLE IF NOT EXISTS daily_challenges (id INTEGER PRIMARY KEY, userId INTEGER, date TEXT, type TEXT, target INTEGER, progress INTEGER DEFAULT 0, description TEXT, xpReward INTEGER, status TEXT DEFAULT 'ACTIVE', FOREIGN KEY(userId) REFERENCES users(id))`);
  db.run(`
    CREATE TABLE IF NOT EXISTS tag_analytics (
      tag_id INTEGER PRIMARY KEY,
      ema REAL DEFAULT 0,
      std_dev REAL DEFAULT 0,
      variance REAL DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);


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

// --- Analytics Engine ---
export const getTagAnalytics = (tagId: number) => {
  if (!db) return null;
  const stmt = db.prepare('SELECT * FROM tag_analytics WHERE tag_id = ?');
  const result = stmt.get([tagId]);
  stmt.free();
  return result || { tag_id: tagId, ema: 0, std_dev: 0, variance: 0, completed_count: 0 };
};

export const getTagAnalyticsWithNames = () => {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT t.id, t.name, ta.ema, ta.std_dev, ta.completed_count 
    FROM tag_analytics ta 
    JOIN tags t ON ta.tag_id = t.id
  `);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

const updateTagAnalytics = (tagId: number, duration: number) => {
  if (!db) return;
  const currentAnalytics: any = getTagAnalytics(tagId);
  const n = currentAnalytics.completed_count + 1;
  const alpha = 2 / (n + 1); // Smoothing factor

  const newEma = (duration * alpha) + (currentAnalytics.ema * (1 - alpha));

  // Welford's online algorithm for variance
  const oldMean = currentAnalytics.ema;
  const oldVariance = currentAnalytics.variance;
  const newMean = oldMean + (duration - oldMean) / n;
  const newVariance = ((n - 1) * oldVariance + (duration - oldMean) * (duration - newMean)) / n;
  const newStdDev = Math.sqrt(newVariance);

  db.run(
    'INSERT OR REPLACE INTO tag_analytics (tag_id, ema, std_dev, variance, completed_count) VALUES (?, ?, ?, ?, ?)',
    [tagId, newEma, newStdDev, newVariance, n]
  );
};

// --- Work Session Logging ---
export const logWorkSession = (session: { taskId: number, startTime: string, endTime: string, duration: number }) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT INTO work_sessions (taskId, startTime, endTime, duration) VALUES (?, ?, ?, ?)', [session.taskId, session.startTime, session.endTime, session.duration]);
  saveDB();
  console.log('[DB] Work session logged and DB saved.');
};


// --- Analytics Functions ---
export const getRecentWorkSessions = (userId: number, days: number = 30) => {
  if (!db) return [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const stmt = db.prepare(`
    SELECT startTime, duration
    FROM work_sessions ws
    JOIN tasks t ON ws.taskId = t.id
    WHERE t.userId = :userId AND ws.startTime >= :cutoffDate
  `);
  stmt.bind({ ':userId': userId, ':cutoffDate': cutoffDate.toISOString() });
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

export const getLast14DaysProductivity = (userId: number) => {
  if (!db) return [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);

  // Using the same "Day starts at 4 AM" logic for consistency
  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(ws.startTime, 'localtime', '-4 hours')) as date,
      SUM(ws.duration) as totalDuration
    FROM work_sessions ws
    JOIN tasks t ON ws.taskId = t.id
    WHERE t.userId = :userId AND ws.startTime >= :cutoffDate
    GROUP BY date
    ORDER BY date
  `);
  stmt.bind({ ':userId': userId, ':cutoffDate': cutoffDate.toISOString() });
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

// --- Daily Challenges ---
export const getDailyChallenge = (userId: number, date: string) => {
  if (!db) return null;
  const stmt = db.prepare('SELECT * FROM daily_challenges WHERE userId = :userId AND date = :date');
  stmt.bind({ ':userId': userId, ':date': date });
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
};

export const createDailyChallenge = (challenge: any) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT INTO daily_challenges (userId, date, type, target, progress, description, xpReward, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [challenge.userId, challenge.date, challenge.type, challenge.target, challenge.progress || 0, challenge.description, challenge.xpReward, 'ACTIVE']);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDB();
  return { ...challenge, id, status: 'ACTIVE', progress: 0 };
};

export const updateDailyChallengeProgress = (id: number, progress: number, status: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE daily_challenges SET progress = ?, status = ? WHERE id = ?', [progress, status, id]);
  saveDB();
};

export const getContributionData = (userId: number) => {
  if (!db) return [];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Use 'localtime' and '-4 hours' to align with "Productivity Day" (starts at 4 AM)
  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(ws.startTime, 'localtime', '-4 hours')) as date,
      SUM(ws.duration) as totalDuration
    FROM work_sessions ws
    JOIN tasks t ON ws.taskId = t.id
    WHERE t.userId = :userId AND ws.startTime >= :oneYearAgo
    GROUP BY date
    ORDER BY date
  `);
  stmt.bind({ ':userId': userId, ':oneYearAgo': oneYearAgo.toISOString() });
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();

  return results;
};

export const getDailyProductivity = (userId: number) => {
  if (!db) return [];

  // Use 'localtime' and '-4 hours' to align with "Productivity Day" (starts at 4 AM)
  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(ws.startTime, 'localtime', '-4 hours')) as date,
      SUM(ws.duration) as totalDuration
    FROM work_sessions ws
    JOIN tasks t ON ws.taskId = t.id
    WHERE t.userId = :userId
    GROUP BY date
    ORDER BY date
  `);
  stmt.bind({ ':userId': userId });
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();

  return results;
};

export const getHourlyProductivity = () => {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT
      CAST(strftime('%H', datetime(startTime, 'localtime')) AS INTEGER) as hour,
      SUM(duration) as totalDuration
    FROM work_sessions
    WHERE startTime IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();

  return results;
};

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

export const deleteTask = (taskId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  saveDB();
  return taskId;
};

export const getTagByName = (name: string) => {
  if (!db) return null;
  const stmt = db.prepare('SELECT id FROM tags WHERE name = ?');
  const result = stmt.get([name]);
  stmt.free();
  return result;
};

export const getAllTags = () => {
  if (!db) return [];
  const stmt = db.prepare('SELECT name FROM tags ORDER BY name ASC');
  const tags: string[] = [];
  while (stmt.step()) {
    tags.push(stmt.get()[0] as string);
  }
  stmt.free();
  return tags;
};

// ... (rest of the file)


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
    console.log('[DB] Tasks order updated and DB saved.');
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
  
  // Set task tags if they exist
  if (task.tags && Array.isArray(task.tags) && task.tags.length > 0) {
    setTaskTags(id, task.tags);
  }

  saveDB();
  console.log('[DB] Task created and DB saved.');
  return { ...task, id, userId, displayOrder: newOrder };
};

export const updateTask = (task: any) => {
  if (!db) throw new Error('DB not initialized');
  
  const oldStatusStmt = db.prepare('SELECT status FROM tasks WHERE id = ?');
  const oldStatusResult = oldStatusStmt.get([task.id]);
  oldStatusStmt.free();
  const oldStatus = oldStatusResult ? oldStatusResult[0] : null;

  if (task.tags && Array.isArray(task.tags)) {
    setTaskTags(task.id, task.tags);
  }
  db.run(`UPDATE tasks SET title = ?, description = ?, status = ?, updateStatusDate = ?, estimate = ?, priority = ?, link = ?, spendTime = ?, startTimer = ?, sprintId = ?, type = ? WHERE id = ?`, [task.title, task.description, task.status, task.updateStatusDate, task.estimate, task.priority, task.link, task.spendTime, task.startTimer, task.sprintId, task.type || 'TASK', task.id]);

  if (oldStatus !== 'COMPLETED' && task.status === 'COMPLETED') {
    const tagIdsStmt = db.prepare('SELECT tagId FROM task_tags WHERE taskId = ?');
    const tagIds = tagIdsStmt.all([task.id]).map((row: any) => row.tagId);
    tagIdsStmt.free();

    tagIds.forEach(tagId => {
      updateTagAnalytics(tagId, task.spendTime);
    });
  }

  saveDB();
  console.log('[DB] Task updated and DB saved.');
  return task;
};

export const getOrCreateTag = (name: string): number => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name]);
  const stmt = db.prepare('SELECT id FROM tags WHERE name = ?');
  const tag = stmt.getAsObject([name]);
  stmt.free();
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
  console.log('[DB] Task tags updated and DB saved.');
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
  console.log('[DB] Profile updated and DB saved.');
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
  console.log('[DB] Achievement granted and DB saved.');
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
  console.log('[DB] Sprint created and DB saved.');
  return { ...sprint, id, status: 'UPCOMING' };
};

export const updateSprintStatus = (sprintId: number, status: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE sprints SET status = ? WHERE id = ?', [status, sprintId]);
  saveDB();
  console.log('[DB] Sprint status updated and DB saved.');
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
  console.log('[DB] Note created and DB saved.');
  return { ...note, id, userId };
};

export const updateNote = (note: any) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE notes SET title = ?, content = ? WHERE id = ?', [note.title, note.content, note.id]);
  saveDB();
  console.log('[DB] Note updated and DB saved.');
  return note;
};

export const deleteNote = (noteId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run('DELETE FROM notes WHERE id = ?', [noteId]);
  saveDB();
  console.log('[DB] Note deleted and DB saved.');
  return noteId;
};

export const registerUser = (username: string, password: string) => {
  if (!db) throw new Error('DB not initialized');
  try {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashPassword(password)]);
    saveDB();
    console.log('[DB] User registered and DB saved.');
    return true;
  } catch (e) {
    console.error('[DB] Error registering user:', e);
    return false;
  }
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
    console.log('[DB] Database closed.');
  }
};
