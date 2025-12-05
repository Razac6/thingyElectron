import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { useTheme } from '@mui/material';

interface DailyProgressEntry {
  date: string;
  dayTimeSpend: number;
}

function DailyProductivityBarChart() {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const storedDataString = localStorage.getItem('dailyProgress');
    const dailyProgress: DailyProgressEntry[] = storedDataString ? JSON.parse(storedDataString) : [];

    const labels: string[] = [];
    const data: number[] = [];
    const today = new Date();

    for (let i = 4; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dateString = day.toLocaleDateString([], { weekday: 'short' }); // e.g., "Mon"
      labels.push(dateString);

      const entry = dailyProgress.find(d => d.date === day.toLocaleDateString());
      const timeInMinutes = entry ? Math.round(entry.dayTimeSpend / (1000 * 60)) : 0;
      data.push(timeInMinutes);
    }

    return {
      labels,
      datasets: [{
        label: 'Time Spent (minutes)',
        data,
        backgroundColor: theme.palette.primary.light,
        borderRadius: 4,
      }],
    };
  }, [theme.palette.primary.light]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: number) {
            return value + 'm';
          }
        }
      },
    },
  };

  return <Bar data={chartData} options={options as any} />;
}

export default DailyProductivityBarChart;
