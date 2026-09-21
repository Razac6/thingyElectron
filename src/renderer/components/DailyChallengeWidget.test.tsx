import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DailyChallengeWidget from './DailyChallengeWidget';

// Mock TimerContext
const mockDailyChallenge = {
  type: 'TOTAL_DURATION',
  target: 120,
  progress: 60,
  description: 'Work for 2 hours today',
  xpReward: 50,
  status: 'ACTIVE',
};

const mockTimerContext = {
  dailyChallenge: mockDailyChallenge,
};

jest.mock('../context/TimerContext', () => ({
  useTimer: () => mockTimerContext,
}));

describe('DailyChallengeWidget', () => {
  it('should render challenge description and progress', () => {
    render(<DailyChallengeWidget />);

    expect(screen.getByText('Work for 2 hours today')).toBeInTheDocument();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument(); // 60/120 = 50%
  });

  it('should show "No quest" message if no challenge exists', () => {
    mockTimerContext.dailyChallenge = null as any;
    render(<DailyChallengeWidget />);
    expect(screen.getByText('No quest for today.')).toBeInTheDocument();
  });

  it('should show completed status', () => {
    mockTimerContext.dailyChallenge = {
      ...mockDailyChallenge,
      progress: 120,
      status: 'COMPLETED',
    };
    render(<DailyChallengeWidget />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    // Check for checkmark icon
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });
});
