import React from 'react';
import '@testing-library/jest-dom';
import { render, act, waitFor } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';
import * as DatabaseService from '../services/DatabaseService';

// Mock DatabaseService
jest.mock('../services/DatabaseService', () => ({
  getAllSettings: jest.fn(),
  setSetting: jest.fn(),
}));

function TestComponent() {
  const { settings, updateSetting, loading } = useSettings();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="complexity">{settings.complexityThreshold}</div>
      <div data-testid="animations">{settings.enableRewardAnimations}</div>
      <button
        type="button"
        onClick={() => updateSetting('complexityThreshold', '10')}
      >
        Update
      </button>
    </div>
  );
}

describe('SettingsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load settings and merge with defaults', async () => {
    (DatabaseService.getAllSettings as jest.Mock).mockResolvedValue({
      enableRewardAnimations: 'false', // Override default
    });

    let result: any;
    await act(async () => {
      result = render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>,
      );
    });

    await waitFor(() => {
      expect(result.getByTestId('complexity').textContent).toBe('8'); // Default
      expect(result.getByTestId('animations').textContent).toBe('false'); // DB value
    });
  });

  it('should update settings', async () => {
    (DatabaseService.getAllSettings as jest.Mock).mockResolvedValue({});
    (DatabaseService.setSetting as jest.Mock).mockResolvedValue({});

    let result: any;
    await act(async () => {
      result = render(
        <SettingsProvider>
          <TestComponent />
        </SettingsProvider>,
      );
    });

    await waitFor(() =>
      expect(result.queryByText('Loading...')).not.toBeInTheDocument(),
    );

    await act(async () => {
      result.getByText('Update').click();
    });

    expect(DatabaseService.setSetting).toHaveBeenCalledWith(
      'complexityThreshold',
      '10',
    );
    expect(result.getByTestId('complexity').textContent).toBe('10');
  });
});
