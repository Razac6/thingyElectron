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

function StopComponent() {
  const { tasks, stopTimer, idlePrompt } = useTimer();
  return (
    <div>
      {tasks.map((task) => (
        <button key={task.id} type="button" onClick={() => stopTimer(task.id)}>
          Stop {task.id}
        </button>
      ))}
      <span data-testid="prompt">
        {idlePrompt ? `${idlePrompt.reason}:${idlePrompt.idleTimeMs}` : 'none'}
      </span>
    </div>
  );
}

describe('TimerContext - forgotten timer', () => {
  const HOUR = 60 * 60 * 1000;
  const { logWorkSession } = require('../services/DatabaseService');

  const renderWithRunningTask = async (runningForMs: number) => {
    fetchData.mockResolvedValue([
      {
        id: 7,
        title: 'Forgotten',
        status: StatusEnum.IN_PROGRESS,
        estimate: 1,
        spendTime: 0,
        startTimer: String(Date.now() - runningForMs),
        type: 'TASK',
      } as any,
    ]);
    await act(async () => {
      render(
        <TimerProvider>
          <StopComponent />
        </TimerProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Stop 7'));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).electron.database.endNotificationSession = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  it('asks before logging a session far longer than the estimate, trimmed to the last activity', async () => {
    const lastActivityAgo = 8 * HOUR;
    (window as any).electron.database.getLastActivityTime = jest
      .fn()
      .mockResolvedValue(Date.now() - lastActivityAgo);

    await renderWithRunningTask(10 * HOUR);

    expect(logWorkSession).not.toHaveBeenCalled();
    const [reason, idleMs] = screen
      .getByTestId('prompt')
      .textContent!.split(':');
    expect(reason).toBe('long-session');
    // Discard would drop everything after the last activity (~8h)
    expect(Number(idleMs)).toBeGreaterThan(lastActivityAgo - 1000);
  });

  it('logs normally when there was activity right up to the stop', async () => {
    (window as any).electron.database.getLastActivityTime = jest
      .fn()
      .mockResolvedValue(Date.now() - 60 * 1000);

    await renderWithRunningTask(5 * HOUR);

    expect(screen.getByTestId('prompt').textContent).toBe('none');
    expect(logWorkSession).toHaveBeenCalled();
  });

  it('logs short sessions without checking activity', async () => {
    (window as any).electron.database.getLastActivityTime = jest.fn();

    await renderWithRunningTask(30 * 60 * 1000);

    expect(
      (window as any).electron.database.getLastActivityTime,
    ).not.toHaveBeenCalled();
    expect(logWorkSession).toHaveBeenCalled();
  });
});
