import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

interface DailyProgressEntry {
  date: string;
  dayTimeSpend: number;
  // Add other properties if they are stored in dailyProgress and used
  // e.g., doTasks: number[];
}

function ProductivityChart() {
  const [productivityData, setProductivityData] = useState<DailyProgressEntry[]>([]);

  useEffect(() => {
    const storedDataString = localStorage.getItem('dailyProgress');
    const storedData: DailyProgressEntry[] = storedDataString ? JSON.parse(storedDataString) : [];
    setProductivityData(storedData);
  }, []);

  const labels = productivityData.map(entry => entry.date);
  const data = productivityData.map(entry => parseFloat((entry.dayTimeSpend / (1000 * 60)).toFixed(1)));

  const chartData = {
    labels: labels,
    datasets: [{
      label: 'Time Spent on Tasks (in min)',
      data: data,
      fill: false,
      backgroundColor: 'rgb(75, 192, 192)',
      borderColor: 'rgba(75, 192, 192, 0.2)',
    }],
  };

  return <Line data={chartData} />;
}

export default ProductivityChart;
