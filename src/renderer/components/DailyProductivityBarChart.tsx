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

  const { chartData, useHours } = useMemo(() => {
    const labels: string[] = [];
    const minutesData: number[] = [];
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

      const shortDayName = day.toLocaleDateString('en-US', {
        weekday: 'short',
      });
      labels.push(shortDayName);

      const isoDate = getISODateString(day);
      const durationMs = productivityMap.get(isoDate) || 0;
      const timeInMinutes = Math.ceil(durationMs / (1000 * 60));
      minutesData.push(timeInMinutes);
    }

    // Once any day breaks an hour, minutes get hard to read at a glance - switch the whole
    // chart to hours so the scale stays meaningful.
    const shouldUseHours = Math.max(...minutesData, 0) > 60;
    const data = shouldUseHours
      ? minutesData.map((m) => Math.round((m / 60) * 10) / 10)
      : minutesData;

    return {
      useHours: shouldUseHours,
      chartData: {
        labels,
        datasets: [
          {
            label: shouldUseHours
              ? 'Time Spent (hours)'
              : 'Time Spent (minutes)',
            data,
            backgroundColor: theme.palette.primary.light,
            borderRadius: 4,
          },
        ],
      },
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
          callback(value: number) {
            return useHours ? `${value}h` : `${value}m`;
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
