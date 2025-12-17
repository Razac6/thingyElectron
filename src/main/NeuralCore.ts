import * as tf from '@tensorflow/tfjs';
import {
  logSystemEvent,
  getDailyBio,
  getAiMaturity,
  getAllSettings,
  getTasks,
  getRecentWorkSessions
} from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';
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
        // Try DD.MM.YYYY (common locale format causing issues)
        const parts = str.split('.');
        if (parts.length === 3) {
            // YYYY-MM-DD
            d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    }
    return isNaN(d.getTime()) ? new Date() : d; // Fallback to now
};

export class NeuralCore {
  model: tf.Sequential;
  isTraining: boolean = false;
  lastTrainingTime: number = 0;

  constructor() {
    this.model = tf.sequential();
    this.initModel();
    this.loadWeights(); // Load memory on startup
  }

  private initModel() {
    // Input: [Hour, Day, Priority, SleepScore, MeetingLoad] (5 features)
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [5] }));
    this.model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 1 })); // Output: Duration (minutes)

    this.model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    logSystemEvent('NeuralCore initialized. Model architecture ready (Inputs: Hour, Day, Priority, Sleep, Meetings).', 'SYSTEM');
  }

  private async saveWeights() {
    try {
        const weights = this.model.getWeights();
        const weightData = weights.map(w => Array.from(w.dataSync()));
        fs.writeFileSync(MODEL_PATH, JSON.stringify(weightData));
        logSystemEvent(`NeuralCore memory saved to: ${MODEL_PATH}`, 'DEBUG');
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
        logSystemEvent('NeuralCore memory loaded from disk. Identity restored.', 'SYSTEM');
        
        // Cleanup tensors created during load
        weights.forEach((w: tf.Tensor) => w.dispose());
    } catch (e) {
        console.error('Failed to load neural weights', e);
    }
  }

  /**
   * Prepares data from Tasks
   */
  private preprocessData(tasks: any[]) {
    const inputs: number[][] = [];
    const outputs: number[] = [];

    tasks.forEach(task => {
      if (task.status === 'Completed' && task.spendTime > 0) {
        const dateObj = parseDate(task.createdAt);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        const hour = dateObj.getHours();
        const day = dateObj.getDay();
        const priority = PRIORITY_MAP[task.priority] || 2;
        
        // Fetch bio context for that day
        const bio = getDailyBio(dateStr);
        const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75; // Default 75 if missing
        const meetingLoad = (bio.meetingTime || 0) / 480; // Normalize 0-8h to 0-1

        inputs.push([hour, day, priority, sleep, meetingLoad]);
        outputs.push(task.spendTime / (1000 * 60)); // Minutes
      }
    });

    if (inputs.length > 0) {
        // console.log('[NEURAL DEBUG] Sample Input:', inputs[0], 'Output:', outputs[0]);
    }

    return {
      inputs: tf.tensor2d(inputs),
      outputs: tf.tensor2d(outputs, [outputs.length, 1])
    };
  }

  async train(tasks: any[]) {
    if (this.isTraining) return;
    
    // Cooldown check (10 minutes)
    const now = Date.now();
    if (now - this.lastTrainingTime < 10 * 60 * 1000) {
        // logSystemEvent('[NEURAL] Skipping training (cooldown active).', 'DEBUG');
        return;
    }

    this.isTraining = true;
    this.lastTrainingTime = now;

    const { inputs, outputs } = this.preprocessData(tasks);
    const count = inputs.shape[0];

    if (count < 5) {
      logSystemEvent(`[NEURAL] Not enough data to train (${count} samples). Need > 5.`, 'DEBUG');
      this.isTraining = false;
      return;
    }

    logSystemEvent(`[NEURAL] Starting training on ${count} tasks with Bio-Context...`, 'LEARNING');

    try {
        await this.model.fit(inputs, outputs, {
          epochs: 10,
          batchSize: 32,
          shuffle: true,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              if (epoch % 10 === 0) {
                 // logSystemEvent(`[NEURAL] Epoch ${epoch}: Loss ${logs?.loss.toFixed(4)}`, 'DEBUG');
              }
            },
            onTrainEnd: () => {
                logSystemEvent(`[NEURAL] Training Complete. Model updated with Sleep Data.`, 'LEARNING');
                this.saveWeights();
                const trainings = Number(getSetting('neural_training_count') || 0) + 1;
                setSetting('neural_training_count', String(trainings));
                setSetting('neural_data_count', String(count));
            }
          }
        });
    } catch (e) {
        logSystemEvent(`[NEURAL] Training Error: ${e}`, 'DEBUG');
    } finally {
        this.isTraining = false;
        inputs.dispose();
        outputs.dispose();
    }
  }

  predict(task: any): number {
    // Prediction for new/existing task
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0];
    
    const hour = dateObj.getHours();
    const day = dateObj.getDay();
    const priority = PRIORITY_MAP[task.priority] || 2;
    
    const bio = getDailyBio(dateStr);
    const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
    const meetingLoad = (bio.meetingTime || 0) / 480;

    const input = tf.tensor2d([[hour, day, priority, sleep, meetingLoad]]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const value = prediction.dataSync()[0];
    
    input.dispose();
    prediction.dispose();

    return value; // Minutes
  }

  // Prediction based on specific task context (historical or current)
  predictForTask(task: any): number {
      const dateObj = parseDate(task.createdAt); // Or updateStatusDate if better
      const dateStr = dateObj.toISOString().split('T')[0];
      
      const hour = dateObj.getHours();
      const day = dateObj.getDay();
      const priority = PRIORITY_MAP[task.priority] || 2;
      
      const bio = getDailyBio(dateStr);
      const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
      const meetingLoad = (bio.meetingTime || 0) / 480;

      const input = tf.tensor2d([[hour, day, priority, sleep, meetingLoad]]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const value = prediction.dataSync()[0];
      
      input.dispose();
      prediction.dispose();

      return value;
  }

  async getPerformanceHistory(userId: number, days: number = 7) {
      const tasks = getTasks(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const groupedData: { [key: string]: { actual: number, predicted: number } } = {};

      // Initialize dates to ensure 0-values for empty days
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
                  
                  // Actual time (ms -> min)
                  const actualMin = (task.spendTime || 0) / (1000 * 60);
                  
                  // Predicted time
                  // We use the task properties. 
                  // Note: Predicting on *completed* task asks "How long should this have taken?"
                  const predictedMin = this.predictForTask(task);

                  if (groupedData[dateStr]) {
                      groupedData[dateStr].actual += actualMin;
                      groupedData[dateStr].predicted += predictedMin;
                  }
              }
          }
      });

      // Convert to array and sort
      return Object.entries(groupedData)
          .map(([date, data]) => ({
              date,
              actual: Math.round(data.actual),
              predicted: Math.round(data.predicted)
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
  }
  
  resetCooldown() {
      this.lastTrainingTime = 0;
  }

  private getRandomResponse(diff: number, category: 'high' | 'low' | 'neutral' | 'focus', activeTask?: string): string {
      const absDiff = Math.round(Math.abs(diff));
      
      const templates = {
          high: [
              `Thingy: Wyczuwam duży opór poznawczy (+${absDiff}%). To może być ciężka przeprawa.`,
              `Thingy: Przewiduję trudną sesję (+${absDiff}% wysiłku). Może rozbij to na mniejsze kroki?`,
              `Thingy: Poziom energii wydaje się niski (+${absDiff}% obciążenia). Może kawa lub drzemka?`,
              `Thingy: Ostrzeżenie: Wykryto wysoki opór (+${absDiff}%). Nie forsuj się, jeśli utkniesz.`,
              `Thingy: Moje obwody sugerują, że to trudny moment (+${absDiff}%). Bądź dla siebie wyrozumiały.`
          ],
          low: [
              `Thingy: Wszystkie systemy sprawne! Przewiduję, że zmiażdżysz to zadanie (-${absDiff}% czasu).`,
              `Thingy: Warunki są optymalne (-${absDiff}% tarcia). Idealny czas na głęboką pracę.`,
              `Thingy: Widzę zielone światło (-${absDiff}% wysiłku). Wykorzystaj ten pęd!`,
              `Thingy: Statystycznie jesteś teraz w formie (-${absDiff}%). Zjedz tę żabę!`,
              `Thingy: Prognoza wydajności: Wyśmienita (-${absDiff}%). Możesz skończyć przed czasem.`
          ],
          neutral: [
              `Thingy: Status: Nominalny. Twoja wydajność jest w normie. Dobry czas na rutynę.`,
              `Thingy: Nie widzę anomalii. Po prostu kolejny produktywny dzień. Działaj.`,
              `Thingy: Warunki stabilne. Dobry moment na utrzymanie regularności.`,
              `Thingy: Predykcja: Standardowa wydajność. Skup się na postępie.`,
              `Thingy: System gotowy. Działasz na swoim normalnym poziomie.`
          ],
          focus: [
              `Thingy: Widzę, że pracujesz nad "{task}". Nie przeszkadzam. Trzymaj flow!`,
              `Thingy: Aktywny timer: "{task}". Pamiętaj o jednej rzeczy na raz.`,
              `Thingy: Jesteś w trakcie zadania. Wyłącz rozpraszacze i dowieź to.`,
              `Thingy: Monitoruję Twoją sesję "{task}". Wygląda na to, że idzie Ci świetnie.`,
              `Thingy: Skupienie wykryte. Oddychaj głęboko i kontynuuj pracę.`
          ]
      };

      const options = templates[category];
      return options[Math.floor(Math.random() * options.length)].replace('{task}', activeTask || 'zadaniem');
  }

  async generateDailyReport(userId: number): Promise<string> {
      const tasks = getTasks(userId);
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      // Filter today's completed tasks
      const todayTasks = tasks.filter(t => 
          t.status === 'Completed' && 
          t.updateStatusDate && 
          t.updateStatusDate.startsWith(dateStr)
      );

      const totalDurationMs = todayTasks.reduce((acc, t) => acc + (t.spendTime || 0), 0);
      const totalDurationMin = Math.round(totalDurationMs / (1000 * 60));
      const hours = Math.floor(totalDurationMin / 60);
      const mins = totalDurationMin % 60;

      // Get Context
      const bio = getDailyBio(dateStr);
      const meetingTime = bio.meetingTime || 0;
      const sleep = bio.sleepScore;

      // Get Algo Stats
      const recentSessions = getRecentWorkSessions(userId, 1); // Last 24h
      const focusScore = ProductivityAnalyst.analyzeFocusQuality(recentSessions);
      const fatigue = ProductivityAnalyst.analyzeFatigue(recentSessions);

      // AI Comparison
      let aiComment = "";
      if (todayTasks.length > 0) {
          let totalPredictedMin = 0;
          todayTasks.forEach(t => {
              totalPredictedMin += this.predictForTask(t);
          });
          
          const diff = totalDurationMin - totalPredictedMin;
          const diffPercent = totalPredictedMin > 0 ? Math.round((diff / totalPredictedMin) * 100) : 0;

          if (Math.abs(diffPercent) < 15) {
              aiComment = "Moje predykcje były bardzo trafne. Pracowałeś/aś zgodnie z oczekiwanym tempem.";
          } else if (diffPercent < 0) {
              aiComment = `Zaskoczyłeś/aś mnie! Pracowałeś/aś o ${Math.abs(diffPercent)}% szybciej niż przewidywałem w tych warunkach. Stan Flow?`;
          } else {
              aiComment = `Wykryłem spowolnienie (${diffPercent}% powyżej estymaty). Możliwe ukryte blokady lub zmęczenie.`;
          }
      } else {
          aiComment = "Brak ukończonych zadań do analizy porównawczej.";
      }

      // Build Report
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pl-PL');
      
      const report = [
          `RAPORT AI (${dateStr} ${timeStr})`,
          `--------------------------------`,
          `LOGISTYKA:`,
          `- Ukończone zadania: ${todayTasks.length}`,
          `- Czas pracy: ${hours}h ${mins}m`,
          `- Spotkania: ${(meetingTime / 60).toFixed(1)}h`,
          `- Sen: ${sleep ? sleep + '%' : 'Brak danych'}`,
          ``,
          `ANALIZA ALGORYTMICZNA:`,
          `- Jakość Skupienia (Deep Work): ${focusScore}%`,
          `- Poziom Zmęczenia: ${fatigue.isFatigued ? 'WYSOKI (Odpocznij!)' : 'W normie'}`,
          `- Średnia sesja: ${Math.round(fatigue.averageSession)} min`,
          ``,
          `WNIOSKI NEURAL CORE (AI):`,
          `${aiComment}`,
          ``,
          `PODSUMOWANIE:`,
          `${ProductivityAnalyst.generateDailyTip({ slope: 0, direction: 'stable', description: '' }, fatigue, bio.mode, sleep || 75, meetingTime)}`
      ];

      return report.join('\n');
  }

  getNeuralAdvice(activeTask?: string): { text: string, category: 'high' | 'low' | 'neutral' | 'focus' } {
    if (!this.model || this.isTraining) return { text: "Thingy: Kalibruję się... proszę czekać.", category: 'neutral' };

    // 1. Focus Override
    if (activeTask) {
        return { text: this.getRandomResponse(0, 'focus', activeTask), category: 'focus' };
    }

    // Context Data
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const bio = getDailyBio(dateStr);
    const sleep = bio.sleepScore !== null ? Number(bio.sleepScore) : 75;
    const meetingTime = bio.meetingTime || 0;
    const meetingLoad = meetingTime / 480;
    const maturity = getAiMaturity();

    // 2. Hard Rules (Bio-Instinct) - These override AI predictions
    if (meetingTime > 180) {
        return { text: this.getRandomResponse(50, 'high'), category: 'high' }; // Force High Load response
    }
    if (bio.sleepScore !== null && sleep < 45) {
        return { text: this.getRandomResponse(50, 'high'), category: 'high' }; // Force High Load response
    }

    // 3. Early Game Stabilization (Suppress random noise from untrained model)
    if (maturity < 25) {
        // While learning, only react to extreme time conditions (e.g., late night)
        const hour = date.getHours();
        if (hour >= 22 || hour < 5) {
             return { text: "Thingy: Pora na regenerację systemów. Odpocznij.", category: 'low' };
        }
        // Otherwise, stay neutral/stable
        return { text: `Thingy: Analizuję Twoje wzorce (Dojrzałość: ${maturity}%).`, category: 'neutral' };
    }

    // 4. Neural Prediction (Only for mature models > 25%)
    // Baseline: Medium Priority Task, 75 Sleep, 12:00 PM, 30m Meetings (Ideal conditions proxy)
    const baselineInput = tf.tensor2d([[12, 3, 2, 75, 30/480]]); 
    const baselinePred = (this.model.predict(baselineInput) as tf.Tensor).dataSync()[0];
    baselineInput.dispose();

    // Current Reality
    const currentInput = tf.tensor2d([[date.getHours(), date.getDay(), 2, sleep, meetingLoad]]);
    const currentPred = (this.model.predict(currentInput) as tf.Tensor).dataSync()[0];
    currentInput.dispose();

    // Compare
    const diff = ((currentPred - baselinePred) / baselinePred) * 100; // % difference

    if (diff > 40) return { text: this.getRandomResponse(diff, 'high'), category: 'high' };
    if (diff < -25) return { text: this.getRandomResponse(diff, 'low'), category: 'low' };
    return { text: this.getRandomResponse(diff, 'neutral'), category: 'neutral' };
  }
}

export const neuralCore = new NeuralCore();