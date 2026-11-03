import React from 'react';
import '@testing-library/jest-dom';
import { render, act, screen, waitFor } from '@testing-library/react';
import { GamificationProvider, useGamification } from './GamificationContext';

const listeners: Record<string, (payload?: any) => void> = {};
const mockDatabase = {
  getGamificationState: jest.fn(),
  awardXp: jest.fn(),
  syncAchievements: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
    ipcRenderer: {
      on: jest.fn((channel: string, fn: (payload?: any) => void) => {
        listeners[channel] = fn;
        return () => delete listeners[channel];
      }),
    },
  };
});

jest.mock('./SettingsContext', () => ({
  useSettings: () => ({ settings: { enableRewardAnimations: 'true' } }),
}));

function TestComponent() {
  const {
    profile,
    earnedAchievements,
    addXp,
    checkForAchievements,
    rewardAnimation,
  } = useGamification();
  return (
    <div>
      <div data-testid="level">{profile?.level}</div>
      <div data-testid="xp">{profile?.xp}</div>
      <div data-testid="achievements">{earnedAchievements.join(',')}</div>
      <div data-testid="animation">{rewardAnimation}</div>
      <button
        type="button"
        onClick={() => addXp(15, 'Habit: Read', 'habit:1:2026-11-03')}
      >
        Add XP
      </button>
      <button type="button" onClick={() => checkForAchievements()}>
        Check
      </button>
    </div>
  );
}

const renderProvider = async () => {
  await act(async () => {
    render(
      <GamificationProvider>
        <TestComponent />
      </GamificationProvider>,
    );
  });
};

describe('GamificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.getGamificationState.mockResolvedValue({
      profile: { userId: 1, level: 4, xp: 320 },
      achievements: [
        { id: 'FIRST_TASK', earnedAt: '2026-01-01' },
        { id: 'FIVE_TASKS', earnedAt: null },
      ],
      recentXp: [],
    });
  });

  it('loads the profile and earned achievements from the main process', async () => {
    await renderProvider();
    expect(screen.getByTestId('level')).toHaveTextContent('4');
    expect(screen.getByTestId('xp')).toHaveTextContent('320');
    expect(screen.getByTestId('achievements')).toHaveTextContent('FIRST_TASK');
  });

  it('forwards XP awards with reason and once-only key', async () => {
    mockDatabase.awardXp.mockResolvedValue({ userId: 1, level: 4, xp: 335 });
    await renderProvider();
    await act(async () => {
      screen.getByText('Add XP').click();
    });
    expect(mockDatabase.awardXp).toHaveBeenCalledWith(
      15,
      'Habit: Read',
      'habit:1:2026-11-03',
    );
    expect(screen.getByTestId('xp')).toHaveTextContent('335');
  });

  it('shows the trophy when the main process reports a new achievement', async () => {
    await renderProvider();
    await act(async () => {
      listeners['gamification:updated']({
        profile: { userId: 1, level: 5, xp: 10 },
        newAchievements: [{ id: 'FIVE_TASKS', name: 'Apprentice', xp: 50 }],
      });
    });
    expect(screen.getByTestId('level')).toHaveTextContent('5');
    expect(screen.getByTestId('achievements')).toHaveTextContent(
      'FIRST_TASK,FIVE_TASKS',
    );
    expect(screen.getByTestId('animation')).toHaveTextContent('trophy');
  });

  it('checkForAchievements syncs with the main process', async () => {
    mockDatabase.syncAchievements.mockResolvedValue({
      profile: { userId: 1, level: 4, xp: 370 },
      newAchievements: [{ id: 'FIVE_TASKS', name: 'Apprentice', xp: 50 }],
    });
    await renderProvider();
    await act(async () => {
      screen.getByText('Check').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('achievements')).toHaveTextContent(
        'FIVE_TASKS',
      ),
    );
  });
});
