import { Task } from '../../interfaces/task.interface';
import { getTagByName, getTagAnalytics } from './DatabaseService';

interface TagAnalytics {
  ema: number;
  std_dev: number;
  completed_count: number;
}

export const analyzeSprintOptimism = async (tasks: Task[]): Promise<string | null> => {
  if (!tasks || tasks.length === 0) return null;

  // 1. Identify all unique tags in the current task list to avoid duplicate DB calls
  const allTags = new Set<string>();
  tasks.forEach(task => {
    if (task.tags && Array.isArray(task.tags)) {
      task.tags.forEach(tag => allTags.add(tag));
    }
  });

  if (allTags.size === 0) return null;

  // 2. Fetch analytics for all tags in parallel
  const tagAnalyticsMap = new Map<string, TagAnalytics>();
  
  const analyticsPromises = Array.from(allTags).map(async (tagName) => {
    try {
      const tag: any = await getTagByName(tagName);
      if (tag && tag.id) {
        const analytics: any = await getTagAnalytics(tag.id);
        if (analytics && analytics.completed_count > 2) { // Require at least 3 data points for statistical relevance
          return { tagName, analytics };
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch analytics for tag ${tagName}`, e);
    }
    return null;
  });

  const results = await Promise.all(analyticsPromises);
  
  results.forEach(result => {
    if (result) {
      tagAnalyticsMap.set(result.tagName, result.analytics);
    }
  });

  // 3. Calculate averages
  let totalEstimate = 0;
  let totalHistoricalEma = 0;
  let tasksWithAnalytics = 0;

  for (const task of tasks) {
    if (!task.tags || task.tags.length === 0) continue;

    let taskEmaSum = 0;
    let validTagsCount = 0;

    for (const tagName of task.tags) {
      const analytics = tagAnalyticsMap.get(tagName);
      if (analytics) {
        taskEmaSum += analytics.ema;
        validTagsCount++;
      }
    }

    if (validTagsCount > 0) {
      // Average EMA of the tags assigned to this task
      // (e.g. if task has #backend (2h avg) and #api (1h avg), expected is 1.5h)
      // Note: This is a simplification. In reality, tags might be additive, but averaging is a safe baseline for now.
      const averageTaskEma = taskEmaSum / validTagsCount;
      
      // EMA is usually in ms (from database), estimate is in hours (from UI) or minutes depending on storage
      // Assuming EMA is in ms (duration) and Task.estimate is in Hours (standard for this app)
      const historicalHours = averageTaskEma / (1000 * 60 * 60);

      totalEstimate += task.estimate || 0;
      totalHistoricalEma += historicalHours;
      tasksWithAnalytics++;
    }
  }

  if (tasksWithAnalytics === 0) {
    return null; 
  }

  const averageEstimate = totalEstimate / tasksWithAnalytics;
  const averageHistorical = totalHistoricalEma / tasksWithAnalytics;

  // 4. Analysis Logic
  // If estimate is significantly lower than historical data
  const threshold = 0.75; // 25% buffer
  
  if (averageEstimate < averageHistorical * threshold) {
    const percentage = Math.round((1 - averageEstimate / averageHistorical) * 100);
    return `Optimism Warning: Estimates are ~${percentage}% lower than historical average for these task types (${averageEstimate.toFixed(1)}h vs ${averageHistorical.toFixed(1)}h).`;
  }

  return null;
};