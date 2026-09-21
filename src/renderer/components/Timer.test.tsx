import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Timer from './Timer';

describe('Timer Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders 00:00:00 initially when no spendTime and no estimate', () => {
    render(
      <Timer startTimer={null} spendTime={0} estimate={0} context="list" />,
    );
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders time spent correctly when not running', () => {
    // 3600 seconds = 1 hour
    render(
      <Timer
        startTimer={null}
        spendTime={3600000}
        estimate={2}
        context="list"
      />,
    );
    // Remaining time: 2h - 1h = 1h
    expect(screen.getByText('01:00:00')).toBeInTheDocument();
  });

  it('updates time when timer is running', () => {
    const now = Date.now();
    jest.setSystemTime(now);

    render(
      <Timer
        startTimer={now.toString()}
        spendTime={0}
        estimate={1}
        context="list"
      />,
    );

    // Initially 1h remaining
    expect(screen.getByText('01:00:00')).toBeInTheDocument();

    // Advance by 1 minute
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // 59 minutes remaining
    expect(screen.getByText('00:59:00')).toBeInTheDocument();
  });

  it('shows overtime with + prefix and red color', () => {
    // Estimate is 1h, spent is 1.5h
    const { container } = render(
      <Timer
        startTimer={null}
        spendTime={5400000}
        estimate={1}
        context="list"
      />,
    );

    // Overtime should be +00:30:00
    expect(screen.getByText('+00:30:00')).toBeInTheDocument();

    // Check color
    const div = container.firstChild as HTMLElement;
    expect(div.style.color).toBe('red');
  });

  it('handles empty string startTimer as not running', () => {
    render(
      <Timer startTimer="" spendTime={3600000} estimate={2} context="list" />,
    );
    expect(screen.getByText('01:00:00')).toBeInTheDocument();
  });

  it('handles null string startTimer as not running', () => {
    render(
      <Timer
        startTimer="null"
        spendTime={3600000}
        estimate={2}
        context="list"
      />,
    );
    expect(screen.getByText('01:00:00')).toBeInTheDocument();
  });
});
