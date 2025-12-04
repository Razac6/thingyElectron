import { Task } from "./task.interface";

export interface SessionInterface{
  id: string,
  date: string,
  tasksIdCompleted: string[],
  timeSpend: string
}
