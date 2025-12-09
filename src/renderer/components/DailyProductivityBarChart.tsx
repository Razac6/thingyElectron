import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { useTheme } from '@mui/material';
import { useTimer } from '../context/TimerContext';

const getISODateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function DailyProductivityBarChart() {
  const theme = useTheme();
  const { productivityData, isLoadingProductivity } = useTimer();

  const chartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    const today = new Date();
    if (today.getHours() < 4) {
        today.setDate(today.getDate() - 1);
    }

    const productivityMap = new Map(
      productivityData.map((p) => [p.date, p.totalDuration]),
    );

    // Show last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);

      const shortDayName = day.toLocaleDateString('en-US', { weekday: 'short' });
      labels.push(shortDayName);

      const isoDate = getISODateString(day);
      const durationMs = productivityMap.get(isoDate) || 0;
      const timeInMinutes = Math.ceil(durationMs / (1000 * 60));
      data.push(timeInMinutes);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Time Spent (minutes)',
          data,
          backgroundColor: theme.palette.primary.light,
          borderRadius: 4,
        },
      ],
    };
  }, [productivityData, theme.palette.primary.light]);

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
          callback: function (value: number) {
            return value + 'm';
          },
        },
      },
    },
  };

  if (isLoadingProductivity) {
    return <div>Loading...</div>;
  }

  return <Bar data={chartData} options={options as any} />;
}

export default DailyProductivityBarChart;
