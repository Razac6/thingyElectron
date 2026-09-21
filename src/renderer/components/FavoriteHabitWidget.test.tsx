import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import FavoriteHabitWidget from './FavoriteHabitWidget';
import { toLocalISOString } from '../util/dateUtils';

// Mock window.electron
const mockDatabase = {
  getTopHabit: jest.fn(),
  getHabitLogs: jest.fn(),
  logHabit: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
  };
});

// Mock GamificationContext
jest.mock('../context/GamificationContext', () => ({
  useGamification: () => ({
    addXp: jest.fn(),
    triggerRewardAnimation: jest.fn(),
  }),
}));

describe('FavoriteHabitWidget', () => {
  const mockHabit = { id: 1, title: 'Drink Water' };
  const today = toLocalISOString(new Date());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing if no top habit', async () => {
    mockDatabase.getTopHabit.mockResolvedValue(null);

    await act(async () => {
      render(<FavoriteHabitWidget />);
    });

    expect(screen.queryByText('Drink Water')).not.toBeInTheDocument();
  });

  it('should render habit title and streak', async () => {
    mockDatabase.getTopHabit.mockResolvedValue(mockHabit);
    mockDatabase.getHabitLogs.mockResolvedValue([
      { habitId: 1, date: today, value: 1 },
    ]);

    await act(async () => {
      render(<FavoriteHabitWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('Drink Water')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Streak
    });
  });

  it('should toggle habit completion for today when clicked', async () => {
    mockDatabase.getTopHabit.mockResolvedValue(mockHabit);
    mockDatabase.getHabitLogs.mockResolvedValue([]);

    await act(async () => {
      render(<FavoriteHabitWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('Drink Water')).toBeInTheDocument();
    });

    // Find the bubble for today. The tooltip contains "Click to toggle today"
    const todayBubble = screen.getByLabelText('Click to toggle today');

    await act(async () => {
      fireEvent.click(todayBubble);
    });

    expect(mockDatabase.logHabit).toHaveBeenCalledWith(1, today, 1);
  });
});
