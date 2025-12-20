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
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useTimer } from '../../context/TimerContext';
import { Task } from '../../../interfaces/task.interface';
import { analyzeSprintOptimism } from '../../services/DDAService';
import { getSprints } from '../../services/SprintService';

const getBusinessDatesCount = (startDate: string, endDate: string) => {
  let count = 0;
  const curDate = new Date(startDate);
  const end = new Date(endDate);
  while (curDate <= end) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
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
  const [suggestedCapacity, setSuggestedCapacity] = useState(0);
  const [optimismWarning, setOptimismWarning] = useState<string | null>(null);

  useEffect(() => {
    const fetchSprintData = async () => {
      const sprints = await getSprints();
      const current = sprints.find((s: any) => s.id === Number(sprintId));
      setSprint(current);

      const avgCapacity = await window.electron.database.getAverageSprintCapacity();
      setSuggestedCapacity(avgCapacity);
    };
    fetchSprintData();
  }, [sprintId]);

  const tasksInSprint = useMemo(() => {
    return tasks.filter(task => task.sprintId === Number(sprintId));
  }, [tasks, sprintId]);

  useEffect(() => {
    const analyze = async () => {
      if (tasksInSprint.length > 0) {
        const warning = await analyzeSprintOptimism(tasksInSprint);
        setOptimismWarning(warning);
      } else {
        setOptimismWarning(null);
      }
    };
    analyze();
  }, [tasksInSprint]);

  const currentLoad = useMemo(() => {
    return tasksInSprint.reduce((acc, task) => acc + (task.estimate || 0), 0);
  }, [tasksInSprint]);

  const displayedCapacity = useMemo(() => {
      if (suggestedCapacity > 0) return suggestedCapacity;
      if (sprint) {
          const days = getBusinessDatesCount(sprint.startDate, sprint.endDate);
          return days * 6;
      }
      return 0;
  }, [suggestedCapacity, sprint]);

  const capacityProgress = displayedCapacity > 0 ? Math.min((currentLoad / displayedCapacity) * 100, 100) : 0;
  const isTheoretical = suggestedCapacity === 0;

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

  if (!sprint) return <Typography>Loading sprint...</Typography>;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={() => navigate('/sprints')}>
              <ArrowBackIcon />
          </IconButton>
          <Box>
              <Typography variant="h4" fontWeight="300">{sprint.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                  {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()} | Status: {sprint.status}
              </Typography>
          </Box>
      </Box>

      <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight="bold">Tasks in this Sprint</Typography>
                      <Button 
                        variant="contained" 
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => setIsTaskPickerOpen(true)}
                        disabled={sprint.status === 'COMPLETED'}
                      >
                          Add from Backlog
                      </Button>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                      {tasksInSprint.length > 0 ? (
                          tasksInSprint.map(task => (
                              <ListItem 
                                key={task.id}
                                secondaryAction={
                                    <IconButton edge="end" color="error" onClick={() => handleRemoveTask(task)}>
                                        <RemoveCircleOutlineIcon />
                                    </IconButton>
                                }
                              >
                                  <ListItemText 
                                    primary={task.title} 
                                    secondary={`Status: ${task.status} | Estimate: ${task.estimate}h`} 
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

          <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">Capacity Analysis</Typography>
                  <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                          Load: <strong>{currentLoad}h</strong> / Limit: {Math.round(displayedCapacity)}h
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={capacityProgress} 
                        color={capacityProgress > 100 ? 'error' : 'primary'} 
                        sx={{ height: 12, borderRadius: 6, mb: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                          {isTheoretical ? 'Theoretical capacity based on work hours.' : 'Calculated based on your historical velocity.'}
                      </Typography>
                  </Box>
              </Paper>

              {optimismWarning && (
                  <Alert severity="warning" variant="outlined" sx={{ fontWeight: 'bold' }}>
                      {optimismWarning}
                  </Alert>
              )}
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
