import React from 'react';
import {
  Box,
  Drawer as MuiDrawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  CssBaseline,
  AppBar as MuiAppBar,
  Typography,
  IconButton,
  styled,
  Theme,
  CSSObject,
  Button,
  useTheme,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import Confetti from 'react-confetti';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import PersonIcon from '@mui/icons-material/Person';
import SprintIcon from '@mui/icons-material/DirectionsRun';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SearchIcon from '@mui/icons-material/Search';
import { useTimer } from '../context/TimerContext';
import { useGamification } from '../context/GamificationContext';
import Timer from './Timer';
import SearchOverlay from './SearchOverlay';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Tasks', path: '/list', icon: <AssignmentIcon /> },
  { text: 'Sprints', path: '/sprints', icon: <SprintIcon /> },
  { text: 'Statistics', path: '/statistics', icon: <BarChartIcon /> },
  { text: 'Profile', path: '/profile', icon: <PersonIcon /> },
  { text: 'Notes', path: '/notes', icon: <NoteAltIcon /> },
];

const useWindowSize = () => {
  const [size, setSize] = React.useState([window.innerWidth, window.innerHeight]);
  React.useLayoutEffect(() => {
    const updateSize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  return size;
};

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{ open?: boolean }>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);


interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [open, setOpen] = React.useState(true);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { tasks, stopTimer } = useTimer();
  const { showConfetti } = useGamification();
  const [width, height] = useWindowSize();


  const activeTask = tasks.find(task => task.startTimer !== null);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const getPageTitle = () => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    return currentItem ? currentItem.text : 'Thingy';
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {showConfetti && <Confetti width={width} height={height} colors={[theme.palette.primary.main, theme.palette.secondary.main, '#FFFFFF']}/>}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AppBar position="fixed" open={open}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              sx={{
                marginRight: 5,
                ...(open && { display: 'none' }),
              }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div">
              {getPageTitle()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton color="inherit" onClick={() => setSearchOpen(true)}>
              <SearchIcon />
            </IconButton>
            {activeTask && (
              <>
                <Typography variant="body1" noWrap>
                  {activeTask.title}
                </Typography>
                <Box sx={{ color: 'white', minWidth: '110px' }}>
                  <Timer
                      startTimer={activeTask.startTimer}
                      spendTime={activeTask.spendTime}
                    />
                </Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<StopCircleIcon />}
                  onClick={() => stopTimer(activeTask.id)}
                  sx={{backgroundColor: 'white', color: '#ac3e33', '&:hover': { backgroundColor: '#f0f0f0'}}}
                >
                  Stop
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                }}
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
