import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  LinearProgress,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ListItemButton,
  Breadcrumbs,
  Link,
  Grid,
  Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { useTimer } from '../../context/TimerContext';
import { Task } from '../../../interfaces/task.interface';
import { analyzeSprintOptimism } from '../../services/DDAService';
import { getSprints } from '../../services/SprintService';
import { differenceInBusinessDays, parseISO, isSameDay } from 'date-fns';

const calculateWorkDays = (start: string, end: string, excludedDates: string[] = []) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    let count = 0;
    const curDate = new Date(startDate);
    
    // Parse excluded dates properly
    const excluded = excludedDates.map(d => new Date(d));

    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isExcluded = excluded.some(ex => isSameDay(ex, curDate));
        
        if (!isWeekend && !isExcluded) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

export default function SprintDetail() {
  const { sprintId } = useParams();
  const navigate = useNavigate();
  const { tasks, updateTask } = useTimer();
  
  const [sprint, setSprint] = useState<any>(null);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historicalVelocity, setHistoricalVelocity] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  useEffect(() => {
    const fetchSprintData = async () => {
      const sprints = await getSprints();
      const current = sprints.find((s: any) => s.id === Number(sprintId));
      setSprint(current);

      // Fetch Historical Velocity (Average completed points/hours per sprint)
      const avgCapacity = await window.electron.database.getAverageSprintCapacity();
      setHistoricalVelocity(avgCapacity || 0);

      // If active, try to get AI analysis
      if (current && current.status === 'ACTIVE') {
          const analysis = await window.electron.database.getSprintAnalysis(1); // Assuming userId=1
          setAiAnalysis(analysis);
      }
    };
    fetchSprintData();
  }, [sprintId]);

  const tasksInSprint = useMemo(() => {
    return tasks.filter(task => task.sprintId === Number(sprintId));
  }, [tasks, sprintId]);

  const currentLoad = useMemo(() => {
    return tasksInSprint.reduce((acc, task) => acc + (task.estimate || 0), 0);
  }, [tasksInSprint]);

  const calculatedCapacity = useMemo(() => {
      if (!sprint) return 0;
      
      // 1. Prefer manually set capacity from planning
      if (sprint.capacity && sprint.capacity > 0) return sprint.capacity;

      // 2. Fallback to calculating based on workdays (8h default)
      const workDays = calculateWorkDays(sprint.startDate, sprint.endDate, sprint.excludedDates);
      return workDays * 8;
  }, [sprint]);

  const capacityProgress = calculatedCapacity > 0 ? Math.min((currentLoad / calculatedCapacity) * 100, 100) : 0;
  
  const velocityDiff = historicalVelocity > 0 ? currentLoad - historicalVelocity : 0;
  const isOverVelocity = velocityDiff > 0;

  const backlogTasks = useMemo(() => {
    return tasks.filter(task => !task.sprintId && task.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tasks, searchQuery]);

  const handleAddTaskToSprint = async (task: Task) => {
    await updateTask({ ...task, sprintId: Number(sprintId) });
    setIsTaskPickerOpen(false);
    setSearchQuery('');
  };

  const handleRemoveTask = async (task: Task) => {
    await updateTask({ ...task, sprintId: null });
  };

  if (!sprint) return <Typography sx={{ p: 3 }}>Loading sprint data...</Typography>;

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={2} px={3} pt={3}>
          <IconButton onClick={() => navigate('/sprints')}>
              <ArrowBackIcon />
          </IconButton>
          <Box>
              <Typography variant="h4" fontWeight="300" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {sprint.name} 
                  <Chip 
                    label={sprint.status} 
                    color={sprint.status === 'ACTIVE' ? 'primary' : sprint.status === 'COMPLETED' ? 'success' : 'default'} 
                    size="small" 
                    variant="outlined" 
                  />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                  {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
              </Typography>
          </Box>
      </Box>

      <Grid container spacing={3} sx={{ px: 3, pb: 3, flex: 1, overflow: 'hidden' }}>
          {/* Left Column: Tasks */}
          <Grid item xs={12} md={8} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Paper sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Box p={2} display="flex" justifyContent="space-between" alignItems="center" bgcolor="#f5f5f5" borderBottom="1px solid #eee">
                      <Typography variant="subtitle1" fontWeight="bold">Sprint Backlog ({tasksInSprint.length})</Typography>
                      <Button 
                        variant="contained" 
                        size="small"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => setIsTaskPickerOpen(true)}
                        disabled={sprint.status === 'COMPLETED'}
                      >
                          Add Task
                      </Button>
                  </Box>
                  <List sx={{ flex: 1, overflow: 'auto' }}>
                      {tasksInSprint.length > 0 ? (
                          tasksInSprint.map(task => (
                              <ListItem 
                                key={task.id}
                                divider
                                secondaryAction={
                                    <IconButton edge="end" color="default" size="small" onClick={() => handleRemoveTask(task)}>
                                        <RemoveCircleOutlineIcon />
                                    </IconButton>
                                }
                              >
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: task.status === 'Completed' ? '#4caf50' : '#ff9800', mr: 2 }} />
                                  <ListItemText 
                                    primary={task.title} 
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            {task.status} • Est: <strong>{task.estimate}h</strong> • Priority: {task.priority}
                                        </Typography>
                                    } 
                                  />
                              </ListItem>
                          ))
                      ) : (
                          <Box textAlign="center" py={5}>
                              <Typography color="text.secondary">This sprint is empty.</Typography>
                          </Box>
                      )}
                  </List>
              </Paper>
          </Grid>

          {/* Right Column: Analytics */}
          <Grid item xs={12} md={4} sx={{ height: '100%', overflow: 'auto' }}>
              
              {/* 1. Capacity Widget */}
              <Paper sx={{ p: 3, mb: 2 }}>
                  <Typography variant="overline" color="text.secondary" fontWeight="bold">CAPACITY PLANNING</Typography>
                  
                  <Box mt={2}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2">Planned Load</Typography>
                          <Typography variant="body2" fontWeight="bold">
                              {currentLoad}h <span style={{ color: '#bdbdbd', fontWeight: 'normal' }}>/ {calculatedCapacity}h</span>
                          </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={capacityProgress} 
                        color={capacityProgress > 100 ? 'error' : 'primary'} 
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Based on {sprint.capacity ? 'manual plan' : 'working days (8h)'}.
                      </Typography>
                  </Box>
              </Paper>

              {/* 2. Velocity Widget */}
              <Paper sx={{ p: 3, mb: 2 }}>
                  <Typography variant="overline" color="text.secondary" fontWeight="bold">VELOCITY CHECK</Typography>
                  <Box display="flex" alignItems="center" gap={2} mt={2}>
                      <SpeedIcon fontSize="large" color={isOverVelocity ? 'warning' : 'success'} />
                      <Box>
                          <Typography variant="h5" fontWeight="300">
                              {currentLoad}h
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                              Avg Velocity: {Math.round(historicalVelocity)}h
                          </Typography>
                      </Box>
                  </Box>
                  {isOverVelocity && (
                      <Alert severity="warning" sx={{ mt: 2, py: 0 }}>
                          You are planning <strong>{velocityDiff.toFixed(1)}h</strong> more than usual.
                      </Alert>
                  )}
              </Paper>

          </Grid>
      </Grid>

      {/* Task Picker Dialog */}
      <Dialog open={isTaskPickerOpen} onClose={() => setIsTaskPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Select Tasks</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Search backlog..." 
            fullWidth 
            variant="standard" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          <List sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
            {backlogTasks.map(task => (
              <ListItemButton key={task.id} onClick={() => handleAddTaskToSprint(task)}>
                <ListItemText primary={task.title} secondary={`Estimate: ${task.estimate}h`} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsTaskPickerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}