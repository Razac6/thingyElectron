import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import SearchOverlay from './SearchOverlay';
import * as DatabaseService from '../services/DatabaseService';

// Mock useTimer
const mockCreateTask = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../context/TimerContext', () => ({
  useTimer: () => ({
    createTask: mockCreateTask,
    tasks: [],
    setTasks: jest.fn(),
  }),
}));

// Mock DatabaseService
jest.mock('../services/DatabaseService');

// Mock window.electron
const mockElectron = {
  database: {
    predictDuration: jest.fn(),
  },
};

Object.defineProperty(window, 'electron', {
  writable: true,
  configurable: true,
  value: mockElectron,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('SearchOverlay', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('userId', JSON.stringify(1));

    (DatabaseService.getAllTags as jest.Mock).mockResolvedValue([
      'backend',
      'frontend',
      'urgent',
    ]);
    (DatabaseService.globalSearch as jest.Mock).mockResolvedValue([]);
    (DatabaseService.getTagByName as jest.Mock).mockResolvedValue(null);
    (DatabaseService.getTagAnalytics as jest.Mock).mockResolvedValue(null);
    mockElectron.database.predictDuration.mockResolvedValue(120); // 120 minutes = 2 hours
  });

  const renderComponent = (open = true) => {
    return render(
      <BrowserRouter>
        <SearchOverlay open={open} onClose={mockOnClose} />
      </BrowserRouter>,
    );
  };

  describe('Rendering and Basic Functionality', () => {
    it('should render when open is true', () => {
      renderComponent(true);
      expect(screen.getByPlaceholderText(/Add task:/)).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      renderComponent(false);
      expect(
        screen.queryByPlaceholderText(/Add task:/),
      ).not.toBeInTheDocument();
    });

    it('should start in add mode by default', () => {
      renderComponent();
      expect(screen.getByPlaceholderText(/Add task:/)).toBeInTheDocument();
    });

    it('should switch to search mode when search icon is clicked', async () => {
      renderComponent();

      const switchButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('title')?.includes('Search Mode'));

      if (switchButton) {
        fireEvent.click(switchButton);
      }

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Search tasks and notes/),
        ).toBeInTheDocument();
      });
    });

    it('should close modal when onClose is triggered', () => {
      renderComponent();

      // MUI's Modal portals the backdrop to document.body, not into RTL's
      // render container, so it must be queried from the document.
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeNull();
      fireEvent.click(backdrop as Element);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Quick Add Task Parsing', () => {
    it('should parse task type from @bug', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'Fix login issue @bug' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Fix login issue',
            type: 'BUG',
          }),
        );
      });
    });

    it('should parse task type from @feature', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'Add dark mode @feature' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Add dark mode',
            type: 'FEATURE',
          }),
        );
      });
    });

    it('should parse time estimate in hours', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'Write documentation 3h' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Write documentation',
            estimate: 3,
          }),
        );
      });
    });

    it('should parse time estimate in minutes', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'Quick fix 30m' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Quick fix',
            estimate: 0.5, // 30 minutes = 0.5 hours
          }),
        );
      });
    });

    it('should parse tags from #backend #frontend', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, {
        target: { value: 'Fix API #backend #urgent' },
      });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Fix API',
            tags: expect.arrayContaining(['backend', 'urgent']),
          }),
        );
      });
    });

    it('should parse complete task with all modifiers', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, {
        target: { value: 'Fix login @bug #backend 2h' },
      });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Fix login',
            type: 'BUG',
            tags: ['backend'],
            estimate: 2,
          }),
        );
      });
    });

    it('should handle empty query gracefully', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('should search for tasks when in search mode', async () => {
      const mockResults = [
        { id: 1, title: 'Task 1', resultType: 'task' as const },
        { id: 2, title: 'Task 2', resultType: 'task' as const },
      ];

      (DatabaseService.globalSearch as jest.Mock).mockResolvedValue(
        mockResults,
      );

      renderComponent();

      // Switch to search mode
      const switchButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('title')?.includes('Search Mode'));
      if (switchButton) {
        fireEvent.click(switchButton);
      }

      const input = screen.getByPlaceholderText(/Search tasks and notes/);
      fireEvent.change(input, { target: { value: 'test query' } });

      await waitFor(
        () => {
          expect(DatabaseService.globalSearch).toHaveBeenCalledWith(
            'test query',
          );
        },
        { timeout: 1000 },
      );
    });

    it('should navigate to task on result selection', async () => {
      const mockResults = [
        { id: 123, title: 'Task 1', resultType: 'task' as const },
      ];

      (DatabaseService.globalSearch as jest.Mock).mockResolvedValue(
        mockResults,
      );

      renderComponent();

      // Switch to search mode
      const switchButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('title')?.includes('Search Mode'));
      if (switchButton) {
        fireEvent.click(switchButton);
      }

      const input = screen.getByPlaceholderText(/Search tasks and notes/);
      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Task 1'));

      expect(mockNavigate).toHaveBeenCalledWith('/task/123');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show "No results found" when search returns empty', async () => {
      (DatabaseService.globalSearch as jest.Mock).mockResolvedValue([]);

      renderComponent();

      // Switch to search mode
      const switchButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('title')?.includes('Search Mode'));
      if (switchButton) {
        fireEvent.click(switchButton);
      }

      const input = screen.getByPlaceholderText(/Search tasks and notes/);
      fireEvent.change(input, { target: { value: 'nonexistent' } });

      await waitFor(
        () => {
          expect(screen.getByText('No results found.')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('AI Estimate Feature', () => {
    it('should fetch AI estimate after typing', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, {
        target: { value: 'Write unit tests #backend' },
      });

      await waitFor(
        () => {
          expect(mockElectron.database.predictDuration).toHaveBeenCalledWith(
            expect.objectContaining({
              title: 'Write unit tests',
              tags: ['backend'],
            }),
          );
        },
        { timeout: 1500 },
      ); // Account for 800ms debounce
    });

    it('should not fetch AI estimate for short queries', async () => {
      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'ab' } }); // Less than 3 characters

      await waitFor(
        () => {
          expect(mockElectron.database.predictDuration).not.toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Tag Analytics', () => {
    it('should show tag analytics when tag is typed', async () => {
      (DatabaseService.getTagByName as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'backend',
      });
      (DatabaseService.getTagAnalytics as jest.Mock).mockResolvedValue({
        ema: 7200000, // 2 hours in ms
        std_dev: 1800000, // 0.5 hours in ms
        completed_count: 5,
      });

      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'Fix issue #backend' } });

      await waitFor(
        () => {
          expect(
            screen.getByText(/Avg time for #backend: ~2.0h/),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it('should show message when tag has no analytics', async () => {
      (DatabaseService.getTagByName as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'newtag',
      });
      (DatabaseService.getTagAnalytics as jest.Mock).mockResolvedValue({
        ema: 0,
        std_dev: 0,
        completed_count: 0,
      });

      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'New task #newtag' } });

      await waitFor(
        () => {
          expect(
            screen.getByText(/No analytics for #newtag yet/),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Task Creation Flow', () => {
    it('should create task and navigate to it on success', async () => {
      const createdTask = { id: 456, title: 'New Task' };
      mockCreateTask.mockResolvedValue(createdTask);

      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'New Task' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/task/456');
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle task creation error gracefully', async () => {
      mockCreateTask.mockRejectedValue(new Error('Creation failed'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      renderComponent();

      const input = screen.getByPlaceholderText(/Add task:/);
      fireEvent.change(input, { target: { value: 'Failed Task' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Failed to quick-add task',
          expect.any(Error),
        );
      });

      jest.restoreAllMocks();
    });
  });
});
