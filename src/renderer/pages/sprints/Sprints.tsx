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
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArchiveIcon from '@mui/icons-material/Archive';
import { getSprints, createSprint, updateSprintStatus } from '../../services/SprintService';
import { useTimer } from '../../context/TimerContext';
import { Task } from '../../../interfaces/task.interface';
import { StatusEnum } from '../../../enums/status.enum';

const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
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
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStart, setNewSprintStart] = useState<string>(formatDateForInput(new Date()));
  const [newSprintEnd, setNewSprintEnd] = useState<string>('');
  const { tasks, updateTask } = useTimer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSprints = async () => {
    const sprintsData = await getSprints();
    setSprints(sprintsData);
    // If a sprint is selected, update its data from the fresh list
    if (selectedSprint) {
      const updatedSelected = sprintsData.find(s => s.id === selectedSprint.id);
      setSelectedSprint(updatedSelected || null);
    } else if (sprintsData.length > 0) {
      setSelectedSprint(sprintsData[0]);
    }
  };

  useEffect(() => {
    fetchSprints();
  }, []);

  const handleCreateSprint = async () => {
    if (!newSprintName || !newSprintStart || !newSprintEnd) return;
    const newSprint = { name: newSprintName, startDate: new Date(newSprintStart).toISOString(), endDate: new Date(newSprintEnd).toISOString() };
    const created = await createSprint(newSprint);
    setSprints(prev => [created, ...prev]);
    setNewSprintName('');
  };

  const handleUpdateSprintStatus = async (sprintId: number, status: 'ACTIVE' | 'COMPLETED') => {
    await updateSprintStatus(sprintId, status);
    // After updating, re-fetch and update the selected sprint state
    const sprintsData = await getSprints();
    setSprints(sprintsData);
    const updatedSelected = sprintsData.find(s => s.id === sprintId);
    setSelectedSprint(updatedSelected || null);
  };

  const tasksInSelectedSprint = useMemo(() => {
    if (!selectedSprint) return [];
    return tasks.filter(task => task.sprintId === selectedSprint.id);
  }, [tasks, selectedSprint]);

  const sprintProgress = useMemo(() => {
    if (!selectedSprint || tasksInSelectedSprint.length === 0) return 0;
    const completedTasks = tasksInSelectedSprint.filter(t => t.status === StatusEnum.COMPLETED).length;
    return Math.round((completedTasks / tasksInSelectedSprint.length) * 100);
  }, [tasksInSelectedSprint, selectedSprint]);

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
      {/* Left Panel: Sprint List & Creation */}
      <Grid item xs={12} md={4}>
        <Paper sx={{ padding: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>Create New Sprint</Typography>
          <TextField label="Sprint Name" fullWidth value={newSprintName} onChange={(e) => setNewSprintName(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Start Date" type="date" fullWidth value={newSprintStart} onChange={(e) => setNewSprintStart(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <TextField label="End Date" type="date" fullWidth value={newSprintEnd} onChange={(e) => setNewSprintEnd(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <Button variant="contained" onClick={handleCreateSprint} fullWidth>Create Sprint</Button>
        </Paper>
        <Paper sx={{ padding: 2 }}>
          <Typography variant="h6" gutterBottom>All Sprints</Typography>
          <List>
            {sprints.map((sprint) => (
              <ListItemButton key={sprint.id} selected={selectedSprint?.id === sprint.id} onClick={() => setSelectedSprint(sprint)}>
                <ListItemText primary={sprint.name} secondary={<Chip label={sprint.status} size="small" color={sprint.status === 'ACTIVE' ? 'primary' : sprint.status === 'COMPLETED' ? 'success' : 'default'} />} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>

      {/* Right Panel: Selected Sprint Details */}
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

            {selectedSprint.status === 'ACTIVE' && (
              <Box sx={{ my: 2 }}>
                <Typography variant="body2">Sprint Progress: {sprintProgress}%</Typography>
                <LinearProgress variant="determinate" value={sprintProgress} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>Tasks in this Sprint</Typography>
            <List>
              {tasksInSelectedSprint.length > 0 ? (
                tasksInSelectedSprint.map(task => (
                  <ListItem key={task.id}><ListItemText primary={task.title} secondary={`Status: ${task.status}`} /></ListItem>
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

      {/* Add Task from Backlog Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Task from Backlog</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Search backlog..." fullWidth variant="standard" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <List sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
            {backlogTasks.map(task => (
              <ListItemButton key={task.id} onClick={() => handleAddTaskToSprint(task)}>
                <ListItemText primary={task.title} />
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
