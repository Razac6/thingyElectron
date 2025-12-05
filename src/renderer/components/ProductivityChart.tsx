import React from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

interface ProductivityChartProps {
  chartData: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      fill: boolean;
      backgroundColor: string;
      borderColor: string;
    }[];
  };
}

function ProductivityChart({ chartData }: ProductivityChartProps) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: number) {
            return value + ' min';
          }
        }
      }
    }
  };

  // The chart can be quite large, so we wrap it in a container
  // that has a defined height. This is usually done in the parent component.
  return <Line data={chartData} options={options as any} />;
}

export default ProductivityChart;
