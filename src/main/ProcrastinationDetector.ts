import * as tf from '@tensorflow/tfjs';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import {
  getTasks,
  logSystemEvent,
  getAppSwitchCount,
  getWebDistractionRatio,
  getDaysSinceLastSimilarTask,
  getActiveUserId,
} from './db';

// Task dates are stored both as ISO strings and as "dd.mm.yyyy" (older rows) - new Date()
// misreads the latter, which would mislabel training rows.
const parseTaskDate = (str: string): number => {
  let d = new Date(str);
  if (Number.isNaN(d.getTime()) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
    const [day, month, year] = String(str).split('.');
    if (year) {
      d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
  }
  return d.getTime();
};

export interface ProcrastinationRisk {
  taskId: number;
  risk: number; // 0-1 probability
  confidence: number; // 0-1
  reasons: string[];
  suggestion: string;
}

const MODEL_PATH = path.join(
  app.getPath('userData'),
  'procrastination-model.json',
);

export class ProcrastinationDetector {
  private model: tf.Sequential;

  private isTraining: boolean = false;

  private lastTrainingTime: number = 0;

  // False until weights were loaded or fitted - an untrained net outputs noise, so predict()
  // reports no risk instead of a made-up percentage.
  private isTrained: boolean = false;

  constructor() {
    this.model = tf.sequential();
    this.initModel();
    this.loadWeights();
  }

  private initModel() {
    // Input features (8):
    // - taskAge (days since created)
    // - estimatedDifficulty (estimate * complexity)
    // - priorityEncoded (High=3, Med=2, Low=1)
    // - recentSwitchCount (how many times user switched away)
    // - webDistractionScore (% time on distracting sites when task active)
    // - timeOfDay (sin/cos encoded hour)
    // - daysSinceLastSimilarTask
    // - focusScoreWhenActive

    this.model.add(
      tf.layers.dense({ units: 16, activation: 'relu', inputShape: [8] }),
    );
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    this.model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Binary output: procrastinating or not

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    logSystemEvent('ProcrastinationDetector initialized', 'SYSTEM');
  }

  private async saveWeights() {
    try {
      // getWeights() returns the model's own live variable tensors, not copies - disposing them
      // here would destroy the in-memory model (predict()/fit() afterwards would throw
      // "already disposed"). Only dataSync() is needed to read the values out.
      const weights = this.model.getWeights();
      const weightData = weights.map((w) => ({
        shape: w.shape,
        data: Array.from(w.dataSync()),
      }));
      fs.writeFileSync(MODEL_PATH, JSON.stringify(weightData));
    } catch (e) {
      log.error('Failed to save procrastination model weights', e);
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

      try {
        this.model.setWeights(weights);
        this.isTrained = true;
        logSystemEvent('ProcrastinationDetector weights loaded', 'SYSTEM');
      } catch (weightError) {
        log.error('Weight mismatch in ProcrastinationDetector. Resetting.');
        weights.forEach((w: tf.Tensor) => w.dispose());
        throw weightError;
      }

      weights.forEach((w: tf.Tensor) => w.dispose());
    } catch (e) {
      log.error(
        'Failed to load procrastination model weights. Starting fresh.',
      );
      try {
        fs.unlinkSync(MODEL_PATH);
      } catch (err) {
        // Ignore
      }
      this.model = tf.sequential();
      this.initModel();
    }
  }

  private encodeTime(hour: number): [number, number] {
    const rad = (hour * Math.PI) / 12;
    return [Math.sin(rad), Math.cos(rad)];
  }

  private extractFeatures(task: any, historicalData: any): number[] {
    const now = Date.now();
    const createdDate = new Date(task.createdAt).getTime();
    const taskAge = (now - createdDate) / (1000 * 60 * 60 * 24); // days

    // Estimated difficulty
    const estimate = task.estimate || 1;
    const complexity = task.storyPoints || 5;
    const estimatedDifficulty = estimate * (complexity / 5); // Normalized

    // Priority encoding
    const priorityMap: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    const priorityEncoded = (priorityMap[task.priority] || 2) / 3;

    // Recent switch count (mock data for now - would need to track this)
    const recentSwitchCount = historicalData.switchCount || 0;

    // Web distraction score (mock - would need browser extension data)
    const webDistractionScore = historicalData.webDistractionScore || 0;

    // Time of day
    const currentHour = new Date().getHours();
    const [sinHour, cosHour] = this.encodeTime(currentHour);

    // Days since last similar task (by type/tags)
    const daysSinceLastSimilar = historicalData.daysSinceLastSimilar || 7;

    return [
      Math.min(taskAge / 30, 1), // Normalize to 30 days
      Math.min(estimatedDifficulty / 10, 1), // Normalize to 10h
      priorityEncoded,
      Math.min(recentSwitchCount / 10, 1), // Normalize to 10 switches
      webDistractionScore,
      sinHour,
      cosHour,
      Math.min(daysSinceLastSimilar / 14, 1), // Normalize to 14 days
    ];
  }

  private generateReasons(features: number[]): string[] {
    const reasons: string[] = [];
    const [
      taskAge,
      difficulty,
      priority,
      switchCount,
      webDistraction,
      ,
      ,
      daysSinceSimilar,
    ] = features;

    if (taskAge > 0.5) {
      reasons.push(
        `Task leży już ${Math.round(taskAge * 30)} dni - to czerwona flaga`,
      );
    }

    if (difficulty > 0.7 && priority < 0.6) {
      reasons.push(
        'Trudny task z niskim priorytetem - klasyczna prokrastynacja',
      );
    }

    if (switchCount > 0.5) {
      reasons.push(
        `Przełączyłeś się z tego taska ${Math.round(switchCount * 10)}+ razy`,
      );
    }

    if (webDistraction > 0.6) {
      reasons.push(
        'Widzę dużo rozproszeń webowych podczas pracy nad tym taskiem',
      );
    }

    if (daysSinceSimilar > 0.7) {
      reasons.push(
        'Długo nie robiłeś podobnych tasków - może trudno wrócić do kontekstu?',
      );
    }

    if (reasons.length === 0) {
      reasons.push('Ogólny wzorzec zachowania wskazuje na prokrastynację');
    }

    return reasons.slice(0, 3); // Max 3 reasons
  }

  private generateSuggestion(features: number[], risk: number): string {
    const [taskAge, difficulty] = features;

    if (risk > 0.8) {
      if (difficulty > 0.7) {
        return '💡 Podziel ten task na 3-5 mniejszych subtasków. Dużo łatwiej zacząć od małego kawałka.';
      }
      if (taskAge > 0.7) {
        return '🎯 Oznacz go jako "DO TODAY" i zrób jako pierwszy rano (Eat the Frog technique).';
      }
      return '⏰ Zastosuj 5-Minute Rule: Obiecaj sobie że pracujesz tylko 5 min. Często to wystarczy żeby zacząć.';
    }
    if (risk > 0.5) {
      return '📅 Zaplanuj konkretny czas (time-boxing): "Jutro 10:00-11:00 robię ten task" i trzymaj się tego.';
    }

    return '✅ Task wygląda OK. Jeśli czujesz opór, sprawdź czy nie jest za duży.';
  }

  async predict(task: any): Promise<ProcrastinationRisk> {
    // Recent behavior (last hour, same window as getFocusContext's default) rather than
    // this specific task's window, since candidate tasks haven't been started yet.
    const now = Date.now();
    const recentWindowStart = now - 60 * 60 * 1000;

    const historicalData = {
      switchCount: getAppSwitchCount(recentWindowStart, now),
      webDistractionScore: getWebDistractionRatio(recentWindowStart, now),
      daysSinceLastSimilar: getDaysSinceLastSimilarTask(
        task.userId || getActiveUserId(),
        task.type || 'TASK',
        task.id,
      ),
    };

    const features = this.extractFeatures(task, historicalData);

    if (!this.isTrained) {
      return {
        taskId: task.id,
        risk: 0,
        confidence: 0,
        reasons: [],
        suggestion: '',
      };
    }

    const risk = tf.tidy(() => {
      const input = tf.tensor2d([features], [1, 8]);
      const prediction = this.model.predict(input) as tf.Tensor;
      return prediction.dataSync()[0];
    });

    const confidence = Math.min(risk * 1.2, 1.0); // Higher risk = higher confidence

    const reasons = this.generateReasons(features);
    const suggestion = this.generateSuggestion(features, risk);

    return {
      taskId: task.id,
      risk,
      confidence,
      reasons,
      suggestion,
    };
  }

  async analyzeTasks(userId: number): Promise<ProcrastinationRisk[]> {
    const tasks = getTasks(userId);

    // Only analyze non-completed, non-in-progress tasks
    const candidates = tasks.filter(
      (t: any) => t.status === 'To Do' && !t.startTimer,
    );

    const risks: ProcrastinationRisk[] = [];

    for (const task of candidates) {
      const risk = await this.predict(task);
      if (risk.risk > 0.5) {
        // Only return high-risk tasks
        risks.push(risk);
      }
    }

    // Sort by risk descending
    return risks.sort((a, b) => b.risk - a.risk);
  }

  // Resolves true only when the model was actually fitted (see NeuralCore.train).
  async train(userId: number): Promise<boolean> {
    if (this.isTraining) return false;

    const now = Date.now();
    if (now - this.lastTrainingTime < 24 * 60 * 60 * 1000) return false; // Train once per day

    this.isTraining = true;
    this.lastTrainingTime = now;

    try {
      const tasks = getTasks(userId);

      // Label data: Tasks that took >2x estimate or sat for >7 days = procrastinated (1)
      // Tasks completed quickly = not procrastinated (0)
      const labeledData: { features: number[]; label: number }[] = [];

      tasks.forEach((task: any) => {
        if (task.status === 'Completed' && task.estimate) {
          const actualHours = (task.spendTime || 0) / (1000 * 60 * 60);
          const createdDate = parseTaskDate(task.createdAt);
          const completedDate = parseTaskDate(task.updateStatusDate);
          const daysToComplete =
            (completedDate - createdDate) / (1000 * 60 * 60 * 24);

          // Heuristic labeling
          const wasProcrastinated =
            actualHours > task.estimate * 2 || daysToComplete > 7 ? 1 : 0;

          // Same signals predict() uses, but anchored to when this task was actually created -
          // using "now" here would give every training row the same constant value for these
          // three features (zero variance), which is the same train/serve skew as hardcoding them.
          const windowStart = createdDate - 60 * 60 * 1000;
          const historicalData = {
            switchCount: getAppSwitchCount(windowStart, createdDate),
            webDistractionScore: getWebDistractionRatio(
              windowStart,
              createdDate,
            ),
            daysSinceLastSimilar: getDaysSinceLastSimilarTask(
              task.userId || userId,
              task.type || 'TASK',
              task.id,
              createdDate,
            ),
          };
          const features = this.extractFeatures(task, historicalData);

          labeledData.push({ features, label: wasProcrastinated });
        }
      });

      if (labeledData.length < 10) {
        logSystemEvent(
          `[ProcrastinationDetector] Training skipped: ${labeledData.length} completed tasks with an estimate (need 10).`,
          'LEARNING',
        );
        return false;
      }

      const { inputs, labels } = tf.tidy(() => {
        const inputData = labeledData.map((d) => d.features);
        const labelData = labeledData.map((d) => [d.label]);

        return {
          inputs: tf.tensor2d(inputData, [inputData.length, 8]),
          labels: tf.tensor2d(labelData, [labelData.length, 1]),
        };
      });

      await this.model.fit(inputs, labels, {
        epochs: 50,
        batchSize: 16,
        shuffle: true,
        validationSplit: 0.2,
        callbacks: {
          onTrainEnd: () => {
            logSystemEvent(
              '[ProcrastinationDetector] Training complete',
              'LEARNING',
            );
            this.saveWeights();
          },
        },
      });

      inputs.dispose();
      labels.dispose();
      this.isTrained = true;
      return true;
    } catch (e) {
      log.error('ProcrastinationDetector training failed', e);
      return false;
    } finally {
      this.isTraining = false;
    }
  }
}

export const procrastinationDetector = new ProcrastinationDetector();
