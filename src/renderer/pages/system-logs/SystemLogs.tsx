import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import { getSystemLogs, getNeuralConfidence } from '../../services/DatabaseService';

function SystemLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await getSystemLogs(50); // Fetch max 50 logs as requested
      setLogs(data);
      const score = await getNeuralConfidence();
      setConfidence(score);
    };
    fetchLogs();
    
    // Optional: Refresh logs periodically or listen for an event
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const getLogColor = (type: string) => {
    switch (type) {
        case 'LEARNING': return '#00bcd4'; // Cyan
        case 'SYSTEM': return '#f44336';   // Red
        case 'DEBUG': return '#9e9e9e';    // Grey
        case 'GAMIFICATION': return '#ffca28'; // Amber/Gold
        case 'PRODUCTIVITY': return '#ab47bc'; // Purple
        default: return '#ffeb3b'; // Default Yellow
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h4" gutterBottom>
            Neural System Logs
        </Typography>
        
        {/* Confidence Bar */}
        <Box sx={{ mb: 2, p: 2, bgcolor: '#1e1e1e', border: '1px solid #333', borderRadius: 1 }}>
             <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#00e5ff', fontFamily: 'monospace', flexGrow: 1 }}>
                    {'>'} SYSTEM_CONFIDENCE_LEVEL
                </Typography>
                <Typography variant="caption" sx={{ color: '#00e5ff', fontFamily: 'monospace' }}>
                    {Number.isNaN(confidence) ? 0 : confidence}%
                </Typography>
             </Box>
             <LinearProgress 
                variant="determinate" 
                value={confidence} 
                sx={{ 
                  height: 6, 
                  bgcolor: '#333',
                  borderRadius: 1,
                  '& .MuiLinearProgress-bar': { 
                      bgcolor: confidence > 70 ? '#00e5ff' : (confidence > 30 ? '#ffca28' : '#f44336') 
                  }
                }} 
              />
              <Typography variant="caption" sx={{ color: '#666', fontFamily: 'monospace', mt: 0.5, display: 'block' }}>
                  {confidence < 30 ? 'STATUS: GATHERING_DATA' : (confidence < 70 ? 'STATUS: CALIBRATING' : 'STATUS: OPTIMIZED')}
              </Typography>
        </Box>

        <Paper sx={{ 
            flexGrow: 1, 
            padding: 3, 
            bgcolor: '#1e1e1e', 
            color: '#4caf50', 
            fontFamily: 'monospace', 
            border: '1px solid #333',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Typography variant="subtitle2" sx={{ borderBottom: '1px solid #333', mb: 2, pb: 1, color: '#66bb6a' }}>
                {'>'} SYSTEM_NEURAL_LOGS // FULL_HISTORY_MODE
            </Typography>
            <Box sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                '&::-webkit-scrollbar': { width: '8px' }, 
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#333', borderRadius: '4px' } 
            }}>
                {logs.length > 0 ? logs.map(log => (
                    <Typography key={log.id} variant="body2" display="block" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
                        <span style={{ color: '#666' }}>[{new Date(log.timestamp).toLocaleString()}]</span> <span style={{ color: getLogColor(log.event_type), fontWeight: 'bold' }}>[{log.event_type}]</span> {log.message}
                    </Typography>
                )) : (
                    <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                        _waiting for system events...
                    </Typography>
                )}
            </Box>
        </Paper>
    </Box>
  );
}

export default SystemLogs;
