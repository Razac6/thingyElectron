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
      return;
    }
    const data = await window.electron.database.getTasks(userId);
    return data;
  } catch (error) {
    console.error(error);
    navigate(-1);
  }
};

const createTask = async (task: any) => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) throw new Error('User not logged in');
    return await window.electron.database.createTask(task, userId);
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

const updateTask = async (task: any) => {
  try {
    return await window.electron.database.updateTask(task);
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

const deleteTask = async (taskId: number) => {
  try {
    return await window.electron.database.deleteTask(taskId);
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

const fetchNotes = async () => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) return [];
    return await window.electron.database.getNotes(userId);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

const createNote = async (note: any) => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) throw new Error('User not logged in');
    return await window.electron.database.createNote(note, userId);
  } catch (error) {
    console.error('Error creating note:', error);
    throw error;
  }
};

const updateNote = async (note: any) => {
  try {
    return await window.electron.database.updateNote(note);
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};

const deleteNote = async (noteId: number) => {
  try {
    return await window.electron.database.deleteNote(noteId);
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

const register = async (username: string, password: string) => {
  try {
    return await window.electron.database.register({ username, password });
  } catch (error) {
    console.error('Error registering:', error);
    throw error;
  }
};

const globalSearch = async (query: string) => {
  try {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : null;
    if (!userId) return [];
    return await window.electron.database.globalSearch(userId, query);
  } catch (error) {
    console.error('Error during global search:', error);
    return [];
  }
};

const logWorkSession = async (session: { taskId: number, startTime: string, endTime: string, duration: number }) => {
  try {
    return await window.electron.database.logWorkSession(session);
  } catch (error) {
    console.error('Error logging work session:', error);
    throw error;
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
};
