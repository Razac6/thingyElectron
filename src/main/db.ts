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

  // Enable Foreign Keys
  db.run('PRAGMA foreign_keys = ON;');

  // Cleanup orphaned logs (Fix for phantom streaks)
  try {
      db.run('DELETE FROM habit_logs WHERE habitId NOT IN (SELECT id FROM habits)');
  } catch (e) {
      console.error('[DB] Failed to cleanup orphaned logs:', e);
  }

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
  db.run(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY, timestamp TEXT, event_type TEXT, message TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS task_checklist_items (id INTEGER PRIMARY KEY, taskId INTEGER, text TEXT, isCompleted INTEGER DEFAULT 0, FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS daily_energy_logs (date TEXT PRIMARY KEY, mode TEXT, sleepScore INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY, userId INTEGER, title TEXT NOT NULL, description TEXT, frequency TEXT NOT NULL, category TEXT, targetStreak INTEGER DEFAULT 0, reminderTime TEXT, createdAt TEXT, isFavorite INTEGER DEFAULT 0, FOREIGN KEY(userId) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS habit_logs (id INTEGER PRIMARY KEY, habitId INTEGER, date TEXT NOT NULL, value INTEGER DEFAULT 1, notes TEXT, FOREIGN KEY(habitId) REFERENCES habits(id) ON DELETE CASCADE)`);


  try {
    const columns = db.exec("PRAGMA table_info(tasks);")[0].values;
    if (!columns.some(row => row[1] === 'displayOrder')) {
      db.run('ALTER TABLE tasks ADD COLUMN displayOrder INTEGER');
      db.run('UPDATE tasks SET displayOrder = id WHERE displayOrder IS NULL');
    }
    if (!columns.some(row => row[1] === 'type')) {
      db.run("ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'TASK'");
    }
    
    // Habit migration
    const habitCols = db.exec("PRAGMA table_info(habits);")[0].values;
    if (!habitCols.some(row => row[1] === 'isFavorite')) {
        db.run('ALTER TABLE habits ADD COLUMN isFavorite INTEGER DEFAULT 0');
    }

    // Bio logs migration
    const bioCols = db.exec("PRAGMA table_info(daily_energy_logs);")[0].values;
    if (!bioCols.some(row => row[1] === 'sleepScore')) {
        db.run('ALTER TABLE daily_energy_logs ADD COLUMN sleepScore INTEGER');
    }
    if (!bioCols.some(row => row[1] === 'meetingTime')) {
        db.run('ALTER TABLE daily_energy_logs ADD COLUMN meetingTime INTEGER DEFAULT 0');
    }
  } catch (e) { /* ignore */ }

  // Seed Default Settings
  const defaultSettings = [
      { key: 'complexityThreshold', value: '8' },
      { key: 'enableRewardAnimations', value: 'true' },
      { key: 'enableFatigueWarnings', value: 'true' },
  ];
  const settingStmt = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(s => settingStmt.run([s.key, s.value]));
  settingStmt.free();


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

// --- System Logging ---
export const logSystemEvent = (message: string, type: string = 'INFO') => {
  if (!db) return;
  const timestamp = new Date().toISOString();
  db.run('INSERT INTO system_logs (timestamp, event_type, message) VALUES (?, ?, ?)', [timestamp, type, message]);
  saveDB(); // Persist logs immediately
};

export const getSystemLogs = (limit: number = 50) => {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM system_logs ORDER BY id DESC LIMIT ?');
  const logs: any[] = [];
  stmt.bind([limit]);
  while (stmt.step()) {
    logs.push(stmt.getAsObject());
  }
  stmt.free();
  return logs;
};

export const getNeuralConfidence = () => {
  if (!db) return 0;
  
  try {
      // 1. Task Volume (Max 50 pts)
      const taskCountStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'Completed' COLLATE NOCASE");
      const taskRow = taskCountStmt.getAsObject();
      const taskCount = Number(taskRow.count) || 0;
      taskCountStmt.free();
      const taskScore = Math.min(50, taskCount);

      // 2. Tag Maturity (Max 30 pts)
      const tagStmt = db.prepare("SELECT COUNT(*) as count FROM tag_analytics WHERE completed_count >= 3");
      const tagRow = tagStmt.getAsObject();
      const matureTags = Number(tagRow.count) || 0;
      tagStmt.free();
      const tagScore = Math.min(30, matureTags * 5);

      // 3. Sprint History (Max 20 pts)
      const sprintStmt = db.prepare("SELECT COUNT(*) as count FROM sprints WHERE status = 'COMPLETED' COLLATE NOCASE");
      const sprintRow = sprintStmt.getAsObject();
      const sprintCount = Number(sprintRow.count) || 0;
      sprintStmt.free();
      const sprintScore = Math.min(20, sprintCount * 5);
      
      const total = Math.round(taskScore + tagScore + sprintScore);
      return total;
  } catch (error) {
      console.error('[DB] Error calculating neural confidence:', error);
      return 0;
  }
};

export const getAiMaturity = () => {
  if (!db) return 0;
  const trainingCount = Number(getSetting('neural_training_count') || 0);
  const dataCount = Number(getSetting('neural_data_count') || 0);
  
  // Score: Training (max 50) + Data Volume (max 50)
  const trainingScore = Math.min(50, trainingCount * 2); // 25 trainings to max
  const dataScore = Math.min(50, dataCount); // 50 tasks to max
  
  return Math.round(trainingScore + dataScore);
};

export const getAiStats = () => {
  if (!db) return { maturity: 0, confidence: 0, trainingCount: 0, dataCount: 0 };
  
  const maturity = getAiMaturity();
  const confidence = getNeuralConfidence();
  const trainingCount = Number(getSetting('neural_training_count') || 0);
  const dataCount = Number(getSetting('neural_data_count') || 0);

  return {
    maturity,
    confidence,
    trainingCount,
    dataCount
  };
};

// --- Analytics Engine ---
export const getTagAnalytics = (tagId: number) => {
  if (!db) return null;
  const stmt = db.prepare('SELECT * FROM tag_analytics WHERE tag_id = ?');
  const result = stmt.getAsObject([tagId]); // Use getAsObject to return { column: value }
  stmt.free();
  // Check if result is empty (all props null/undefined if not found usually, or empty object)
  // sql.js getAsObject returns object with keys but values might be null if no row? 
  // Actually getAsObject returns empty object if no result? No, it usually returns object with columns if bind works.
  // Safer to check if tag_id is present in result.
  if (result && result.tag_id) {
      return result;
  }
  return { tag_id: tagId, ema: 0, std_dev: 0, variance: 0, completed_count: 0 };
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
  const safeDuration = Number(duration) || 0; // Ensure duration is a number
  const currentAnalytics: any = getTagAnalytics(tagId);
  
  // Fetch tag name for logging
  const tagStmt = db.prepare('SELECT name FROM tags WHERE id = ?');
  const tagResult = tagStmt.get([tagId]);
  tagStmt.free();
  const tagName = tagResult ? tagResult[0] : 'Unknown';

  logSystemEvent(`[DEBUG] Tag Update: ID=${tagId} (${tagName}), Count=${currentAnalytics.completed_count}, EMA=${currentAnalytics.ema}`, 'DEBUG');

  const currentCount = Number(currentAnalytics.completed_count) || 0;
  const currentEma = Number(currentAnalytics.ema) || 0;
  const currentVariance = Number(currentAnalytics.variance) || 0;

  const n = currentCount + 1;
  const alpha = 2 / (n + 1); // Smoothing factor

  const newEma = (safeDuration * alpha) + (currentEma * (1 - alpha));

  // Welford's online algorithm for variance
  const oldMean = currentEma;
  const oldVariance = currentVariance;
  const newMean = oldMean + (safeDuration - oldMean) / n;
  const newVariance = ((n - 1) * oldVariance + (safeDuration - oldMean) * (safeDuration - newMean)) / n;
  const newStdDev = Math.sqrt(newVariance);

  db.run(
    'INSERT OR REPLACE INTO tag_analytics (tag_id, ema, std_dev, variance, completed_count) VALUES (?, ?, ?, ?, ?)',
    [tagId, newEma, newStdDev, newVariance, n]
  );
  
  // Log the learning event
  const hours = (newEma / (1000 * 60 * 60)).toFixed(2);
  logSystemEvent(`Analyzed #${tagName}: Updated EMA to ${hours}h (Samples: ${n})`, 'LEARNING');
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
  let stmt = db.prepare('SELECT * FROM daily_challenges WHERE userId = :userId AND date = :date');
  stmt.bind({ ':userId': userId, ':date': date });
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();

  // Fallback: Try to find ANY challenge for today (Single User / Dev Mode fix)
  // This handles cases where frontend sends ID=1 but DB has UUID
  const fallbackStmt = db.prepare('SELECT * FROM daily_challenges WHERE date = :date LIMIT 1');
  fallbackStmt.bind({ ':date': date });
  if (fallbackStmt.step()) {
      const result = fallbackStmt.getAsObject();
      fallbackStmt.free();
      return result;
  }
  fallbackStmt.free();

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

export const getContributionData = (userId: number, days: number = 365) => {
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Use 'localtime' and '-4 hours' to align with "Productivity Day" (starts at 4 AM)
  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(ws.startTime, 'localtime', '-4 hours')) as date,
      SUM(ws.duration) as totalDuration
    FROM work_sessions ws
    JOIN tasks t ON ws.taskId = t.id
    WHERE t.userId = :userId AND ws.startTime >= :startDate
    GROUP BY date
    ORDER BY date
  `);
  stmt.bind({ ':userId': userId, ':startDate': startDate.toISOString() });
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

export const getTasks = (userId: number, includeMeetings: boolean = false) => {
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
  const minOrderResult = db.exec('SELECT MIN(displayOrder) FROM tasks');
  const minOrder = minOrderResult[0]?.values[0][0] as number | null;
  const newOrder = (minOrder === null) ? 0 : minOrder - 1;

  const newTask = {
      title: task.title,
      description: task.description,
      status: task.status,
      updateStatusDate: new Date().toISOString(),
      estimate: task.estimate,
      priority: task.priority,
      link: task.link,
      createdAt: new Date().toISOString(),
      spendTime: task.spendTime || 0,
      startTimer: task.startTimer,
      type: task.type || 'TASK',
      userId: userId,
      sprintId: task.sprintId || null,
      displayOrder: newOrder
  };

  const stmt = db.prepare(`INSERT INTO tasks (title, description, status, updateStatusDate, estimate, priority, link, createdAt, spendTime, startTimer, type, userId, sprintId, displayOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run([newTask.title, newTask.description, newTask.status, newTask.updateStatusDate, newTask.estimate, newTask.priority, newTask.link, newTask.createdAt, newTask.spendTime, newTask.startTimer, newTask.type, newTask.userId, newTask.sprintId, newTask.displayOrder]);
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

  let updateDate = task.updateStatusDate;
  if (oldStatus !== task.status) {
      updateDate = new Date().toISOString();
  }

  if (task.tags && Array.isArray(task.tags)) {
    setTaskTags(task.id, task.tags);
  }
  db.run(`UPDATE tasks SET title = ?, description = ?, status = ?, updateStatusDate = ?, estimate = ?, priority = ?, link = ?, spendTime = ?, startTimer = ?, sprintId = ?, type = ? WHERE id = ?`, [task.title, task.description, task.status, updateDate, task.estimate, task.priority, task.link, task.spendTime, task.startTimer, task.sprintId, task.type || 'TASK', task.id]);

  if (oldStatus !== 'Completed' && task.status === 'Completed') {
    const tagIdsStmt = db.prepare('SELECT tagId FROM task_tags WHERE taskId = ?');
    tagIdsStmt.bind([task.id]);
    const tagIds: number[] = [];
    while (tagIdsStmt.step()) {
        const row = tagIdsStmt.getAsObject();
        tagIds.push(row.tagId as number);
    }
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
  logSystemEvent(`Achievement Unlocked: ${achievementId}`, 'GAMIFICATION');
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

export const updateSprint = (sprint: any) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE sprints SET name = ?, startDate = ?, endDate = ?, status = ? WHERE id = ?', 
    [sprint.name, sprint.startDate, sprint.endDate, sprint.status, sprint.id]);
  saveDB();
  console.log('[DB] Sprint updated and DB saved.');
  return sprint;
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

// --- Checklist Helpers ---
export const getChecklistItems = (taskId: number) => {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM task_checklist_items WHERE taskId = ? ORDER BY id ASC');
  stmt.bind([taskId]);
  const items: any[] = [];
  while (stmt.step()) {
    items.push(stmt.getAsObject());
  }
  stmt.free();
  return items;
};

export const addChecklistItem = (taskId: number, text: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT INTO task_checklist_items (taskId, text, isCompleted) VALUES (?, ?, 0)', [taskId, text]);
  saveDB();
  return getChecklistItems(taskId);
};

export const toggleChecklistItem = (itemId: number, isCompleted: boolean) => {
  if (!db) throw new Error('DB not initialized');
  db.run('UPDATE task_checklist_items SET isCompleted = ? WHERE id = ?', [isCompleted ? 1 : 0, itemId]);
  saveDB();
  // Get taskId to return fresh list
  const idStmt = db.prepare('SELECT taskId FROM task_checklist_items WHERE id = ?');
  const result = idStmt.get([itemId]);
  idStmt.free();
  if (result) {
      return getChecklistItems(result[0] as number);
  }
  return [];
};

export const deleteChecklistItem = (itemId: number) => {
  if (!db) throw new Error('DB not initialized');
  
  // Get taskId first to return list later
  const idStmt = db.prepare('SELECT taskId FROM task_checklist_items WHERE id = ?');
  const result = idStmt.get([itemId]);
  idStmt.free();
  const taskId = result ? (result[0] as number) : null;

  db.run('DELETE FROM task_checklist_items WHERE id = ?', [itemId]);
  saveDB();
  
  if (taskId) return getChecklistItems(taskId);
  return [];
};

// --- Settings Helpers ---
export const getAllSettings = () => {
  if (!db) return {};
  const stmt = db.prepare('SELECT * FROM app_settings');
  const settings: any = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    settings[row.key as string] = row.value;
  }
  stmt.free();
  return settings;
};

export const getSetting = (key: string) => {
  if (!db) return null;
  const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const result = stmt.getAsObject([key]);
  stmt.free();
  return result.value || null;
};

export const setSetting = (key: string, value: string) => {
  if (!db) throw new Error('DB not initialized');
  db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
  saveDB();
  return getAllSettings();
};

// --- Daily Bio Helpers ---
export const getDailyBio = (date: string) => {
  if (!db) return { mode: 'normal', sleepScore: null, meetingTime: 30 }; // Default 30 min
  const stmt = db.prepare('SELECT * FROM daily_energy_logs WHERE date = ?');
  const result = stmt.getAsObject([date]);
  stmt.free();
  if (!result || !result.date) return { mode: 'normal', sleepScore: null, meetingTime: 30 }; // Default 30 min
  return { mode: result.mode || 'normal', sleepScore: result.sleepScore, meetingTime: result.meetingTime !== null ? result.meetingTime : 30 };
};

export const updateDailyBio = (date: string, data: { mode?: string, sleepScore?: number, meetingTime?: number }) => {
  if (!db) throw new Error('DB not initialized');
  
  const current = getDailyBio(date);
  const newMode = data.mode !== undefined ? data.mode : current.mode;
  const newSleep = data.sleepScore !== undefined ? data.sleepScore : current.sleepScore;
  const newMeetingTime = data.meetingTime !== undefined ? data.meetingTime : current.meetingTime;

  db.run('INSERT OR REPLACE INTO daily_energy_logs (date, mode, sleepScore, meetingTime) VALUES (?, ?, ?, ?)', [date, newMode, newSleep, newMeetingTime]);
  saveDB();
  return { mode: newMode, sleepScore: newSleep, meetingTime: newMeetingTime };
};

// --- Habit Tracker Helpers ---
export const getHabits = (userId: number) => {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM habits WHERE userId = ? ORDER BY createdAt DESC');
  stmt.bind([userId]);
  const habits: any[] = [];
  while (stmt.step()) {
    const habit = stmt.getAsObject();
    try {
      habit.frequency = JSON.parse(habit.frequency as string);
    } catch (e) {
      habit.frequency = { type: 'daily', days: [] };
    }
    habits.push(habit);
  }
  stmt.free();
  return habits;
};

export const createHabit = (habit: any, userId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run(
    'INSERT INTO habits (userId, title, description, frequency, category, targetStreak, reminderTime, createdAt, isFavorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, habit.title, habit.description, JSON.stringify(habit.frequency), habit.category, habit.targetStreak, habit.reminderTime, new Date().toISOString(), habit.isFavorite || 0]
  );
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDB();
  logSystemEvent(`New Habit Created: ${habit.title}`, 'HABIT');
  return { ...habit, id, userId };
};

export const updateHabit = (habit: any) => {
  if (!db) throw new Error('DB not initialized');
  db.run(
    'UPDATE habits SET title = ?, description = ?, frequency = ?, category = ?, targetStreak = ?, reminderTime = ?, isFavorite = ? WHERE id = ?',
    [habit.title, habit.description, JSON.stringify(habit.frequency), habit.category, habit.targetStreak, habit.reminderTime, habit.isFavorite, habit.id]
  );
  saveDB();
  return habit;
};

export const toggleHabitFavorite = (habitId: number, userId: number) => {
    if (!db) throw new Error('DB not initialized');
    // Unset all favorites for this user first
    db.run('UPDATE habits SET isFavorite = 0 WHERE userId = ?', [userId]);
    // Set this one
    db.run('UPDATE habits SET isFavorite = 1 WHERE id = ?', [habitId]);
    saveDB();
    return true;
};

export const deleteHabit = (habitId: number) => {
  if (!db) throw new Error('DB not initialized');
  db.run('DELETE FROM habits WHERE id = ?', [habitId]);
  saveDB();
  return habitId;
};

export const logHabit = (habitId: number, date: string, value: number = 1) => {
  if (!db) throw new Error('DB not initialized');
  // Check if already logged for this date
  const existingStmt = db.prepare('SELECT id FROM habit_logs WHERE habitId = ? AND date = ?');
  existingStmt.bind([habitId, date]);
  
  if (existingStmt.step()) {
    // Update existing
    db.run('UPDATE habit_logs SET value = ? WHERE habitId = ? AND date = ?', [value, habitId, date]);
  } else {
    // Insert new
    db.run('INSERT INTO habit_logs (habitId, date, value) VALUES (?, ?, ?)', [habitId, date, value]);
  }
  existingStmt.free();
  saveDB();
  
  // Calculate Streak
  // (Simple implementation: count consecutive days backwards from today or provided date)
  // For now, we'll just return the log. Advanced streak calculation can be done on read.
  return { habitId, date, value };
};

export const getHabitLogs = (userId: number, fromDate?: string) => {
  if (!db) return [];
  // Get all logs for user's habits
  let query = `
    SELECT hl.* 
    FROM habit_logs hl
    JOIN habits h ON hl.habitId = h.id
    WHERE h.userId = :userId
  `;
  if (fromDate) {
    query += ` AND hl.date >= :fromDate`;
  }
  
  const stmt = db.prepare(query);
  const params: any = { ':userId': userId };
  if (fromDate) params[':fromDate'] = fromDate;
  
  stmt.bind(params);
  const logs: any[] = [];
  while (stmt.step()) {
    logs.push(stmt.getAsObject());
  }
  stmt.free();
  return logs;
};

export const getTopHabit = (userId: number) => {
  if (!db) return null;
  
  // 1. Try to get favorite habit first
  const favStmt = db.prepare('SELECT * FROM habits WHERE userId = ? AND isFavorite = 1 LIMIT 1');
  let result = favStmt.getAsObject([userId]);
  favStmt.free();

  if (result && result.id) {
      try { result.frequency = JSON.parse(result.frequency as string); } catch(e) {}
      return result;
  }

  // 2. Fallback to most consistent
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().split('T')[0];

  const stmt = db.prepare(`
    SELECT h.*, COUNT(hl.id) as recent_count
    FROM habits h
    LEFT JOIN habit_logs hl ON h.id = hl.habitId AND hl.date >= ?
    WHERE h.userId = ?
    GROUP BY h.id
    ORDER BY recent_count DESC
    LIMIT 1
  `);
  
  result = stmt.getAsObject([dateStr, userId]);
  stmt.free();
  
  if (!result || !result.id) return null;
  try { result.frequency = JSON.parse(result.frequency as string); } catch(e) {}
  return result;
};

export const closeDB = () => {
  if (db) {
    saveDB();
    db.close();
    console.log('[DB] Database closed.');
  }
};
