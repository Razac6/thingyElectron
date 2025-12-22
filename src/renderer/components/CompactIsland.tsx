import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, useTheme, keyframes } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BoltIcon from '@mui/icons-material/Bolt';

const breatheHigh = keyframes`
  0% { box-shadow: 0 0 5px rgba(255, 183, 3, 0.3); border-color: rgba(255, 183, 3, 0.2); }
  50% { box-shadow: 0 0 15px rgba(255, 183, 3, 0.6); border-color: rgba(255, 183, 3, 0.5); }
  100% { box-shadow: 0 0 5px rgba(255, 183, 3, 0.3); border-color: rgba(255, 183, 3, 0.2); }
`;

const breatheLow = keyframes`
  0% { box-shadow: 0 0 5px rgba(142, 202, 230, 0.2); border-color: rgba(142, 202, 230, 0.1); }
  50% { box-shadow: 0 0 12px rgba(142, 202, 230, 0.4); border-color: rgba(142, 202, 230, 0.3); }
  100% { box-shadow: 0 0 5px rgba(142, 202, 230, 0.2); border-color: rgba(142, 202, 230, 0.1); }
`;

// Mock types until we integrate with real context
interface CompactIslandProps {
  currentTask?: {
    title: string;
    status: 'active' | 'paused';
  };
  onExpand?: () => void;
}

const CompactIsland: React.FC<CompactIslandProps> = ({
  currentTask,
  onExpand 
}) => {
  const theme = useTheme();
  const [energy, setEnergy] = useState<{ level: 'high' | 'low', label: string }>({ 
    level: 'high', 
    label: 'Analyzing energy...' 
  });

  useEffect(() => {
    const updateEnergy = async () => {
      try {
        const data = await window.electron.database.getEnergyLevel();
        setEnergy(data);
      } catch (e) {
        console.error("Failed to fetch energy level", e);
      }
    };

    updateEnergy();
    const interval = setInterval(updateEnergy, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const energyColor = energy.level === 'high' ? '#ffb703' : '#8ecae6';
  const animation = energy.level === 'high' ? `${breatheHigh} 4s infinite ease-in-out` : `${breatheLow} 6s infinite ease-in-out`;

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
      setIsHovered(true);
      window.electron.ipcRenderer.send('island:expand');
  };

  const handleMouseLeave = () => {
      setIsHovered(false);
      window.electron.ipcRenderer.send('island:shrink');
  };

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        width: '100%', 
        height: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0 16px',
        pt: '10px', // Content padding inside the pill
        cursor: 'default',
        // Boring.Notch Style: Pure Black, merged with hardware notch
        background: '#000000', 
        borderRadius: '0 0 20px 20px', // Smooth bottom rounding
        borderBottom: `1px solid ${energyColor}30`, // Very subtle bottom highlight
        boxShadow: isHovered ? `0 20px 50px -10px ${energyColor}40` : 'none',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', // iOS-like Spring
        overflow: 'hidden'
      }}
    >
      {/* Content Container */}
      <Box sx={{ 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mt: isHovered ? 0.5 : 0,
          transition: 'margin 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
          {/* Left: Icon / Pulse */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BoltIcon sx={{ fontSize: '1.2rem', color: energyColor, filter: `drop-shadow(0 0 8px ${energyColor})` }} />
          </Box>
            
          {/* Middle: Info */}
          <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              opacity: isHovered ? 1 : 0, 
              transform: isHovered ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'all 0.3s ease 0.1s',
              maxWidth: '220px',
              flexGrow: 1
          }}>
                {currentTask ? (
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', textAlign: 'center' }}>
                        {currentTask.title}
                    </Typography>
                ) : (
                    <Typography variant="caption" sx={{ fontWeight: 500, color: '#888', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                        {energy.label.split(':')[0].toUpperCase()}
                    </Typography>
                )}
          </Box>

          {/* Right: Restore Button */}
          <Box sx={{ opacity: isHovered ? 1 : 0, transform: isHovered ? 'scale(1)' : 'scale(0.8)', transition: 'all 0.3s ease 0.1s' }}>
              <IconButton 
                size="small" 
                onClick={onExpand}
                sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(255,255,255,0.15)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)', transform: 'scale(1.1)' },
                    transition: 'all 0.2s',
                    width: 28, height: 28
                }}
              >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
                 </svg>
              </IconButton>
          </Box>
      </Box>
    </Box>
  );
};

export default CompactIsland;
