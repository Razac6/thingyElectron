import * as tf from '@tensorflow/tfjs';
import {
  logSystemEvent,
  getDailyBio,
  getAiMaturity,
  getAllSettings,
  getSetting,
  setSetting,
  getTasks,
  getRecentWorkSessions,
  getHabits,
  getHabitLogs,
  getActiveSprint,
  getSprintTasks,
  getTagAnalytics,
  getTagByName
} from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';
import { personalityEngine, AiMood } from './PersonalityEngine';
import { llamaEngine } from './LlamaEngine';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Simple mapping for priorities
const PRIORITY_MAP: { [key: string]: number } = {
  'Low': 1,
  'Medium': 2,
  'High': 3
};

const MODEL_PATH = path.join(app.getPath('userData'), 'neural-core-weights.json');

const parseDate = (str: string) => {
    let d = new Date(str);
    if (isNaN(d.getTime())) {
        const parts = str.split('.');
        if (parts.length === 3) {
            d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    }
    return isNaN(d.getTime()) ? new Date() : d;
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
    // Input: [Hour, Day, Priority, SleepScore, MeetingLoad, HabitScore] (6 features)
    this.model.add(tf.layers.dense({ units: 24, activation: 'relu', inputShape: [6] }));
    this.model.add(tf.layers.dense({ units: 12, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 1 }));

    this.model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    logSystemEvent('NeuralCore initialized. Model updated (6 Features: Hour, Day, Priority, Sleep, Meetings, Habits).', 'SYSTEM');
  }

  private async saveWeights() {
    try {
        const weights = this.model.getWeights();
        const weightData = weights.map(w => Array.from(w.dataSync()));
        fs.writeFileSync(MODEL_PATH, JSON.stringify(weightData));
    } catch (e) {
        console.error('Failed to save neural weights', e);
    }
  }

  private async loadWeights() {
    if (!fs.existsSync(MODEL_PATH)) return;
    try {
        const data = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8'));
        const weights = data.map((w: any[]) => tf.tensor(w));
        this.model.setWeights(weights);
        logSystemEvent('NeuralCore memory loaded from disk.', 'SYSTEM');
        weights.forEach((w: tf.Tensor) => w.dispose());
    } catch (e) {
        console.error('Failed to load neural weights', e);
    }
  }

  private determineMood(risk: any, sleep: number, habitScore: number): AiMood {
      if (risk && risk.risk === 'Critical') return 'PANIC';
      if (risk && risk.risk === 'At Risk') return 'SUPPORTIVE';
      if (sleep < 50) return 'SUPPORTIVE';
      if (habitScore > 0.8 && risk?.risk === 'Stable') return 'GRIND';
      if (habitScore > 0.5) return 'STABLE';
      return 'CHILL';
  }

  private preprocessData(tasks: any[], userId: number) {
    const inputs: number[][] = [];
    const outputs: number[] = [];
    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);

    tasks.forEach(task => {
      if (task.status === 'Completed' && task.spendTime > 0) {
        const dateObj = parseDate(task.createdAt);
        const dateStr = dateObj.toISOString().split('T')[0];
        const bio = getDailyBio(dateStr);
        const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
        const meetingLoad = (bio.meetingTime || 0) / 480;

        let habitScore = 0.5;
        if (habits.length > 0) {
            const completedOnDay = logs.filter((l: any) => l.date === dateStr && l.value >= 1).length;
            habitScore = completedOnDay / habits.length;
        }

        inputs.push([dateObj.getHours(), dateObj.getDay(), PRIORITY_MAP[task.priority] || 2, sleep, meetingLoad, habitScore]);
        outputs.push(task.spendTime / (1000 * 60));
      }
    });

    return {
      inputs: tf.tensor2d(inputs),
      outputs: tf.tensor2d(outputs, [outputs.length, 1])
    };
  }

  async train(tasks: any[]) {
    if (this.isTraining) return;
    const now = Date.now();
    if (now - this.lastTrainingTime < 10 * 60 * 1000) return;

    const userId = tasks.length > 0 ? tasks[0].userId : 1;
    this.isTraining = true;
    this.lastTrainingTime = now;

    try {
        const { inputs, outputs } = this.preprocessData(tasks, userId);
        if (inputs.shape[0] < 5) {
            this.isTraining = false;
            inputs.dispose(); outputs.dispose();
            return;
        }

        await this.model.fit(inputs, outputs, {
          epochs: 10,
          batchSize: 32,
          shuffle: true,
          callbacks: {
            onTrainEnd: () => {
                logSystemEvent(`[NEURAL] Training Complete.`, 'LEARNING');
                this.saveWeights();
                const trainings = Number(getSetting('neural_training_count') || 0) + 1;
                setSetting('neural_training_count', String(trainings));
            }
          }
        });
        inputs.dispose(); outputs.dispose();
    } catch (e) {
        console.error('Training failed', e);
    } finally {
        this.isTraining = false;
    }
  }

  predict(task: any): number {
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0];
    const userId = task.userId || 1;
    const bio = getDailyBio(dateStr);
    const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
    const meetingLoad = (bio.meetingTime || 0) / 480;

    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);
    let habitScore = 0.5;
    if (habits.length > 0) {
        const completedToday = logs.filter((l: any) => l.date === dateStr && l.value >= 1).length;
        habitScore = completedToday / habits.length;
    }

    let tagEmaSum = 0; let tagCount = 0;
    if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach((tagName: string) => {
            const tagId = getTagByName(tagName);
            if (tagId) {
                const analytics = getTagAnalytics(tagId[0]);
                if (analytics && analytics.completed_count > 0) {
                    tagEmaSum += analytics.ema; tagCount++;
                }
            }
        });
    }

    const input = tf.tensor2d([[dateObj.getHours(), dateObj.getDay(), PRIORITY_MAP[task.priority] || 2, sleep, meetingLoad, habitScore]]);
    const prediction = this.model.predict(input) as tf.Tensor;
    let finalMin = prediction.dataSync()[0];
    input.dispose(); prediction.dispose();

    if (tagCount > 0) {
        const avgTagMin = (tagEmaSum / tagCount) / (1000 * 60);
        const maturity = getAiMaturity();
        finalMin = maturity < 50 ? avgTagMin : (finalMin * 0.6 + avgTagMin * 0.4);
    }

    return finalMin < 15 ? 60 : finalMin;
  }

  predictForTask(task: any): number {
      const dateObj = parseDate(task.createdAt);
      const dateStr = dateObj.toISOString().split('T')[0];
      const userId = task.userId || 1;
      const bio = getDailyBio(dateStr);
      const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
      const meetingLoad = (bio.meetingTime || 0) / 480;

      const hour = dateObj.getHours();
      const day = dateObj.getDay();
      const priority = PRIORITY_MAP[task.priority] || 2;

      const habits = getHabits(userId);
      const logs = getHabitLogs(userId);
      let habitScore = 0.5;
      if (habits.length > 0) {
          const completedOnDay = logs.filter((l: any) => l.date === dateStr && l.value >= 1).length;
          habitScore = completedOnDay / habits.length;
      }

      const input = tf.tensor2d([[hour, day, priority, sleep, meetingLoad, habitScore]]);
      const prediction = this.model.predict(input) as tf.Tensor;
      let value = prediction.dataSync()[0];
      input.dispose(); prediction.dispose();
      return value < 15 ? 60 : value;
  }

  async getPerformanceHistory(userId: number, days: number = 7) {
      const tasks = getTasks(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const groupedData: { [key: string]: { actual: number, predicted: number } } = {};

      for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          groupedData[dateStr] = { actual: 0, predicted: 0 };
      }

      tasks.forEach(task => {
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
              predicted: Math.round(data.predicted)
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
  }

  async generateDailyReport(userId: number): Promise<string> {
      const tasks = getTasks(userId);
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const todayTasks = tasks.filter(t => 
          t.status === 'Completed' && t.updateStatusDate && t.updateStatusDate.startsWith(dateStr)
      );

      const totalDurationMs = todayTasks.reduce((acc, t) => acc + (t.spendTime || 0), 0);
      const totalDurationMin = Math.round(totalDurationMs / (1000 * 60));
      const hours = Math.floor(totalDurationMin / 60);
      const mins = totalDurationMin % 60;

      const bio = getDailyBio(dateStr);
      const meetingTime = bio.meetingTime || 0;
      const sleep = bio.sleepScore;

      const recentSessions = getRecentWorkSessions(userId, 1); 
      const focusScore = ProductivityAnalyst.analyzeFocusQuality(recentSessions);
      const fatigue = ProductivityAnalyst.analyzeFatigue(recentSessions);

      let aiComment = "";
      if (todayTasks.length > 0) {
          let totalPredictedMin = 0;
          todayTasks.forEach(t => { totalPredictedMin += this.predictForTask(t); });
          const diff = totalDurationMin - totalPredictedMin;
          const diffPercent = totalPredictedMin > 0 ? Math.round((diff / totalPredictedMin) * 100) : 0;

          if (Math.abs(diffPercent) < 15) aiComment = "Predykcje trafne.";
          else if (diffPercent < 0) aiComment = `Szybciej o ${Math.abs(diffPercent)}%.`;
          else aiComment = `Wolniej o ${diffPercent}%.`;
      }

      return `RAPORT AI: ${hours}h ${mins}m pracy. Sen: ${sleep || '?'}. ${aiComment}`;
  }

  resetCooldown() { this.lastTrainingTime = 0; }

  async getNeuralAdvice(activeTask?: string): Promise<{ text: string, category: 'high' | 'low' | 'neutral' | 'focus' }> {
    if (!this.model || this.isTraining) return { text: "Thingy: Kalibruję się... proszę czekać.", category: 'neutral' };

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const userId = 1;
    
    const bio = getDailyBio(dateStr);
    const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
    const habits = getHabits(userId);
    const logs = getHabitLogs(userId);
    const habitCount = logs.filter((l: any) => l.date === dateStr && l.value >= 1).length;
    const habitScore = habits.length > 0 ? habitCount / habits.length : 0.5;

    const sprint = getActiveSprint();
    let risk = null; let tasksRemaining = 0;
    if (sprint) {
        const tasks = getSprintTasks(sprint.id);
        const unfinished = tasks.filter(t => t.status !== 'Completed');
        tasksRemaining = unfinished.length;
        const predictions = unfinished.map(t => this.predictForTask(t));
        const sessions = getRecentWorkSessions(userId, 14);
        risk = ProductivityAnalyst.analyzeSprintRisk(sprint, tasks, sessions, predictions, { 
            start: getSetting('workDayStart') || '09:00', 
            end: getSetting('workDayEnd') || '17:00' 
        });
    }

    if (activeTask) return { text: `Thingy: Widzę, że pracujesz nad "${activeTask}". Monitoruję Twoje skupienie.`, category: 'focus' };

    const mood = this.determineMood(risk, sleep, habitScore);
    
    // --- Llama Integration ---
    const llamaStatus = llamaEngine.getStatus();
    let text = "";

    if (llamaStatus.ready) {
        try {
            const sleepDesc = sleep < 50 ? "słabo spał" : (sleep > 85 ? "jest bardzo wypoczęty" : "wyspał się normalnie");
            const sprintDesc = risk?.risk === 'Critical' ? "sprint jest bardzo zagrożony" : (risk?.risk === 'At Risk' ? "sprint jest lekko opóźniony" : "wszystko ze sprintem jest w porządku");
            const habitDesc = habitScore > 0.8 ? "świetnie trzyma nawyki" : (habitScore < 0.3 ? "zaniedbał dziś nawyki" : "nawyki są na średnim poziomie");

            const prompt = `Marcin ${sleepDesc}. Ma do zrobienia jeszcze ${tasksRemaining} zadań. ${sprintDesc}, a on ${habitDesc}. Twój nastrój to ${mood}. Powiedz mu coś krótkiego i sensownego o jego sytuacji.`;
            
            text = await llamaEngine.generateMessage(prompt, { mood, sleep, habitScore, risk });
        } catch (e) {
            text = personalityEngine.generateMessage({ mood, userName: 'Marcin', sprintRisk: risk, habitScore, tasksRemaining });
        }
    } else {
        text = personalityEngine.generateMessage({ mood, userName: 'Marcin', sprintRisk: risk, habitScore, tasksRemaining });
    }

    const categoryMap: Record<AiMood, 'high' | 'low' | 'neutral' | 'focus'> = {
        PANIC: 'high', SUPPORTIVE: 'high', GRIND: 'low', CELEBRATION: 'low', STABLE: 'neutral', CHILL: 'neutral'
    };
    return { text, category: categoryMap[mood] };
  }
}

export const neuralCore = new NeuralCore();
