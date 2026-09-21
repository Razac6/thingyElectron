import React from 'react';
import { Box, Typography, styled, keyframes } from '@mui/material';

const wave = keyframes`
  0% { transform: translateX(-50%) skewY(-2deg); }
  50% { transform: translateX(-30%) skewY(2deg); }
  100% { transform: translateX(-50%) skewY(-2deg); }
`;

const LiquidContainer = styled(Box)(() => ({
  position: 'relative',
  width: '100%',
  height: '24px',
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid rgba(0, 0, 0, 0.05)',
}));

const Water = styled(Box)<{ progress: number; color?: string }>(
  ({ theme, progress, color }) => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '200%',
    height: `${progress}%`,
    backgroundColor: color || theme.palette.primary.main,
    transition: 'height 1s cubic-bezier(0.4, 0, 0.2, 1)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '-15px',
      left: 0,
      width: '100%',
      height: '20px',
      backgroundColor: color || theme.palette.primary.main,
      borderRadius: '40%',
      animation: `${wave} 3s infinite linear`,
      opacity: 0.6,
    },
  }),
);

interface LiquidProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
}

const LiquidProgressBar: React.FC<LiquidProgressBarProps> = ({
  value,
  max,
  label,
  color,
}) => {
  const progress = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <Box sx={{ width: '100%', my: 1 }}>
      {label && (
        <Box display="flex" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" fontWeight="bold">
            {label}
          </Typography>
          <Typography variant="caption">
            {value} / {max}
          </Typography>
        </Box>
      )}
      <LiquidContainer>
        <Water progress={progress} color={color} />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: progress > 50 ? '#fff' : 'text.primary',
              fontWeight: 'bold',
              fontSize: '0.7rem',
            }}
          >
            {Math.round(progress)}%
          </Typography>
        </Box>
      </LiquidContainer>
    </Box>
  );
};

export default LiquidProgressBar;
