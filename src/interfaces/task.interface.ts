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
  type: TaskTypeEnum
}
