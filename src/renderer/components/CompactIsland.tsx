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

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="glass-panel"
      sx={{
        // Smooth width transition for the "Pop out" effect
        width: isHovered ? '320px' : '60px', 
        height: '42px',
        borderRadius: '21px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isHovered ? 'space-between' : 'center',
        padding: isHovered ? '0 14px' : '0',
        cursor: 'default', // Cursor default, clickable elements inside
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', // Apple-like spring ease
        animation: isHovered ? 'none' : animation, // Breathe only when collapsed
        border: '1px solid rgba(255,255,255,0.1)',
        background: isHovered ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.85)', // Darker when collapsed (blends with notch)
        backdropFilter: 'blur(20px)',
        margin: '0 auto', 
        color: theme.palette.text.primary,
        overflow: 'hidden',
        boxShadow: isHovered ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
      }}
    >
      {/* Icon always visible, centered when collapsed */}
      <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minWidth: '24px',
          height: '100%'
      }}>
        <BoltIcon sx={{ 
            fontSize: '1.2rem', 
            color: energyColor,
            filter: `drop-shadow(0 0 5px ${energyColor})`
        }} />
      </Box>
        
      {/* Details - Visible only on Hover */}
      <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateX(0)' : 'translateX(20px)',
          transition: 'all 0.3s ease 0.1s', // Slight delay for content
          flexGrow: 1,
          justifyContent: 'space-between',
          overflow: 'hidden',
          ml: 1
      }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', mr: 1 }}>
            {currentTask ? (
                <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#fff' }}>
                    {currentTask.title}
                </Typography>
            ) : (
                <Typography variant="caption" noWrap sx={{ fontWeight: 500, color: '#aaa', fontSize: '0.75rem' }}>
                    {energy.label.split(':')[0]}
                </Typography>
            )}
          </Box>

          {/* Restore Button */}
          <IconButton 
            size="small" 
            onClick={onExpand}
            sx={{ 
                color: '#fff', 
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                width: 28, height: 28
            }}
          >
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
             </svg>
          </IconButton>
      </Box>
    </Box>
  );
};

export default CompactIsland;
