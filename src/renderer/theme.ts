import { createTheme } from '@mui/material/styles';

// Import the Roboto font with the desired weights
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#ff5958', // Intense red
    },
    secondary: {
      main: '#ac3e33', // Darker red
    },
    background: {
      default: '#f4f6f8', // A very light grey for the main content area
      paper: '#ffffff',   // White for cards, drawers, etc.
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // Apply the thin font weight more broadly
    h1: { fontWeight: 300 },
    h2: { fontWeight: 300 },
    h3: { fontWeight: 300 },
    h4: { fontWeight: 300 },
    h5: { fontWeight: 500 }, // Keep headers a bit bolder for hierarchy
    h6: { fontWeight: 500 },
    subtitle1: { fontWeight: 400 },
    body1: { fontWeight: 300 },
    body2: { fontWeight: 300 },
    button: { fontWeight: 500, textTransform: 'none' }, // Modern buttons often don't use all-caps
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          // Use the darker red for the AppBar for contrast
          backgroundColor: '#ac3e33',
        }
      }
    }
  }
});

export default theme;
