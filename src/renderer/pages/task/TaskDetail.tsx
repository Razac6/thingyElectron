import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useTimer } from '../../context/TimerContext';
import { getSprints } from '../../services/SprintService';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { useGamification } from '../../context/GamificationContext';

function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { tasks, updateTask } = useTimer();
  const { addXp, checkForAchievements, triggerConfetti } = useGamification();

  const [task, setTask] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const taskIdNum = Number(taskId);
    const foundTask = tasks.find(t => t.id === taskIdNum);
    if (foundTask) {
      setTask(foundTask);
    }

    const fetchSprints = async () => {
      const sprintsData = await getSprints();
      setSprints(sprintsData);
    };

    fetchSprints();
    setIsLoading(false);
  }, [taskId, tasks]);

  const handleSave = async () => {
    if (!task) return;

    const originalTask = tasks.find(t => t.id === task.id);
    await updateTask(task);

    if (originalTask && originalTask.status !== StatusEnum.COMPLETED && task.status === StatusEnum.COMPLETED) {
      addXp(10);
      checkForAchievements('TASK_COMPLETED', { task });
      triggerConfetti();
    }
    navigate(-1); // Go back after saving
  };

  if (isLoading || !task) {
    return (
      <Paper sx={{ padding: 3, textAlign: 'center' }}>
        <Typography variant="h5">{isLoading ? 'Loading task...' : 'Task not found'}</Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Paper>
    );
  }

  return (
    <Paper sx={{ padding: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Edit Task
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </Box>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            label="Title"
            fullWidth
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={task.description}
            onChange={(e) => setTask({ ...task, description: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={task.status}
              label="Status"
              onChange={(e) => setTask({ ...task, status: e.target.value as StatusEnum })}
            >
              <MenuItem value={StatusEnum.TO_DO}>To Do</MenuItem>
              <MenuItem value={StatusEnum.IN_PROGRESS}>In Progress</MenuItem>
              <MenuItem value={StatusEnum.IN_REVIEW}>In Review</MenuItem>
              <MenuItem value={StatusEnum.COMPLETED}>Completed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={task.priority}
              label="Priority"
              onChange={(e) => setTask({ ...task, priority: e.target.value as PriorityEnum })}
            >
              <MenuItem value={PriorityEnum.LOW}>Low</MenuItem>
              <MenuItem value={PriorityEnum.MEDIUM}>Medium</MenuItem>
              <MenuItem value={PriorityEnum.HIGH}>High</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
           <FormControl fullWidth>
            <InputLabel>Sprint</InputLabel>
            <Select
              value={task.sprintId || ''}
              label="Sprint"
              onChange={(e) => setTask({ ...task, sprintId: e.target.value === '' ? null : e.target.value })}
            >
              <MenuItem value=""><em>Backlog</em></MenuItem>
              {sprints.map(sprint => (
                <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Estimate (hours)"
            type="number"
            fullWidth
            value={task.estimate}
            onChange={(e) => setTask({ ...task, estimate: Number(e.target.value) })}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </Box>
    </Paper>
  );
}

export default TaskDetail;
