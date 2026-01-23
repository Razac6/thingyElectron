import { TaskTypeEnum } from "../enums/task-type.enum";

export interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  updateStatusDate: string
  estimate: number | string;
  priority: string;
  link: string;
  createdAt: string;
  spendTime: number;
  startTimer: string | null;
  timerMode?: 'normal' | 'pomodoro';
  type: TaskTypeEnum;
  storyPoints?: number;
  subtasks?: string; // JSON string of Subtask[]
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}
