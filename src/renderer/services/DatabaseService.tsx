const getToken = async (username: string, password: string) => {
  try {
    const responseData = await window.electron.database.login({
      username,
      password,
    });
    localStorage.setItem(
      'access_token',
      JSON.stringify(responseData.access_token),
    );
    localStorage.setItem('userId', JSON.stringify(responseData.userId));
    return responseData;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const checkAuth = async () => {
  const tokenStr = localStorage.getItem('access_token');
  const userStr = localStorage.getItem('userId');
  const accessToken = tokenStr ? JSON.parse(tokenStr) : null;
  const userId = userStr ? JSON.parse(userStr) : null;
  return !(!accessToken || !userId);
};

const fetchData = async (navigate: any) => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) {
      navigate(-1);
      return [];
    }
    const data = await window.electron.database.getTasks(userId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Failed to fetch tasks:', error);
    navigate(-1);
    return [];
  }
};

const createTask = async (task: any): Promise<Task> => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) throw new Error('User not logged in');
    const created: Task = await window.electron.database.createTask(task, userId);
    return created;
  } catch (error) {
    console.error('[DatabaseService] Error creating task:', error);
    throw error;
  }
};

const updateTask = async (task: any) => {
  try {
    const updated = await window.electron.database.updateTask(task);
    return updated;
  } catch (error) {
    console.error('[DatabaseService] Error updating task:', error);
    throw error;
  }
};

const deleteTask = async (taskId: number) => {
  try {
    const deleted = await window.electron.database.deleteTask(taskId);
    return deleted;
  } catch (error) {
    console.error('[DatabaseService] Error deleting task:', error);
    throw error;
  }
};

const fetchNotes = async () => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) {
      return [];
    }
    const data = await window.electron.database.getNotes(userId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching notes:', error);
    return [];
  }
};

const createNote = async (note: any) => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) throw new Error('User not logged in');
    const created = await window.electron.database.createNote(note, userId);
    return created;
  } catch (error) {
    console.error('[DatabaseService] Error creating note:', error);
    throw error;
  }
};

const updateNote = async (note: any) => {
  try {
    const updated = await window.electron.database.updateNote(note);
    return updated;
  } catch (error) {
    console.error('[DatabaseService] Error updating note:', error);
    throw error;
  }
};

const deleteNote = async (noteId: number) => {
  try {
    const deleted = await window.electron.database.deleteNote(noteId);
    return deleted;
  } catch (error) {
    console.error('[DatabaseService] Error deleting note:', error);
    throw error;
  }
};

const register = async (username: string, password: string) => {
  try {
    const registered = await window.electron.database.register({ username, password });
    return registered;
  } catch (error) {
    console.error('[DatabaseService] Error registering:', error);
    throw error;
  }
};

const globalSearch = async (query: string) => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) {
      return [];
    }
    const results = await window.electron.database.globalSearch(userId, query);
    return results;
  } catch (error) {
    console.error('[DatabaseService] Error during global search:', error);
    return [];
  }
};

const logWorkSession = async (session: { taskId: number, startTime: string, endTime: string, duration: number }) => {
  try {
    const logged = await window.electron.database.logWorkSession(session);
    return logged;
  }
  catch (error) {
    console.error('[DatabaseService] Error logging work session:', error);
    throw error;
  }
};

const getDailyProductivity = async () => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) {
      return [];
    }
    const data = await window.electron.database.getDailyProductivity(userId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching daily productivity:', error);
    return [];
  }
};

const getContributionData = async () => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) {
      return [];
    }
    const data = await window.electron.database.getContributionData(userId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching contribution data:', error);
    return [];
  }
};

const getHourlyProductivity = async () => {
  try {
    const data = await window.electron.database.getHourlyProductivity();
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching hourly productivity:', error);
    return [];
  }
};

const getProductivityInsights = async () => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) return null;
    const data = await window.electron.database.getProductivityInsights(userId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching productivity insights:', error);
    return null;
  }
};

const getDailyChallenge = async () => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) return null;
    const data = await window.electron.database.getDailyChallenge(userId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching daily challenge:', error);
    return null;
  }
};

const getTagAnalytics = async (tagId: number) => {
  try {
    const data = await window.electron.database.getTagAnalytics(tagId);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching tag analytics:', error);
    return null;
  }
};

const getTagByName = async (name: string) => {
  try {
    const data = await window.electron.database.getTagByName(name);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching tag by name:', error);
    return null;
  }
};

const getAllTags = async () => {
  try {
    const data = await window.electron.database.getAllTags();
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching all tags:', error);
    return [];
  }
};

const getSystemLogs = async (limit?: number) => {
  try {
    const data = await window.electron.database.getSystemLogs(limit);
    return data;
  } catch (error) {
    console.error('[DatabaseService] Error fetching system logs:', error);
    return [];
  }
};

const getNeuralConfidence = async () => {
  try {
    const score = await window.electron.database.getNeuralConfidence();
    return score;
  } catch (error) {
    console.error('[DatabaseService] Error fetching neural confidence:', error);
    return 0;
  }
};

export {
  getToken,
  checkAuth,
  fetchData,
  createTask,
  updateTask,
  deleteTask,
  register,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  globalSearch,
  logWorkSession,
  getDailyProductivity,
  getContributionData,
  getHourlyProductivity,
  getProductivityInsights,
  getDailyChallenge,
  getTagAnalytics,
  getTagByName,
  getAllTags,
  getSystemLogs,
  getNeuralConfidence,
};
