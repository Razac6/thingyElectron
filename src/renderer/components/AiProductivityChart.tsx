import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Tooltip, IconButton } from '@mui/material'; // Dodano Tooltip, IconButton
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import ScienceIcon from '@mui/icons-material/Science';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; // Dodano InfoOutlinedIcon

const AiProductivityChart = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [maturity, setMaturity] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        try {
            const userStr = localStorage.getItem('userId');
            const userId = userStr ? JSON.parse(userStr) : 1;
            
            // 1. Fetch AI Stats (Maturity) - Critical for overlay
            try {
                const aiStats = await window.electron.database.getAiStats();
                setMaturity(aiStats.maturity);
            } catch (err) {
                console.error('Failed to fetch AI stats for chart', err);
            }

            // 2. Fetch Performance Data - Can fail without breaking maturity display
            try {
                const perfData = await window.electron.database.getAiPerformance(userId, 7);
                
                const labels = perfData.map((d: any) => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
                });

                setChartData({
                    labels,
                    datasets: [
                        {
                            label: 'Actual Work (min)',
                            data: perfData.map((d: any) => d.actual),
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.5)',
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'AI Predicted (min)',
                            data: perfData.map((d: any) => d.predicted),
                            borderColor: 'rgb(171, 71, 188)', // Purple for AI
                            backgroundColor: 'rgba(171, 71, 188, 0.5)',
                            borderDash: [5, 5],
                            tension: 0.3
                        }
                    ]
                });
            } catch (err) {
                console.error('Failed to fetch AI performance history', err);
            }

        } catch (error) {
            console.error('General error loading AI chart', error);
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

  const isLearning = maturity < 100;

  const tooltipText = (
    <>
      <Typography variant="body2" color="inherit">
        Ten wykres to Twoje "Lustro Produktywności". Porównuje Twój rzeczywisty czas pracy z tym, co przewiduje AI, bazując na Twojej historii i kontekście dnia (sen, spotkania).
      </Typography>
      <Typography variant="body2" color="inherit" mt={1}>
        <ul>
          <li><strong>Rzeczywistość &lt; AI:</strong> Jesteś w stanie Flow. Pracujesz szybciej niż zwykle w danych warunkach.</li>
          <li><strong>Rzeczywistość &gt; AI:</strong> Coś Cię blokuje. Mimo uwzględnionego kontekstu (sen, spotkania), pracujesz wolniej. Może to być rozproszenie, prokrastynacja lub ukryta trudność zadania.</li>
          <li><strong>Zbieżne linie:</strong> AI świetnie Cię rozumie, a Ty osiągasz przewidywaną wydajność.</li>
        </ul>
      </Typography>
      <Typography variant="body2" color="inherit" mt={1}>
        Wskazuje, czy pracujesz tak wydajnie, jak zazwyczaj w tych warunkach, czy coś jest nie tak.
      </Typography>
    </>
  );

  return (
    <Paper sx={{ p: 2, position: 'relative', overflow: 'hidden' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center"> {/* Dodano Box dla wyrównania */}
                <Typography variant="h6" mr={1}>AI Reality Check</Typography>
                <Tooltip title={tooltipText} placement="right" arrow>
                    <IconButton size="small">
                        <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary">Actual vs Predicted Effort</Typography>
        </Box>

        <Box sx={{ height: 300, filter: isLearning ? 'blur(2px) grayscale(0.5)' : 'none', transition: '0.3s' }}>
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
        </Box>

        {isLearning && (
            <Box 
                sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.6)',
                    zIndex: 10
                }}
            >
                <Box bgcolor="white" p={3} borderRadius={2} boxShadow={3} textAlign="center" maxWidth={300}>
                    <ScienceIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight="bold">Model Learning...</Typography>
                    <Typography variant="body2" color="text.secondary">
                        The Neural Core needs more data ({maturity}%) to generate accurate productivity baselines. 
                        Keep completing tasks to unlock this chart.
                    </Typography>
                </Box>
            </Box>
        )}
    </Paper>
  );
};

export default AiProductivityChart;
