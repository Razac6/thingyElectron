export type SprintStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

export interface SprintInterface {
  id: number;
  name: string;
  startDate: string; // ISO String
  endDate: string;   // ISO String
  status: SprintStatus;
  tasksId?: string[];
  capacity?: number;       // Total available man-hours
  excludedDates?: string[]; // ISO strings of days that are non-working (holidays, etc)
}