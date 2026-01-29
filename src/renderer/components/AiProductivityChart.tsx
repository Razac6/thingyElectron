import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Tooltip, IconButton, Alert } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import ScienceIcon from '@mui/icons-material/Science';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const AiProductivityChart = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [maturity, setMaturity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
        try {
            const userStr = localStorage.getItem('userId');
            const userId = userStr ? JSON.parse(userStr) : 1;
            
            try {
                // @ts-ignore
                const aiStats = await window.electron.database.getAiStats();
                setMaturity(aiStats.maturity || 0);
            } catch (err) { console.error(err); }

            try {
                // @ts-ignore
                const perfData = await window.electron.database.getAiPerformance(userId, 7);
                
                if (!perfData || perfData.length === 0) {
                    setHasData(false);
                } else {
                    const labels = perfData.map((d: any) => {
                        const date = new Date(d.date);
                        return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
                    });

                    const totalActual = perfData.reduce((acc: number, d: any) => acc + (d.actual || 0), 0);
                    setHasData(totalActual > 0);

                    setChartData({
                        labels,
                        datasets: [
                            {
                                label: 'Actual Work (min)',
                                data: perfData.map((d: any) => d.actual || 0),
                                borderColor: 'rgb(75, 192, 192)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                tension: 0.3,
                                fill: true
                            },
                            {
                                label: 'AI Predicted (min)',
                                data: perfData.map((d: any) => d.predicted || 0),
                                borderColor: 'rgb(171, 71, 188)',
                                backgroundColor: 'rgba(171, 71, 188, 0.1)',
                                borderDash: [5, 5],
                                tension: 0.3,
                                fill: false
                            }
                        ]
                    });
                }
            } catch (err) { console.error(err); }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    loadData();
  }, []);

  if (loading) {
      return (
          <Paper sx={{ p: 2, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
          </Paper>
      );
  }

  const isLearning = maturity < 50;

  const tooltipText = (
    <>
      <Typography variant="body2" color="inherit">
        Ten wykres to Twoje "Lustro Produktywności". Porównuje Twój rzeczywisty czas pracy z tym, co przewiduje AI.
      </Typography>
      <Typography variant="body2" color="inherit" mt={1}>
        <ul>
          <li><strong>Rzeczywistość &lt; AI:</strong> Jesteś w stanie Flow.</li>
          <li><strong>Rzeczywistość &gt; AI:</strong> Coś Cię blokuje lub zadanie jest trudniejsze niż myślałeś.</li>
        </ul>
      </Typography>
    </>
  );

  return (
    <Paper sx={{ p: 2, position: 'relative', overflow: 'hidden' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center">
                <Typography variant="h6" mr={1}>AI Reality Check</Typography>
                <Tooltip title={tooltipText} placement="right" arrow>
                    <IconButton size="small">
                        <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary">Actual vs Predicted Effort</Typography>
        </Box>

        <Box sx={{ height: 300, position: 'relative' }}> 
            {!hasData && (
                <Box 
                    sx={{ 
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.7)', zIndex: 5
                    }}
                >
                    <Alert severity="info">Not enough data yet. Complete some tasks to see AI comparison.</Alert>
                </Box>
            )}
            {chartData && <Line data={chartData} options={{ 
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Minutes' } }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
            }} />}
            {isLearning && (
                <Box 
                    sx={{
                        position: 'absolute',
                        top: 8, right: 8,
                        bgcolor: 'rgba(255, 152, 0, 0.8)',
                        color: 'white',
                        p: 0.5,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        zIndex: 10
                    }}
                >
                    <ScienceIcon fontSize="small" />
                    <Typography variant="caption" fontWeight="bold">
                        Model Learning... ({maturity}%)
                    </Typography>
                </Box>
            )}
        </Box>
    </Paper>
  );
};

export default AiProductivityChart;