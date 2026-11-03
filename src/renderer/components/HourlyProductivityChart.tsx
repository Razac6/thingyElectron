import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { alpha, useTheme } from '@mui/material/styles';
import { useTimer } from '../context/TimerContext';

interface HourlyProductivityData {
  hour: number;
  totalDuration: number; // in milliseconds
}

function HourlyProductivityChart() {
  const { hourlyProductivity } = useTimer();
  const theme = useTheme();

  const chartData = useMemo(() => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const datasetData = new Array(24).fill(0);

    hourlyProductivity.forEach((item: HourlyProductivityData) => {
      if (item.hour >= 0 && item.hour < 24) {
        datasetData[item.hour] = Math.round(item.totalDuration / (1000 * 60)); // Convert ms to minutes
      }
    });

    const now = new Date().getHours();
    return {
      labels,
      datasets: [
        {
          label: 'Minutes worked',
          data: datasetData,
          // Current hour stands out, the rest are a lighter tint
          backgroundColor: datasetData.map((_, hour) =>
            hour === now
              ? theme.palette.primary.main
              : alpha(theme.palette.primary.main, 0.25),
          ),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 18,
        },
      ],
    };
  }, [hourlyProductivity, theme.palette.primary.main]);

  const tick = {
    color: theme.palette.text.secondary,
    font: { family: theme.typography.fontFamily as string, size: 11 },
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { ...tick, maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: alpha(theme.palette.text.primary, 0.06) },
        ticks: {
          ...tick,
          maxTicksLimit: 5,
          callback(value: number) {
            return `${value}m`;
          },
        },
      },
    },
  };

  return <Bar data={chartData} options={options as any} />;
}

export default HourlyProductivityChart;
