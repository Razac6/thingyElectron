import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  LinearProgress,
  Tooltip,
  Alert,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArchiveIcon from '@mui/icons-material/Archive';
import EditIcon from '@mui/icons-material/Edit'; // Import EditIcon
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'; // Import RemoveCircleOutlineIcon
import { getSprints, createSprint, updateSprintStatus, updateSprint } from '../../services/SprintService'; // Import updateSprint
import { useTimer } from '../../context/TimerContext';
import { Task } from '../../../interfaces/task.interface';
import { StatusEnum } from '../../../enums/status.enum';
import { analyzeSprintOptimism } from '../../services/DDAService';

const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

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

interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
}

function Sprints() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null); // State for editing
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStart, setNewSprintStart] = useState<string>(formatDateForInput(new Date()));
  const [newSprintEnd, setNewSprintEnd] = useState<string>('');
  const { tasks, updateTask } = useTimer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedCapacity, setSuggestedCapacity] = useState(0);
  const [optimismWarning, setOptimismWarning] = useState<string | null>(null);

  const fetchSprintsAndCapacity = async () => {
    const sprintsData = await getSprints();
    setSprints(sprintsData);
    
    // Refresh selected sprint data if it was updated
    if (selectedSprint) {
        const updatedSelected = sprintsData.find((s: Sprint) => s.id === selectedSprint.id);
        if (updatedSelected) setSelectedSprint(updatedSelected);
    } else if (sprintsData.length > 0 && !selectedSprint) {
        // Don't auto-select on initial load if we want to respect user state, 
        // but for now, selecting first is fine. 
        // However, we handle auto-select on CREATE explicitly now.
        setSelectedSprint(sprintsData[0]);
    }
    
    const avgCapacity = await window.electron.database.getAverageSprintCapacity();
    setSuggestedCapacity(avgCapacity);
  };

  useEffect(() => {
    fetchSprintsAndCapacity();
  }, []);

  const handleSaveSprint = async () => {
    if (!newSprintName || !newSprintStart || !newSprintEnd) return;

    if (editingSprint) {
        // Update existing sprint
        const updated = {
            ...editingSprint,
            name: newSprintName,
            startDate: new Date(newSprintStart).toISOString(),
            endDate: new Date(newSprintEnd).toISOString()
        };
        await updateSprint(updated);
        setEditingSprint(null);
    } else {
        // Create new sprint
        const newSprint = { name: newSprintName, startDate: new Date(newSprintStart).toISOString(), endDate: new Date(newSprintEnd).toISOString() };
        const createdSprint = await createSprint(newSprint);
        
        // Auto-select the new sprint immediately
        setSelectedSprint(createdSprint);
    }
    
    // Reset form
    setNewSprintName('');
    setNewSprintStart(formatDateForInput(new Date()));
    setNewSprintEnd('');
    
    fetchSprintsAndCapacity();
  };

  const handleEditSprint = (sprint: Sprint, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingSprint(sprint);
      setNewSprintName(sprint.name);
      setNewSprintStart(formatDateForInput(new Date(sprint.startDate)));
      setNewSprintEnd(formatDateForInput(new Date(sprint.endDate)));
  };

  const handleCancelEdit = () => {
      setEditingSprint(null);
      setNewSprintName('');
      setNewSprintStart(formatDateForInput(new Date()));
      setNewSprintEnd('');
  };

  const handleUpdateSprintStatus = async (sprintId: number, status: 'ACTIVE' | 'COMPLETED') => {
    await updateSprintStatus(sprintId, status);
    fetchSprintsAndCapacity();
  };

  const handleRemoveTaskFromSprint = async (task: Task) => {
      const updatedTask = { ...task, sprintId: null }; 
      await updateTask(updatedTask as any);
  };

  const tasksInSelectedSprint = useMemo(() => {
    if (!selectedSprint) return [];
    return tasks.filter(task => task.sprintId === selectedSprint.id);
  }, [tasks, selectedSprint]);

  useEffect(() => {
    const analyze = async () => {
      if (tasksInSelectedSprint.length > 0) {
        const warning = await analyzeSprintOptimism(tasksInSelectedSprint);
        setOptimismWarning(warning);
      } else {
        setOptimismWarning(null);
      }
    };
    analyze();
  }, [tasksInSelectedSprint]);

  const currentSprintLoad = useMemo(() => {
    return tasksInSelectedSprint.reduce((acc, task) => acc + (task.estimate || 0), 0);
  }, [tasksInSelectedSprint]);

  // Calculate displayed capacity: History OR Theoretical (Business Days * 6h)
  const displayedCapacity = useMemo(() => {
      if (suggestedCapacity > 0) return suggestedCapacity;
      if (selectedSprint) {
          const days = getBusinessDatesCount(selectedSprint.startDate, selectedSprint.endDate);
          return days * 6; // Assume 6h per workday
      }
      return 0;
  }, [suggestedCapacity, selectedSprint]);

  const capacityProgress = displayedCapacity > 0 ? Math.min((currentSprintLoad / displayedCapacity) * 100, 100) : 0;
  const isTheoretical = suggestedCapacity === 0;

  const backlogTasks = useMemo(() => {
    return tasks.filter(task => !task.sprintId && task.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tasks, searchQuery]);

  const handleAddTaskToSprint = async (task: Task) => {
    if (!selectedSprint) return;
    const updatedTask = { ...task, sprintId: selectedSprint.id };
    await updateTask(updatedTask);
    setIsModalOpen(false);
    setSearchQuery('');
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper sx={{ padding: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>{editingSprint ? 'Edit Sprint' : 'Create New Sprint'}</Typography>
          {suggestedCapacity > 0 && !editingSprint && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Average Historical Velocity: ~{Math.round(suggestedCapacity)} hours
            </Typography>
          )}
          <TextField label="Sprint Name" fullWidth value={newSprintName} onChange={(e) => setNewSprintName(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Start Date" type="date" fullWidth value={newSprintStart} onChange={(e) => setNewSprintStart(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <TextField label="End Date" type="date" fullWidth value={newSprintEnd} onChange={(e) => setNewSprintEnd(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <Box display="flex" gap={1}>
            <Button variant="contained" onClick={handleSaveSprint} fullWidth>
                {editingSprint ? 'Update Sprint' : 'Create Sprint'}
            </Button>
            {editingSprint && (
                <Button variant="outlined" onClick={handleCancelEdit} fullWidth color="secondary">
                    Cancel
                </Button>
            )}
          </Box>
        </Paper>
        <Paper sx={{ padding: 2 }}>
          <Typography variant="h6" gutterBottom>All Sprints</Typography>
          <List>
            {sprints.map((sprint) => (
              <ListItemButton key={sprint.id} selected={selectedSprint?.id === sprint.id} onClick={() => setSelectedSprint(sprint)}>
                <ListItemText primary={sprint.name} secondary={<Chip label={sprint.status} size="small" color={sprint.status === 'ACTIVE' ? 'primary' : sprint.status === 'COMPLETED' ? 'success' : 'default'} />} />
                <IconButton size="small" onClick={(e) => handleEditSprint(sprint, e)}>
                    <EditIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>

      <Grid item xs={12} md={8}>
        {selectedSprint ? (
          <Paper sx={{ padding: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h5" gutterBottom>{selectedSprint.name}</Typography>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                  {`From: ${new Date(selectedSprint.startDate).toLocaleDateString()} | To: ${new Date(selectedSprint.endDate).toLocaleDateString()}`}
                </Typography>
              </Box>
              <Box>
                {selectedSprint.status === 'UPCOMING' && (
                  <Button startIcon={<PlayArrowIcon />} onClick={() => handleUpdateSprintStatus(selectedSprint.id, 'ACTIVE')}>Start Sprint</Button>
                )}
                {selectedSprint.status === 'ACTIVE' && (
                  <Button startIcon={<ArchiveIcon />} onClick={() => handleUpdateSprintStatus(selectedSprint.id, 'COMPLETED')}>Complete Sprint</Button>
                )}
                 <IconButton color="primary" onClick={() => setIsModalOpen(true)} title="Add task from backlog">
                  <AddCircleOutlineIcon fontSize="large" />
                </IconButton>
              </Box>
            </Box>

            {displayedCapacity > 0 && selectedSprint.status !== 'COMPLETED' && (
              <Box sx={{ my: 2 }}>
                <Tooltip title={`Current Load: ${currentSprintLoad}h / ${isTheoretical ? 'Estimated' : 'Historical'}: ${Math.round(displayedCapacity)}h`}>
                  <Box>
                    <Typography variant="body2">
                        Sprint Capacity ({isTheoretical ? 'Estimated based on duration' : 'Based on history'})
                    </Typography>
                    <LinearProgress variant="determinate" value={capacityProgress} color={capacityProgress > 100 ? 'error' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
                  </Box>
                </Tooltip>
              </Box>
            )}

            {optimismWarning && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {optimismWarning}
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>Tasks in this Sprint</Typography>
            <List>
              {tasksInSelectedSprint.length > 0 ? (
                tasksInSelectedSprint.map(task => (
                  <ListItem 
                    key={task.id}
                    secondaryAction={
                        <IconButton edge="end" aria-label="remove" onClick={() => handleRemoveTaskFromSprint(task)}>
                            <RemoveCircleOutlineIcon />
                        </IconButton>
                    }
                  >
                    <ListItemText primary={task.title} secondary={`Status: ${task.status}`} />
                  </ListItem>
                ))
              ) : (
                <Typography>No tasks assigned to this sprint yet.</Typography>
              )}
            </List>
          </Paper>
        ) : (
          <Paper sx={{ padding: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography>Select a sprint to see details</Typography>
          </Paper>
        )}
      </Grid>

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Task from Backlog</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Search backlog..." fullWidth variant="standard" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <List sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
            {backlogTasks.map(task => (
              <ListItemButton key={task.id} onClick={() => handleAddTaskToSprint(task)}>
                <ListItemText primary={task.title} secondary={`Estimate: ${task.estimate}h`} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}

export default Sprints;
