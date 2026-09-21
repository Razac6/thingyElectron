import * as tf from '@tensorflow/tfjs';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  logSystemEvent,
  getDailyBio,
  getAiMaturity,
  getSetting,
  setSetting,
  getTasks,
  getRecentWorkSessions,
  getHabits,
  getHabitLogs,
  getActiveSprint,
  getSprintTasks,
  getTagAnalytics,
  getTagByName,
  getFocusContext,
} from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';
import { personalityEngine, AiMood } from './PersonalityEngine';

// Simple mapping for priorities
const PRIORITY_MAP: { [key: string]: number } = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const MODEL_PATH = path.join(
  app.getPath('userData'),
  'neural-core-weights.json',
);

// Normalization / heuristic constants used across preprocessing and prediction
const WORKDAY_MINUTES = 480; // 8h workday, used to normalize meeting load
const MAX_STORY_POINTS = 13; // Fibonacci-scale cap, used to normalize story points
const TRAINING_COOLDOWN_MS = 10 * 60 * 1000; // Minimum time between training runs
const MIN_PREDICTED_MINUTES = 30; // Floor applied when a prediction looks implausibly low
const PREDICTION_SANITY_FLOOR = 5; // Below this, a prediction is treated as implausible
const LOW_SLEEP_THRESHOLD = 50;
const HIGH_HABIT_SCORE = 0.8;
const MED_HABIT_SCORE = 0.5;
const AI_MATURITY_MAX = 100; // getAiMaturity() scale (0-100); used to weight net vs. baseline blending

// Model capacity / regularization - kept small on purpose: a personal task tracker realistically
// trains on tens to low hundreds of completed tasks, not thousands, so a large network just overfits.
const DROPOUT_RATE = 0.2;
const L2_REGULARIZATION = 0.01;

// Training loop safety net for small datasets
const MIN_TRAINING_SAMPLES = 5; // below this, validationSplit wouldn't leave a meaningful val set
const VALIDATION_SPLIT = 0.2;
const MAX_EPOCHS = 30; // early stopping usually cuts this short once val_loss stops improving
const EARLY_STOPPING_PATIENCE = 5;

const parseDate = (str: string) => {
  let d = new Date(str);
  if (Number.isNaN(d.getTime())) {
    const parts = str.split('.');
    if (parts.length === 3) {
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  }
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export class NeuralCore {
  model: tf.Sequential;

  isTraining: boolean = false;

  lastTrainingTime: number = 0;

  constructor() {
    this.model = tf.sequential();
    this.initModel();
    this.loadWeights();
  }

  private initModel() {
    // Input: [SinHour, CosHour, SinDay, CosDay, Priority, SleepScore, MeetingLoad, HabitScore, StoryPoints, FocusContext] (10 features)
    // Small, regularized network (8 -> 4 -> 1): with only tens/hundreds of completed tasks to
    // train on, a larger net (previously 32 -> 16 -> 1) just memorizes noise instead of generalizing.
    this.model.add(
      tf.layers.dense({
        units: 8,
        activation: 'relu',
        inputShape: [10],
        kernelRegularizer: tf.regularizers.l2({ l2: L2_REGULARIZATION }),
      }),
    );
    this.model.add(tf.layers.dropout({ rate: DROPOUT_RATE }));
    this.model.add(
      tf.layers.dense({
        units: 4,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: L2_REGULARIZATION }),
      }),
    );
    this.model.add(tf.layers.dense({ units: 1 }));

    this.model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    logSystemEvent(
      `NeuralCore initialized. Model updated (10 Features + Normalization, regularized 8-4-1). Weights path: ${MODEL_PATH}`,
      'SYSTEM',
    );
  }

  private encodeTime(hour: number, day: number) {
    const hourRad = (hour * Math.PI) / 12;
    const dayRad = (day * Math.PI) / 3.5;
    return [
      Math.sin(hourRad),
      Math.cos(hourRad),
      Math.sin(dayRad),
      Math.cos(dayRad),
    ];
  }

  private async saveWeights() {
    try {
      // getWeights() returns the model's own live variable tensors, not copies - disposing
      // them here would destroy the in-memory model (any predict()/fit() call afterwards
      // would throw "already disposed"). Only dataSync() is needed to read the values out.
      const weights = this.model.getWeights();
      const weightData = weights.map((w) => ({
        shape: w.shape,
        data: Array.from(w.dataSync()),
      }));
      fs.writeFileSync(MODEL_PATH, JSON.stringify(weightData));
    } catch (e) {
      log.error('Failed to save neural weights', e);
    }
  }

  private async loadWeights() {
    if (!fs.existsSync(MODEL_PATH)) return;
    try {
      const data = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8'));
      // Shape must be stored and restored explicitly - dataSync() flattens each tensor, so
      // reconstructing without the original shape produces a 1D tensor setWeights() rejects.
      const weights = data.map((w: { shape: number[]; data: number[] }) =>
        tf.tensor(w.data, w.shape),
      );

      // setWeights throws on a dimension mismatch (e.g. after changing the feature count) -
      // caught below so we can delete the stale file and retrain from scratch.
      try {
        this.model.setWeights(weights);
        logSystemEvent('NeuralCore memory loaded from disk.', 'SYSTEM');
      } catch (weightError) {
        log.error('Weight Mismatch during setWeights. Resetting.', weightError);
        weights.forEach((w: tf.Tensor) => w.dispose()); // Clean up tensors
        throw weightError; // Re-throw to trigger outer catch block
      }

      weights.forEach((w: tf.Tensor) => w.dispose());
    } catch (e) {
      log.error(
        'Failed to load neural weights (Dimension Mismatch?). Resetting brain.',
      );
      // Force delete old weights
      try {
        fs.unlinkSync(MODEL_PATH);
        logSystemEvent(
          'Old NeuralCore weights deleted. Starting fresh.',
          'SYSTEM',
        );
      } catch (err) {
        log.error('Could not delete weights file', err);
      }

      // Re-initialize model to be sure it's clean
      this.model = tf.sequential();
      this.initModel();
    }
  }

  determineMood(risk: any, sleep: number, habitScore: number): AiMood {
    if (risk && risk.risk === 'Critical') return 'PANIC';
    if (risk && risk.risk === 'At Risk') return 'SUPPORTIVE';
    if (sleep < LOW_SLEEP_THRESHOLD) return 'SUPPORTIVE';
    if (habitScore > HIGH_HABIT_SCORE && risk?.risk === 'Stable')
      return 'GRIND';
    if (habitScore > MED_HABIT_SCORE) return 'STABLE';
    return 'CHILL';
  }

  // Shared feature normalization used by preprocessData, predict and predictForTask.
  // habits/logs are passed in (rather than fetched here) so callers can fetch them once
  // per batch instead of once per task.
  private computeCommonFeatures(
    task: any,
    dateStr: string,
    habits: any[],
    logs: any[],
  ) {
    const bio = getDailyBio(dateStr);

    const sleep = (bio.sleepScore !== null ? Number(bio.sleepScore) : 75) / 100;
    const meetingLoad = Math.min(1.0, (bio.meetingTime || 0) / WORKDAY_MINUTES);
    const priority = (PRIORITY_MAP[task.priority] || 2) / 3;

    let habitScore = 0.5;
    if (habits.length > 0) {
      const completedOnDay = logs.filter(
        (l: any) => l.date === dateStr && l.value >= 1,
      ).length;
      habitScore = completedOnDay / habits.length;
    }

    const storyPoints = Math.min(
      1.0,
      (task.storyPoints ? Number(task.storyPoints) : 0) / MAX_STORY_POINTS,
    );

    return { sleep, meetingLoad, priority, habitScore, storyPoints };
  }

  private preprocessData(tasks: any[], userId: number) {
    const rawData: { input: number[]; output: number; type: string }[] = [];
    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);

    tasks.forEach((task) => {
      if (task.status === 'Completed' && task.spendTime > 0) {
        const dateObj = parseDate(task.updateStatusDate || task.createdAt);
        const dateStr = dateObj.toISOString().split('T')[0];

        const { sleep, meetingLoad, priority, habitScore, storyPoints } =
          this.computeCommonFeatures(task, dateStr, habits, logs);

        // Use precise Focus Context for the duration of the task
        const endTimeTs = dateObj.getTime();
        const startTimeTs = endTimeTs - task.spendTime;
        const focusContext = getFocusContext(endTimeTs, startTimeTs);

        const timeEncoded = this.encodeTime(
          dateObj.getHours(),
          dateObj.getDay(),
        );
        const input = [
          ...timeEncoded,
          priority,
          sleep,
          meetingLoad,
          habitScore,
          storyPoints,
          focusContext,
        ];
        const output = task.spendTime / (1000 * 60); // minutes
        const type = task.type || 'TASK';

        rawData.push({ input, output, type });
      }
    });

    // Use tf.tidy to automatically clean up intermediate tensors
    return tf.tidy(() => {
      const inputs = rawData.map((d) => d.input);
      const outputs = rawData.map((d) => d.output);

      return {
        inputs: tf.tensor2d(inputs, [inputs.length, 10]),
        outputs: tf.tensor2d(outputs, [outputs.length, 1]),
      };
    });
  }

  async train(tasks: any[]) {
    if (this.isTraining) return;
    const now = Date.now();
    if (now - this.lastTrainingTime < TRAINING_COOLDOWN_MS) return;

    const userId = tasks.length > 0 ? tasks[0].userId : 1;
    this.isTraining = true;
    this.lastTrainingTime = now;

    try {
      const { inputs, outputs } = this.preprocessData(tasks, userId);
      if (inputs.shape[0] < MIN_TRAINING_SAMPLES) {
        this.isTraining = false;
        inputs.dispose();
        outputs.dispose();
        return;
      }

      const sampleCount = inputs.shape[0];
      const history = await this.model.fit(inputs, outputs, {
        epochs: MAX_EPOCHS,
        batchSize: 32,
        shuffle: true,
        validationSplit: VALIDATION_SPLIT,
        callbacks: [
          tf.callbacks.earlyStopping({
            monitor: 'val_loss',
            patience: EARLY_STOPPING_PATIENCE,
          }),
        ],
      });

      // Report what actually happened, not a static message - epochs run (early stopping may
      // cut this short), final loss/val_loss, and how many samples it trained on.
      const lastMetric = (
        arr: Array<number | tf.Tensor> | undefined,
      ): number | null => {
        if (!arr || arr.length === 0) return null;
        const v = arr[arr.length - 1];
        return typeof v === 'number' ? v : (v as tf.Tensor).dataSync()[0];
      };
      const epochsRun = history.epoch.length;
      const finalLoss = lastMetric(history.history.loss);
      const finalValLoss = lastMetric(history.history.val_loss);
      const lossStr = finalLoss !== null ? finalLoss.toFixed(2) : 'n/a';
      const valLossStr =
        finalValLoss !== null ? `, val_loss=${finalValLoss.toFixed(2)}` : '';
      const earlyStopNote = epochsRun < MAX_EPOCHS ? ' (early stop)' : '';

      logSystemEvent(
        `[NEURAL] Training complete: ${epochsRun}/${MAX_EPOCHS} epochs${earlyStopNote}, ${sampleCount} samples, loss=${lossStr}${valLossStr}`,
        'LEARNING',
      );
      this.saveWeights();
      const trainings = Number(getSetting('neural_training_count') || 0) + 1;
      setSetting('neural_training_count', String(trainings));

      inputs.dispose();
      outputs.dispose();
    } catch (e) {
      log.error('Training failed', e);
    } finally {
      this.isTraining = false;
    }
  }

  predict(task: any): number {
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0];
    const userId = task.userId || 1;

    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);
    const { sleep, meetingLoad, priority, habitScore, storyPoints } =
      this.computeCommonFeatures(task, dateStr, habits, logs);

    let tagEmaSum = 0;
    let tagCount = 0;
    if (task.tags && Array.isArray(task.tags)) {
      task.tags.forEach((tagName: string) => {
        const tagId = getTagByName(tagName);
        if (tagId) {
          const analytics = getTagAnalytics(tagId[0] as number);
          if (analytics && analytics.completed_count > 0) {
            tagEmaSum += analytics.ema;
            tagCount++;
          }
        }
      });
    }

    const focusContext = getFocusContext(Date.now()); // Real-time context

    const timeEncoded = this.encodeTime(dateObj.getHours(), dateObj.getDay());
    const inputArr = [
      ...timeEncoded,
      priority,
      sleep,
      meetingLoad,
      habitScore,
      storyPoints,
      focusContext,
    ];

    // Use tf.tidy to automatically clean up tensors
    let finalMin: number;
    try {
      finalMin = tf.tidy(() => {
        const input = tf.tensor2d([inputArr], [1, 10]);
        const prediction = this.model.predict(input) as tf.Tensor;
        return prediction.dataSync()[0];
      });
    } catch (e) {
      log.error('NeuralCore.predict: model inference failed', e);
      return MIN_PREDICTED_MINUTES;
    }

    // Blend the net's raw prediction with a simpler baseline, weighted by how much the model has
    // actually learned (getAiMaturity: training runs + completed-task volume, 0-100). At low
    // maturity the net hasn't seen enough data to be trusted alone, so lean on tag history (if any)
    // or the user's own manual estimate instead.
    let baseline: number | null = null;
    if (tagCount > 0) {
      baseline = tagEmaSum / tagCount / (1000 * 60); // historical tag average, minutes
    } else if (task.estimate) {
      baseline = Number(task.estimate) * 60; // manual estimate, hours -> minutes
    }

    if (baseline !== null) {
      const neuralWeight = Math.min(
        1,
        Math.max(0, getAiMaturity() / AI_MATURITY_MAX),
      );
      finalMin = neuralWeight * finalMin + (1 - neuralWeight) * baseline;
    }

    return finalMin < PREDICTION_SANITY_FLOOR
      ? MIN_PREDICTED_MINUTES
      : finalMin;
  }

  predictForTask(task: any): number {
    const dateObj = parseDate(task.updateStatusDate || task.createdAt);
    const dateStr = dateObj.toISOString().split('T')[0];
    const userId = task.userId || 1;

    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);
    const { sleep, meetingLoad, priority, habitScore, storyPoints } =
      this.computeCommonFeatures(task, dateStr, habits, logs);
    const focusContext = getFocusContext(dateObj.getTime());

    const timeEncoded = this.encodeTime(dateObj.getHours(), dateObj.getDay());
    const inputArr = [
      ...timeEncoded,
      priority,
      sleep,
      meetingLoad,
      habitScore,
      storyPoints,
      focusContext,
    ];

    // Use tf.tidy to automatically clean up tensors
    let value: number;
    try {
      value = tf.tidy(() => {
        const input = tf.tensor2d([inputArr], [1, 10]);
        const prediction = this.model.predict(input) as tf.Tensor;
        return prediction.dataSync()[0];
      });
    } catch (e) {
      log.error('NeuralCore.predictForTask: model inference failed', e);
      return MIN_PREDICTED_MINUTES;
    }

    // Same confidence blend as predict() - see comment there.
    if (task.estimate) {
      const neuralWeight = Math.min(
        1,
        Math.max(0, getAiMaturity() / AI_MATURITY_MAX),
      );
      value =
        neuralWeight * value +
        (1 - neuralWeight) * (Number(task.estimate) * 60);
    }

    return value < PREDICTION_SANITY_FLOOR ? MIN_PREDICTED_MINUTES : value;
  }

  // Real prediction accuracy (0-100) from completed tasks in the last `days`, based on actual
  // percent error (predicted vs. actual duration) rather than a data-volume proxy. Backs the
  // "Confidence" stat shown in the AI Status widget and System Logs page.
  getPredictionAccuracy(userId: number = 1, days: number = 14): number {
    const tasks = getTasks(userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentCompleted = tasks.filter(
      (t) =>
        t.status === 'Completed' &&
        t.updateStatusDate &&
        t.spendTime > 0 &&
        parseDate(t.updateStatusDate) >= cutoffDate,
    );

    if (recentCompleted.length === 0) return 0;

    let totalErrorPct = 0;
    recentCompleted.forEach((task) => {
      const actualMin = task.spendTime / (1000 * 60);
      const predictedMin = this.predictForTask(task);
      const errorPct = Math.abs(actualMin - predictedMin) / actualMin;
      totalErrorPct += Math.min(errorPct, 2); // cap wild outliers so one bad task doesn't dominate the average
    });

    const avgErrorPct = totalErrorPct / recentCompleted.length;
    return Math.round(Math.max(0, Math.min(100, 100 - avgErrorPct * 100)));
  }

  async getPerformanceHistory(userId: number, days: number = 7) {
    const tasks = getTasks(userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const groupedData: {
      [key: string]: { actual: number; predicted: number };
    } = {};

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      groupedData[dateStr] = { actual: 0, predicted: 0 };
    }

    tasks.forEach((task) => {
      if (task.status === 'Completed' && task.updateStatusDate) {
        const taskDate = parseDate(task.updateStatusDate);
        if (taskDate >= cutoffDate) {
          const dateStr = taskDate.toISOString().split('T')[0];
          const actualMin = (task.spendTime || 0) / (1000 * 60);
          const predictedMin = this.predictForTask(task);

          if (groupedData[dateStr]) {
            groupedData[dateStr].actual += actualMin;
            groupedData[dateStr].predicted += predictedMin;
          }
        }
      }
    });

    return Object.entries(groupedData)
      .map(([date, data]) => ({
        date,
        actual: Math.round(data.actual),
        predicted: Math.round(data.predicted),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async generateDailyReport(userId: number): Promise<string> {
    const tasks = getTasks(userId);
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const todayTasks = tasks.filter(
      (t) =>
        t.status === 'Completed' &&
        t.updateStatusDate &&
        t.updateStatusDate.startsWith(dateStr),
    );

    const totalDurationMs = todayTasks.reduce(
      (acc, t) => acc + (t.spendTime || 0),
      0,
    );
    const totalDurationMin = Math.round(totalDurationMs / (1000 * 60));
    const hours = Math.floor(totalDurationMin / 60);
    const mins = totalDurationMin % 60;

    const bio = getDailyBio(dateStr);
    const sleep = bio.sleepScore;

    let aiComment = '';
    if (todayTasks.length > 0) {
      let totalPredictedMin = 0;
      todayTasks.forEach((t) => {
        totalPredictedMin += this.predictForTask(t);
      });
      const diff = totalDurationMin - totalPredictedMin;
      const diffPercent =
        totalPredictedMin > 0
          ? Math.round((diff / totalPredictedMin) * 100)
          : 0;

      if (Math.abs(diffPercent) < 15) aiComment = 'Predykcje trafne.';
      else if (diffPercent < 0)
        aiComment = `Szybciej o ${Math.abs(diffPercent)}%.`;
      else aiComment = `Wolniej o ${diffPercent}%.`;
    }

    return `RAPORT AI: ${hours}h ${mins}m pracy. Sen: ${sleep || '?'}. ${aiComment}`;
  }

  resetCooldown() {
    this.lastTrainingTime = 0;
  }

  // Shared by getNeuralAdvice and the db:get-ai-message IPC handler (main.ts) so both use the
  // same real sprint-risk assessment instead of duplicating the computation.
  getSprintRiskContext(userId: number = 1): {
    risk: any;
    tasksRemaining: number;
  } {
    const sprint = getActiveSprint();
    if (!sprint) return { risk: null, tasksRemaining: 0 };

    const tasks = getSprintTasks(sprint.id);
    const unfinished = tasks.filter((t) => t.status !== 'Completed');
    const tasksRemaining = unfinished.length;
    const predictions = unfinished.map((t) => this.predictForTask(t));
    const sessions = getRecentWorkSessions(userId, 14);
    const risk = ProductivityAnalyst.analyzeSprintRisk(
      sprint,
      tasks,
      sessions,
      predictions,
      {
        start: String(getSetting('workDayStart') || '09:00'),
        end: String(getSetting('workDayEnd') || '17:00'),
      },
    );
    return { risk, tasksRemaining };
  }

  async getNeuralAdvice(
    activeTask?: string,
  ): Promise<{ text: string; category: 'high' | 'low' | 'neutral' | 'focus' }> {
    if (!this.model || this.isTraining)
      return {
        text: 'Thingy: Kalibruję się... proszę czekać.',
        category: 'neutral',
      };

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const userId = 1;

    const bio = getDailyBio(dateStr);
    const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);
    const habitCount = logs.filter(
      (l: any) => l.date === dateStr && l.value >= 1,
    ).length;
    const habitScore = habits.length > 0 ? habitCount / habits.length : 0.5;

    const { risk, tasksRemaining } = this.getSprintRiskContext(userId);

    if (activeTask)
      return {
        text: `Thingy: Widzę, że pracujesz nad "${activeTask}". Monitoruję Twoje skupienie.`,
        category: 'focus',
      };

    const mood = this.determineMood(risk, sleep, habitScore);

    // --- Removed Llama Integration ---
    // We now rely solely on the personalityEngine (templates)
    const text = personalityEngine.generateMessage({
      mood,
      userName: 'Marcin',
      sprintRisk: risk,
      habitScore,
      tasksRemaining,
    });

    const categoryMap: Record<AiMood, 'high' | 'low' | 'neutral' | 'focus'> = {
      PANIC: 'high',
      SUPPORTIVE: 'high',
      GRIND: 'low',
      CELEBRATION: 'low',
      STABLE: 'neutral',
      CHILL: 'neutral',
      BORED: 'neutral',
      DISTRACTED: 'high',
    };

    return { text, category: categoryMap[mood] };
  }
}

export const neuralCore = new NeuralCore();
