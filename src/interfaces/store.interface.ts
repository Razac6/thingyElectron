import { Task } from "./task.interface";
import { UserInterface } from "./user.interface";
import { SprintInterface } from "./sprint.interface";
import { SessionInterface } from "./session.interface";

export interface StoreInterface{
  tasks: Task[],
  user: UserInterface,
  sprints: SprintInterface[],
  session: SessionInterface
}
