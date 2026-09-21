import React from 'react';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { TimerProvider, useTimer } from './TimerContext';
import { StatusEnum } from '../../enums/status.enum';
import { Task } from '../../interfaces/task.interface';

// Mock the window.electron API
beforeAll(() => {
  (global as any).window.electron = {
    ipcRenderer: {
      on: jest.fn(),
      send: jest.fn(),
    },
    database: {
      getDailyDeepWork: jest
        .fn()
        .mockResolvedValue({ score: 0, duration: 0, longestSession: 0 }),
      startNotificationSession: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock dependencies
jest.mock('../services/DatabaseService', () => ({
  fetchData: jest.fn(),
  updateTask: jest.fn(),
  logWorkSession: jest.fn(),
  getDailyProductivity: jest.fn().mockResolvedValue([]),
  getContributionData: jest.fn().mockResolvedValue([]),
  getHourlyProductivity: jest.fn().mockResolvedValue([]),
  getProductivityInsights: jest.fn().mockResolvedValue(null),
  getDailyChallenge: jest.fn().mockResolvedValue(null),
  createTask: jest.fn(),
  deleteTask: jest.fn(),
  getDailyBio: jest.fn().mockResolvedValue(null),
}));

jest.mock('./GamificationContext', () => ({
  useGamification: () => ({
    addXp: jest.fn(),
    checkForAchievements: jest.fn().mockResolvedValue(false),
    triggerRewardAnimation: jest.fn(),
  }),
}));

jest.mock('./SettingsContext', () => ({
  useSettings: () => ({
    settings: { activityGraphDays: 365 },
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

const { fetchData, updateTask } = require('../services/DatabaseService');

function TestComponent() {
  const { tasks, startTimer } = useTimer();
  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id}>
          <span data-testid={`status-${task.id}`}>{task.status}</span>
          <button type="button" onClick={() => startTimer(task.id)}>
            Start {task.id}
          </button>
        </div>
      ))}
    </div>
  );
}

describe('TimerContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should change status from TO_DO to IN_PROGRESS when timer starts', async () => {
    const mockTasks: Task[] = [
      {
        id: 1,
        title: 'Test Task',
        status: StatusEnum.TO_DO,
        displayOrder: 1,
        priority: 'MEDIUM',
        estimate: 1,
        spendTime: 0,
        startTimer: null,
        type: 'TASK',
        sprintId: null,
      } as any,
    ];

    // Mock initial data load
    fetchData.mockResolvedValue(mockTasks);

    await act(async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>,
      );
    });

    // Wait for the context to load the tasks
    expect(screen.getByTestId('status-1').textContent).toBe(StatusEnum.TO_DO);

    // Start timer
    await act(async () => {
      fireEvent.click(screen.getByText('Start 1'));
    });

    // Verify updateTask was called with correct data
    expect(updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        status: StatusEnum.IN_PROGRESS,
      }),
    );
  });
});
