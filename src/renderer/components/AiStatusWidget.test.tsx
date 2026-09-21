import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import AiStatusWidget from './AiStatusWidget';

// Mock window.electron
const mockDatabase = {
  getAiStats: jest.fn(),
  getAiMessage: jest.fn(),
  generateDailyReport: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
  };
});

describe('AiStatusWidget', () => {
  const mockStats = {
    maturity: 100,
    confidence: 85,
    trainingCount: 150,
    dataCount: 3000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.getAiStats.mockResolvedValue(mockStats);
    mockDatabase.getAiMessage.mockResolvedValue(
      'Hello, I am your AI assistant.',
    );
  });

  it('should render AI stats correctly', async () => {
    await act(async () => {
      render(<AiStatusWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('Neural Core')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Cycles
      expect(screen.getByText('3000')).toBeInTheDocument(); // Data
    });
  });

  it('should display AI message in a bubble', async () => {
    jest.useFakeTimers();

    await act(async () => {
      render(<AiStatusWidget />);
    });

    // Ai message is fetched with 1500ms delay
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Hello, I am your AI assistant.'),
      ).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('should open report dialog when report icon is clicked', async () => {
    mockDatabase.generateDailyReport.mockResolvedValue(
      'Detailed report content',
    );

    await act(async () => {
      render(<AiStatusWidget />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('SummarizeIcon')).toBeInTheDocument();
    });

    const reportButton = screen.getByTestId('SummarizeIcon').closest('button');
    if (reportButton) {
      await act(async () => {
        fireEvent.click(reportButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Raport AI')).toBeInTheDocument();
        expect(screen.getByText('Detailed report content')).toBeInTheDocument();
      });
    }
  });
});
