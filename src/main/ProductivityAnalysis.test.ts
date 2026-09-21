import { ProductivityAnalyst, WorkSession } from './ProductivityAnalysis';

import { getFocusContext } from './db';

// Mock the db module since it's used in analyzeFocusQuality
jest.mock('./db', () => ({
  getFocusContext: jest.fn().mockReturnValue(0.9), // Default high focus
}));

describe('ProductivityAnalyst', () => {
  describe('generateDailyChallenge', () => {
    const defaultFatigue = {
      averageSession: 45,
      maxRecommended: 60,
      isFatigued: false,
    };
    const stableTrend = {
      slope: 0,
      direction: 'stable' as const,
      description: 'Stable',
    };

    it('should return recovery challenge when mode is recovery', () => {
      const challenge = ProductivityAnalyst.generateDailyChallenge(
        stableTrend,
        defaultFatigue,
        'recovery',
      );
      expect(challenge.type).toBe('TOTAL_DURATION');
      expect(challenge.target).toBe(45);
    });

    it('should return high impact challenge when mode is boost', () => {
      const challenge = ProductivityAnalyst.generateDailyChallenge(
        stableTrend,
        defaultFatigue,
        'boost',
      );
      expect(['DEEP_WORK', 'FROG_EATER']).toContain(challenge.type);
    });

    it('should return momentum builder when trend is decreasing', () => {
      const decreasingTrend = {
        slope: -5,
        direction: 'decreasing' as const,
        description: 'Decreasing',
      };
      const challenge = ProductivityAnalyst.generateDailyChallenge(
        decreasingTrend,
        defaultFatigue,
        'normal',
      );
      expect(['BACKLOG_CLEANER', 'TASK_SPRINTER']).toContain(challenge.type);
    });

    it('should return beast mode when trend is increasing', () => {
      const increasingTrend = {
        slope: 5,
        direction: 'increasing' as const,
        description: 'Increasing',
      };
      const challenge = ProductivityAnalyst.generateDailyChallenge(
        increasingTrend,
        defaultFatigue,
        'normal',
      );
      expect(challenge.type).toBe('TOTAL_DURATION');
      expect(challenge.target).toBeGreaterThanOrEqual(120);
    });
  });

  describe('analyzeFocusQuality', () => {
    it('should calculate score based on deep work sessions', () => {
      const sessions: WorkSession[] = [
        { startTime: '2023-01-01T10:00:00Z', duration: 30 * 60 * 1000 }, // 30m - Deep Work
        { startTime: '2023-01-01T11:00:00Z', duration: 10 * 60 * 1000 }, // 10m - Too short
        { startTime: '2023-01-01T12:00:00Z', duration: 150 * 60 * 1000 }, // 150m - Too long
      ];

      const result = ProductivityAnalyst.analyzeFocusQuality(sessions);
      // Total duration = 30 + 10 + 150 = 190m
      // Deep work = 30m
      // Score = 30 / 190 = ~16%
      expect(result.score).toBe(16);
      expect(result.deepWorkMinutes).toBe(30);
    });

    it('should return 0 if focus context is low', () => {
      (getFocusContext as jest.Mock).mockReturnValue(0.5); // Low focus
      const sessions: WorkSession[] = [
        { startTime: '2023-01-01T10:00:00Z', duration: 30 * 60 * 1000 },
      ];
      const result = ProductivityAnalyst.analyzeFocusQuality(sessions);
      expect(result.score).toBe(0);
      expect(result.deepWorkMinutes).toBe(0);
    });
  });

  describe('identifyPeakHours', () => {
    it('should identify top hours based on duration and weight', () => {
      // Use fixed dates but expect based on local timezone interpretation
      const date1 = new Date();
      date1.setHours(10, 0, 0, 0);
      const date2 = new Date();
      date2.setHours(14, 0, 0, 0);

      const sessions: WorkSession[] = [
        { startTime: date1.toISOString(), duration: 60 * 60 * 1000 },
        { startTime: date2.toISOString(), duration: 120 * 60 * 1000 },
      ];

      const result = ProductivityAnalyst.identifyPeakHours(sessions);
      expect(result.peakHours).toContain(10);
      expect(result.peakHours).toContain(14);
    });
  });

  describe('analyzeFatigue', () => {
    it('should return defaults for small datasets', () => {
      const sessions: WorkSession[] = [
        { startTime: '2023-01-01T10:00:00Z', duration: 30 * 60 * 1000 },
      ];
      const result = ProductivityAnalyst.analyzeFatigue(sessions);
      expect(result.averageSession).toBe(45);
      expect(result.maxRecommended).toBe(60);
    });

    it('should calculate mean and maxRecommended correctly', () => {
      const sessions: WorkSession[] = [
        { startTime: '2023-01-01T10:00:00Z', duration: 40 * 60 * 1000 },
        { startTime: '2023-01-02T10:00:00Z', duration: 50 * 60 * 1000 },
        { startTime: '2023-01-03T10:00:00Z', duration: 60 * 60 * 1000 },
        { startTime: '2023-01-04T10:00:00Z', duration: 40 * 60 * 1000 },
        { startTime: '2023-01-05T10:00:00Z', duration: 50 * 60 * 1000 },
      ];
      const result = ProductivityAnalyst.analyzeFatigue(sessions);
      // Mean = 48
      expect(result.averageSession).toBe(48);
      expect(result.maxRecommended).toBeGreaterThan(48);
    });
  });

  describe('analyzeTrend', () => {
    it('should detect increasing trend', () => {
      const dailyTotals = [
        { date: '2023-01-01', totalDuration: 60 * 60 * 1000 },
        { date: '2023-01-02', totalDuration: 120 * 60 * 1000 },
        { date: '2023-01-03', totalDuration: 180 * 60 * 1000 },
        { date: '2023-01-04', totalDuration: 240 * 60 * 1000 },
      ];
      const result = ProductivityAnalyst.analyzeTrend(dailyTotals);
      expect(result.direction).toBe('increasing');
    });

    it('should detect decreasing trend', () => {
      const dailyTotals = [
        { date: '2023-01-01', totalDuration: 240 * 60 * 1000 },
        { date: '2023-01-02', totalDuration: 180 * 60 * 1000 },
        { date: '2023-01-03', totalDuration: 120 * 60 * 1000 },
        { date: '2023-01-04', totalDuration: 60 * 60 * 1000 },
      ];
      const result = ProductivityAnalyst.analyzeTrend(dailyTotals);
      expect(result.direction).toBe('decreasing');
    });
  });

  describe('calculateTaskScore', () => {
    it('should give boost to In Progress tasks', () => {
      const task = { priority: 'Medium', status: 'In Progress', estimate: 1 };
      const score = ProductivityAnalyst.calculateTaskScore(task, {});
      expect(score).toBeGreaterThan(2000);
    });

    it('should give high score to High priority tasks', () => {
      const task = { priority: 'High', status: 'To Do', estimate: 1 };
      const score = ProductivityAnalyst.calculateTaskScore(task, {});
      // 1000 (Base) - 5 (Effort for 1h) = 995
      expect(score).toBeGreaterThanOrEqual(995);
    });
  });

  describe('analyzeSprintRisk', () => {
    const sprint = {
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }; // Tomorrow
    const workHours = { start: '09:00', end: '17:00' }; // 8h/day

    it('should return Stable for empty sprint', () => {
      const result = ProductivityAnalyst.analyzeSprintRisk(
        sprint,
        [],
        [],
        [],
        workHours,
      );
      expect(result.risk).toBe('Stable');
    });

    it('should detect Critical risk when workload exceeds capacity', () => {
      const tasks = [{ status: 'To Do', estimate: 20 }]; // 20h work
      const neuralPredictions = [1200]; // 20h in minutes
      // Capacity is roughly 8h (until tomorrow)
      const result = ProductivityAnalyst.analyzeSprintRisk(
        sprint,
        tasks,
        [],
        neuralPredictions,
        workHours,
      );
      expect(result.risk).toBe('Critical');
    });
  });
});
