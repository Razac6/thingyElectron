import React, { useEffect } from 'react';
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
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import Lottie from 'lottie-react';

import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import PersonIcon from '@mui/icons-material/Person';
import SprintIcon from '@mui/icons-material/DirectionsRun';
import MenuIcon from '@mui/icons-material/Menu';
import LoopIcon from '@mui/icons-material/Loop';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import StopIcon from '@mui/icons-material/Stop';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';

import trophyAnimation from '../../../assets/Trophy.json';
import catRocket from '../../../assets/Cat in a rocket.json';
import meditatingFox from '../../../assets/Meditating Fox.json';
import flirtingDog from '../../../assets/Flirting Dog.json';
import catMovement from '../../../assets/Cat Movement.json';

import { useTimer } from '../context/TimerContext';
import { useGamification } from '../context/GamificationContext';
import Timer from './Timer';
import SearchOverlay from './SearchOverlay';
import CompactIsland from './CompactIsland';

const animationMap = {
  cat_movement: catMovement,
  flirting_dog: flirtingDog,
  meditating_fox: meditatingFox,
  cat_rocket: catRocket,
  trophy: trophyAnimation,
};

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Tasks', path: '/list', icon: <AssignmentIcon /> },
  { text: 'Habits', path: '/habits', icon: <LoopIcon /> },
  { text: 'Sprints', path: '/sprints', icon: <SprintIcon /> },
  { text: 'Statistics', path: '/statistics', icon: <BarChartIcon /> },
  { text: 'Profile', path: '/profile', icon: <PersonIcon /> },
  { text: 'Notes', path: '/notes', icon: <NoteAltIcon /> },
];

const bottomMenuItems = [
  { text: 'System Logs', path: '/logs', icon: <TerminalIcon /> },
];

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

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
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
}));

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [isCompactMode, setIsCompactMode] = React.useState(false);
  const [notchHeight, setNotchHeight] = React.useState(38);
  
  const { tasks, stopTimer } = useTimer();
  const { rewardAnimation, hideRewardAnimation } = useGamification();

  const activeTask = tasks.find((task) => task.startTimer !== null);

  useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    const handleOpenSettings = () => navigate('/settings');
    const handleEnterCompact = (data?: { menuBarHeight: number }) => {
        if (data?.menuBarHeight) setNotchHeight(data.menuBarHeight);
        setIsCompactMode(true);
    };
    const handleExitCompact = () => setIsCompactMode(false);

    window.electron.ipcRenderer.on('open-search', handleOpenSearch);
    window.electron.ipcRenderer.on('open-settings', handleOpenSettings);
    window.electron.ipcRenderer.on('enter-compact-mode', handleEnterCompact);
    window.electron.ipcRenderer.on('exit-compact-mode', handleExitCompact);

    return () => {
      window.electron.ipcRenderer.removeListener('open-search', handleOpenSearch);
      window.electron.ipcRenderer.removeListener('open-settings', handleOpenSettings);
      window.electron.ipcRenderer.removeListener('enter-compact-mode', handleEnterCompact);
      window.electron.ipcRenderer.removeListener('exit-compact-mode', handleExitCompact);
    };
  }, [navigate]);

  // Force transparency on HTML/Body when in compact mode
  useEffect(() => {
      if (isCompactMode) {
          document.documentElement.style.background = 'transparent';
          document.body.style.background = 'transparent';
      } else {
          document.documentElement.style.background = '';
          document.body.style.background = '';
      }
  }, [isCompactMode]);

  const handleDrawerOpen = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);

  const handleExpandIsland = () => {
    setIsCompactMode(false);
    window.electron.ipcRenderer.send('restore-window');
  };

  const getPageTitle = () => {
    const allItems = [...menuItems, ...bottomMenuItems];
    const currentItem = allItems.find(
      (item) => item.path === location.pathname,
    );
    return currentItem ? currentItem.text : 'Thingy';
  };

  const currentAnimationData = rewardAnimation
    ? animationMap[rewardAnimation]
    : null;

  if (isCompactMode) {
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          pt: `${notchHeight}px`,
          background: 'transparent',
        }}
      >
        <CssBaseline />
        <CompactIsland
          currentTask={
            activeTask ? { title: activeTask.title, status: 'active' } : undefined
          }
          onExpand={handleExpandIsland}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {currentAnimationData && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <Lottie
            animationData={currentAnimationData}
            loop={false}
            onComplete={hideRewardAnimation}
          />
        </Box>
      )}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AppBar position="fixed" open={open}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              sx={{ marginRight: 5, ...(open && { display: 'none' }) }}
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
                <Typography variant="body1" noWrap sx={{ color: 'white' }}>
                  {activeTask.title}
                </Typography>
                <Box sx={{ color: 'white', minWidth: '110px' }}>
                  <Timer
                    startTimer={activeTask.startTimer}
                    spendTime={activeTask.spendTime}
                    estimate={activeTask.estimate}
                    context="header"
                  />
                </Box>
                <IconButton
                  onClick={() => stopTimer(activeTask.id)}
                  sx={{ color: '#ef476f' }}
                >
                  <StopIcon />
                </IconButton>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                  <ListItemText
                    primary={item.text}
                    sx={{ opacity: open ? 1 : 0 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Box sx={{ flexGrow: 1 }} />
          <List>
            {bottomMenuItems.map((item) => (
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
                  <ListItemText
                    primary={item.text}
                    sx={{ opacity: open ? 1 : 0 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}