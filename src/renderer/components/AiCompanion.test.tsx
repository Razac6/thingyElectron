import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiCompanion } from './AiCompanion';

// Mock Lottie since it might not work well in JSDOM
jest.mock(
  'lottie-react',
  () =>
    function () {
      return <div data-testid="lottie-mock" />;
    },
);

// Mock window.electron
const mockDatabase = {
  getDailyBio: jest.fn().mockResolvedValue({
    waterIntake: 2,
    meditationMinutes: 5,
    stretchingMinutes: 10,
  }),
  updateDailyBio: jest.fn().mockResolvedValue({}),
  getAiMessage: jest.fn().mockResolvedValue('Hello!'),
  getDailyReportData: jest.fn(),
  getDailyStandup: jest.fn(),
  getDistractionStats: jest.fn(),
};

const mockIpcRenderer = {
  on: jest.fn(),
  removeListener: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
    ipcRenderer: mockIpcRenderer,
    app: { skipMeditation: jest.fn() },
  };
});

// Mock Contexts
jest.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      enable_ai_assistant: 'true',
      ai_bubble_opacity: '0.8',
      enable_water_reminders: 'true',
    },
  }),
}));

jest.mock('../context/TimerContext', () => ({
  useTimer: () => ({
    tasks: [],
    stopTimer: jest.fn(),
  }),
}));

jest.mock('../context/GamificationContext', () => ({
  useGamification: () => ({
    checkForAchievements: jest.fn(),
    triggerRewardAnimation: jest.fn(),
  }),
}));

describe('AiCompanion', () => {
  let messageCallback: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIpcRenderer.on.mockImplementation((channel, cb) => {
      if (channel === 'ai-companion:show-message') messageCallback = cb;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should appear when summon event is triggered', async () => {
    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    // Trigger summon event
    act(() => {
      window.dispatchEvent(new CustomEvent('summon-ai-companion'));
    });

    await waitFor(() => {
      expect(screen.getByText('Jestem! W czym pomóc?')).toBeInTheDocument();
      expect(screen.getByText('Szybki raport')).toBeInTheDocument();
    });
  });

  it('should show message from IPC', async () => {
    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    act(() => {
      messageCallback('Drink some water!');
    });

    await waitFor(() => {
      expect(screen.getByText('Drink some water!')).toBeInTheDocument();
    });
  });

  it('should log water intake when prompted', async () => {
    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    await act(async () => {
      messageCallback('Pamiętaj o wodzie!');
    });

    // Wait for the async useEffect to complete and state to update
    await waitFor(() => expect(mockDatabase.getDailyBio).toHaveBeenCalled());

    // Additional wait to ensure state update after mock resolved
    await act(async () => {
      await Promise.resolve(); // Flush microtasks
    });

    await waitFor(() => {
      expect(screen.getByText('Zrobione!')).toBeInTheDocument();
    });

    const doneButton = screen.getByText('Zrobione!');
    await act(async () => {
      fireEvent.click(doneButton);
    });

    expect(mockDatabase.updateDailyBio).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ waterIntake: 3 }), // 2 (initial) + 1
    );
  });

  it('should show report when selected in menu', async () => {
    mockDatabase.getDailyReportData.mockResolvedValue({
      completedCount: 5,
      totalTimeMs: 3600000,
      pomodoroCount: 2,
    });

    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    // Open menu
    act(() => {
      window.dispatchEvent(new CustomEvent('summon-ai-companion'));
    });

    const reportButton = screen.getByText('Szybki raport');
    await act(async () => {
      fireEvent.click(reportButton);
    });

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('1h 0m')).toBeInTheDocument();
      expect(screen.getByTestId('TimerIcon')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should show distractions', async () => {
    mockDatabase.getDistractionStats.mockResolvedValue([
      { domain: 'youtube.com', totalTime: 600000 }, // 10m
    ]);

    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('summon-ai-companion'));
    });

    const distractionsButton = screen.getByText('Co mnie rozprasza?');
    await act(async () => {
      fireEvent.click(distractionsButton);
    });

    await waitFor(() => {
      expect(screen.getByText('1. youtube.com')).toBeInTheDocument();
      expect(screen.getByText('10m')).toBeInTheDocument();
    });
  });

  it('should show daily standup when STANDUP_TRIGGER received', async () => {
    mockDatabase.getDailyStandup.mockResolvedValue({
      yesterday: { completedCount: 3, totalTimeMs: 1800000 },
      topSuggestion: { id: 10, title: 'Big Task' },
      challenge: { description: 'Do some work' },
    });

    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    await act(async () => {
      messageCallback('STANDUP_TRIGGER');
    });

    await waitFor(() => {
      expect(
        screen.getByText('Dzień dobry! Oto Twój plan:'),
      ).toBeInTheDocument();
      expect(screen.getByText('Big Task')).toBeInTheDocument();
      expect(screen.getByText('Do some work')).toBeInTheDocument();
    });
  });

  it('should handle snooze during prompt', async () => {
    render(
      <MemoryRouter>
        <AiCompanion />
      </MemoryRouter>,
    );

    await act(async () => {
      messageCallback('Pamiętaj o wodzie!');
    });

    await waitFor(() => {
      expect(screen.getByText('Później...')).toBeInTheDocument();
    });

    const snoozeButton = screen.getByText('Później...');
    fireEvent.click(snoozeButton);

    await waitFor(() => {
      expect(screen.getByText('15m')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('15m'));

    // Should hide
    await waitFor(() => {
      expect(screen.queryByText('Później...')).not.toBeInTheDocument();
    });
  });
});
