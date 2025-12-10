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
  Autocomplete,
  Chip,
  IconButton,
  Link,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TimerIcon from '@mui/icons-material/Timer';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import { useTimer } from '../../context/TimerContext';
import { getSprints } from '../../services/SprintService';
import { getAllTags } from '../../services/DatabaseService';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { TaskTypeEnum } from '../../../enums/TaskTypeEnum';
import { useGamification } from '../../context/GamificationContext';
import TaskStats from '../../components/TaskStats'; // Import the new component

function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { tasks, updateTask, startTimer, stopTimer } = useTimer();
  const { addXp, checkForAchievements, triggerRewardAnimation } = useGamification();

  const [task, setTask] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchAndSetTask = async () => {
      setIsLoading(true); // Start loading

      const taskIdNum = Number(taskId);
      let currentTask: Task | null = null;

      // Try to find task in context first
      const foundTaskInContext = tasks.find(t => t.id === taskIdNum);
      if (foundTaskInContext) {
        currentTask = foundTaskInContext;
      } else {
        // If not found in context, fetch directly from DB
        const fetchedTaskFromDb = await window.electron.db.getTask(taskIdNum);
        currentTask = fetchedTaskFromDb;
      }
      
      if (currentTask) {
        setTask({ ...currentTask, tags: currentTask.tags || [], type: currentTask.type || TaskTypeEnum.TASK });
      } else {
        setTask(null); // Task not found
      }

      const sprintsData = await getSprints();
      setSprints(sprintsData);

      const allAvailableTags = await getAllTags();
      setAvailableTags(allAvailableTags || []);

      setIsLoading(false); // End loading after all data is fetched
    };
    
    fetchAndSetTask();
  }, [taskId, tasks]);

  const handleSave = async () => {
    if (!task) return;
    if (!task.estimate || task.estimate <= 0) {
      alert('Estimate must be greater than 0.');
      return;
    }
    const originalTask = tasks.find(t => t.id === task.id);
    await updateTask(task);

    if (originalTask && originalTask.status !== StatusEnum.COMPLETED && task.status === StatusEnum.COMPLETED) {
      addXp(10);
      const achievementEarned = await checkForAchievements('TASK_COMPLETED', { task });
      if (achievementEarned) {
        triggerRewardAnimation('achievement');
      } else {
        triggerRewardAnimation('standard');
      }
    }
    setIsEditing(false);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (task?.link) {
      let url = task.link;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      window.electron.shell.openExternal(url);
    }
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
          {isEditing ? 'Edit Task' : task.title}
        </Typography>
        <Box>
          {isEditing ? (
            <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={handleSave}>
              Save Changes
            </Button>
          ) : (
            <IconButton color="primary" onClick={() => setIsEditing(true)}>
              <EditIcon />
            </IconButton>
          )}
          <IconButton onClick={() => navigate(-1)} sx={{ ml: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
      </Box>
      <Divider sx={{ mb: 3 }} />

      {isEditing ? (
        <Grid container spacing={3}>
          <Grid item xs={12}><TextField label="Title" fullWidth value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /></Grid>
          <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={4} value={task.description} onChange={(e) => setTask({ ...task, description: e.target.value })} /></Grid>
          <Grid item xs={12}><TextField label="URL / Link" fullWidth value={task.link || ''} onChange={(e) => setTask({ ...task, link: e.target.value })} /></Grid>
          <Grid item xs={12}><Autocomplete multiple freeSolo options={availableTags} value={task.tags} onChange={(event, newValue) => setTask({ ...task, tags: newValue })} renderTags={(value, getTagProps) => value.map((option, index) => (<Chip variant="outlined" label={option} {...getTagProps({ index })} />))} renderInput={(params) => (<TextField {...params} variant="outlined" label="Tags" placeholder="Add tags" />)} /></Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
                fullWidth
                options={Object.values(TaskTypeEnum)}
                value={task.type}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setTask({ ...task, type: newValue as TaskTypeEnum });
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Type" />}
                disableClearable
             />
          </Grid>
          <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Status</InputLabel><Select value={task.status} label="Status" onChange={(e) => setTask({ ...task, status: e.target.value as StatusEnum })}><MenuItem value={StatusEnum.TO_DO}>To Do</MenuItem><MenuItem value={StatusEnum.IN_PROGRESS}>In Progress</MenuItem><MenuItem value={StatusEnum.IN_REVIEW}>In Review</MenuItem><MenuItem value={StatusEnum.COMPLETED}>Completed</MenuItem></Select></FormControl></Grid>
          <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Priority</InputLabel><Select value={task.priority} label="Priority" onChange={(e) => setTask({ ...task, priority: e.target.value as PriorityEnum })}><MenuItem value={PriorityEnum.LOW}>Low</MenuItem><MenuItem value={PriorityEnum.MEDIUM}>Medium</MenuItem><MenuItem value={PriorityEnum.HIGH}>High</MenuItem></Select></FormControl></Grid>
          <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Sprint</InputLabel><Select value={task.sprintId || ''} label="Sprint" onChange={(e) => setTask({ ...task, sprintId: e.target.value === '' ? null : e.target.value })}><MenuItem value=""><em>Backlog</em></MenuItem>{sprints.map(sprint => (<MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>))}</Select></FormControl></Grid>
          <Grid item xs={12} md={6}><TextField required label="Estimate (hours)" type="number" fullWidth value={task.estimate} onChange={(e) => setTask({ ...task, estimate: Math.max(0, Number(e.target.value)) })} inputProps={{ min: 0 }} /></Grid>
        </Grid>
      ) : (
        <Box>
          {task.link && (
            <Button startIcon={<OpenInNewIcon />} onClick={handleLinkClick} sx={{ mb: 2 }}>
              Open Link
            </Button>
          )}
          <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>{task.description || 'No description provided.'}</Typography>
          <TaskStats task={task} />
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
            <Grid item>
                {task.startTimer ? (
                    <Button variant="contained" color="secondary" startIcon={<TimerOffIcon />} onClick={() => stopTimer(task.id)}>
                        Stop Timer
                    </Button>
                ) : (
                    <Button variant="contained" color="primary" startIcon={<TimerIcon />} onClick={() => startTimer(task.id)}>
                        Start Timer
                    </Button>
                )}
            </Grid>
            <Grid item><Chip label={`Type: ${task.type}`} /></Grid>
            <Grid item><Chip label={`Status: ${task.status}`} /></Grid>
            <Grid item><Chip label={`Priority: ${task.priority}`} /></Grid>
            <Grid item><Chip label={`Sprint: ${sprints.find(s => s.id === task.sprintId)?.name || 'Backlog'}`} /></Grid>
            <Grid item><Chip label={`Estimate: ${task.estimate}h`} /></Grid>
          </Grid>
          {task.tags && task.tags.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>Tags:</Typography>
              {task.tags.map((tag: string) => <Chip key={tag} label={tag} sx={{ mr: 1 }} />)}
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default TaskDetail;
