import { getTasks, getSprints, updateTasksOrder } from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';
import { neuralCore } from './NeuralCore';

export const getProposedSchedule = (userId: number) => {
  // 1. Fetch data
  const allTasks = getTasks(userId, true); 
  console.log(`[TaskScheduler] Fetched ${allTasks.length} total tasks for User ${userId}`);
  
  // DEBUG: Check what statuses we actually have
  const uniqueStatuses = [...new Set(allTasks.map((t: any) => t.status))];
  console.log('[TaskScheduler] Unique statuses in DB:', uniqueStatuses);

  const sprints = getSprints();
  const sprintMap = new Map<number, string>();
  sprints.forEach((s: any) => sprintMap.set(s.id, s.endDate));

  // 2. Analysis
  const difficultyProfile = ProductivityAnalyst.analyzeTagDifficulty(allTasks);

  // 3. Filter actionable tasks (Blocklist approach for robustness)
  const completedStatuses = ['completed', 'done', 'finished', 'archived'];
  
  const actionableTasks = allTasks.filter((t: any) => {
      const status = (t.status || '').toLowerCase();
      // Include if NOT completed AND NOT meeting
      return !completedStatuses.includes(status) && t.type !== 'MEETING';
  });
  // console.log(`[TaskScheduler] Found ${actionableTasks.length} actionable tasks`);

  // 4. Scoring with Neural Core & Reasoning
  const scoredTasks = actionableTasks.map((task: any) => {
      const endDate = task.sprintId ? sprintMap.get(task.sprintId) : undefined;
      
      // AI Prediction
      const predictedMinutes = neuralCore.predict(task);
      const neuralEstimateHours = predictedMinutes / 60;

      const score = ProductivityAnalyst.calculateTaskScore(task, difficultyProfile, endDate, neuralEstimateHours);
      
      // Generate Reasoning
      let reasons = [];
      if (task.priority === 'High') reasons.push("🔥 Priorytet");
      if (endDate) {
          const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 2) reasons.push("⏳ Koniec Sprintu");
      }
      if (neuralEstimateHours < 1) reasons.push("⚡ Szybkie (wg AI)");
      else if (neuralEstimateHours < (task.estimate || 0)) reasons.push("📉 Łatwiejsze niż estymata");

      const reason = reasons.length > 0 ? reasons.join(' + ') : 'Optymalizacja kolejki';

      return { ...task, score, aiReason: reason, neuralEstimate: neuralEstimateHours };
  });

  // 5. Sorting (High score first)
  scoredTasks.sort((a: any, b: any) => b.score - a.score);

  return scoredTasks;
};

export const autoScheduleTasks = (userId: number) => {
  const sortedTasks = getProposedSchedule(userId);
  const ids = sortedTasks.map((t: any) => t.id);
  updateTasksOrder(ids);
  console.log(`[TaskScheduler] Auto-scheduled ${ids.length} tasks for user ${userId}.`);
  return sortedTasks;
};
