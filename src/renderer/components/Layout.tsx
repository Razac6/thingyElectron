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
  ButtonBase,
  Tooltip,
  styled,
  Theme,
  CSSObject,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import Lottie from 'lottie-react';

// Import all animations

import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import TasksIcon from '@mui/icons-material/TaskAltOutlined';
import StatisticsIcon from '@mui/icons-material/InsightsOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlineOutlined';
import SprintIcon from '@mui/icons-material/DirectionsRunOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import HabitsIcon from '@mui/icons-material/EventRepeatOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import StopIcon from '@mui/icons-material/Stop'; // Use the square Stop icon
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/TerminalOutlined';
import MonitoringIcon from '@mui/icons-material/ScreenSearchDesktopOutlined';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import trophyAnimation from '../../../assets/Trophy.json';
import catRocket from '../../../assets/Cat in a rocket.json';
import meditatingFox from '../../../assets/Meditating Fox.json';
import flirtingDog from '../../../assets/Flirting Dog.json';
import catMovement from '../../../assets/Cat Movement.json';
import { useTimer } from '../context/TimerContext';
import { useGamification } from '../context/GamificationContext';
import Timer from './Timer';
import { PageAction, PageActionsContext } from '../context/PageActionsContext';
import SearchOverlay from './SearchOverlay';
import IdlePromptModal from './IdlePromptModal';
import FocusBlockCard from './FocusBlockCard';
import TimerPill from './TimerPill';
import { useRunningBlock } from './focusBlockStore';
import ModeSuggestionModal from './ModeSuggestionModal';
import BoostOverlay from './BoostOverlay';
import { useSettings } from '../context/SettingsContext';
import { AiCompanion } from './AiCompanion';
import { useIsLuma } from '../themes';

// The search shortcut is registered as CommandOrControl+K - show it the way each OS writes it
const SEARCH_SHORTCUT = /mac/i.test(navigator.platform || navigator.userAgent)
  ? '⌘K'
  : 'Ctrl K';

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
  { text: 'Tasks', path: '/list', icon: <TasksIcon /> },
  { text: 'Habits', path: '/habits', icon: <HabitsIcon /> },
  { text: 'Sprints', path: '/sprints', icon: <SprintIcon /> },
  { text: 'Statistics', path: '/statistics', icon: <StatisticsIcon /> },
  { text: 'Monitoring', path: '/web-activity', icon: <MonitoringIcon /> },
  { text: 'Profile', path: '/profile', icon: <PersonIcon /> },
];

// Titles for routes that aren't in the menu (shown in the AppBar)
const extraPageTitles: Record<string, string> = {
  '/settings': 'Settings',
  '/meditation': 'Meditation',
};

const bottomMenuItems = [
  { text: 'System Logs', path: '/logs', icon: <TerminalIcon /> },
  { text: 'About', path: '/about', icon: <InfoIcon /> },
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
  const [pageActions, setPageActions] = React.useState<PageAction[]>([]);
  const {
    tasks,
    stopTimer,
    idlePrompt,
    handleKeepIdleTime,
    handleDiscardIdleTime,
    isBoostMode,
    toggleBoostMode,
    dailyMode,
    modeSuggestion,
    handleAcceptModeSuggestion,
    handleDismissModeSuggestion,
  } = useTimer();
  const { rewardAnimation, hideRewardAnimation } = useGamification();
  const { settings } = useSettings();
  const isLuma = useIsLuma();

  const activeTask = tasks.find((task) => task.startTimer !== null);
  const isPomodoroRunning = activeTask?.timerMode === 'pomodoro';

  // A focus block started with Boost keeps the overlay open until the block ends
  const focusBlock = useRunningBlock();

  // Auto-activate Boost Overlay if mode is Boost and timer is running. A running Pomodoro
  // sets isBoostMode itself (see startTimer in TimerContext) independently of dailyMode - it
  // must never be force-closed here just because the daily mode isn't 'boost', otherwise the
  // overlay (and its liquid loader) closes right after opening for every Pomodoro session.
  useEffect(() => {
    if (dailyMode === 'boost' && activeTask) {
      if (!isBoostMode) toggleBoostMode(true);
    } else if (isBoostMode && !isPomodoroRunning && !focusBlock?.boost) {
      toggleBoostMode(false);
    }
  }, [dailyMode, activeTask, isBoostMode, isPomodoroRunning, focusBlock]);

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.text === 'Monitoring') {
      return (
        settings.browser_integration_enabled === 'true' ||
        settings.desktop_app_monitoring_enabled !== 'false'
      );
    }
    return true;
  });

  useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    const handleOpenSettings = () => navigate('/settings');

    const handleTaskDraft = (draft: any) => {
      console.log('Layout: Received draft task:', draft);
      // Navigate to List view and pass the draft data to open the modal there
      navigate('/list', { state: { draftTask: draft } });
    };

    const unsubSearch = window.electron.ipcRenderer.on(
      'open-search',
      handleOpenSearch,
    );
    const unsubSettings = window.electron.ipcRenderer.on(
      'open-settings',
      handleOpenSettings,
    );
    const unsubDraft = window.electron.ipcRenderer.on(
      'task:draft-received',
      handleTaskDraft,
    );

    return () => {
      if (unsubSearch) unsubSearch();
      if (unsubSettings) unsubSettings();
      if (unsubDraft) unsubDraft();
    };
  }, [navigate]);

  const handleDrawerOpen = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);

  const getPageTitle = () => {
    const allItems = [...menuItems, ...bottomMenuItems];
    const currentItem = allItems.find(
      (item) => item.path === location.pathname,
    );
    return currentItem
      ? currentItem.text
      : extraPageTitles[location.pathname] || 'Thingy';
  };

  const currentAnimationData = rewardAnimation
    ? animationMap[rewardAnimation]
    : null;

  return (
    <PageActionsContext.Provider value={setPageActions}>
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <CssBaseline />
        <BoostOverlay
          open={isBoostMode}
          onClose={() => toggleBoostMode(false)}
        />
        <AiCompanion />
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
        {idlePrompt && (
          <IdlePromptModal
            open={idlePrompt.isOpen}
            idleTimeMs={idlePrompt.idleTimeMs}
            taskTitle={idlePrompt.taskTitle}
            onKeep={handleKeepIdleTime}
            onDiscard={handleDiscardIdleTime}
            reason={idlePrompt.reason}
            sessionStart={idlePrompt.originalStartTime}
            lastActivityAt={idlePrompt.lastActivityAt}
          />
        )}
        <FocusBlockCard />
        {modeSuggestion && (
          <ModeSuggestionModal
            open={!!modeSuggestion}
            mode={modeSuggestion.mode}
            reason={modeSuggestion.reason}
            onAccept={handleAcceptModeSuggestion}
            onDismiss={handleDismissModeSuggestion}
          />
        )}
        {isLuma ? (
          // Luma has no top bar: search and the running timer float in the top-right corner
          <Box
            sx={{
              position: 'fixed',
              top: 12,
              right: 24,
              zIndex: (theme) => theme.zIndex.drawer + 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            {activeTask && (
              <TimerPill
                task={activeTask}
                onStop={() => stopTimer(activeTask.id)}
              />
            )}
            {pageActions
              .filter((action) => !action.primary)
              .map((action) => (
                <Tooltip key={action.key} title={action.label}>
                  <IconButton
                    aria-label={action.label}
                    onClick={action.onClick}
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: '0 8px 24px rgba(17,18,20,0.08)',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    {action.icon}
                  </IconButton>
                </Tooltip>
              ))}
            {pageActions
              .filter((action) => action.primary)
              .map((action) => (
                <ButtonBase
                  key={action.key}
                  aria-label={action.label}
                  onClick={action.onClick}
                  sx={{
                    height: 40,
                    pl: 1.5,
                    pr: 2,
                    gap: 0.75,
                    borderRadius: 999,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    boxShadow: '0 8px 24px rgba(17,18,20,0.18)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    '&:hover': { bgcolor: 'primary.light' },
                  }}
                >
                  {action.icon}
                  {action.label}
                </ButtonBase>
              ))}
            <ButtonBase
              onClick={() => setSearchOpen(true)}
              sx={{
                height: 40,
                px: 2,
                gap: 1,
                borderRadius: 999,
                bgcolor: 'background.paper',
                color: 'text.secondary',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 8px 24px rgba(17,18,20,0.08)',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'color 0.2s, border-color 0.2s',
                '&:hover': {
                  color: 'text.primary',
                  borderColor: 'text.primary',
                },
              }}
            >
              <SearchIcon fontSize="small" />
              Search
              <Box
                component="kbd"
                sx={{
                  ml: 1,
                  px: 0.75,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  fontFamily: 'inherit',
                  fontSize: '0.7rem',
                }}
              >
                {SEARCH_SHORTCUT}
              </Box>
            </ButtonBase>
          </Box>
        ) : (
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
        )}
        <Drawer variant="permanent" open={open}>
          <DrawerHeader
            sx={isLuma && !open ? { justifyContent: 'center' } : undefined}
          >
            {isLuma && !open ? (
              // Without a top bar the drawer opens from its own header
              <IconButton aria-label="open drawer" onClick={handleDrawerOpen}>
                <MenuIcon />
              </IconButton>
            ) : (
              <IconButton onClick={handleDrawerClose}>
                <ChevronLeftIcon />
              </IconButton>
            )}
          </DrawerHeader>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <List>
              {visibleMenuItems.map((item) => (
                <ListItem
                  key={item.text}
                  disablePadding
                  sx={{ display: 'block' }}
                >
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
                <ListItem
                  key={item.text}
                  disablePadding
                  sx={{ display: 'block' }}
                >
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
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            height: '100%',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          {/* Room for the AppBar (Classic) or the floating search pill (Luma) */}
          {isLuma ? (
            <Box sx={{ height: 40, flexShrink: 0 }} />
          ) : (
            <Toolbar sx={{ flexShrink: 0 }} />
          )}
          <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
        </Box>
      </Box>
    </PageActionsContext.Provider>
  );
}
