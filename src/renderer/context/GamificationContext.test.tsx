import React from 'react';
import { render, act, screen, waitFor } from '@testing-library/react';
import {
  GamificationProvider,
  useGamification,
  getRankForLevel,
} from './GamificationContext';

// Mock window.electron
const mockDatabase = {
  getProfile: jest.fn(),
  getEarnedAchievements: jest.fn(),
  updateProfile: jest.fn(),
  grantAchievement: jest.fn(),
  getTasks: jest.fn(),
  getLifetimeStats: jest.fn(),
};

const mockIpcRenderer = {
  on: jest.fn(),
  removeListener: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
    ipcRenderer: mockIpcRenderer,
  };
});

// Mock SettingsContext
jest.mock('./SettingsContext', () => ({
  useSettings: () => ({
    settings: { enableRewardAnimations: 'true' },
  }),
}));

function TestComponent() {
  const { profile, earnedAchievements, addXp, rank, checkForAchievements } =
    useGamification();
  return (
    <div>
      <div data-testid="level">{profile?.level}</div>
      <div data-testid="xp">{profile?.xp}</div>
      <div data-testid="rank">{rank}</div>
      <div data-testid="achievements">{earnedAchievements.join(',')}</div>
      <button type="button" onClick={() => addXp(50)}>
        Add 50 XP
      </button>
      <button
        type="button"
        onClick={() => checkForAchievements('TASK_COMPLETED')}
      >
        Check Task
      </button>
    </div>
  );
}

describe('GamificationContext', () => {
  const initialProfile = { userId: 1, level: 1, xp: 0 };
  const initialAchievements: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.getProfile.mockResolvedValue(initialProfile);
    mockDatabase.getEarnedAchievements.mockResolvedValue(initialAchievements);
  });

  it('should load initial profile and rank', async () => {
    await act(async () => {
      render(
        <GamificationProvider>
          <TestComponent />
        </GamificationProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('level').textContent).toBe('1');
      expect(screen.getByTestId('rank').textContent).toBe('Utopiec');
    });
  });

  it('should increase XP and level up', async () => {
    await act(async () => {
      render(
        <GamificationProvider>
          <TestComponent />
        </GamificationProvider>,
      );
    });

    // Level 1 needs 1 * 100 = 100 XP
    await act(async () => {
      screen.getByText('Add 50 XP').click();
    });

    expect(screen.getByTestId('xp').textContent).toBe('50');

    await act(async () => {
      screen.getByText('Add 50 XP').click();
    });

    // Should level up to 2
    expect(screen.getByTestId('level').textContent).toBe('2');
    expect(screen.getByTestId('xp').textContent).toBe('0');
    // Level 5 is Leszy, so at 2 it should still be Utopiec or next?
    // Wait, getRankForLevel logic:
    // 1: Utopiec, 5: Leszy
    expect(screen.getByTestId('rank').textContent).toBe('Utopiec');
  });

  it('should grant FIRST_TASK achievement', async () => {
    mockDatabase.getTasks.mockResolvedValue([]);

    await act(async () => {
      render(
        <GamificationProvider>
          <TestComponent />
        </GamificationProvider>,
      );
    });

    await act(async () => {
      screen.getByText('Check Task').click();
    });

    await waitFor(() => {
      expect(mockDatabase.grantAchievement).toHaveBeenCalledWith(
        1,
        'FIRST_TASK',
      );
      expect(screen.getByTestId('achievements').textContent).toContain(
        'FIRST_TASK',
      );
    });
  });

  it('should grant FIVE_TASKS achievement when 5 tasks are completed', async () => {
    mockDatabase.getEarnedAchievements.mockResolvedValue(['FIRST_TASK']);
    mockDatabase.getTasks.mockResolvedValue([
      { status: 'Completed' },
      { status: 'Completed' },
      { status: 'Completed' },
      { status: 'Completed' },
      { status: 'Completed' },
    ]);

    await act(async () => {
      render(
        <GamificationProvider>
          <TestComponent />
        </GamificationProvider>,
      );
    });

    await act(async () => {
      screen.getByText('Check Task').click();
    });

    await waitFor(() => {
      expect(mockDatabase.grantAchievement).toHaveBeenCalledWith(
        1,
        'FIVE_TASKS',
      );
      expect(screen.getByTestId('achievements').textContent).toContain(
        'FIVE_TASKS',
      );
    });
  });
});

describe('getRankForLevel', () => {
  it('should return correct ranks', () => {
    expect(getRankForLevel(1)).toBe('Utopiec');
    expect(getRankForLevel(4)).toBe('Utopiec');
    expect(getRankForLevel(5)).toBe('Leszy');
    expect(getRankForLevel(9)).toBe('Leszy');
    expect(getRankForLevel(10)).toBe('Bies');
    expect(getRankForLevel(25)).toBe('Wąpierz');
    expect(getRankForLevel(100)).toBe('Wąpierz');
  });
});
