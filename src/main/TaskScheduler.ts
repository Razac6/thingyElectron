import { getTasks, getSprints, updateTasksOrder } from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';
import { neuralCore } from './NeuralCore';

export const autoScheduleTasks = (userId: number) => {
  // 1. Fetch data
  const allTasks = getTasks(userId, true); 
  const sprints = getSprints();
  const sprintMap = new Map<number, string>();
  sprints.forEach((s: any) => sprintMap.set(s.id, s.endDate));

  // 2. Analysis
  const difficultyProfile = ProductivityAnalyst.analyzeTagDifficulty(allTasks);

  // 3. Filter actionable tasks (Only To Do and In Progress)
  const actionableTasks = allTasks.filter((t: any) => 
      (t.status === 'To Do' || t.status === 'In Progress') && 
      t.type !== 'MEETING'
  );

  // 4. Scoring with Neural Core
  const scoredTasks = actionableTasks.map((task: any) => {
      const endDate = task.sprintId ? sprintMap.get(task.sprintId) : undefined;
      
      // AI Prediction
      const predictedMinutes = neuralCore.predict(task);
      const neuralEstimateHours = predictedMinutes / 60;

      const score = ProductivityAnalyst.calculateTaskScore(task, difficultyProfile, endDate, neuralEstimateHours);
      return { ...task, score };
  });

  // 5. Sorting (High score first)
  scoredTasks.sort((a: any, b: any) => b.score - a.score);

  // 6. Update DB
  const ids = scoredTasks.map((t: any) => t.id);
  updateTasksOrder(ids);

  console.log(`[TaskScheduler] Auto-scheduled ${ids.length} tasks for user ${userId} using Neural Core predictions.`);
  return scoredTasks;
};
