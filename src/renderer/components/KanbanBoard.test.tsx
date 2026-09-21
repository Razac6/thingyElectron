import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KanbanBoard } from './KanbanBoard';
import { Task } from '../../interfaces/task.interface';
import { StatusEnum } from '../../enums/status.enum';
import { PriorityEnum } from '../../enums/priority.enum';
import { TaskTypeEnum } from '../../enums/task-type.enum';

describe('KanbanBoard', () => {
  const mockOnStatusChange = jest.fn();
  const mockOnTaskClick = jest.fn();
  const mockOnStartTimer = jest.fn();
  const mockOnStopTimer = jest.fn();

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 1,
    title: 'Test Task',
    description: '',
    status: StatusEnum.TO_DO,
    updateStatusDate: '2024-01-01',
    estimate: 2,
    priority: PriorityEnum.MEDIUM,
    link: '',
    createdAt: '2024-01-01',
    spendTime: 0,
    startTimer: null,
    type: TaskTypeEnum.TASK,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all four kanban columns', () => {
      render(
        <KanbanBoard
          tasks={[]}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      expect(screen.getByText(/To Do/)).toBeInTheDocument();
      expect(screen.getByText(/In Progress/)).toBeInTheDocument();
      expect(screen.getByText(/In Review/)).toBeInTheDocument();
      expect(screen.getByText(/Completed/)).toBeInTheDocument();
    });

    it('should show task count for each column', () => {
      const tasks = [
        createMockTask({ id: 1, status: StatusEnum.TO_DO }),
        createMockTask({ id: 2, status: StatusEnum.TO_DO }),
        createMockTask({ id: 3, status: StatusEnum.IN_PROGRESS }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      expect(screen.getByText(/To Do \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/In Progress \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/In Review \(0\)/)).toBeInTheDocument();
      expect(screen.getByText(/Completed \(0\)/)).toBeInTheDocument();
    });

    it('should render tasks in correct columns', () => {
      const tasks = [
        createMockTask({ id: 1, title: 'Todo Task', status: StatusEnum.TO_DO }),
        createMockTask({
          id: 2,
          title: 'In Progress Task',
          status: StatusEnum.IN_PROGRESS,
        }),
        createMockTask({
          id: 3,
          title: 'Review Task',
          status: StatusEnum.IN_REVIEW,
        }),
        createMockTask({
          id: 4,
          title: 'Done Task',
          status: StatusEnum.COMPLETED,
        }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      expect(screen.getByText('Todo Task')).toBeInTheDocument();
      expect(screen.getByText('In Progress Task')).toBeInTheDocument();
      expect(screen.getByText('Review Task')).toBeInTheDocument();
      expect(screen.getByText('Done Task')).toBeInTheDocument();
    });

    it('should display task estimate', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task',
          estimate: 3,
          status: StatusEnum.TO_DO,
        }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      expect(screen.getByText('3h')).toBeInTheDocument();
    });

    it('should display task type chip when type is present', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task',
          type: TaskTypeEnum.BUG,
          status: StatusEnum.TO_DO,
        }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      expect(screen.getByText(TaskTypeEnum.BUG)).toBeInTheDocument();
    });

    it('should sort tasks by displayOrder within each column', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task C',
          status: StatusEnum.TO_DO,
          displayOrder: 3,
        }),
        createMockTask({
          id: 2,
          title: 'Task A',
          status: StatusEnum.TO_DO,
          displayOrder: 1,
        }),
        createMockTask({
          id: 3,
          title: 'Task B',
          status: StatusEnum.TO_DO,
          displayOrder: 2,
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const taskElements = container.querySelectorAll('.MuiCard-root');
      const taskTitles = Array.from(taskElements).map(
        (el) => el.querySelector('.MuiTypography-body2')?.textContent,
      );

      expect(taskTitles).toEqual(['Task A', 'Task B', 'Task C']);
    });
  });

  describe('Task Click', () => {
    it('should call onTaskClick when task is clicked', () => {
      const tasks = [
        createMockTask({
          id: 123,
          title: 'Clickable Task',
          status: StatusEnum.TO_DO,
        }),
      ];

      render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const task = screen.getByText('Clickable Task');
      fireEvent.click(task);

      expect(mockOnTaskClick).toHaveBeenCalledWith(123);
    });
  });

  describe('Timer Controls', () => {
    it('should show start button when timer is not running', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task',
          status: StatusEnum.TO_DO,
          startTimer: null,
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      // PlayCircleOutlineIcon should be present
      const playButton = container.querySelector(
        '[data-testid="PlayCircleOutlineIcon"]',
      );
      expect(playButton?.parentElement).toBeInTheDocument();
    });

    it('should show stop button when timer is running', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task',
          status: StatusEnum.IN_PROGRESS,
          startTimer: '2024-01-01T10:00:00',
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning
        />,
      );

      // PauseCircleOutlineIcon should be present
      const pauseButton = container.querySelector(
        '[data-testid="PauseCircleOutlineIcon"]',
      );
      expect(pauseButton?.parentElement).toBeInTheDocument();
    });

    it('should call onStartTimer when start button is clicked', () => {
      const tasks = [
        createMockTask({
          id: 456,
          title: 'Task',
          status: StatusEnum.TO_DO,
          startTimer: null,
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const playButton = container.querySelector(
        '[data-testid="PlayCircleOutlineIcon"]',
      )?.parentElement;
      if (playButton) {
        fireEvent.click(playButton);
      }

      expect(mockOnStartTimer).toHaveBeenCalledWith(456);
      expect(mockOnTaskClick).not.toHaveBeenCalled(); // Should not trigger task click
    });

    it('should call onStopTimer when stop button is clicked', () => {
      const tasks = [
        createMockTask({
          id: 789,
          title: 'Task',
          status: StatusEnum.IN_PROGRESS,
          startTimer: '2024-01-01T10:00:00',
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning
        />,
      );

      const pauseButton = container.querySelector(
        '[data-testid="PauseCircleOutlineIcon"]',
      )?.parentElement;
      if (pauseButton) {
        fireEvent.click(pauseButton);
      }

      expect(mockOnStopTimer).toHaveBeenCalledWith(789);
      expect(mockOnTaskClick).not.toHaveBeenCalled(); // Should not trigger task click
    });

    it('should disable start button when another timer is running', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task',
          status: StatusEnum.TO_DO,
          startTimer: null,
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning // Another timer is running
        />,
      );

      const playButton = container.querySelector(
        '[data-testid="PlayCircleOutlineIcon"]',
      )?.parentElement;
      expect(playButton).toBeDisabled();
    });

    it('should disable start button when task is completed', () => {
      const tasks = [
        createMockTask({
          id: 1,
          title: 'Task',
          status: StatusEnum.COMPLETED,
          startTimer: null,
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const playButton = container.querySelector(
        '[data-testid="PlayCircleOutlineIcon"]',
      )?.parentElement;
      expect(playButton).toBeDisabled();
    });
  });

  describe('Drag and Drop', () => {
    it('should set taskId in dataTransfer on drag start', () => {
      const tasks = [
        createMockTask({
          id: 999,
          title: 'Draggable Task',
          status: StatusEnum.TO_DO,
        }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeDefined();

      const dataTransfer = {
        setData: jest.fn(),
        getData: jest.fn(),
      };

      if (card) {
        fireEvent.dragStart(card, { dataTransfer });
      }

      expect(dataTransfer.setData).toHaveBeenCalledWith('taskId', '999');
    });

    it('should handle drag start correctly', () => {
      const tasks = [
        createMockTask({ id: 111, title: 'Task', status: StatusEnum.TO_DO }),
      ];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const card = container.querySelector('.MuiCard-root');

      // Verify card is draggable
      expect(card).toHaveAttribute('draggable', 'true');
    });

    it('should render drop zones for all columns', () => {
      const task = createMockTask({
        id: 111,
        title: 'Task',
        status: StatusEnum.TO_DO,
      });
      const tasks = [task];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      // Verify all 4 columns exist (drop zones)
      const columns = container.querySelectorAll('div[class*="MuiBox"]');

      // Find columns by their labels
      const todoColumn = Array.from(columns).find((col) =>
        col.textContent?.includes('To Do'),
      );
      const inProgressColumn = Array.from(columns).find((col) =>
        col.textContent?.includes('In Progress'),
      );
      const inReviewColumn = Array.from(columns).find((col) =>
        col.textContent?.includes('In Review'),
      );
      const completedColumn = Array.from(columns).find((col) =>
        col.textContent?.includes('Completed'),
      );

      expect(todoColumn).toBeDefined();
      expect(inProgressColumn).toBeDefined();
      expect(inReviewColumn).toBeDefined();
      expect(completedColumn).toBeDefined();
    });

    it('should not call onStatusChange when dropped in same column', () => {
      const task = createMockTask({
        id: 222,
        title: 'Task',
        status: StatusEnum.TO_DO,
      });
      const tasks = [task];

      const { container } = render(
        <KanbanBoard
          tasks={tasks}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      const columns = container.querySelectorAll('div[class*="MuiBox"]');
      const todoColumn = Array.from(columns).find((col) =>
        col.textContent?.includes('To Do (1)'),
      );

      if (todoColumn) {
        const dropEvent = new Event('drop', { bubbles: true });
        Object.defineProperty(dropEvent, 'dataTransfer', {
          value: { getData: () => '222' },
          writable: false,
        });
        todoColumn.dispatchEvent(dropEvent);
      }

      // Should not call onStatusChange because task is already in TO_DO
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should render empty columns when no tasks', () => {
      render(
        <KanbanBoard
          tasks={[]}
          onStatusChange={mockOnStatusChange}
          onTaskClick={mockOnTaskClick}
          onStartTimer={mockOnStartTimer}
          onStopTimer={mockOnStopTimer}
          anyTimerRunning={false}
        />,
      );

      expect(screen.getByText(/To Do \(0\)/)).toBeInTheDocument();
      expect(screen.getByText(/In Progress \(0\)/)).toBeInTheDocument();
      expect(screen.getByText(/In Review \(0\)/)).toBeInTheDocument();
      expect(screen.getByText(/Completed \(0\)/)).toBeInTheDocument();
    });
  });
});
