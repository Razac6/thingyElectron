import { app } from 'electron';

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
  focusScore: number; // 0-100%
  tagConsistency: {
    consistent: string[];
    volatile: string[];
  };
}

export interface ChallengeConfig {
  type: 'TOTAL_DURATION' | 'DEEP_WORK' | 'FOCUS_SCORE' | 'FROG_EATER' | 'BACKLOG_CLEANER';
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
    
    // Scenario 1: Slump -> Backlog Cleaning (Momentum builder)
    if (trend.direction === 'decreasing') {
      return {
        type: 'BACKLOG_CLEANER',
        target: 3, // 3 tasks
        description: 'Momentum Builder: Complete 3 tasks to get back on track.',
        xpReward: 100
      };
    }

    // Scenario 2: Increasing/Stable -> Beast Mode (Challenge)
    if (trend.direction === 'increasing') {
      const hardTarget = Math.max(120, Math.round(fatigue.averageSession * 6));
      return {
        type: 'TOTAL_DURATION',
        target: hardTarget,
        description: `Beast Mode: Reach ${Math.floor(hardTarget / 60)}h ${hardTarget % 60}m of total work.`,
        xpReward: 200
      };
    }

    // Default
    return {
      type: 'DEEP_WORK',
      target: 60, // 1 hour of deep work
      description: 'Focus Challenge: Accumulate 60 minutes of Deep Work (sessions > 20m).',
      xpReward: 100
    };
  }

  /**
   * Algorithm 4: Focus Quality Score
   * Calculates the percentage of time spent in "Deep Work" sessions.
   * Deep Work is defined as a session lasting between 20 and 120 minutes.
   */
  static analyzeFocusQuality(sessions: WorkSession[]): number {
    if (sessions.length === 0) return 0;

    let totalDuration = 0;
    let deepWorkDuration = 0;

    sessions.forEach(session => {
      const durationMinutes = session.duration / (1000 * 60);
      totalDuration += durationMinutes;

      // Deep Work Criteria:
      // > 20 mins: Takes time to get into flow
      // < 120 mins: Beyond this is likely fatigue/forgetting to stop timer, diminishing returns
      if (durationMinutes >= 20 && durationMinutes <= 120) {
        deepWorkDuration += durationMinutes;
      }
    });

    if (totalDuration === 0) return 0;

    return Math.round((deepWorkDuration / totalDuration) * 100);
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
      // Not enough data, return defaults (Pomodoro standard)
      return { averageSession: 25, maxRecommended: 45 };
    }

    // Convert to minutes
    const durations = sessions.map(s => s.duration / (1000 * 60));
    
    // Filter out micro-sessions (< 1 min) that might skew data (mistakes)
    const validDurations = durations.filter(d => d > 1);
    
    if (validDurations.length === 0) return { averageSession: 25, maxRecommended: 45 };

    // Calculate Mean (μ)
    const sum = validDurations.reduce((a, b) => a + b, 0);
    const mean = sum / validDurations.length;

    // Calculate Variance & StdDev (σ)
    const variance = validDurations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validDurations.length;
    const stdDev = Math.sqrt(variance);

    // Rule: Recommended Limit = Mean + 1.5 Sigma (covers ~87% of your typical productive sessions)
    // Capped at 90 minutes (biological limit)
    let maxRecommended = mean + (1.5 * stdDev);
    if (maxRecommended > 90) maxRecommended = 90;
    if (maxRecommended < 25) maxRecommended = 25; // Minimum viable session

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
}
