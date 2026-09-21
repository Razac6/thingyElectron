import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ContributionGraph from './ContributionGraph';

// Mock react-calendar-heatmap to avoid complex SVG issues in JSDOM
jest.mock(
  'react-calendar-heatmap',
  () =>
    function (props: any) {
      return (
        <div data-testid="heatmap-mock">
          {props.values.map((v: any) => (
            <div key={v.date} data-count={v.count}>
              {v.date}
            </div>
          ))}
        </div>
      );
    },
);

// Mock react-tooltip
jest.mock('react-tooltip', () => ({
  Tooltip: () => <div data-testid="tooltip-mock" />,
}));

const mockTimerContext = {
  contributionData: [
    { date: '2023-01-01', totalDuration: 3600000 }, // 60 min
    { date: '2023-01-02', totalDuration: 1800000 }, // 30 min
  ],
};

jest.mock('../context/TimerContext', () => ({
  useTimer: () => mockTimerContext,
}));

describe('ContributionGraph', () => {
  it('should render heatmap with mapped data', () => {
    render(<ContributionGraph />);

    expect(screen.getByTestId('heatmap-mock')).toBeInTheDocument();

    // Check if data was converted to minutes correctly
    expect(screen.getByText('2023-01-01')).toHaveAttribute('data-count', '60');
    expect(screen.getByText('2023-01-02')).toHaveAttribute('data-count', '30');
  });
});
