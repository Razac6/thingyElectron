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
import Sprints from './Sprints';

import { createSprint } from '../../services/SprintService';

// Mock DataGrid
jest.mock('@mui/x-data-grid', () => ({
  DataGrid: (props: any) => (
    <div data-testid="data-grid">
      {props.rows.map((row: any) => (
        <div key={row.id} onClick={() => props.onRowClick({ id: row.id })}>
          {row.name}
        </div>
      ))}
    </div>
  ),
}));

// Mock DayPicker
jest.mock('react-day-picker', () => ({
  DayPicker: () => <div data-testid="day-picker-mock" />,
}));

// Mock SprintService
jest.mock('../../services/SprintService', () => ({
  getSprints: jest.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Sprint 1',
      startDate: '2023-01-01',
      endDate: '2023-01-14',
      status: 'ACTIVE',
      capacity: 80,
    },
  ]),
  createSprint: jest.fn().mockResolvedValue({}),
  updateSprintStatus: jest.fn().mockResolvedValue({}),
  updateSprint: jest.fn().mockResolvedValue({}),
}));

// Mock Contexts
jest.mock('../../context/TimerContext', () => ({
  useTimer: () => ({ tasks: [] }),
}));

jest.mock('../../context/GamificationContext', () => ({
  useGamification: () => ({
    checkForAchievements: jest.fn().mockResolvedValue(false),
    triggerRewardAnimation: jest.fn(),
  }),
}));

describe('Sprints Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the sprints list', async () => {
    render(
      <MemoryRouter>
        <Sprints />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    });
  });

  it('should open the plan new sprint dialog', async () => {
    render(
      <MemoryRouter>
        <Sprints />
      </MemoryRouter>,
    );

    const speedDial = screen.getByLabelText('Sprint Actions');
    fireEvent.click(speedDial);

    const addAction = await screen.findByLabelText('Create New Sprint');
    fireEvent.click(addAction);

    expect(screen.getByText('Plan New Sprint')).toBeInTheDocument();
  });

  it('should call createSprint when saving a new sprint', async () => {
    render(
      <MemoryRouter>
        <Sprints />
      </MemoryRouter>,
    );

    // Open dialog
    const speedDial = screen.getByLabelText('Sprint Actions');
    fireEvent.click(speedDial);
    const addAction = await screen.findByLabelText('Create New Sprint');
    fireEvent.click(addAction);

    // Fill name
    const nameInput = screen.getByLabelText('Sprint Name');
    fireEvent.change(nameInput, { target: { value: 'New Sprint' } });

    // Set dates (Start Date is already set to today)
    const endDateInput = screen.getByLabelText('End Date');
    fireEvent.change(endDateInput, { target: { value: '2023-12-31' } });

    // Click Confirm
    const confirmButton = screen.getByText('Confirm Plan');
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(createSprint).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Sprint',
        capacity: expect.any(Number),
      }),
    );
  });
});
