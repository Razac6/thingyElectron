import React from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Stack,
  Avatar,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';

interface ModeSuggestionModalProps {
  open: boolean;
  mode: 'boost' | 'recovery';
  reason: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function ModeSuggestionModal({
  open,
  mode,
  reason,
  onAccept,
  onDismiss,
}: ModeSuggestionModalProps) {
  const isBoost = mode === 'boost';

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, p: 1 },
      }}
    >
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Avatar
          sx={{
            bgcolor: isBoost ? '#fff3e0' : '#e3f2fd',
            color: isBoost ? '#fb8500' : '#219ebc',
            width: 56,
            height: 56,
            mx: 'auto',
            mb: 2,
          }}
        >
          {isBoost ? (
            <RocketLaunchIcon fontSize="large" />
          ) : (
            <SelfImprovementIcon fontSize="large" />
          )}
        </Avatar>
        <Typography variant="h6" fontWeight="bold">
          {isBoost ? 'Przełączyć na Boost Mode?' : 'Przełączyć na Recovery?'}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, px: 2 }}
        >
          {reason}
        </Typography>
      </Box>

      <DialogContent>
        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            onClick={onAccept}
            sx={{
              py: 1.5,
              bgcolor: '#023047',
              '&:hover': { bgcolor: '#219ebc' },
              borderRadius: 2,
            }}
          >
            Tak, zmień tryb
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={onDismiss}
            sx={{ py: 1.5, borderRadius: 2 }}
          >
            Nie, zostaw jak jest
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
