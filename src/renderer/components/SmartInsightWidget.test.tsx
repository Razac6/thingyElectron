import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import SmartInsightWidget from './SmartInsightWidget';

import { updateDailyBio } from '../services/DatabaseService';

// Mock window.electron
const mockDatabase = {
  getSprintAnalysis: jest.fn(),
  updateDailyBio: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
  };
});

// Mock TimerContext
jest.mock('../context/TimerContext', () => ({
  useTimer: () => ({
    insights: {
      peakHourRange: '10:00 - 12:00',
      fatigueProfile: { maxRecommended: 90 },
      trend: { direction: 'increasing', description: 'Working well' },
      focusScore: { score: 85, deepWorkMinutes: 120, longestSessionToday: 45 },
      habitCorrelation: {
        impact: 23,
        message: 'Habit days boost your focus by 23%',
      },
    },
    toggleBoostMode: jest.fn(),
    setDailyMode: jest.fn(),
    tasks: [],
    totalSpendTimeToday: 3600000,
    dailyChallenge: { status: 'ACTIVE' },
  }),
}));

// Mock SettingsContext
jest.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { enableSleepTracking: 'true' },
  }),
}));

// Mock DatabaseService
jest.mock('../services/DatabaseService', () => ({
  getDailyBio: jest
    .fn()
    .mockResolvedValue({ mode: 'normal', sleepScore: 80, meetingTime: 30 }),
  updateDailyBio: jest.fn().mockResolvedValue({ mode: 'boost' }),
}));

describe('SmartInsightWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.getSprintAnalysis.mockResolvedValue({
      risk: 'On Track',
      message: 'Everything is fine',
      completed: 5,
      total: 10,
    });
  });

  it('should render insights and peak hours', async () => {
    await act(async () => {
      render(<SmartInsightWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('10:00 - 12:00')).toBeInTheDocument();
      expect(screen.getByText(/Deep Work:/)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });
  });

  it('should display sprint analysis risk', async () => {
    await act(async () => {
      render(<SmartInsightWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('On Track')).toBeInTheDocument();
    });
  });

  it('should display habit correlation insight when present', async () => {
    await act(async () => {
      render(<SmartInsightWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Nawyki:/)).toBeInTheDocument();
      expect(screen.getByText(/\+23% focus/)).toBeInTheDocument();
    });
  });

  it('should call handleModeChange when boost button is clicked', async () => {
    await act(async () => {
      render(<SmartInsightWidget />);
    });

    const boostButton = screen
      .getByTestId('LocalFireDepartmentIcon')
      .closest('button');

    if (boostButton) {
      await act(async () => {
        fireEvent.click(boostButton);
      });
      expect(updateDailyBio).toHaveBeenCalled();
    }
  });
});
