import React from 'react';
import '@testing-library/jest-dom';
import { render, act, screen, waitFor } from '@testing-library/react';
import { GamificationProvider, useGamification } from './GamificationContext';

const listeners: Record<string, (payload?: any) => void> = {};
const mockDatabase = {
  getGamificationState: jest.fn(),
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
  const { earnedAchievements, checkForAchievements, rewardAnimation } =
    useGamification();
  return (
    <div>
      <div data-testid="achievements">{earnedAchievements.join(',')}</div>
      <div data-testid="animation">{rewardAnimation}</div>
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
      achievements: [
        { id: 'FIRST_TASK', earnedAt: '2026-01-01' },
        { id: 'FIVE_TASKS', earnedAt: null },
      ],
    });
  });

  it('loads the earned achievements from the main process', async () => {
    await renderProvider();
    expect(screen.getByTestId('achievements')).toHaveTextContent('FIRST_TASK');
  });

  it('shows the trophy when the main process reports a new achievement', async () => {
    await renderProvider();
    await act(async () => {
      listeners['gamification:updated']({
        newAchievements: [{ id: 'FIVE_TASKS', name: 'Apprentice' }],
      });
    });
    expect(screen.getByTestId('achievements')).toHaveTextContent(
      'FIRST_TASK,FIVE_TASKS',
    );
    expect(screen.getByTestId('animation')).toHaveTextContent('trophy');
  });

  it('checkForAchievements syncs with the main process', async () => {
    mockDatabase.syncAchievements.mockResolvedValue({
      newAchievements: [{ id: 'FIVE_TASKS', name: 'Apprentice' }],
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
