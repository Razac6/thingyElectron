import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SprintDetail from './SprintDetail';

// Mock TimerContext
const mockTasks = [
  { id: 1, title: 'Sprint Task', status: 'To Do', estimate: 5, sprintId: 1 },
  {
    id: 2,
    title: 'Backlog Task',
    status: 'To Do',
    estimate: 10,
    sprintId: null,
  },
];

const mockUpdateTask = jest.fn();

const mockTimerContext = {
  tasks: mockTasks,
  updateTask: mockUpdateTask,
};

jest.mock('../../context/TimerContext', () => ({
  useTimer: () => mockTimerContext,
}));

// Mock SprintService
jest.mock('../../services/SprintService', () => ({
  getSprints: jest.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Active Sprint',
      startDate: '2023-01-01',
      endDate: '2023-01-14',
      status: 'ACTIVE',
      capacity: 40,
    },
  ]),
}));

// Mock window.electron
beforeAll(() => {
  (global as any).window.electron = {
    database: {
      getAverageSprintCapacity: jest.fn().mockResolvedValue(30),
      getSprintAnalysis: jest
        .fn()
        .mockResolvedValue({ risk: 'Stable', message: 'OK' }),
    },
  };
});

const renderComponent = (sprintId = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/sprints/${sprintId}`]}>
      <Routes>
        <Route path="/sprints/:sprintId" element={<SprintDetail />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('SprintDetail Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock tasks to default
    mockTimerContext.tasks = [...mockTasks];
  });

  it('should render sprint details and tasks', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Active Sprint')).toBeInTheDocument();
      expect(screen.getByText('Sprint Task')).toBeInTheDocument();
      // Use getAllByText for '5h' since it appears in multiple places (backlog and total)
      expect(screen.getAllByText(/5h/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/\/ 40h/)).toBeInTheDocument();
    });
  });

  it('should open task picker and add task to sprint', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('Add Task')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Add Task'));

    await waitFor(() => {
      expect(screen.getByText('Backlog Task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Backlog Task'));

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        sprintId: 1,
      }),
    );
  });

  it('should show velocity warning when current load exceeds average', async () => {
    // Set heavy tasks for this test
    mockTimerContext.tasks = [
      {
        id: 1,
        title: 'Heavy Task',
        status: 'To Do',
        estimate: 35,
        sprintId: 1,
      },
    ];

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/more than usual/)).toBeInTheDocument();
    });
  });

  it('should remove task from sprint', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('Sprint Task')).toBeInTheDocument(),
    );

    const removeButton = screen
      .getByTestId('RemoveCircleOutlineIcon')
      .closest('button');
    fireEvent.click(removeButton!);

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        sprintId: null,
      }),
    );
  });
});
