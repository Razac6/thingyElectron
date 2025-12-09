import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '@mui/material';
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

      return {
        labels,
        datasets: [{
          label: 'Minutes Worked',
          data: datasetData,
          backgroundColor: theme.palette.secondary.main,
          borderColor: theme.palette.secondary.dark,
          borderWidth: 1,
        }],
      };
  }, [hourlyProductivity, theme.palette.secondary.main, theme.palette.secondary.dark]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Productivity by Hour of Day',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Hour of Day',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Minutes Worked',
        },
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

export default HourlyProductivityChart;
