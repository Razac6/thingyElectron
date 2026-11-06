// Gamification rules in one place. The main process owns XP and achievements (the
// renderer only asks for them), so awards from anywhere - the UI, daily challenges,
// Pomodoro, meditation - add up instead of overwriting each other.
//
// Achievements are *derived from real data* (completed tasks, sessions, focus blocks...),
// not from "an event happened while the app was listening", so they're granted
// retroactively and can't be missed because of a code path that forgot to report.

export interface AchievementStats {
  completedTasks: number;
  completedBugs: number;
  sprints: number;
  longestSessionMin: number;
  focusBlocksAchieved: number;
  stepsCompleted: number;
  onTargetTasks: number; // finished within ±20% of the estimate
  bestHabitStreak: number;
  pomodoros: number;
  meditationDays: number;
  completedFeatures: number;
  sprintsCompleted: number;
  biggestChecklist: number; // most steps on one task
  workStreakDays: number; // consecutive days with tracked work
  bestDayMin: number; // most tracked minutes in one day
  questsCompleted: number; // daily challenges
  notes: number;
  water: number;
  stretchingSessions: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xp: number;
  group: 'Tasks' | 'Focus' | 'Planning' | 'Habits' | 'Wellbeing';
  target: number;
  progress: (s: AchievementStats) => number;
}

const def = (
  id: string,
  name: string,
  description: string,
  xp: number,
  group: AchievementDef['group'],
  target: number,
  progress: (s: AchievementStats) => number,
): AchievementDef => ({ id, name, description, xp, group, target, progress });

export const ACHIEVEMENTS: AchievementDef[] = [
  def(
    'FIRST_TASK',
    'First Step',
    'Complete your first task.',
    10,
    'Tasks',
    1,
    (s) => s.completedTasks,
  ),
  def(
    'FIVE_TASKS',
    'Apprentice',
    'Complete 5 tasks.',
    50,
    'Tasks',
    5,
    (s) => s.completedTasks,
  ),
  def(
    'TEN_TASKS',
    'Journeyman',
    'Complete 10 tasks.',
    100,
    'Tasks',
    10,
    (s) => s.completedTasks,
  ),
  def(
    'FIFTY_TASKS',
    'Craftsman',
    'Complete 50 tasks.',
    200,
    'Tasks',
    50,
    (s) => s.completedTasks,
  ),
  def(
    'HUNDRED_TASKS',
    'Master Builder',
    'Complete 100 tasks.',
    400,
    'Tasks',
    100,
    (s) => s.completedTasks,
  ),
  def(
    'BUG_SQUASHER',
    'Bug Squasher',
    'Fix your first bug.',
    20,
    'Tasks',
    1,
    (s) => s.completedBugs,
  ),
  def(
    'BUG_HUNTER',
    'Bug Hunter',
    'Fix 10 bugs.',
    100,
    'Tasks',
    10,
    (s) => s.completedBugs,
  ),
  def(
    'ON_TARGET',
    'Sharp Estimator',
    'Finish 5 tasks within 20% of their estimate.',
    75,
    'Tasks',
    5,
    (s) => s.onTargetTasks,
  ),
  def(
    'FEATURE_SHIPPER',
    'Feature Shipper',
    'Complete 10 feature tasks.',
    100,
    'Tasks',
    10,
    (s) => s.completedFeatures,
  ),
  def(
    'DIVIDE_CONQUER',
    'Divide and Conquer',
    'Break a task into 5 or more checklist steps.',
    20,
    'Tasks',
    5,
    (s) => s.biggestChecklist,
  ),
  def(
    'DEEP_DIVE',
    'Deep Dive',
    'Work for 2 hours in one uninterrupted session.',
    50,
    'Focus',
    120,
    (s) => s.longestSessionMin,
  ),
  def(
    'SOLID_DAY',
    'Solid Day',
    'Track 4 hours of focused work in one day.',
    40,
    'Focus',
    240,
    (s) => s.bestDayMin,
  ),
  def(
    'CONSISTENT',
    'Consistent',
    'Track work on 5 days in a row.',
    75,
    'Focus',
    5,
    (s) => s.workStreakDays,
  ),
  def(
    'FIRST_BLOCK',
    'In the Zone',
    'Hit the goal of a focus block.',
    20,
    'Focus',
    1,
    (s) => s.focusBlocksAchieved,
  ),
  def(
    'TEN_BLOCKS',
    'Locked In',
    'Hit the goal of 10 focus blocks.',
    100,
    'Focus',
    10,
    (s) => s.focusBlocksAchieved,
  ),
  def(
    'STEP_BY_STEP',
    'Step by Step',
    'Tick off 25 checklist steps.',
    75,
    'Focus',
    25,
    (s) => s.stepsCompleted,
  ),
  def(
    'POMODORO_MASTER',
    'Pomodoro Master',
    'Complete your first Pomodoro session.',
    30,
    'Focus',
    1,
    (s) => s.pomodoros,
  ),
  def(
    'THE_PLANNER',
    'The Planner',
    'Create your first sprint.',
    25,
    'Planning',
    1,
    (s) => s.sprints,
  ),
  def(
    'SPRINT_VETERAN',
    'Sprint Veteran',
    'Plan 5 sprints.',
    75,
    'Planning',
    5,
    (s) => s.sprints,
  ),
  def(
    'SPRINT_FINISHER',
    'Sprint Finisher',
    'Complete a sprint.',
    50,
    'Planning',
    1,
    (s) => s.sprintsCompleted,
  ),
  def(
    'QUEST_HUNTER',
    'Quest Hunter',
    'Complete 5 daily quests.',
    75,
    'Planning',
    5,
    (s) => s.questsCompleted,
  ),
  def(
    'KNOWLEDGE_KEEPER',
    'Knowledge Keeper',
    'Write 10 dev notes.',
    30,
    'Planning',
    10,
    (s) => s.notes,
  ),
  def(
    'HABIT_WEEK',
    'On a Roll',
    'Keep a habit going 7 days in a row.',
    50,
    'Habits',
    7,
    (s) => s.bestHabitStreak,
  ),
  def(
    'HABIT_MONTH',
    'Second Nature',
    'Keep a habit going 30 days in a row.',
    200,
    'Habits',
    30,
    (s) => s.bestHabitStreak,
  ),
  def(
    'ZEN_MASTER',
    'Zen Master',
    'Meditate on 5 different days.',
    40,
    'Wellbeing',
    5,
    (s) => s.meditationDays,
  ),
  def(
    'HYDRO_HOMIE',
    'Hydro Homie',
    'Log 10 glasses of water.',
    25,
    'Wellbeing',
    10,
    (s) => s.water,
  ),
  def(
    'FLEXIBLE',
    'Flexible',
    'Stretch on 5 different days.',
    30,
    'Wellbeing',
    5,
    (s) => s.stretchingSessions,
  ),
];

/** Achievements whose target is reached but that haven't been granted yet. */
export const newlyEarned = (stats: AchievementStats, earned: string[]) =>
  ACHIEVEMENTS.filter(
    (a) => !earned.includes(a.id) && a.progress(stats) >= a.target,
  );

/** Longest run of consecutive days with the habit done, from its log dates (YYYY-MM-DD). */
export const longestStreak = (dates: string[]) => {
  const days = [...new Set(dates)]
    .map((d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((t, i) => {
    run = i > 0 && t - days[i - 1] === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
};
