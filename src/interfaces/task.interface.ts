import { TaskTypeEnum } from '../enums/task-type.enum';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  updateStatusDate: string;
  estimate: number;
  priority: string;
  link: string;
  createdAt: string;
  spendTime: number;
  startTimer: string | null;
  timerMode?: 'normal' | 'pomodoro';
  type: TaskTypeEnum;
  storyPoints?: number;
  subtasks?: string; // JSON string of Subtask[]
  sprintId?: number | null;
  tags?: string[];
  displayOrder?: number;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}
