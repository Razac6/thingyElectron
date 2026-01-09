import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Avatar,
  LinearProgress
} from '@mui/material';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement'; // Deep work/Thinking
import CoffeeIcon from '@mui/icons-material/Coffee'; // Break
import WorkIcon from '@mui/icons-material/Work';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface IdlePromptModalProps {
  open: boolean;
  idleTimeMs: number;
  taskTitle: string;
  onKeep: () => void;
  onDiscard: () => void;
}

export default function IdlePromptModal({
  open,
  idleTimeMs,
  taskTitle,
  onKeep,
  onDiscard,
}: IdlePromptModalProps) {
  const [timeLeft, setTimeLeft] = useState(60); // Auto-discard after 60s if no answer

  useEffect(() => {
    if (!open) {
      setTimeLeft(60);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDiscard(); // Auto-discard on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onDiscard]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60));
    return `${minutes} minutes`;
  };

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, p: 1 }
      }}
    >
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Avatar
          sx={{
            bgcolor: '#fff3e0',
            color: '#fb8500',
            width: 56,
            height: 56,
            mx: 'auto',
            mb: 2
          }}
        >
          <AccessTimeIcon fontSize="large" />
        </Avatar>
        <Typography variant="h6" fontWeight="bold">
          You were away for {formatDuration(idleTimeMs)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, px: 2 }}>
          Task: <strong>{taskTitle}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Were you working offline or taking a break?
        </Typography>
      </Box>

      <DialogContent>
        <Stack spacing={2}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SelfImprovementIcon />}
            onClick={onKeep}
            sx={{
              py: 1.5,
              bgcolor: '#023047',
              '&:hover': { bgcolor: '#219ebc' },
              borderRadius: 2
            }}
          >
            I was working (Keep Time)
          </Button>
          
          <Button
            variant="outlined"
            color="warning"
            size="large"
            startIcon={<CoffeeIcon />}
            onClick={onDiscard}
            sx={{
              py: 1.5,
              borderColor: '#fb8500',
              color: '#fb8500',
              '&:hover': { borderColor: '#e65100', bgcolor: '#fff3e0' },
              borderRadius: 2
            }}
          >
            I took a break (Discard)
          </Button>
        </Stack>
        
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress 
                variant="determinate" 
                value={(timeLeft / 60) * 100} 
                sx={{ flex: 1, height: 4, borderRadius: 2 }} 
            />
            <Typography variant="caption" color="text.disabled" sx={{ minWidth: 20 }}>
                {timeLeft}s
            </Typography>
        </Box>
        <Typography variant="caption" color="text.disabled" display="block" textAlign="center" mt={0.5}>
            Auto-discarding in {timeLeft} seconds...
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
