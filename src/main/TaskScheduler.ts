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
      
      // 1. Momentum (Highest Priority usually)
      if (task.status === 'In Progress') {
          reasons.push("🚀 Momentum (Context Switching Prevention)");
      }

      // 2. Sprint Pressure
      if (endDate) {
          const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 1) reasons.push("🚨 Sprint Critical Path");
          else if (daysLeft <= 3) reasons.push("⏳ Sprint Risk Mitigation");
      }

      // 3. WSJF Factors
      if (task.priority === 'High') reasons.push("🔥 High Cost of Delay (WSJF)");
      
      // 4. Neural Factors
      if (neuralEstimateHours < 0.5) reasons.push("⚡ Quick Win (Neural Core)");
      else if (neuralEstimateHours < (task.estimate || 0)) reasons.push("📉 Efficiency Opportunity");

      // Fallback
      const reason = reasons.length > 0 
        ? reasons.slice(0, 2).join(' + ') // Limit to top 2 reasons
        : 'Algorytm optymalizacji przepływu (Flow Optimizer)';

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
