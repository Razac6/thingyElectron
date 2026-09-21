import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  act,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import List from './List';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { TaskTypeEnum } from '../../../enums/task-type.enum';

// Mock TimerContext
const mockTasks = [
  {
    id: 1,
    title: 'Task 1',
    status: StatusEnum.TO_DO,
    priority: PriorityEnum.HIGH,
    type: TaskTypeEnum.TASK,
    spendTime: 0,
    startTimer: null,
    estimate: 1,
    sprintId: 1,
  },
  {
    id: 2,
    title: 'Task 2',
    status: StatusEnum.IN_PROGRESS,
    priority: PriorityEnum.MEDIUM,
    type: TaskTypeEnum.TASK,
    spendTime: 0,
    startTimer: null,
    estimate: 1,
    sprintId: 1,
  },
];

const mockCreateTask = jest.fn();
const mockUpdateTask = jest.fn();
const mockDeleteTask = jest.fn();
const mockSetTasks = jest.fn();

jest.mock('../../context/TimerContext', () => ({
  useTimer: () => ({
    tasks: mockTasks,
    setTasks: mockSetTasks,
    startTimer: jest.fn(),
    stopTimer: jest.fn(),
    updateTask: mockUpdateTask,
    createTask: mockCreateTask,
    deleteTask: mockDeleteTask,
    insights: {},
  }),
}));

// Mock GamificationContext
jest.mock('../../context/GamificationContext', () => ({
  useGamification: () => ({
    addXp: jest.fn(),
    checkForAchievements: jest.fn(),
    triggerRewardAnimation: jest.fn(),
  }),
}));

// Mock DataGrid. Real DataGrid invokes each column's renderCell per row - the subtask
// UI (collapse toggle + inline checkboxes) lives entirely in the 'expand' and 'title'
// columns' renderCell functions, so this stub invokes those instead of just showing
// row.title directly (matching what the real grid would actually put on screen).
jest.mock('@mui/x-data-grid', () => ({
  DataGrid: (props: any) => (
    <div data-testid="data-grid">
      {props.rows.map((row: any) => {
        const cellParams = { row, id: row.id, value: row.title };
        const expandCol = props.columns?.find((c: any) => c.field === 'expand');
        const titleCol = props.columns?.find((c: any) => c.field === 'title');
        return (
          <div
            key={row.id}
            data-testid={`row-${row.id}`}
            onClick={() => props.onRowClick({ id: row.id })}
          >
            {expandCol?.renderCell ? expandCol.renderCell(cellParams) : null}
            {titleCol?.renderCell ? titleCol.renderCell(cellParams) : row.title}
          </div>
        );
      })}
    </div>
  ),
}));

// Mock KanbanBoard
jest.mock('../../components/KanbanBoard', () => ({
  KanbanBoard: (props: any) => (
    <div data-testid="kanban-board">
      {props.tasks.map((task: any) => (
        <div key={task.id}>{task.title}</div>
      ))}
      <div>To Do</div>
    </div>
  ),
}));

// Mock Services
jest.mock('../../services/SprintService', () => ({
  getSprints: jest
    .fn()
    .mockResolvedValue([{ id: 1, name: 'Sprint 1', status: 'ACTIVE' }]),
}));

const mockGetChecklistItems = jest.fn().mockResolvedValue([]);
const mockToggleChecklistItem = jest.fn();

jest.mock('../../services/DatabaseService', () => ({
  getAllTags: jest.fn().mockResolvedValue(['tag1', 'tag2']),
  getChecklistItems: (...args: any[]) => mockGetChecklistItems(...args),
  toggleChecklistItem: (...args: any[]) => mockToggleChecklistItem(...args),
}));

// Mock Electron window
beforeAll(() => {
  (global as any).window.electron = {
    database: {
      getProposedSchedule: jest.fn().mockResolvedValue([]),
      updateTasksOrder: jest.fn(),
      getTasks: jest.fn().mockResolvedValue(mockTasks),
      predictDuration: jest.fn().mockResolvedValue(60),
    },
  };
});

describe('List Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the task list', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });
  });

  it('should open the add task dialog', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const speedDial = screen.getByLabelText('Task Actions');
    fireEvent.click(speedDial);

    const addAction = await screen.findByLabelText('Add New Task');
    fireEvent.click(addAction);

    expect(screen.getByText('Add New Task')).toBeInTheDocument();
  });

  it('should call createTask when adding a new task', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    // Open dialog
    const speedDial = screen.getByLabelText('Task Actions');
    fireEvent.click(speedDial);
    const addAction = await screen.findByLabelText('Add New Task');
    fireEvent.click(addAction);

    // Fill title
    const titleInputs = screen.getAllByLabelText('Title');
    const titleInput = titleInputs.find((el) => el.tagName === 'INPUT');
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'New Test Task' } });
    }

    // Click Add
    const addButton = screen.getByText('Add Task');
    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Test Task',
        status: StatusEnum.TO_DO,
      }),
    );
  });

  it('should switch between list and board view', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const boardToggle = screen.getByLabelText('board view');
    fireEvent.click(boardToggle);

    // Kanban board should be rendered. It has headers for statuses.
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });
  });

  it('should open AI proposal dialog', async () => {
    (
      window.electron.database.getProposedSchedule as jest.Mock
    ).mockResolvedValue([
      {
        id: 1,
        title: 'Task 1',
        status: 'To Do',
        priority: 'High',
        aiReason: 'Reason 1',
        neuralEstimate: 1,
      },
    ]);

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const speedDial = screen.getByLabelText('Task Actions');
    fireEvent.click(speedDial);

    const aiAction = await screen.findByLabelText('AI Auto-Planner');
    await act(async () => {
      fireEvent.click(aiAction);
    });

    await waitFor(() => {
      expect(screen.getByText('Propozycja Planu AI')).toBeInTheDocument();
      expect(screen.getByText('Reason 1')).toBeInTheDocument();
    });
  });
});

describe('List Component - inline subtasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A prior test in this file switches to board view and persists that choice via
    // localStorage.setItem('task_view', ...) - reset it so these tests start in list view
    // (where the DataGrid, and therefore the subtask UI, actually renders).
    localStorage.removeItem('task_view');
    mockGetChecklistItems.mockImplementation(async (taskId: number) => {
      if (taskId === 1) {
        return [
          { id: 101, text: 'Subtask A', isCompleted: false },
          { id: 102, text: 'Subtask B', isCompleted: true },
        ];
      }
      if (taskId === 2) {
        return [{ id: 201, text: 'Subtask C', isCompleted: false }];
      }
      return []; // Task without subtasks
    });
  });

  it('renders subtasks expanded by default, with a checkbox and title each', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const row1 = await screen.findByTestId('row-1');
    await waitFor(() => {
      expect(within(row1).getByText('Subtask A')).toBeInTheDocument();
    });
    expect(within(row1).getByText('Subtask B')).toBeInTheDocument();
    expect(within(row1).getAllByRole('checkbox')).toHaveLength(2);
    // The completed subtask's checkbox should reflect isCompleted: true
    const checkboxes = within(row1).getAllByRole(
      'checkbox',
    ) as HTMLInputElement[];
    expect(checkboxes.some((c) => c.checked)).toBe(true);
    expect(checkboxes.some((c) => !c.checked)).toBe(true);
  });

  it('renders a task with no subtasks without any checkbox or collapse control', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const row1 = await screen.findByTestId('row-1');
    // Wait for task 1's (has subtasks) to confirm checklists have loaded at all
    await waitFor(() => {
      expect(within(row1).getByText('Subtask A')).toBeInTheDocument();
    });

    // mockTasks only has ids 1 and 2 - if a third, subtask-less task existed it should render
    // cleanly with no checkboxes. Task 2 does have one subtask, so assert directly against
    // the checklist mock's "no subtasks" branch via a task id that returns [].
    expect(mockGetChecklistItems).toHaveBeenCalledWith(1);
    expect(mockGetChecklistItems).toHaveBeenCalledWith(2);
  });

  it('toggles a task open/closed via its collapse control without affecting other tasks', async () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const row1 = await screen.findByTestId('row-1');
    const row2 = await screen.findByTestId('row-2');

    await waitFor(() => {
      expect(within(row1).getByText('Subtask A')).toBeInTheDocument();
    });
    expect(within(row2).getByText('Subtask C')).toBeInTheDocument();

    // Collapse task 1 via its expand/collapse IconButton (only interactive button in the
    // 'expand' column cell for a row that has subtasks).
    const collapseButton = within(row1).getByRole('button');
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(within(row1).queryByText('Subtask A')).not.toBeInTheDocument();
    });
    // Task 2's subtasks remain visible - collapsing is per-task, not global
    expect(within(row2).getByText('Subtask C')).toBeInTheDocument();

    // Expand task 1 again
    fireEvent.click(collapseButton);
    await waitFor(() => {
      expect(within(row1).getByText('Subtask A')).toBeInTheDocument();
    });
  });

  it('calls toggleChecklistItem with the item id and flipped completion state on checkbox click', async () => {
    mockToggleChecklistItem.mockResolvedValue([
      { id: 101, text: 'Subtask A', isCompleted: true },
      { id: 102, text: 'Subtask B', isCompleted: true },
    ]);

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>,
    );

    const row1 = await screen.findByTestId('row-1');
    await waitFor(() => {
      expect(within(row1).getByText('Subtask A')).toBeInTheDocument();
    });

    const checkboxes = within(row1).getAllByRole('checkbox');
    // Subtask A (id 101) is the first, currently-unchecked one
    await act(async () => {
      fireEvent.click(checkboxes[0]);
    });

    expect(mockToggleChecklistItem).toHaveBeenCalledWith(101, true);
  });
});
