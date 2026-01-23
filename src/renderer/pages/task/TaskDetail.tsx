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
  Alert,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TimerIcon from '@mui/icons-material/Timer';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTimer } from '../../context/TimerContext';
import { getSprints } from '../../services/SprintService';
import { getAllTags, getChecklistItems, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from '../../services/DatabaseService';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { TaskTypeEnum } from '../../../enums/TaskTypeEnum';
import { useGamification } from '../../context/GamificationContext';
import { useSettings } from '../../context/SettingsContext';
import TaskStats from '../../components/TaskStats';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend
);

function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { tasks, updateTask, startTimer, stopTimer } = useTimer();
  const { addXp, checkForAchievements, triggerRewardAnimation } = useGamification();
  const { settings } = useSettings();

  const [task, setTask] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    const fetchAndSetTask = async () => {
      setIsLoading(true);

      const taskIdNum = Number(taskId);
      let currentTask: any = null;

      const foundTaskInContext = tasks.find(t => t.id === taskIdNum);
      if (foundTaskInContext) {
        currentTask = foundTaskInContext;
      } else {
        const allTasks = await window.electron.database.getTasks(localStorage.getItem('userId') ? JSON.parse(localStorage.getItem('userId')!) : 1);
        currentTask = allTasks.find((t: any) => t.id === taskIdNum);
      }
      
      if (currentTask) {
        setTask({ ...currentTask, tags: currentTask.tags || [], type: currentTask.type || TaskTypeEnum.TASK });
        const items = await getChecklistItems(taskIdNum);
        setChecklist(items);

        // Fetch Work Sessions for Chart
        try {
            const sessions = await window.electron.database.getTaskWorkSessions(taskIdNum);
            if (sessions && sessions.length > 0) {
                const grouped: Record<string, number> = {};
                let totalDuration = 0;
                
                sessions.forEach((s: any) => {
                    const dateObj = new Date(s.startTime);
                    if (!isNaN(dateObj.getTime())) {
                        const dateKey = dateObj.toLocaleDateString();
                        // Duration in database is ms, convert to minutes
                        const minutes = Math.round(s.duration / (1000 * 60));
                        grouped[dateKey] = (grouped[dateKey] || 0) + minutes;
                        totalDuration += minutes;
                    }
                });
                
                const labels = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                const dataPoints = labels.map(d => grouped[d]);

                // Calculate Stats
                const avgSession = Math.round(totalDuration / sessions.length);
                const hours = Math.floor(totalDuration / 60);
                const mins = totalDuration % 60;

                setChartData({
                    labels,
                    datasets: [
                        {
                            label: 'Time Spent (min)',
                            data: dataPoints,
                            backgroundColor: '#023047',
                            borderRadius: 4,
                            barThickness: 20,
                        }
                    ],
                    stats: {
                        total: `${hours}h ${mins}m`,
                        count: sessions.length,
                        avg: `${avgSession} min`
                    }
                });
            } else {
                setChartData(null);
            }
        } catch (e) {
            console.error("Failed to load chart data", e);
        }
      } else {
        setTask(null);
      }

      const sprintsData = await getSprints();
      setSprints(sprintsData);

      const allAvailableTags = await getAllTags();
      setAvailableTags(allAvailableTags || []);

      setIsLoading(false);
    };
    
    fetchAndSetTask();
  }, [taskId, tasks]);

  const handleAddChecklist = async () => {
      if (newChecklistItem.trim()) {
          const updated = await addChecklistItem(Number(taskId), newChecklistItem);
          setChecklist(updated);
          setNewChecklistItem('');
      }
  };

  const handleToggleChecklist = async (id: number, currentStatus: number) => {
      const updated = await toggleChecklistItem(id, !currentStatus);
      setChecklist(updated);
  };

  const handleExternalLink = (e: React.MouseEvent) => {
      e.preventDefault();
      if (task?.link) {
          let url = task.link;
          if (!/^https?:\/\//i.test(url)) {
              url = 'https://' + url;
          }
          window.electron.shell.openExternal(url);
      }
  };

  const handleDeleteChecklist = async (id: number) => {
      const updated = await deleteChecklistItem(id);
      setChecklist(updated);
  };

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

          {/* Progress Chart Section */}
          <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Work History</Typography>
              {chartData ? (
                  <>
                    <Box sx={{ height: 250, bgcolor: '#f8f9fa', p: 2, borderRadius: 2, mb: 2 }}>
                        <Bar 
                            data={chartData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: (context) => `${context.parsed.y} min`
                                        }
                                    }
                                },
                                scales: {
                                    y: { 
                                        beginAtZero: true, 
                                        grid: { color: '#e0e0e0' }
                                    },
                                    x: {
                                        grid: { display: false }
                                    }
                                }
                            }} 
                        />
                    </Box>
                    <Grid container spacing={2}>
                        <Grid item xs={4}>
                            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Total Time</Typography>
                                <Typography variant="h6" color="primary">{chartData.stats.total}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={4}>
                            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Sessions</Typography>
                                <Typography variant="h6">{chartData.stats.count}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={4}>
                            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Avg Session</Typography>
                                <Typography variant="h6">{chartData.stats.avg}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                  </>
              ) : (
                  <Alert severity="info" variant="outlined">
                      No work sessions recorded yet. Start the timer to track your progress over time!
                  </Alert>
              )}
          </Box>
          
          {/* Complexity Warnings */}
          {task.estimate >= (Number(settings.complexityThreshold) || 8) && checklist.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2, mb: 1 }}>
                  <strong>High Complexity Detected:</strong> This task is estimated for {task.estimate}h but has no sub-steps. 
                  Consider breaking it down into a checklist for better tracking.
              </Alert>
          )}
          {task.estimate < 0.5 && checklist.length > 5 && (
              <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
                  <strong>Granularity Notice:</strong> You have many steps for a short task. Ensure you aren't micro-managing.
              </Alert>
          )}

          {/* Smart Checklist Section */}
          <Box sx={{ mt: 3, mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>Smart Checklist</Typography>
            {checklist.map((item) => (
                <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <IconButton size="small" onClick={() => handleToggleChecklist(item.id, item.isCompleted)}>
                        {item.isCompleted ? <CheckBoxIcon color="primary" /> : <CheckBoxOutlineBlankIcon />}
                    </IconButton>
                    <Typography 
                        sx={{ 
                            flexGrow: 1, 
                            textDecoration: item.isCompleted ? 'line-through' : 'none',
                            color: item.isCompleted ? 'text.disabled' : 'text.primary'
                        }}
                    >
                        {item.text}
                    </Typography>
                    <IconButton size="small" onClick={() => handleDeleteChecklist(item.id)}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Add sub-task or step..." 
                    value={newChecklistItem} 
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                />
                <Button variant="contained" sx={{ ml: 1 }} onClick={handleAddChecklist}>Add</Button>
            </Box>
          </Box>

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
            <Grid item><Chip label={`🍅 ${task.pomodoroCount || 0}`} title="Completed Pomodoro Sessions" /></Grid>
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