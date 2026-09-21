import React from 'react';
import { Box, Paper, styled, keyframes } from '@mui/material';

const wave = keyframes`
  0% { transform: translate(-50%, 0) rotate(0deg); }
  100% { transform: translate(-50%, -5%) rotate(360deg); }
`;

const CardContainer = styled(Paper)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2),
  borderRadius: '16px',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#fff',
  zIndex: 1,
}));

const LiquidBackground = styled(Box)<{ progress: number }>(({ progress }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: `${Math.min(100, progress)}%`,
  backgroundColor: 'rgba(33, 158, 188, 0.15)', // Półprzezroczysty kolor z palety
  transition: 'height 2s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: -1,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-150%',
    left: '50%',
    width: '300%',
    height: '300%',
    backgroundColor: 'rgba(33, 158, 188, 0.1)',
    borderRadius: '45%',
    animation: `${wave} 15s infinite linear`,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '-155%',
    left: '50%',
    width: '300%',
    height: '300%',
    backgroundColor: 'rgba(142, 202, 230, 0.2)',
    borderRadius: '40%',
    animation: `${wave} 12s infinite linear`,
  },
}));

interface LiquidCardProps {
  children: React.ReactNode;
  value: number; // Current value
  max: number; // Max value for 100% fill
}

const LiquidCard: React.FC<LiquidCardProps> = ({ children, value, max }) => {
  const progress = (value / max) * 100;

  return (
    <CardContainer elevation={0} variant="outlined">
      <LiquidBackground progress={progress} />
      <Box sx={{ position: 'relative', zIndex: 2, width: '100%' }}>
        {children}
      </Box>
    </CardContainer>
  );
};

export default LiquidCard;
