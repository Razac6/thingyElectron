import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '@mui/material';

interface HourlyProductivityData {
  hour: number;
  totalDuration: number; // in milliseconds
}

function HourlyProductivityChart() {
  const [chartData, setChartData] = useState<any>(null);
  const theme = useTheme();

  useEffect(() => {
    const fetchHourlyData = async () => {
      const data: HourlyProductivityData[] = await window.electron.database.getHourlyProductivity();

      const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      const datasetData = new Array(24).fill(0);

      data.forEach(item => {
        datasetData[item.hour] = Math.round(item.totalDuration / (1000 * 60)); // Convert ms to minutes
      });

      setChartData({
        labels,
        datasets: [{
          label: 'Minutes Worked',
          data: datasetData,
          backgroundColor: theme.palette.secondary.main,
          borderColor: theme.palette.secondary.dark,
          borderWidth: 1,
        }],
      });
    };

    fetchHourlyData();
  }, [theme.palette.secondary.main, theme.palette.secondary.dark]);

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

  if (!chartData) {
    return <p>Loading productivity data...</p>;
  }

  return <Bar data={chartData} options={options as any} />;
}

export default HourlyProductivityChart;
