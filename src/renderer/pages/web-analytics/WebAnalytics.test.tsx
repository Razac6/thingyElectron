import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import WebAnalytics from './WebAnalytics';

// Mock window.electron
const mockDatabase = {
  getWebStats: jest.fn(),
  getAppStats: jest.fn(),
  getWebSettings: jest.fn(),
  setDomainCategory: jest.fn(),
  setAppCategory: jest.fn(),
};

beforeAll(() => {
  (global as any).window.electron = {
    database: mockDatabase,
  };
});

describe('WebAnalytics Component', () => {
  const mockWebStats = {
    topDomains: [
      { domain: 'google.com', totalTime: 600000, category: 'WORK' }, // 10m
      { domain: 'youtube.com', totalTime: 1200000, category: 'DISTRACTION' }, // 20m
    ],
    totalDuration: 1800000,
  };

  const mockAppStats = [
    { appName: 'WebStorm', totalTime: 3600000, category: 'WORK' }, // 1h
  ];

  const mockSettings = {
    integrationEnabled: true,
    appMonitoringEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.getWebStats.mockResolvedValue(mockWebStats);
    mockDatabase.getAppStats.mockResolvedValue(mockAppStats);
    mockDatabase.getWebSettings.mockResolvedValue(mockSettings);
  });

  it('should render web and app analytics', async () => {
    await act(async () => {
      render(<WebAnalytics />);
    });

    await waitFor(() => {
      expect(screen.getByText('google.com')).toBeInTheDocument();
      expect(screen.getByText('youtube.com')).toBeInTheDocument();
      expect(screen.getByText('WebStorm')).toBeInTheDocument();
      // Times show in the rows (and again in card totals / summary tiles)
      expect(screen.getAllByText('10m').length).toBeGreaterThan(0);
      expect(screen.getAllByText('20m').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1h 0m').length).toBeGreaterThan(0);
      // Productive = google.com (WORK) + WebStorm (WORK)
      expect(screen.getByText('1h 10m')).toBeInTheDocument();
    });
  });

  it('should call setDomainCategory when web category is changed', async () => {
    await act(async () => {
      render(<WebAnalytics />);
    });

    await waitFor(() =>
      expect(screen.getByText('google.com')).toBeInTheDocument(),
    );

    // Material UI Select uses hidden input or text for current value
    // We'll look for the select button and click it, then click the menu item
    const webCategorySelect = screen.getAllByRole('combobox')[0]; // google.com's category

    fireEvent.mouseDown(webCategorySelect);
    const option = await screen.findByRole('option', { name: 'Learning' });
    fireEvent.click(option);

    expect(mockDatabase.setDomainCategory).toHaveBeenCalledWith(
      'google.com',
      'LEARNING',
    );
  });

  it('should update stats when time range is changed', async () => {
    await act(async () => {
      render(<WebAnalytics />);
    });

    fireEvent.click(screen.getByRole('button', { name: '7 days' }));

    await waitFor(() =>
      expect(mockDatabase.getWebStats).toHaveBeenCalledWith(7),
    );
    await waitFor(() =>
      expect(mockDatabase.getAppStats).toHaveBeenCalledWith(7),
    );
  });
});
