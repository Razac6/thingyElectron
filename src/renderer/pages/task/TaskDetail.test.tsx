import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetail from './TaskDetail';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { TaskTypeEnum } from '../../../enums/task-type.enum';

// Mock Chart.js to avoid issues in JSDOM
jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="chart-mock" />,
}));

// Mock TimerContext
const mockTask = {
  id: 1,
  title: 'Test Task',
  description: 'Test Description',
  status: StatusEnum.TO_DO,
  priority: PriorityEnum.HIGH,
  type: TaskTypeEnum.TASK,
  estimate: 2,
  spendTime: 0,
  tags: ['tag1'],
  link: 'https://example.com',
};

const mockTasks = [mockTask];
const mockUpdateTask = jest.fn();
const mockStartTimer = jest.fn();
const mockStopTimer = jest.fn();

const mockTimerContext = {
  tasks: mockTasks,
  updateTask: mockUpdateTask,
  startTimer: mockStartTimer,
  stopTimer: mockStopTimer,
};

jest.mock('../../context/TimerContext', () => ({
  useTimer: () => mockTimerContext,
}));

// Mock Contexts
jest.mock('../../context/GamificationContext', () => ({
  useGamification: () => ({
    addXp: jest.fn(),
    checkForAchievements: jest.fn(),
    triggerRewardAnimation: jest.fn(),
  }),
}));

jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { complexityThreshold: '8' },
  }),
}));

// Mock Services
jest.mock('../../services/SprintService', () => ({
  getSprints: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/DatabaseService', () => ({
  getAllTags: jest.fn().mockResolvedValue(['tag1', 'tag2']),
  getChecklistItems: jest
    .fn()
    .mockResolvedValue([{ id: 1, text: 'Check item 1', isCompleted: 0 }]),
  addChecklistItem: jest.fn().mockResolvedValue([
    { id: 1, text: 'Check item 1', isCompleted: 0 },
    { id: 2, text: 'New item', isCompleted: 0 },
  ]),
  toggleChecklistItem: jest.fn(),
  deleteChecklistItem: jest.fn(),
}));

// Mock window.electron
beforeAll(() => {
  (global as any).window.electron = {
    database: {
      getTasks: jest.fn().mockResolvedValue([mockTask]),
      getTaskWorkSessions: jest.fn().mockResolvedValue([]),
      getAverageTimeForTaskType: jest.fn().mockResolvedValue(60),
      suggestBestTimeForTask: jest
        .fn()
        .mockResolvedValue({ icon: '📅', text: 'Anytime', color: 'default' }),
    },
    shell: {
      openExternal: jest.fn(),
    },
  };
});

const renderComponent = (taskId = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/task/${taskId}`]}>
      <Routes>
        <Route path="/task/:taskId" element={<TaskDetail />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('TaskDetail Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render task details', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('Check item 1')).toBeInTheDocument();
    });
  });

  it('should enter edit mode and save changes', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('Test Task')).toBeInTheDocument(),
    );

    // Click Edit icon
    const editButton = screen.getByTestId('EditIcon').parentElement;
    fireEvent.click(editButton!);

    // Change title
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Task Title' } });

    // Save
    const saveButton = screen.getByText('Save Changes');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated Task Title',
      }),
    );
  });

  it('should add a checklist item', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('Check item 1')).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText('Add sub-task or step...');
    fireEvent.change(input, { target: { value: 'New item' } });

    const addButton = screen.getByText('Add');
    await act(async () => {
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(screen.getByText('New item')).toBeInTheDocument();
    });
  });

  it('should start timer when button clicked', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('Start Timer')).toBeInTheDocument(),
    );

    const startButton = screen.getByText('Start Timer');
    fireEvent.click(startButton);

    expect(mockStartTimer).toHaveBeenCalledWith(1);
  });

  it('should open external link', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('Open Link')).toBeInTheDocument(),
    );

    const linkButton = screen.getByText('Open Link');
    fireEvent.click(linkButton);

    expect(window.electron.shell.openExternal).toHaveBeenCalledWith(
      'https://example.com',
    );
  });
});
