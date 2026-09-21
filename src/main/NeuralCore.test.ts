import path from 'path';

// No weights file exists at the mocked path, so the real constructor initializes a fresh,
// randomly-weighted model - predict() below controls its output directly rather than relying
// on that randomness.
import { NeuralCore } from './NeuralCore';
import { getTasks, getActiveSprint, getSprintTasks } from './db';

// NeuralCore.ts resolves its weights file path via electron's app.getPath at import time,
// and pulls most of its input features from ./db - both must be mocked before importing it.
jest.mock('electron', () => ({
  app: {
    getPath: jest
      .fn()
      .mockReturnValue(path.join(__dirname, '../../temp_neural_core_test')),
    isPackaged: false,
  },
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('./db', () => ({
  logSystemEvent: jest.fn(),
  getDailyBio: jest.fn().mockReturnValue({ sleepScore: null, meetingTime: 0 }),
  getAiMaturity: jest.fn().mockReturnValue(0),
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  getTasks: jest.fn().mockReturnValue([]),
  getRecentWorkSessions: jest.fn().mockReturnValue([]),
  getHabits: jest.fn().mockReturnValue([]),
  getHabitLogs: jest.fn().mockReturnValue([]),
  getActiveSprint: jest.fn().mockReturnValue(null),
  getSprintTasks: jest.fn().mockReturnValue([]),
  getTagAnalytics: jest.fn(),
  getTagByName: jest.fn().mockReturnValue(null),
  getFocusContext: jest.fn().mockReturnValue(0.5),
}));

describe('NeuralCore.predict', () => {
  let neuralCore: NeuralCore;

  beforeEach(() => {
    neuralCore = new NeuralCore();
  });

  it('clamps a negative raw prediction to the minimum default', () => {
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [-0.5],
    } as any);

    const prediction = neuralCore.predict({
      title: 'Test',
      priority: 'MEDIUM',
      tags: [],
    });

    expect(prediction).toBe(30);
  });

  it('clamps a raw prediction below the sanity floor to the minimum default', () => {
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [2],
    } as any);

    const prediction = neuralCore.predict({
      title: 'Simple task',
      priority: 'LOW',
      tags: [],
    });

    expect(prediction).toBe(30);
  });

  it('returns the raw prediction unchanged when above the sanity floor', () => {
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [90],
    } as any);

    const prediction = neuralCore.predict({
      title: 'Urgent bug fix',
      priority: 'HIGH',
      tags: ['bug'],
    });

    expect(prediction).toBe(90);
  });

  it('handles tasks with no tags without crashing', () => {
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [45],
    } as any);

    expect(() =>
      neuralCore.predict({
        title: 'A task',
        priority: 'MEDIUM',
        tags: undefined,
      }),
    ).not.toThrow();
  });

  it('falls back to the minimum default if the model throws during inference', () => {
    jest.spyOn(neuralCore.model, 'predict').mockImplementation(() => {
      throw new Error('TensorFlow prediction error');
    });

    const prediction = neuralCore.predict({
      title: 'Test',
      priority: 'MEDIUM',
      tags: [],
    });

    expect(prediction).toBe(30);
  });
});

describe('NeuralCore.getPredictionAccuracy', () => {
  let neuralCore: NeuralCore;

  beforeEach(() => {
    jest.clearAllMocks();
    neuralCore = new NeuralCore();
  });

  it('returns 0 when there are no completed tasks in the window', () => {
    (getTasks as jest.Mock).mockReturnValue([]);

    expect(neuralCore.getPredictionAccuracy(1, 14)).toBe(0);
  });

  it('returns 0 when tasks exist but none are completed-with-spendTime in the window', () => {
    (getTasks as jest.Mock).mockReturnValue([
      {
        status: 'To Do',
        updateStatusDate: new Date().toISOString(),
        spendTime: 0,
      },
    ]);

    expect(neuralCore.getPredictionAccuracy(1, 14)).toBe(0);
  });

  it('scores ~100 when the actual duration exactly matches the model prediction', () => {
    // No task.estimate, so predictForTask() skips the estimate-blend and uses the raw
    // model output directly (still subject to the sanity-floor clamp - 60 is well above it).
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [60],
    } as any);

    (getTasks as jest.Mock).mockReturnValue([
      {
        status: 'Completed',
        updateStatusDate: new Date().toISOString(),
        spendTime: 60 * 60 * 1000, // 60 minutes, in ms - matches the 60-minute prediction
        priority: 'MEDIUM',
      },
    ]);

    expect(neuralCore.getPredictionAccuracy(1, 14)).toBeCloseTo(100, 0);
  });

  it('scores lower accuracy when actual and predicted durations diverge', () => {
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [60],
    } as any);

    (getTasks as jest.Mock).mockReturnValue([
      {
        status: 'Completed',
        updateStatusDate: new Date().toISOString(),
        spendTime: 120 * 60 * 1000, // 120 actual minutes vs. 60 predicted -> 100% error
        priority: 'MEDIUM',
      },
    ]);

    const accuracy = neuralCore.getPredictionAccuracy(1, 14);
    expect(accuracy).toBeLessThan(100);
    expect(accuracy).toBeGreaterThanOrEqual(0);
  });

  it('ignores completed tasks outside the requested day window', () => {
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [60],
    } as any);

    const longAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    (getTasks as jest.Mock).mockReturnValue([
      {
        status: 'Completed',
        updateStatusDate: longAgo,
        spendTime: 60 * 60 * 1000,
        priority: 'MEDIUM',
      },
    ]);

    // days=14 window, but the task was completed 30 days ago
    expect(neuralCore.getPredictionAccuracy(1, 14)).toBe(0);
  });
});

describe('NeuralCore.getSprintRiskContext', () => {
  let neuralCore: NeuralCore;

  beforeEach(() => {
    jest.clearAllMocks();
    neuralCore = new NeuralCore();
    jest.spyOn(neuralCore.model, 'predict').mockReturnValue({
      dataSync: () => [30],
    } as any);
  });

  it('returns null risk and 0 remaining tasks when there is no active sprint', () => {
    (getActiveSprint as jest.Mock).mockReturnValue(null);

    expect(neuralCore.getSprintRiskContext(1)).toEqual({
      risk: null,
      tasksRemaining: 0,
    });
  });

  it('computes tasksRemaining and a risk object when a sprint is active', () => {
    (getActiveSprint as jest.Mock).mockReturnValue({
      id: 1,
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const now = new Date().toISOString();
    (getSprintTasks as jest.Mock).mockReturnValue([
      {
        id: 1,
        status: 'To Do',
        estimate: 2,
        priority: 'MEDIUM',
        createdAt: now,
      },
      {
        id: 2,
        status: 'In Progress',
        estimate: 3,
        priority: 'HIGH',
        createdAt: now,
      },
      {
        id: 3,
        status: 'Completed',
        estimate: 1,
        priority: 'LOW',
        createdAt: now,
      },
    ]);

    const context = neuralCore.getSprintRiskContext(1);

    expect(context.tasksRemaining).toBe(2); // only the 2 non-Completed tasks
    expect(context.risk).not.toBeNull();
    expect(typeof context.risk.risk).toBe('string');
  });
});
