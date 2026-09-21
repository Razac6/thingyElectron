import { getProposedSchedule } from './TaskScheduler';
import { getTasks, getSprints } from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';

// Mock DB
jest.mock('./db', () => ({
  getTasks: jest.fn(),
  getSprints: jest.fn(),
  updateTasksOrder: jest.fn(),
}));

// Mock NeuralCore
jest.mock('./NeuralCore', () => ({
  neuralCore: {
    predict: jest.fn().mockReturnValue(60), // 1 hour
  },
}));

// Mock ProductivityAnalysis
jest.mock('./ProductivityAnalysis', () => ({
  ProductivityAnalyst: {
    analyzeTagDifficulty: jest.fn().mockReturnValue({}),
    calculateTaskScore: jest.fn().mockReturnValue(100),
  },
}));

describe('TaskScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a list of actionable tasks sorted by score', () => {
    const mockTasks = [
      {
        id: 1,
        title: 'Task 1',
        status: 'To Do',
        priority: 'High',
        type: 'TASK',
      },
      {
        id: 2,
        title: 'Task 2',
        status: 'Completed',
        priority: 'Medium',
        type: 'TASK',
      },
      {
        id: 3,
        title: 'Task 3',
        status: 'In Progress',
        priority: 'Low',
        type: 'TASK',
      },
      {
        id: 4,
        title: 'Meeting',
        status: 'To Do',
        priority: 'Low',
        type: 'MEETING',
      },
    ];
    (getTasks as jest.Mock).mockReturnValue(mockTasks);
    (getSprints as jest.Mock).mockReturnValue([]);

    // We want Task 3 to have higher score than Task 1
    (ProductivityAnalyst.calculateTaskScore as jest.Mock)
      .mockReturnValueOnce(100) // For Task 1
      .mockReturnValueOnce(500); // For Task 3

    const schedule = getProposedSchedule(1);

    // Actionable tasks should be Task 1 and Task 3
    // Task 2 is completed, Task 4 is a meeting.
    expect(schedule).toHaveLength(2);
    expect(schedule[0].id).toBe(3); // Higher score
    expect(schedule[1].id).toBe(1);
    expect(schedule[0].aiReason).toContain('Momentum');
  });

  it('should handle sprint deadlines in reasoning', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const mockTasks = [
      { id: 1, title: 'Sprint Task', status: 'To Do', sprintId: 101 },
    ];
    (getTasks as jest.Mock).mockReturnValue(mockTasks);
    (getSprints as jest.Mock).mockReturnValue([
      { id: 101, endDate: tomorrow.toISOString() },
    ]);

    const schedule = getProposedSchedule(1);

    expect(schedule[0].aiReason).toContain('Sprint Critical Path');
  });
});
