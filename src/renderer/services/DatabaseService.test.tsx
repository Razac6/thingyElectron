import { Task } from '../../interfaces/task.interface';
import { TaskTypeEnum } from '../../enums/task-type.enum';
import { StatusEnum } from '../../enums/status.enum';
import { PriorityEnum } from '../../enums/priority.enum';

// Now import the service after mocking
import {
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
  getTagAnalyticsWithNames,
  getTagByName,
  getAllTags,
  getSystemLogs,
  getNeuralConfidence,
  getAiMaturity,
  getAiStats,
  getChecklistItems,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  getAllSettings,
  setSetting,
  getDailyBio,
  updateDailyBio,
  predictDuration,
  forceNeuralTraining,
  startNewExpedition,
} from './DatabaseService';

// Mock window.electron BEFORE importing the service
const mockElectron = {
  database: {
    login: jest.fn(),
    getTasks: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    register: jest.fn(),
    getNotes: jest.fn(),
    createNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
    globalSearch: jest.fn(),
    logWorkSession: jest.fn(),
    getDailyProductivity: jest.fn(),
    getContributionData: jest.fn(),
    getHourlyProductivity: jest.fn(),
    getProductivityInsights: jest.fn(),
    getDailyChallenge: jest.fn(),
    getTagAnalytics: jest.fn(),
    getTagAnalyticsWithNames: jest.fn(),
    getTagByName: jest.fn(),
    getAllTags: jest.fn(),
    getSystemLogs: jest.fn(),
    getNeuralConfidence: jest.fn(),
    getAiMaturity: jest.fn(),
    getAiStats: jest.fn(),
    getChecklistItems: jest.fn(),
    addChecklistItem: jest.fn(),
    toggleChecklistItem: jest.fn(),
    deleteChecklistItem: jest.fn(),
    getAllSettings: jest.fn(),
    setSetting: jest.fn(),
    getDailyBio: jest.fn(),
    updateDailyBio: jest.fn(),
    predictDuration: jest.fn(),
    forceNeuralTraining: jest.fn(),
    startNewExpedition: jest.fn(),
  },
};

Object.defineProperty(window, 'electron', {
  writable: true,
  configurable: true,
  value: mockElectron,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication', () => {
    describe('getToken', () => {
      it('should login successfully and store tokens', async () => {
        const mockResponse = {
          access_token: 'test-token',
          userId: 123,
        };
        mockElectron.database.login.mockResolvedValue(mockResponse);

        const result = await getToken('testuser', 'testpass');

        expect(mockElectron.database.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'testpass',
        });
        expect(localStorage.getItem('access_token')).toBe(
          JSON.stringify('test-token'),
        );
        expect(localStorage.getItem('userId')).toBe(JSON.stringify(123));
        expect(result).toEqual(mockResponse);
      });

      it('should throw error on login failure', async () => {
        const error = new Error('Invalid credentials');
        mockElectron.database.login.mockRejectedValue(error);

        await expect(getToken('baduser', 'badpass')).rejects.toThrow(
          'Invalid credentials',
        );
        expect(console.error).toHaveBeenCalledWith(error);
      });
    });

    describe('checkAuth', () => {
      it('should return true when both token and userId exist', async () => {
        localStorage.setItem('access_token', JSON.stringify('test-token'));
        localStorage.setItem('userId', JSON.stringify(123));

        const result = await checkAuth();

        expect(result).toBe(true);
      });

      it('should return false when token is missing', async () => {
        localStorage.setItem('userId', JSON.stringify(123));

        const result = await checkAuth();

        expect(result).toBe(false);
      });

      it('should return false when userId is missing', async () => {
        localStorage.setItem('access_token', JSON.stringify('test-token'));

        const result = await checkAuth();

        expect(result).toBe(false);
      });

      it('should return false when both are missing', async () => {
        const result = await checkAuth();

        expect(result).toBe(false);
      });
    });

    describe('register', () => {
      it('should register user successfully', async () => {
        const mockResponse = { success: true };
        mockElectron.database.register.mockResolvedValue(mockResponse);

        const result = await register('newuser', 'newpass');

        expect(mockElectron.database.register).toHaveBeenCalledWith({
          username: 'newuser',
          password: 'newpass',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should throw error on registration failure', async () => {
        const error = new Error('User already exists');
        mockElectron.database.register.mockRejectedValue(error);

        await expect(register('existinguser', 'pass')).rejects.toThrow(
          'User already exists',
        );
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Task Operations', () => {
    const mockTask: Task = {
      id: 1,
      title: 'Test Task',
      description: 'Test Description',
      status: StatusEnum.TO_DO,
      updateStatusDate: '2024-01-01',
      estimate: 2,
      priority: PriorityEnum.HIGH,
      link: '',
      createdAt: '2024-01-01',
      spendTime: 0,
      startTimer: null,
      type: TaskTypeEnum.TASK,
    };

    describe('fetchData', () => {
      it('should fetch tasks successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockTasks = [mockTask];
        mockElectron.database.getTasks.mockResolvedValue(mockTasks);

        const result = await fetchData(jest.fn());

        expect(mockElectron.database.getTasks).toHaveBeenCalledWith(123);
        expect(result).toEqual(mockTasks);
      });

      it('should return empty array and navigate back when userId is missing', async () => {
        const mockNavigate = jest.fn();

        const result = await fetchData(mockNavigate);

        expect(mockNavigate).toHaveBeenCalledWith(-1);
        expect(result).toEqual([]);
      });

      it('should return empty array and navigate back on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.getTasks.mockRejectedValue(new Error('DB Error'));
        const mockNavigate = jest.fn();

        const result = await fetchData(mockNavigate);

        expect(mockNavigate).toHaveBeenCalledWith(-1);
        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('createTask', () => {
      it('should create task successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.createTask.mockResolvedValue(mockTask);

        const result = await createTask({ title: 'New Task' });

        expect(mockElectron.database.createTask).toHaveBeenCalledWith(
          { title: 'New Task' },
          123,
        );
        expect(result).toEqual(mockTask);
      });

      it('should throw error when user is not logged in', async () => {
        await expect(createTask({ title: 'New Task' })).rejects.toThrow(
          'User not logged in',
        );
      });

      it('should throw error on creation failure', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const error = new Error('Create failed');
        mockElectron.database.createTask.mockRejectedValue(error);

        await expect(createTask({ title: 'New Task' })).rejects.toThrow(
          'Create failed',
        );
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('updateTask', () => {
      it('should update task successfully', async () => {
        const updatedTask = { ...mockTask, title: 'Updated Task' };
        mockElectron.database.updateTask.mockResolvedValue(updatedTask);

        const result = await updateTask(updatedTask);

        expect(mockElectron.database.updateTask).toHaveBeenCalledWith(
          updatedTask,
        );
        expect(result).toEqual(updatedTask);
      });

      it('should throw error on update failure', async () => {
        const error = new Error('Update failed');
        mockElectron.database.updateTask.mockRejectedValue(error);

        await expect(updateTask(mockTask)).rejects.toThrow('Update failed');
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('deleteTask', () => {
      it('should delete task successfully', async () => {
        mockElectron.database.deleteTask.mockResolvedValue({ success: true });

        const result = await deleteTask(1);

        expect(mockElectron.database.deleteTask).toHaveBeenCalledWith(1);
        expect(result).toEqual({ success: true });
      });

      it('should throw error on deletion failure', async () => {
        const error = new Error('Delete failed');
        mockElectron.database.deleteTask.mockRejectedValue(error);

        await expect(deleteTask(1)).rejects.toThrow('Delete failed');
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Note Operations', () => {
    const mockNote = {
      id: 1,
      title: 'Test Note',
      content: 'Test Content',
      createdAt: '2024-01-01',
    };

    describe('fetchNotes', () => {
      it('should fetch notes successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockNotes = [mockNote];
        mockElectron.database.getNotes.mockResolvedValue(mockNotes);

        const result = await fetchNotes();

        expect(mockElectron.database.getNotes).toHaveBeenCalledWith(123);
        expect(result).toEqual(mockNotes);
      });

      it('should return empty array when userId is missing', async () => {
        const result = await fetchNotes();

        expect(result).toEqual([]);
      });

      it('should return empty array on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.getNotes.mockRejectedValue(new Error('DB Error'));

        const result = await fetchNotes();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('createNote', () => {
      it('should create note successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.createNote.mockResolvedValue(mockNote);

        const result = await createNote({ title: 'New Note' });

        expect(mockElectron.database.createNote).toHaveBeenCalledWith(
          { title: 'New Note' },
          123,
        );
        expect(result).toEqual(mockNote);
      });

      it('should throw error when user is not logged in', async () => {
        await expect(createNote({ title: 'New Note' })).rejects.toThrow(
          'User not logged in',
        );
      });

      it('should throw error on creation failure', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const error = new Error('Create failed');
        mockElectron.database.createNote.mockRejectedValue(error);

        await expect(createNote({ title: 'New Note' })).rejects.toThrow(
          'Create failed',
        );
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('updateNote', () => {
      it('should update note successfully', async () => {
        const updatedNote = { ...mockNote, title: 'Updated Note' };
        mockElectron.database.updateNote.mockResolvedValue(updatedNote);

        const result = await updateNote(updatedNote);

        expect(mockElectron.database.updateNote).toHaveBeenCalledWith(
          updatedNote,
        );
        expect(result).toEqual(updatedNote);
      });

      it('should throw error on update failure', async () => {
        const error = new Error('Update failed');
        mockElectron.database.updateNote.mockRejectedValue(error);

        await expect(updateNote(mockNote)).rejects.toThrow('Update failed');
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('deleteNote', () => {
      it('should delete note successfully', async () => {
        mockElectron.database.deleteNote.mockResolvedValue({ success: true });

        const result = await deleteNote(1);

        expect(mockElectron.database.deleteNote).toHaveBeenCalledWith(1);
        expect(result).toEqual({ success: true });
      });

      it('should throw error on deletion failure', async () => {
        const error = new Error('Delete failed');
        mockElectron.database.deleteNote.mockRejectedValue(error);

        await expect(deleteNote(1)).rejects.toThrow('Delete failed');
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Search and Analytics', () => {
    describe('globalSearch', () => {
      it('should perform global search successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockResults = [{ id: 1, type: 'task', title: 'Search Result' }];
        mockElectron.database.globalSearch.mockResolvedValue(mockResults);

        const result = await globalSearch('test query');

        expect(mockElectron.database.globalSearch).toHaveBeenCalledWith(
          123,
          'test query',
        );
        expect(result).toEqual(mockResults);
      });

      it('should return empty array when userId is missing', async () => {
        const result = await globalSearch('test');

        expect(result).toEqual([]);
      });

      it('should return empty array on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.globalSearch.mockRejectedValue(
          new Error('Search failed'),
        );

        const result = await globalSearch('test');

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('logWorkSession', () => {
      it('should log work session successfully', async () => {
        const session = {
          taskId: 1,
          startTime: '2024-01-01T10:00:00',
          endTime: '2024-01-01T11:00:00',
          duration: 3600,
        };
        mockElectron.database.logWorkSession.mockResolvedValue({
          success: true,
        });

        const result = await logWorkSession(session);

        expect(mockElectron.database.logWorkSession).toHaveBeenCalledWith(
          session,
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw error on logging failure', async () => {
        const session = {
          taskId: 1,
          startTime: '2024-01-01T10:00:00',
          endTime: '2024-01-01T11:00:00',
          duration: 3600,
        };
        const error = new Error('Log failed');
        mockElectron.database.logWorkSession.mockRejectedValue(error);

        await expect(logWorkSession(session)).rejects.toThrow('Log failed');
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Productivity Data', () => {
    describe('getDailyProductivity', () => {
      it('should fetch daily productivity successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockData = [{ date: '2024-01-01', productivity: 85 }];
        mockElectron.database.getDailyProductivity.mockResolvedValue(mockData);

        const result = await getDailyProductivity();

        expect(mockElectron.database.getDailyProductivity).toHaveBeenCalledWith(
          123,
        );
        expect(result).toEqual(mockData);
      });

      it('should return empty array when userId is missing', async () => {
        const result = await getDailyProductivity();

        expect(result).toEqual([]);
      });

      it('should return empty array on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.getDailyProductivity.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getDailyProductivity();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getContributionData', () => {
      it('should fetch contribution data with default days', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockData = [{ date: '2024-01-01', count: 5 }];
        mockElectron.database.getContributionData.mockResolvedValue(mockData);

        const result = await getContributionData();

        expect(mockElectron.database.getContributionData).toHaveBeenCalledWith(
          123,
          365,
        );
        expect(result).toEqual(mockData);
      });

      it('should fetch contribution data with custom days', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockData = [{ date: '2024-01-01', count: 5 }];
        mockElectron.database.getContributionData.mockResolvedValue(mockData);

        const result = await getContributionData(30);

        expect(mockElectron.database.getContributionData).toHaveBeenCalledWith(
          123,
          30,
        );
        expect(result).toEqual(mockData);
      });

      it('should return empty array when userId is missing', async () => {
        const result = await getContributionData();

        expect(result).toEqual([]);
      });

      it('should return empty array on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.getContributionData.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getContributionData();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getHourlyProductivity', () => {
      it('should fetch hourly productivity successfully', async () => {
        const mockData = [{ hour: 9, productivity: 75 }];
        mockElectron.database.getHourlyProductivity.mockResolvedValue(mockData);

        const result = await getHourlyProductivity();

        expect(mockElectron.database.getHourlyProductivity).toHaveBeenCalled();
        expect(result).toEqual(mockData);
      });

      it('should return empty array on error', async () => {
        mockElectron.database.getHourlyProductivity.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getHourlyProductivity();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getProductivityInsights', () => {
      it('should fetch productivity insights successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockInsights = {
          averageProductivity: 80,
          trend: 'up',
          bestDay: 'Monday',
        };
        mockElectron.database.getProductivityInsights.mockResolvedValue(
          mockInsights,
        );

        const result = await getProductivityInsights();

        expect(
          mockElectron.database.getProductivityInsights,
        ).toHaveBeenCalledWith(123);
        expect(result).toEqual(mockInsights);
      });

      it('should use default userId of 1 when not set', async () => {
        const mockInsights = { averageProductivity: 80 };
        mockElectron.database.getProductivityInsights.mockResolvedValue(
          mockInsights,
        );

        const result = await getProductivityInsights();

        expect(
          mockElectron.database.getProductivityInsights,
        ).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockInsights);
      });

      it('should return null on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.getProductivityInsights.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getProductivityInsights();

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getDailyChallenge', () => {
      it('should fetch daily challenge successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        const mockChallenge = {
          id: 1,
          title: 'Complete 5 tasks',
          progress: 3,
          target: 5,
        };
        mockElectron.database.getDailyChallenge.mockResolvedValue(
          mockChallenge,
        );

        const result = await getDailyChallenge();

        expect(mockElectron.database.getDailyChallenge).toHaveBeenCalledWith(
          123,
        );
        expect(result).toEqual(mockChallenge);
      });

      it('should use default userId of 1 when not set', async () => {
        const mockChallenge = { id: 1, title: 'Test' };
        mockElectron.database.getDailyChallenge.mockResolvedValue(
          mockChallenge,
        );

        const result = await getDailyChallenge();

        expect(mockElectron.database.getDailyChallenge).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockChallenge);
      });

      it('should return null on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.getDailyChallenge.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getDailyChallenge();

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Tag Operations', () => {
    describe('getTagAnalytics', () => {
      it('should fetch tag analytics successfully', async () => {
        const mockAnalytics = { totalTasks: 10, completedTasks: 7 };
        mockElectron.database.getTagAnalytics.mockResolvedValue(mockAnalytics);

        const result = await getTagAnalytics(1);

        expect(mockElectron.database.getTagAnalytics).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockAnalytics);
      });

      it('should return null on error', async () => {
        mockElectron.database.getTagAnalytics.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getTagAnalytics(1);

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getTagAnalyticsWithNames', () => {
      it('should fetch tag analytics with names successfully', async () => {
        const mockAnalytics = [
          { tagName: 'urgent', totalTasks: 5 },
          { tagName: 'bug', totalTasks: 3 },
        ];
        mockElectron.database.getTagAnalyticsWithNames.mockResolvedValue(
          mockAnalytics,
        );

        const result = await getTagAnalyticsWithNames();

        expect(
          mockElectron.database.getTagAnalyticsWithNames,
        ).toHaveBeenCalled();
        expect(result).toEqual(mockAnalytics);
      });

      it('should return empty array on error', async () => {
        mockElectron.database.getTagAnalyticsWithNames.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getTagAnalyticsWithNames();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getTagByName', () => {
      it('should fetch tag by name successfully', async () => {
        const mockTag = { id: 1, name: 'urgent' };
        mockElectron.database.getTagByName.mockResolvedValue(mockTag);

        const result = await getTagByName('urgent');

        expect(mockElectron.database.getTagByName).toHaveBeenCalledWith(
          'urgent',
        );
        expect(result).toEqual(mockTag);
      });

      it('should return null on error', async () => {
        mockElectron.database.getTagByName.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getTagByName('urgent');

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getAllTags', () => {
      it('should fetch all tags successfully', async () => {
        const mockTags = ['urgent', 'bug', 'feature'];
        mockElectron.database.getAllTags.mockResolvedValue(mockTags);

        const result = await getAllTags();

        expect(mockElectron.database.getAllTags).toHaveBeenCalled();
        expect(result).toEqual(mockTags);
      });

      it('should return empty array on error', async () => {
        mockElectron.database.getAllTags.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getAllTags();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('System and AI Operations', () => {
    describe('getSystemLogs', () => {
      it('should fetch system logs with limit', async () => {
        const mockLogs = [
          { id: 1, message: 'Log 1' },
          { id: 2, message: 'Log 2' },
        ];
        mockElectron.database.getSystemLogs.mockResolvedValue(mockLogs);

        const result = await getSystemLogs(10);

        expect(mockElectron.database.getSystemLogs).toHaveBeenCalledWith(10);
        expect(result).toEqual(mockLogs);
      });

      it('should fetch system logs without limit', async () => {
        const mockLogs = [{ id: 1, message: 'Log 1' }];
        mockElectron.database.getSystemLogs.mockResolvedValue(mockLogs);

        const result = await getSystemLogs();

        expect(mockElectron.database.getSystemLogs).toHaveBeenCalledWith(
          undefined,
        );
        expect(result).toEqual(mockLogs);
      });

      it('should return empty array on error', async () => {
        mockElectron.database.getSystemLogs.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getSystemLogs();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getNeuralConfidence', () => {
      it('should fetch neural confidence successfully', async () => {
        mockElectron.database.getNeuralConfidence.mockResolvedValue(0.85);

        const result = await getNeuralConfidence();

        expect(mockElectron.database.getNeuralConfidence).toHaveBeenCalled();
        expect(result).toBe(0.85);
      });

      it('should return 0 on error', async () => {
        mockElectron.database.getNeuralConfidence.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getNeuralConfidence();

        expect(result).toBe(0);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getAiMaturity', () => {
      it('should fetch AI maturity successfully', async () => {
        mockElectron.database.getAiMaturity.mockResolvedValue(75);

        const result = await getAiMaturity();

        expect(mockElectron.database.getAiMaturity).toHaveBeenCalled();
        expect(result).toBe(75);
      });

      it('should return 0 on error', async () => {
        mockElectron.database.getAiMaturity.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getAiMaturity();

        expect(result).toBe(0);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getAiStats', () => {
      it('should fetch AI stats successfully', async () => {
        const mockStats = {
          totalPredictions: 100,
          accuracy: 0.92,
        };
        mockElectron.database.getAiStats.mockResolvedValue(mockStats);

        const result = await getAiStats();

        expect(mockElectron.database.getAiStats).toHaveBeenCalled();
        expect(result).toEqual(mockStats);
      });

      it('should return null on error', async () => {
        mockElectron.database.getAiStats.mockRejectedValue(
          new Error('Fetch failed'),
        );

        const result = await getAiStats();

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('predictDuration', () => {
      it('should predict duration successfully', async () => {
        const task = { title: 'Test Task', description: 'Description' };
        mockElectron.database.predictDuration.mockResolvedValue(120);

        const result = await predictDuration(task);

        expect(mockElectron.database.predictDuration).toHaveBeenCalledWith(
          task,
        );
        expect(result).toBe(120);
      });

      it('should return 0 on error', async () => {
        mockElectron.database.predictDuration.mockRejectedValue(
          new Error('Prediction failed'),
        );

        const result = await predictDuration({ title: 'Test' });

        expect(result).toBe(0);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('forceNeuralTraining', () => {
      it('should force neural training successfully', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.forceNeuralTraining.mockResolvedValue(undefined);

        const result = await forceNeuralTraining();

        expect(mockElectron.database.forceNeuralTraining).toHaveBeenCalledWith(
          123,
        );
        expect(result).toBe(true);
      });

      it('should use default userId of 1 when not set', async () => {
        mockElectron.database.forceNeuralTraining.mockResolvedValue(undefined);

        const result = await forceNeuralTraining();

        expect(mockElectron.database.forceNeuralTraining).toHaveBeenCalledWith(
          1,
        );
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        localStorage.setItem('userId', JSON.stringify(123));
        mockElectron.database.forceNeuralTraining.mockRejectedValue(
          new Error('Training failed'),
        );

        const result = await forceNeuralTraining();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });
    });
  });

  describe('Checklist Operations', () => {
    describe('getChecklistItems', () => {
      it('should fetch checklist items successfully', async () => {
        const mockItems = [
          { id: 1, taskId: 1, text: 'Item 1', isCompleted: false },
          { id: 2, taskId: 1, text: 'Item 2', isCompleted: true },
        ];
        mockElectron.database.getChecklistItems.mockResolvedValue(mockItems);

        const result = await getChecklistItems(1);

        expect(mockElectron.database.getChecklistItems).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockItems);
      });
    });

    describe('addChecklistItem', () => {
      it('should add checklist item successfully', async () => {
        const mockItem = {
          id: 1,
          taskId: 1,
          text: 'New Item',
          isCompleted: false,
        };
        mockElectron.database.addChecklistItem.mockResolvedValue(mockItem);

        const result = await addChecklistItem(1, 'New Item');

        expect(mockElectron.database.addChecklistItem).toHaveBeenCalledWith(
          1,
          'New Item',
        );
        expect(result).toEqual(mockItem);
      });
    });

    describe('toggleChecklistItem', () => {
      it('should toggle checklist item successfully', async () => {
        const mockItem = { id: 1, taskId: 1, text: 'Item', isCompleted: true };
        mockElectron.database.toggleChecklistItem.mockResolvedValue(mockItem);

        const result = await toggleChecklistItem(1, true);

        expect(mockElectron.database.toggleChecklistItem).toHaveBeenCalledWith(
          1,
          true,
        );
        expect(result).toEqual(mockItem);
      });
    });

    describe('deleteChecklistItem', () => {
      it('should delete checklist item successfully', async () => {
        mockElectron.database.deleteChecklistItem.mockResolvedValue({
          success: true,
        });

        const result = await deleteChecklistItem(1);

        expect(mockElectron.database.deleteChecklistItem).toHaveBeenCalledWith(
          1,
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('Settings and User Data', () => {
    describe('getAllSettings', () => {
      it('should fetch all settings successfully', async () => {
        const mockSettings = { theme: 'dark', language: 'en' };
        mockElectron.database.getAllSettings.mockResolvedValue(mockSettings);

        const result = await getAllSettings();

        expect(mockElectron.database.getAllSettings).toHaveBeenCalled();
        expect(result).toEqual(mockSettings);
      });
    });

    describe('setSetting', () => {
      it('should set setting successfully', async () => {
        mockElectron.database.setSetting.mockResolvedValue({ success: true });

        const result = await setSetting('theme', 'dark');

        expect(mockElectron.database.setSetting).toHaveBeenCalledWith(
          'theme',
          'dark',
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('getDailyBio', () => {
      it('should fetch daily bio successfully', async () => {
        const mockBio = {
          date: '2024-01-01',
          mood: 'happy',
          notes: 'Good day',
        };
        mockElectron.database.getDailyBio.mockResolvedValue(mockBio);

        const result = await getDailyBio('2024-01-01');

        expect(mockElectron.database.getDailyBio).toHaveBeenCalledWith(
          '2024-01-01',
        );
        expect(result).toEqual(mockBio);
      });
    });

    describe('updateDailyBio', () => {
      it('should update daily bio successfully', async () => {
        const bioData = { mood: 'happy', notes: 'Great day!' };
        mockElectron.database.updateDailyBio.mockResolvedValue({
          success: true,
        });

        const result = await updateDailyBio('2024-01-01', bioData);

        expect(mockElectron.database.updateDailyBio).toHaveBeenCalledWith(
          '2024-01-01',
          bioData,
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('startNewExpedition', () => {
      it('should start new expedition successfully', async () => {
        const mockExpedition = {
          id: 1,
          startDate: '2024-01-01',
          status: 'active',
        };
        mockElectron.database.startNewExpedition.mockResolvedValue(
          mockExpedition,
        );

        const result = await startNewExpedition();

        expect(mockElectron.database.startNewExpedition).toHaveBeenCalled();
        expect(result).toEqual(mockExpedition);
      });
    });
  });
});
