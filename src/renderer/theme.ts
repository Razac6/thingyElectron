import { createTheme } from '@mui/material/styles';

// Import the Roboto font with the desired weights
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Module augmentation to add 'glass' to the palette
declare module '@mui/material/styles' {
  interface Palette {
    glass: {
      main: string;
      light: string;
      dark: string;
      contrastText: string;
    };
  }
  interface PaletteOptions {
    glass?: {
      main: string;
      light?: string;
      dark?: string;
      contrastText?: string;
    };
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#219ebc', // Main blue
    },
    secondary: {
      main: '#ffb703', // Accent yellow/orange
    },
    glass: {
      main: 'rgba(255, 255, 255, 0.2)', // Base glass
      light: 'rgba(255, 255, 255, 0.4)', // Highlight
      dark: 'rgba(2, 48, 71, 0.6)', // Dark glass (for text/contrast)
      contrastText: '#ffffff',
    },
    background: {
      default: '#f0f4f8', // A very light, cool grey
      paper: '#ffffff', // White for cards, drawers, etc.
    },
    text: {
      primary: '#023047', // Dark blue for primary text
      secondary: '#5f7d8b', // A softer blue-grey for secondary text
    },
    // Adding the other colors for potential use
    info: {
      main: '#8ecae6', // Light blue
    },
    warning: {
      main: '#fb8500', // Accent orange
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 300, color: '#023047' },
    h2: { fontWeight: 300, color: '#023047' },
    h3: { fontWeight: 300, color: '#023047' },
    h4: { fontWeight: 500, color: '#023047' }, // Reverted to default dark color
    h5: { fontWeight: 500, color: '#fb8500' }, // Card headers
    h6: { fontWeight: 500 }, // Removed color to allow inheritance
    subtitle1: { fontWeight: 400, color: '#fb8500' }, // Card subtitles
    body1: { fontWeight: 300, color: '#023047' },
    body2: { fontWeight: 300, color: '#5f7d8b' },
    button: { fontWeight: 500, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '.glass-panel': {
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)', // Safari support
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#023047', // Deep blue for the AppBar
          color: '#ffffff',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#023047',
          // Apply text and icon colors only to items inside the drawer
          '& .MuiListItemText-primary': {
            color: '#ffffff', // White for text
          },
          '& .MuiListItemIcon-root': {
            color: '#ef476f', // New icon color
          },
        },
      },
    },
  },
});

export default theme;
