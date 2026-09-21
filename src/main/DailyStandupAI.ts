import { getTasks, getRecentWorkSessions, getDailyBio } from './db';
import { ProductivityAnalyst } from './ProductivityAnalysis';

export interface StandupData {
  date: string;
  summary: string;
  completed: TaskSummary[];
  inProgress: TaskSummary[];
  stats: StandupStats;
  insights: string[];
  recommendations: string[];
  yesterday?: {
    completedCount: number;
    totalTimeMs: number;
  };
  topSuggestion?: {
    id: number;
    title: string;
  };
  challenge?: {
    description: string;
  };
}

interface TaskSummary {
  id: number;
  title: string;
  type: string;
  spendTime: number;
  estimate?: number;
  tags?: string;
}

interface StandupStats {
  totalTime: number; // hours
  taskCount: number;
  deepWorkMinutes: number;
  focusScore: number;
  longestTask: string;
  productivity: 'low' | 'medium' | 'high';
}

function formatTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.round((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getProductivityLevel(
  focusScore: number,
  taskCount: number,
): 'low' | 'medium' | 'high' {
  if (focusScore > 75 && taskCount >= 3) return 'high';
  if (focusScore > 50 || taskCount >= 2) return 'medium';
  return 'low';
}

function generateInsights(
  completed: TaskSummary[],
  stats: StandupStats,
  bio: any,
): string[] {
  const insights: string[] = [];

  // 1. Focus Quality Insight
  if (stats.focusScore > 80) {
    insights.push(
      `🎯 Świetny focus dzisiaj! ${stats.focusScore}% czasu w Deep Work`,
    );
  } else if (stats.focusScore < 30) {
    insights.push(
      `⚠️ Niska koncentracja (${stats.focusScore}%). Może za dużo rozproszeń?`,
    );
  }

  // 2. Productivity vs Estimate
  const withEstimates = completed.filter((t) => t.estimate && t.estimate > 0);
  if (withEstimates.length > 0) {
    const avgAccuracy =
      withEstimates.reduce((sum, t) => {
        const actualHours = t.spendTime / (1000 * 60 * 60);
        const diff = Math.abs(actualHours - (t.estimate || 0));
        return sum + diff;
      }, 0) / withEstimates.length;

    if (avgAccuracy < 0.5) {
      insights.push(
        `📊 Twoje estymaty są bardzo trafne (avg ±${(avgAccuracy * 60).toFixed(0)}min)`,
      );
    } else if (avgAccuracy > 1.5) {
      insights.push(
        `📊 Estymaty średnio odbiegają o ${avgAccuracy.toFixed(1)}h - może używać AI predict?`,
      );
    }
  }

  // 3. Task Velocity
  if (completed.length >= 5) {
    insights.push(`🔥 Beast mode: ${completed.length} tasków ukończonych!`);
  } else if (completed.length === 0 && stats.totalTime > 2) {
    insights.push(
      `🤔 ${stats.totalTime.toFixed(1)}h pracy bez ukończonego taska - może dzielisz za duże kawałki?`,
    );
  }

  // 4. Bio Data Context
  if (bio.sleepScore && bio.sleepScore < 50) {
    insights.push(
      `😴 Niski sen (${bio.sleepScore}/100) ale i tak ${stats.taskCount} tasków - szacun!`,
    );
  } else if (bio.sleepScore && bio.sleepScore > 90) {
    insights.push(
      `💤 Świetny sen (${bio.sleepScore}/100) przekłada się na wydajność`,
    );
  }

  // 5. Meeting Load
  if (bio.meetingTime && bio.meetingTime > 180) {
    insights.push(
      `📅 ${Math.floor(bio.meetingTime / 60)}h meetingów to dużo. Cognitively draining day!`,
    );
  }

  return insights.slice(0, 3); // Max 3 insights
}

function generateRecommendations(
  stats: StandupStats,
  inProgress: TaskSummary[],
  sessions: any[],
): string[] {
  const recommendations: string[] = [];

  // 1. Based on focus score
  if (stats.focusScore < 40) {
    recommendations.push(
      '💡 Spróbuj Pomodoro (25min focus) - Twoje sesje są zbyt rozproszone',
    );
  }

  // 2. Based on session pattern
  const avgSessionLength =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.duration, 0) /
        sessions.length /
        (1000 * 60)
      : 0;

  if (avgSessionLength > 90) {
    recommendations.push(
      '⏰ Robisz długie sesje (90min+). Zaplanuj krótkie przerwy co 90min',
    );
  } else if (avgSessionLength < 20) {
    recommendations.push(
      '🎯 Krótkie sesje (<20min) - może za często przełączasz kontekst?',
    );
  }

  // 3. In Progress tasks
  if (inProgress.length > 5) {
    recommendations.push(
      `📦 Masz ${inProgress.length} tasków "In Progress" - może skupić się na dokończeniu 1-2?`,
    );
  }

  // 4. Work-life balance
  if (stats.totalTime > 10) {
    recommendations.push(
      '🚨 Ponad 10h pracy! Pamiętaj o balansie. Burnout to prawdziwe ryzyko.',
    );
  } else if (stats.totalTime < 2 && stats.taskCount === 0) {
    recommendations.push(
      '🌟 Lekki dzień - dobry moment na planowanie jutrzejszego sprintu',
    );
  }

  return recommendations.slice(0, 3); // Max 3 recommendations
}

export function generateDailyStandup(userId: number): StandupData {
  const tasks = getTasks(userId);
  const today = new Date().toISOString().split('T')[0];
  const dateStr = today;

  // Filter tasks for today
  const completed = tasks.filter(
    (t) =>
      t.status === 'Completed' &&
      t.updateStatusDate &&
      t.updateStatusDate.startsWith(dateStr),
  );

  const inProgress = tasks.filter(
    (t) =>
      t.status === 'In Progress' ||
      (t.status === 'To Do' && t.startTimer !== null),
  );

  // Calculate stats
  const totalTimeMs = completed.reduce((sum, t) => sum + (t.spendTime || 0), 0);
  const totalTime = totalTimeMs / (1000 * 60 * 60);

  // Get productivity analysis
  const sessions = getRecentWorkSessions(userId, 1); // Today's sessions
  const focusAnalysis = ProductivityAnalyst.analyzeFocusQuality(sessions);

  // Find longest task
  const longestTask =
    completed.length > 0
      ? completed.reduce(
          (max, t) => (t.spendTime > max.spendTime ? t : max),
          completed[0],
        )
      : null;

  const stats: StandupStats = {
    totalTime,
    taskCount: completed.length,
    deepWorkMinutes: focusAnalysis.deepWorkMinutes,
    focusScore: focusAnalysis.score,
    longestTask: longestTask?.title || 'N/A',
    productivity: getProductivityLevel(focusAnalysis.score, completed.length),
  };

  // Get bio data
  const bio = getDailyBio(dateStr);

  // Generate insights and recommendations
  const insights = generateInsights(
    completed.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type || 'TASK',
      spendTime: t.spendTime || 0,
      estimate: t.estimate,
      tags: typeof t.tags === 'string' ? t.tags : '',
    })),
    stats,
    bio,
  );

  const recommendations = generateRecommendations(
    stats,
    inProgress.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type || 'TASK',
      spendTime: t.spendTime || 0,
      estimate: t.estimate,
      tags: typeof t.tags === 'string' ? t.tags : '',
    })),
    sessions,
  );

  // Calculate yesterday's stats for AI Companion
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yesterdayCompleted = tasks.filter(
    (t) =>
      t.status === 'Completed' && t.updateStatusDate?.startsWith(yesterdayStr),
  );
  const yesterdayStats = {
    completedCount: yesterdayCompleted.length,
    totalTimeMs: yesterdayCompleted.reduce(
      (sum, t) => sum + (t.spendTime || 0),
      0,
    ),
  };

  // Find top suggestion (highest priority incomplete task)
  const todoTasks = tasks.filter(
    (t) => t.status === 'To Do' || t.status === 'In Progress',
  );
  const topSuggestion =
    todoTasks.length > 0
      ? todoTasks.sort((a, b) => {
          const priorityMap: Record<string, number> = {
            High: 3,
            Medium: 2,
            Low: 1,
          };
          const aPriority = priorityMap[a.priority || 'Low'] || 1;
          const bPriority = priorityMap[b.priority || 'Low'] || 1;
          if (aPriority !== bPriority) return bPriority - aPriority;
          if (a.deadline && b.deadline)
            return (
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            );
          return 0;
        })[0]
      : null;

  // Generate daily challenge
  const challenge = {
    description:
      stats.productivity === 'high'
        ? `Utrzymaj tempo - zrób kolejne ${Math.max(3, completed.length)} taski!`
        : stats.productivity === 'low'
          ? 'Skup się na 1 ważnym tasku przez pełne 90 minut bez przerw.'
          : `Ukończ ${Math.max(2, completed.length + 1)} taski z wysoką koncentracją.`,
  };

  // Generate summary markdown
  const summary = `# 📊 Daily Standup - ${dateStr}

## ✅ Ukończone (${completed.length})
${
  completed.length > 0
    ? completed
        .map(
          (t) =>
            `- **${t.title}** ${t.type !== 'TASK' ? `[${t.type}]` : ''} - ${formatTime(t.spendTime || 0)}`,
        )
        .join('\n')
    : '_Brak ukończonych tasków_'
}

## 🔄 W toku (${inProgress.length})
${
  inProgress.length > 0
    ? inProgress
        .slice(0, 5)
        .map((t) => `- ${t.title}${t.startTimer ? ' ⏱️' : ''}`)
        .join('\n')
    : '_Brak aktywnych tasków_'
}

## ⏱️ Statystyki
- **Łączny czas pracy:** ${totalTime.toFixed(1)}h
- **Deep Work:** ${stats.deepWorkMinutes}min (${stats.focusScore}%)
- **Najdłuższy task:** ${stats.longestTask}
- **Produktywność:** ${stats.productivity === 'high' ? '🔥 Wysoka' : stats.productivity === 'medium' ? '✅ Średnia' : '⚠️ Niska'}

## 💡 Insighty
${insights.map((i) => `- ${i}`).join('\n')}

## 🎯 Rekomendacje
${recommendations.map((r) => `- ${r}`).join('\n')}

---
_Wygenerowano przez AI o ${new Date().toLocaleTimeString('pl-PL')}_
`;

  return {
    date: dateStr,
    summary,
    completed: completed.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type || 'TASK',
      spendTime: t.spendTime || 0,
      estimate: t.estimate,
      tags: typeof t.tags === 'string' ? t.tags : '',
    })),
    inProgress: inProgress.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type || 'TASK',
      spendTime: t.spendTime || 0,
      estimate: t.estimate,
      tags: typeof t.tags === 'string' ? t.tags : '',
    })),
    stats,
    insights,
    recommendations,
    yesterday: yesterdayStats,
    topSuggestion: topSuggestion
      ? { id: topSuggestion.id, title: topSuggestion.title }
      : undefined,
    challenge,
  };
}

export function generateWeeklyStandup(userId: number): string {
  const tasks = getTasks(userId);
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const completed = tasks.filter((t) => {
    if (t.status !== 'Completed' || !t.updateStatusDate) return false;
    const completedDate = new Date(t.updateStatusDate);
    return completedDate >= weekAgo && completedDate <= now;
  });

  const totalTimeMs = completed.reduce((sum, t) => sum + (t.spendTime || 0), 0);
  const totalTime = totalTimeMs / (1000 * 60 * 60);
  const avgDailyHours = totalTime / 7;

  const sessions = getRecentWorkSessions(userId, 7);
  const focusAnalysis = ProductivityAnalyst.analyzeFocusQuality(sessions);

  const byType: Record<string, number> = {};
  completed.forEach((t) => {
    const type = t.type || 'TASK';
    byType[type] = (byType[type] || 0) + 1;
  });
  const typeBreakdown =
    Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `- **${type}**: ${count}`)
      .join('\n') || '_Brak danych_';

  const longestTask =
    completed.length > 0
      ? completed.reduce(
          (max, t) => (t.spendTime > max.spendTime ? t : max),
          completed[0],
        )
      : null;

  const dateRangeStr = `${weekAgo.toISOString().split('T')[0]} - ${now.toISOString().split('T')[0]}`;

  return `# 📅 Weekly Standup - ${dateRangeStr}

## ✅ Ukończone (${completed.length})
${
  completed.length > 0
    ? `Łącznie **${formatTime(totalTimeMs)}** pracy, średnio **${avgDailyHours.toFixed(1)}h/dzień**.`
    : '_Brak ukończonych tasków w tym tygodniu_'
}

## 📊 Rozkład typów
${typeBreakdown}

## ⏱️ Statystyki
- **Deep Work:** ${focusAnalysis.deepWorkMinutes}min (${focusAnalysis.score}% focus)
- **Najdłuższy task:** ${longestTask?.title || 'N/A'}

---
_Wygenerowano przez AI o ${new Date().toLocaleTimeString('pl-PL')}_
`;
}
