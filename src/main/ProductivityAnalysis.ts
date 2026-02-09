import { app } from 'electron';
import { getFocusContext } from './db';

// Interfaces
export interface WorkSession {
  startTime: string; // ISO String
  duration: number;  // Milliseconds
}

export interface AnalysisResult {
  peakHours: number[]; // Array of hours (0-23) sorted by productivity
  peakHourRange: string; // e.g., "10:00 - 14:00"
  fatigueProfile: {
    averageSession: number; // Minutes
    maxRecommended: number; // Minutes (Mean + 1.5 Sigma)
    isFatigued: boolean; // Calculated against a current session if provided
  };
  trend: {
    slope: number;
    direction: 'increasing' | 'decreasing' | 'stable';
    description: string;
  };
  focusScore: { score: number, deepWorkMinutes: number }; // Updated interface
  tagConsistency: {
    consistent: string[];
    volatile: string[];
  };
  tagDifficulty: Record<string, number>; // New: Tag Name -> Difficulty Multiplier (e.g. 1.5 = takes 50% longer than estimated)
  dailyTip?: string;
  dailyTipCategory?: 'high' | 'low' | 'neutral' | 'focus';
}

export interface ChallengeConfig {
  type: 'TOTAL_DURATION' | 'DEEP_WORK' | 'FOCUS_SCORE' | 'FROG_EATER' | 'BACKLOG_CLEANER' | 'POMODORO_MARATHON' | 'HYDRATION_HERO' | 'MINDFULNESS_MOMENT' | 'TASK_SPRINTER';
  target: number;
  description: string;
  xpReward: number;
}

export class ProductivityAnalyst {
  /**
   * Generates a Daily Challenge based on user's recent performance and Daily Mode.
   */
  static generateDailyChallenge(trend: AnalysisResult['trend'], fatigue: AnalysisResult['fatigueProfile'], dailyMode: string = 'normal'): ChallengeConfig {
    
    // 1. Recovery Mode -> Easy Wins or Consistency
    if (dailyMode === 'recovery') {
       return {
         type: 'TOTAL_DURATION',
         target: 45, // Just 45 mins
         description: 'Recovery Day: Log 45 minutes of work to keep the streak.',
         xpReward: 50
       };
    }

    // 2. Boost Mode -> High Impact
    if (dailyMode === 'boost') {
       // Randomize between Deep Work and Frog Eater
       return Math.random() > 0.5 ? {
         type: 'DEEP_WORK',
         target: 120, // 2h Deep Work
         description: 'Boost Mode: Accumulate 2 hours of Deep Work.',
         xpReward: 250
       } : {
         type: 'FROG_EATER',
         target: 1, // 1 High Priority Task
         description: 'Boost Mode: Eat the Frog! Complete 1 High Priority task.',
         xpReward: 300
       };
    }

    // 3. Normal Mode -> Context dependent
    
    // Scenario 1: Slump -> Backlog Cleaning (Momentum builder) or Task Sprinter
    if (trend.direction === 'decreasing') {
      return Math.random() > 0.5 ? {
        type: 'BACKLOG_CLEANER',
        target: 3, // 3 tasks
        description: 'Momentum Builder: Complete 3 tasks to get back on track.',
        xpReward: 100
      } : {
        type: 'TASK_SPRINTER',
        target: 3, // 3 quick tasks
        description: 'Task Sprinter: Complete 3 small tasks (estimate < 1h).',
        xpReward: 120
      };
    }

    // Scenario 2: Increasing/Stable -> Beast Mode (Challenge) or Health/Deep Focus
    if (trend.direction === 'increasing') {
      const hardTarget = Math.max(120, Math.round(fatigue.averageSession * 6));
      return {
        type: 'TOTAL_DURATION',
        target: hardTarget,
        description: `Beast Mode: Reach ${Math.floor(hardTarget / 60)}h ${hardTarget % 60}m of total work.`,
        xpReward: 200
      };
    }

    // Default: Random Mix of Focus and Health Challenges
    const rand = Math.random();
    if (rand < 0.25) {
        return {
            type: 'POMODORO_MARATHON',
            target: 4, // 4 pomodoros
            description: 'Pomodoro Marathon: Complete 4 Pomodoro sessions today.',
            xpReward: 150
        };
    } else if (rand < 0.4) {
        return {
            type: 'HYDRATION_HERO',
            target: 6, // 6 glasses
            description: 'Hydration Hero: Log 6 glasses of water today.',
            xpReward: 100
        };
    } else if (rand < 0.55) {
        return {
            type: 'MINDFULNESS_MOMENT',
            target: 10, // 10 minutes
            description: 'Mindful Day: Complete 10 minutes of meditation.',
            xpReward: 120
        };
    }

    // Default fallback
    return {
      type: 'DEEP_WORK',
      target: 60, // 1 hour of deep work
      description: 'Focus Challenge: Accumulate 60 minutes of Deep Work (sessions > 20m).',
      xpReward: 100
    };
  }

  static generateDailyTip(
    trend: AnalysisResult['trend'],
    fatigue: AnalysisResult['fatigueProfile'],
    dailyMode: string = 'normal',
    sleepScore: number = 75,
    meetingTime: number = 30
  ): string {
    // 0. Check Meeting Overload (Highest Priority)
    if (meetingTime > 180) return "⚠️ Meeting Overload (>3h). Your cognitive resources are drained. Stick to low-focus execution tasks today.";
    if (meetingTime > 90) return "Moderate meeting load today. Good for maintenance work, but deep focus might be fragmented.";

    // 1. Check Bio-Data
    if (sleepScore < 50) return "Low sleep detected. Your cognitive function might be reduced. Stick to administrative tasks and take frequent breaks.";
    if (sleepScore > 90) return "Great sleep score! Your brain is primed for learning and complex problem solving today.";

    // 2. Check Daily Mode
    if (dailyMode === 'recovery') return "You are in Recovery Mode. Be kind to yourself. Completing even one small task is a win today.";
    if (dailyMode === 'boost') return "Boost Mode Active! Tackle that one big task you've been avoiding. Momentum is on your side.";

    // 3. Check Trend
    if (trend.direction === 'decreasing') return "Your momentum is slowing down. Try a small 5-minute task to get back in the groove.";
    if (trend.direction === 'increasing') return "You are on a roll! Consistency is key. Try to maintain this pace without burning out.";

    // 4. Check Fatigue
    if (fatigue.maxRecommended < 30) return "Your recent sessions suggest quick fatigue. Try the Pomodoro technique (25m work / 5m break) to sustain focus.";

    // Default
    return "Productivity is not about doing more, but doing what matters. Check your priorities.";
  }

  /**
   * Algorithm 4: Focus Quality Score
   * Calculates the percentage of time spent in "Deep Work" sessions.
   * Deep Work is defined as a session lasting between 20 and 120 minutes.
   */
  static analyzeFocusQuality(sessions: WorkSession[]): { score: number, deepWorkMinutes: number } {
    if (sessions.length === 0) return { score: 0, deepWorkMinutes: 0 };

    let totalDuration = 0;
    let deepWorkDuration = 0;

    sessions.forEach(session => {
      const durationMinutes = session.duration / (1000 * 60);
      totalDuration += durationMinutes;

      // Deep Work Criteria 2.0:
      // 1. Duration: 20m - 120m
      // 2. Focus Context: > 75% score (low distractions)
      if (durationMinutes >= 20 && durationMinutes <= 120) {
          const endTime = new Date(session.startTime).getTime() + session.duration;
          const focusScore = getFocusContext(endTime); 

          if (focusScore > 0.75) {
              deepWorkDuration += durationMinutes;
          }
      }
    });

    if (totalDuration === 0) return { score: 0, deepWorkMinutes: 0 };

    return {
        score: Math.round((deepWorkDuration / totalDuration) * 100),
        deepWorkMinutes: Math.round(deepWorkDuration)
    };
  }

  /**
   * Algorithm 1: Weighted Frequency Distribution (Peak Hours)
   * Identifies "Golden Hours" by analyzing session start times and durations.
   * Recent sessions (last 7 days) are weighted x2.0 to reflect current biology.
   */
  static identifyPeakHours(sessions: WorkSession[]): { peakHours: number[], formattedRange: string } {
    const hours = new Array(24).fill(0);
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    sessions.forEach(session => {
      const date = new Date(session.startTime);
      // Determine local hour (0-23)
      const hour = date.getHours(); 
      
      // Weighting: 2.0 for last 7 days, 1.0 for older
      const weight = date >= sevenDaysAgo ? 2.0 : 1.0;
      
      // Add weighted duration (in minutes) to the bucket
      const durationMinutes = session.duration / (1000 * 60);
      hours[hour] += durationMinutes * weight;
    });

    // Create array of objects { hour, score }
    const scoredHours = hours.map((score, hour) => ({ hour, score }));
    
    // Sort descending by score
    scoredHours.sort((a, b) => b.score - a.score);

    // Get top 3 hours
    const topHours = scoredHours.slice(0, 3).map(h => h.hour);

    // Simple formatting logic (finding a contiguous block if possible)
    topHours.sort((a, b) => a - b);
    let range = "No data";
    if (topHours.length > 0) {
      // Simplistic range finder: e.g. if 10, 11, 12 -> "10:00 - 13:00"
      range = `${topHours[0]}:00 - ${topHours[topHours.length - 1] + 1}:00`;
    }

    return { peakHours: topHours, formattedRange: range };
  }

  /**
   * Algorithm 2: Z-Score & Ultradian Rhythms (Fatigue Analysis)
   * Calculates safe session limits using Mean + 1.5 Standard Deviation.
   * Hard limits at 90m (biological ultradian rhythm).
   */
  static analyzeFatigue(sessions: WorkSession[]): { averageSession: number, maxRecommended: number } {
    if (sessions.length < 5) {
      // Not enough data, return realistic default for devs
      return { averageSession: 45, maxRecommended: 60 };
    }

    // Convert to minutes
    const durations = sessions.map(s => s.duration / (1000 * 60));
    
    // Filter out micro-sessions (< 1 min) that might skew data (mistakes)
    const validDurations = durations.filter(d => d > 1);
    
    if (validDurations.length === 0) return { averageSession: 45, maxRecommended: 60 };

    // Calculate Mean (μ)
    const sum = validDurations.reduce((a, b) => a + b, 0);
    const mean = sum / validDurations.length;

    // Calculate Variance & StdDev (σ)
    const variance = validDurations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validDurations.length;
    const stdDev = Math.sqrt(variance);

    // Rule: Recommended Limit = Mean + 1.5 Sigma (covers ~87% of your typical productive sessions)
    // Capped at 90 minutes (biological limit)
    let maxRecommended = mean + (1.5 * stdDev);
    if (maxRecommended > 120) maxRecommended = 120; // Increased cap to 2h
    if (maxRecommended < 30) maxRecommended = 30; // Minimum viable session

    return {
      averageSession: Math.round(mean),
      maxRecommended: Math.round(maxRecommended)
    };
  }

  /**
   * Algorithm 3: Linear Regression (Trend Analysis)
   * Calculates the slope of productivity over the last 14 days.
   */
  static analyzeTrend(dailyTotals: { date: string, totalDuration: number }[]): { slope: number, direction: 'increasing' | 'decreasing' | 'stable', description: string } {
    if (dailyTotals.length < 3) {
      return { slope: 0, direction: 'stable', description: 'Not enough data for trend analysis' };
    }

    // Prepare data: X = day index (0, 1, 2...), Y = duration (minutes)
    // Ensure data is sorted by date
    const sortedData = [...dailyTotals].sort((a, b) => a.date.localeCompare(b.date));
    
    // Take last 14 entries max
    const recentData = sortedData.slice(-14);

    const n = recentData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    recentData.forEach((day, index) => {
      const x = index;
      const y = day.totalDuration / (1000 * 60); // minutes
      
      sumX += x;
      sumY += y;
      sumXY += (x * y);
      sumXX += (x * x);
    });

    // Slope formula (m)
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let description = 'Twoja produktywność jest stabilna.';

    // Interpretation thresholds
    if (slope > 2) {
      direction = 'increasing';
      description = 'Masz świetne momentum! Twoja produktywność rośnie z dnia na dzień.';
    } else if (slope < -2) {
      direction = 'decreasing';
      description = 'Wykryto spadek formy. Może potrzebujesz regeneracji?';
    }

    return { slope, direction, description };
  }

  /**
   * Algorithm 5: Tag Consistency Analysis
   * Uses Standard Deviation (from Welford's algorithm in DB) to identify consistent vs volatile tasks.
   * Low CV (Coefficient of Variation) = Consistent.
   * High CV = Volatile.
   */
  static analyzeTagConsistency(tagAnalytics: any[], tagsMap: Map<number, string>): { consistent: string[], volatile: string[] } {
    const consistent: string[] = [];
    const volatile: string[] = [];

    tagAnalytics.forEach(stat => {
      // Filter out tags with insufficient data
      if (stat.completed_count < 3 || stat.ema < (1000 * 60 * 5)) return; // Ignore < 5 min avg

      // Coefficient of Variation (CV) = StdDev / Mean
      // This normalizes volatility regardless of task length (e.g. 1h vs 10m tasks)
      const cv = stat.std_dev / stat.ema;
      const tagName = tagsMap.get(stat.tag_id) || `Tag ${stat.tag_id}`;

      // Benchmarks:
      // CV < 0.2 (20% variance) is very consistent
      // CV > 0.5 (50% variance) is highly volatile
      if (cv < 0.25) {
        consistent.push(tagName);
      } else if (cv > 0.6) {
        volatile.push(tagName);
      }
    });

    return { 
      consistent: consistent.slice(0, 3), // Top 3
      volatile: volatile.slice(0, 3) 
    };
  }

  /**
   * Algorithm 7: Tag Difficulty Profiling (Personalized Difficulty)
   * Calculates a "Multiplier" for each tag based on: Actual Time / Estimated Time.
   * > 1.0: User tends to underestimate tasks with this tag (Harder than thought).
   * < 1.0: User tends to overestimate tasks with this tag (Easier than thought).
   */
  static analyzeTagDifficulty(tasks: any[]): Record<string, number> {
      const tagStats: Record<string, { totalSpend: number, totalEst: number }> = {};

      tasks.forEach(task => {
          // Only consider completed tasks with valid estimates and time spent
          if (task.status === 'Completed' && task.spendTime > 0 && task.estimate > 0) {
              // Parse tags (assuming comma separated string or array in the future, currently comma string from DB)
              // The passed 'tasks' object from DB usually has 'tags' as a comma-separated string if coming from getTasks view,
              // or we might need to rely on what is passed. 
              // Let's assume it's an array of strings or comma-string.
              let tags: string[] = [];
              if (Array.isArray(task.tags)) {
                  tags = task.tags;
              } else if (typeof task.tags === 'string' && task.tags.length > 0) {
                  tags = task.tags.split(',');
              }

              const estimateMs = task.estimate * 60 * 60 * 1000;

              tags.forEach(tag => {
                  const t = tag.trim();
                  if (!tagStats[t]) tagStats[t] = { totalSpend: 0, totalEst: 0 };
                  tagStats[t].totalSpend += task.spendTime;
                  tagStats[t].totalEst += estimateMs;
              });
          }
      });

      const difficultyMap: Record<string, number> = {};
      
      // Calculate Global Average for fallback
      let globalSpend = 0;
      let globalEst = 0;

      Object.entries(tagStats).forEach(([tag, stats]) => {
          // Only calculate if we have significant data (e.g. > 1 hour of total work)
          if (stats.totalEst > 0) {
              difficultyMap[tag] = Number((stats.totalSpend / stats.totalEst).toFixed(2));
              globalSpend += stats.totalSpend;
              globalEst += stats.totalEst;
          }
      });

      // Add a 'default' key for tasks without tags or new tags
      difficultyMap['default'] = globalEst > 0 ? Number((globalSpend / globalEst).toFixed(2)) : 1.0;

      return difficultyMap;
  }

  /**
   * Algorithm 6: AI Scheduler Suggestion
   * Suggests best time of day for a task based on complexity and user's peak hours.
   */
  static suggestBestTimeForTask(task: any, peakHours: number[]): { icon: string, text: string, color: string } {
      const isHard = task.priority === 'High' || (task.estimate && task.estimate >= 2);
      const isEasy = task.priority === 'Low' || (task.estimate && task.estimate < 1);

      if (isHard) {
          if (peakHours.length > 0) {
              const start = peakHours[0];
              const end = peakHours[peakHours.length - 1] + 1;
              return { icon: '⚡', text: `Golden Hour (${start}:00-${end}:00)`, color: 'warning' };
          }
          return { icon: '☀️', text: 'Morning Boost', color: 'warning' };
      }

      if (isEasy) {
          return { icon: '☕', text: 'Low Energy Time', color: 'success' };
      }

      return { icon: '📅', text: 'Anytime', color: 'default' };
  }

  /**
   * Algorithm 8: AI Task Scoring
   * Calculates a score for auto-scheduling. Higher score = higher position in list.
   * Strategy: Weighted Shortest Job First (WSJF) variant.
   */
  static calculateTaskScore(task: any, tagDifficulty: Record<string, number>, sprintEndDate?: string, neuralEstimateHours?: number): number {
      let score = 0;

      // 1. Priority Base (The anchor)
      // We use large gaps to ensure Priority is the dominant factor
      switch (task.priority) {
          case 'High': score += 1000; break;
          case 'Medium': score += 500; break;
          default: score += 100; break; // Low
      }

      // 1a. Status Momentum (Finish what you started)
      if (task.status === 'In Progress') {
          score += 2000; // Massive boost to ensure context switching is minimized
      }

      // 2. Difficulty/Effort Penalty (Prefer easier tasks within the same priority tier)
      let projectedEffort = 0;

      if (neuralEstimateHours !== undefined) {
          // Use AI Prediction directly
          projectedEffort = neuralEstimateHours;
      } else {
          // Fallback to Tag Multiplier Logic
          let multiplier = tagDifficulty['default'] || 1.0;
          if (task.tags && typeof task.tags === 'string') {
              const tags = task.tags.split(',');
              let sum = 0;
              let count = 0;
              tags.forEach((t: string) => {
                  const tag = t.trim();
                  if (tagDifficulty[tag]) {
                      sum += tagDifficulty[tag];
                      count++;
                  }
              });
              if (count > 0) multiplier = sum / count;
          }
          const estimate = task.estimate || 1; 
          projectedEffort = estimate * multiplier;
      }
      
      // Subtract points for effort (e.g. 5h task = -25 pts). 
      // This ensures that among High priority tasks, the quicker ones are done first.
      score -= (projectedEffort * 5);

      // 3. Sprint Pressure (Deadline factor)
      if (sprintEndDate) {
          const now = new Date();
          const end = new Date(sprintEndDate);
          const diffTime = end.getTime() - now.getTime();
          const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (daysRemaining >= 0) {
              // Inverse proportion: fewer days = more points.
              // +1 to avoid division by zero.
              // Examples:
              // 0 days left (today) -> 1000 pts (Massive boost, treats as Critical)
              // 1 day left -> 500 pts
              // 5 days left -> 166 pts
              score += (10 / (daysRemaining + 1)) * 100;
          }
      }

      return score;
  }

  /**
   * Algorithm 9: Habit-Productivity Correlation
   * Compares days with high habit completion vs low habit completion
   * to find performance boosts.
   */
  static analyzeHabitCorrelation(dailyHabitScores: { date: string, score: number }[], sessions: WorkSession[]): { impact: number, message: string } | null {
      if (dailyHabitScores.length < 5 || sessions.length < 10) return null;

      const dailyFocus: Record<string, number[]> = {};
      sessions.forEach(s => {
          const d = s.startTime.split('T')[0];
          if (!dailyFocus[d]) dailyFocus[d] = [];
          dailyFocus[d].push(s.duration);
      });

      const highHabitDays: number[] = []; // Focus scores on high habit days (>0.8)
      const lowHabitDays: number[] = [];  // Focus scores on low habit days (<0.4)

      dailyHabitScores.forEach(hs => {
          const durations = dailyFocus[hs.date];
          if (!durations) return;

          // Calculate focus score for that day
          const total = durations.reduce((a, b) => a + b, 0);
          const deepWork = durations.filter(d => d >= 20 * 60 * 1000 && d <= 120 * 60 * 1000).reduce((a, b) => a + b, 0);
          const score = total > 0 ? deepWork / total : 0;

          if (hs.score >= 0.8) highHabitDays.push(score);
          else if (hs.score <= 0.4) lowHabitDays.push(score);
      });

      if (highHabitDays.length >= 2 && lowHabitDays.length >= 2) {
          const avgHigh = highHabitDays.reduce((a, b) => a + b, 0) / highHabitDays.length;
          const avgLow = lowHabitDays.reduce((a, b) => a + b, 0) / lowHabitDays.length;

          if (avgHigh > avgLow * 1.1) { // At least 10% boost
              const diff = Math.round((avgHigh - avgLow) * 100);
              return {
                  impact: diff,
                  message: `W dni, kiedy realizujesz nawyki, Twoje skupienie (Deep Work) jest o ${diff}% wyższe. Trzymaj tak dalej!`
              };
          }
      }

      return null;
  }

  /**
   * Algorithm 10: Sprint Risk Analysis
   * Predicts if the sprint will be completed on time.
   */
  static analyzeSprintRisk(sprint: any, tasks: any[], recentSessions: WorkSession[], neuralPredictions: number[], workHours: { start: string, end: string }): { completed: number, total: number, risk: 'Stable' | 'At Risk' | 'Critical', message: string } {
      const unfinishedTasks = tasks.filter(t => t.status !== 'Completed');
      const finishedTasks = tasks.filter(t => t.status === 'Completed');
      
      const totalTasks = tasks.length;
      const completedTasks = finishedTasks.length;

      if (totalTasks === 0) return { completed: 0, total: 0, risk: 'Stable', message: 'Brak zadań w sprincie.' };

      // 1. Calculate remaining workload (Hours)
      const remainingMinutesAI = neuralPredictions.reduce((acc, val) => acc + val, 0);
      const remainingHours = remainingMinutesAI > 0 ? remainingMinutesAI / 60 : unfinishedTasks.reduce((acc, t) => acc + (t.estimate || 1), 0);

      // 2. Calculate available capacity based on Work Hours
      const now = new Date();
      const end = new Date(sprint.endDate);
      
      // Calculate work hours per day
      const [startH, startM] = workHours.start.split(':').map(Number);
      const [endH, endM] = workHours.end.split(':').map(Number);
      const dailyWorkHours = (endH + endM/60) - (startH + startM/60);

      // Remaining days (excluding weekends? for now just total days)
      const diffTime = end.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      // Precise capacity calculation: (Today's remaining hours) + (Full remaining days * dailyWorkHours)
      const currentHour = now.getHours() + (now.getMinutes() / 60);
      const hoursLeftToday = Math.max(0, (endH + endM/60) - currentHour);
      
      const totalCapacity = hoursLeftToday + ((daysLeft - 1) * dailyWorkHours);
      
      // 3. Fallback to historical velocity if totalCapacity seems unrealistic or no workHours
      const dailyTotals: Record<string, number> = {};
      recentSessions.forEach(s => {
          const d = s.startTime.split('T')[0];
          dailyTotals[d] = (dailyTotals[d] || 0) + (s.duration / (1000 * 60 * 60));
      });
      const velocities = Object.values(dailyTotals);
      const avgVelocity = velocities.length > 0 
          ? velocities.reduce((a, b) => a + b, 0) / velocities.length
          : dailyWorkHours; // Use workHours as fallback

      const riskRatio = remainingHours / Math.max(1, totalCapacity);

      let risk: 'Stable' | 'At Risk' | 'Critical' = 'Stable';
      let message = 'Sprint postępuje zgodnie z planem.';

      if (riskRatio > 1.2) {
          risk = 'Critical';
          message = `Krytyczne opóźnienie! Pozostało ${remainingHours.toFixed(1)}h pracy, a Twój harmonogram oferuje tylko ${totalCapacity.toFixed(1)}h.`;
      } else if (riskRatio > 0.95) {
          risk = 'At Risk';
          message = `Zagrożenie! Masz bardzo mało czasu na dokończenie zadań (${totalCapacity.toFixed(1)}h dostępnych).`;
      } else if (riskRatio > 0.75) {
          message = `Uwaga: Wykorzystujesz już ${(riskRatio * 100).toFixed(0)}% dostępnego czasu w sprincie.`;
      }

      return { completed: completedTasks, total: totalTasks, risk, message };
  }
}
