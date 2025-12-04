import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { checkAuth, getToken, register } from '../services/DatabaseService';

function Login() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async () => {
    setError('');
    try {
      if (isRegistering) {
        const success = await register(username, password);
        if (success) {
          // Auto login after register? Or just switch to login
          setIsRegistering(false);
          setError('');
          // Optional: Auto login
          await getToken(username, password);
          setDialogOpen(false);
        } else {
          setError('Registration failed. Username might be taken.');
        }
      } else {
        await getToken(username, password);
        setDialogOpen(false);
      }
    } catch (e) {
      setError('Authentication failed. Check credentials.');
    }
  };

  const checkSignIn = async () => {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      setDialogOpen(true);
    }
  };

  useEffect(() => {
    checkSignIn();
  }, []);

  return (
    <div>
      <Dialog open={dialogOpen} disableEscapeKeyDown>
        <DialogTitle>{isRegistering ? 'Register' : 'Log in'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ marginBottom: 2, marginTop: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Password"
            variant="outlined"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ marginBottom: 2 }}
          />
          <Typography
            variant="body2"
            sx={{ cursor: 'pointer', color: 'blue', textAlign: 'center' }}
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
          >
            {isRegistering
              ? 'Already have an account? Log in'
              : 'No account? Register'}
          </Typography>
        </DialogContent>
        <DialogActions>
          {/* Cancel button removed to force login/register */}
          <Button onClick={() => handleLoginSubmit()}>
            {isRegistering ? 'Register' : 'Login'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Login;
