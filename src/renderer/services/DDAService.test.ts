import { Task } from '../../interfaces/task.interface';
import { TaskTypeEnum } from '../../enums/task-type.enum';
import { StatusEnum } from '../../enums/status.enum';
import { PriorityEnum } from '../../enums/priority.enum';

import { analyzeSprintOptimism } from './DDAService';
import * as DatabaseService from './DatabaseService';

// Mock DatabaseService before importing DDAService
jest.mock('./DatabaseService', () => ({
  getTagByName: jest.fn(),
  getTagAnalytics: jest.fn(),
}));

describe('DDAService', () => {
  const mockGetTagByName =
    DatabaseService.getTagByName as jest.MockedFunction<any>;
  const mockGetTagAnalytics =
    DatabaseService.getTagAnalytics as jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 1,
    title: 'Test Task',
    description: '',
    status: StatusEnum.TO_DO,
    updateStatusDate: '2024-01-01',
    estimate: 2,
    priority: PriorityEnum.MEDIUM,
    link: '',
    createdAt: '2024-01-01',
    spendTime: 0,
    startTimer: null,
    type: TaskTypeEnum.TASK,
    tags: [],
    ...overrides,
  });

  describe('analyzeSprintOptimism', () => {
    it('should return null when tasks array is empty', async () => {
      const result = await analyzeSprintOptimism([]);

      expect(result).toBeNull();
      expect(mockGetTagByName).not.toHaveBeenCalled();
      expect(mockGetTagAnalytics).not.toHaveBeenCalled();
    });

    it('should return null when tasks is null', async () => {
      const result = await analyzeSprintOptimism(null as any);

      expect(result).toBeNull();
    });

    it('should return null when no tasks have tags', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 2, tags: [] }),
        createMockTask({ id: 2, estimate: 3, tags: [] }),
      ];

      const result = await analyzeSprintOptimism(tasks);

      expect(result).toBeNull();
      expect(mockGetTagByName).not.toHaveBeenCalled();
      expect(mockGetTagAnalytics).not.toHaveBeenCalled();
    });

    it('should return null when no tags have sufficient analytics data', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 2, tags: ['backend'] }),
        createMockTask({ id: 2, estimate: 3, tags: ['frontend'] }),
      ];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 7200000, // 2 hours in ms
        std_dev: 1800000,
        completed_count: 2, // Less than 3 - insufficient data
      });

      const result = await analyzeSprintOptimism(tasks);

      expect(result).toBeNull();
    });

    it('should return null when estimates are within threshold', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 2, tags: ['backend'] }),
        createMockTask({ id: 2, estimate: 3, tags: ['backend'] }),
      ];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 7200000, // 2 hours in ms
        std_dev: 1800000,
        completed_count: 5,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Average estimate: (2 + 3) / 2 = 2.5h
      // Average historical: 2h
      // 2.5h >= 2h * 0.75 (1.5h) - within threshold
      expect(result).toBeNull();
    });

    it('should return warning when estimates are significantly lower than historical data', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 1, tags: ['backend'] }),
        createMockTask({ id: 2, estimate: 1, tags: ['backend'] }),
      ];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours in ms
        std_dev: 1800000,
        completed_count: 10,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Average estimate: 1h
      // Average historical: 4h
      // 1h < 4h * 0.75 (3h) - optimistic!
      expect(result).toContain('Optimism Warning');
      expect(result).toContain('75%'); // (1 - 1/4) * 100 = 75%
      expect(result).toContain('1.0h');
      expect(result).toContain('4.0h');
    });

    it('should handle multiple tags per task and average their EMAs', async () => {
      const tasks = [
        createMockTask({
          id: 1,
          estimate: 1,
          tags: ['backend', 'api'],
        }),
      ];

      mockGetTagByName.mockImplementation(async (tagName: string) => {
        if (tagName === 'backend') return { id: 1, name: 'backend' };
        if (tagName === 'api') return { id: 2, name: 'api' };
        return null;
      });

      mockGetTagAnalytics.mockImplementation(async (tagId: number) => {
        if (tagId === 1) {
          // backend: 4 hours average
          return {
            ema: 14400000,
            std_dev: 1800000,
            completed_count: 10,
          };
        }
        if (tagId === 2) {
          // api: 2 hours average
          return {
            ema: 7200000,
            std_dev: 900000,
            completed_count: 8,
          };
        }
        return null;
      });

      const result = await analyzeSprintOptimism(tasks);

      // Task has backend (4h) and api (2h), averaged to 3h
      // Estimate is 1h
      // 1h < 3h * 0.75 (2.25h) - optimistic!
      expect(result).toContain('Optimism Warning');
      expect(result).toContain('1.0h');
      expect(result).toContain('3.0h');
    });

    it('should fetch tag analytics only once for duplicate tags', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 1, tags: ['backend'] }),
        createMockTask({ id: 2, estimate: 1, tags: ['backend'] }),
        createMockTask({ id: 3, estimate: 1, tags: ['backend'] }),
      ];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours
        std_dev: 1800000,
        completed_count: 10,
      });

      await analyzeSprintOptimism(tasks);

      // Should only fetch tag once even though 3 tasks have it
      expect(mockGetTagByName).toHaveBeenCalledTimes(1);
      expect(mockGetTagByName).toHaveBeenCalledWith('backend');
      expect(mockGetTagAnalytics).toHaveBeenCalledTimes(1);
      expect(mockGetTagAnalytics).toHaveBeenCalledWith(1);
    });

    it('should handle tasks without estimates gracefully', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 0, tags: ['backend'] }),
        createMockTask({ id: 2, estimate: 1, tags: ['backend'] }),
      ];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 7200000, // 2 hours
        std_dev: 1800000,
        completed_count: 5,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Average estimate: (0 + 1) / 2 = 0.5h
      // Historical: 2h
      // 0.5h < 2h * 0.75 (1.5h) - optimistic!
      expect(result).toContain('Optimism Warning');
    });

    it('should handle errors when fetching tag data', async () => {
      const tasks = [
        createMockTask({
          id: 1,
          estimate: 1,
          tags: ['backend', 'failing-tag'],
        }),
      ];

      mockGetTagByName.mockImplementation(async (tagName: string) => {
        if (tagName === 'backend') return { id: 1, name: 'backend' };
        if (tagName === 'failing-tag') throw new Error('API Error');
        return null;
      });

      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours
        std_dev: 1800000,
        completed_count: 10,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Should log warning but continue with available data
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to fetch analytics for tag failing-tag',
        ),
        expect.any(Error),
      );

      // Should still analyze based on 'backend' tag
      expect(result).toContain('Optimism Warning');
    });

    it('should skip tags without tag ID', async () => {
      const tasks = [createMockTask({ id: 1, estimate: 1, tags: ['backend'] })];

      mockGetTagByName.mockResolvedValue(null); // Tag not found

      const result = await analyzeSprintOptimism(tasks);

      expect(result).toBeNull();
      expect(mockGetTagAnalytics).not.toHaveBeenCalled();
    });

    it('should skip tags with null analytics', async () => {
      const tasks = [createMockTask({ id: 1, estimate: 1, tags: ['backend'] })];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue(null);

      const result = await analyzeSprintOptimism(tasks);

      expect(result).toBeNull();
    });

    it('should calculate percentage correctly for different optimism levels', async () => {
      const tasks = [createMockTask({ id: 1, estimate: 2, tags: ['backend'] })];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours
        std_dev: 1800000,
        completed_count: 10,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Estimate: 2h, Historical: 4h
      // Percentage: (1 - 2/4) * 100 = 50%
      expect(result).toContain('50%');
      expect(result).toContain('2.0h');
      expect(result).toContain('4.0h');
    });

    it('should handle tasks with undefined tags property', async () => {
      const tasks = [createMockTask({ id: 1, estimate: 2, tags: undefined })];

      const result = await analyzeSprintOptimism(tasks);

      expect(result).toBeNull();
    });

    it('should process multiple unique tags in parallel', async () => {
      const tasks = [
        createMockTask({
          id: 1,
          estimate: 1,
          tags: ['backend', 'api', 'database'],
        }),
      ];

      let callCount = 0;
      mockGetTagByName.mockImplementation(async (tagName: string) => {
        callCount++;
        return { id: callCount, name: tagName };
      });

      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours
        std_dev: 1800000,
        completed_count: 10,
      });

      await analyzeSprintOptimism(tasks);

      // Should have called getTagByName 3 times (once per unique tag)
      expect(mockGetTagByName).toHaveBeenCalledTimes(3);
      expect(mockGetTagByName).toHaveBeenCalledWith('backend');
      expect(mockGetTagByName).toHaveBeenCalledWith('api');
      expect(mockGetTagByName).toHaveBeenCalledWith('database');

      // Should have called getTagAnalytics 3 times
      expect(mockGetTagAnalytics).toHaveBeenCalledTimes(3);
    });

    it('should handle exact threshold boundary (75%)', async () => {
      const tasks = [createMockTask({ id: 1, estimate: 3, tags: ['backend'] })];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours
        std_dev: 1800000,
        completed_count: 10,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Estimate: 3h, Historical: 4h, Threshold: 3h (4 * 0.75)
      // 3h is exactly at threshold, should NOT warn
      expect(result).toBeNull();
    });

    it('should warn when just below threshold', async () => {
      const tasks = [
        createMockTask({ id: 1, estimate: 2.9, tags: ['backend'] }),
      ];

      mockGetTagByName.mockResolvedValue({ id: 1, name: 'backend' });
      mockGetTagAnalytics.mockResolvedValue({
        ema: 14400000, // 4 hours
        std_dev: 1800000,
        completed_count: 10,
      });

      const result = await analyzeSprintOptimism(tasks);

      // Estimate: 2.9h, Historical: 4h, Threshold: 3h
      // 2.9h < 3h, should warn
      expect(result).toContain('Optimism Warning');
    });
  });
});
