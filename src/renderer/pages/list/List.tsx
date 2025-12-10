import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid, GridRenderCellParams, GridSortModel, GridColDef } from '@mui/x-data-grid';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  TextField,
  Typography,
  Chip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { TaskTypeEnum } from '../../../enums/TaskTypeEnum';
import Timer from '../../components/Timer';
import { getSprints } from '../../services/SprintService';
import { useTimer } from '../../context/TimerContext';
import { useGamification } from '../../context/GamificationContext';
import { Task } from '../../../interfaces/task.interface';
import { getAllTags } from '../../services/DatabaseService';

const getPriorityColor = (priority: PriorityEnum) => {
  switch (priority) {
    case PriorityEnum.HIGH: return '#d32f2f';
    case PriorityEnum.MEDIUM: return '#ffb300';
    case PriorityEnum.LOW: return '#1976d2';
    default: return '#9e9e9e';
  }
};

function List() {
  const navigate = useNavigate();
  const { tasks, setTasks, startTimer, stopTimer, updateTask, createTask, deleteTask } = useTimer();
  const { addXp, checkForAchievements, triggerRewardAnimation } = useGamification();
  const [sprints, setSprints] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: StatusEnum.TO_DO,
    priority: PriorityEnum.MEDIUM,
    estimate: 1,
    link: '',
    type: TaskTypeEnum.TASK,
  });
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [currentMenuTaskId, setCurrentMenuTaskId] = useState<null | number>(null);
  const [filterSprint, setFilterSprint] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isColumnSortActive, setIsColumnSortActive] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchSprints = async () => {
      const sprintsData = await getSprints();
      setSprints(sprintsData);
    };
    const fetchTags = async () => {
      const tags = await getAllTags();
      setAvailableTags(tags || []);
    };
    fetchSprints();
    fetchTags();
  }, []);

  const anyTimerRunning = tasks.some((task) => task.startTimer !== null);

  const filteredTasks = useMemo(() => {
    let processedTasks = [...tasks];
    if (filterSprint !== 'all') {
      processedTasks = filterSprint === 'backlog'
        ? processedTasks.filter(task => !task.sprintId)
        : processedTasks.filter(task => task.sprintId === Number(filterSprint));
    }
    if (filterType !== 'all') {
      processedTasks = processedTasks.filter(task => task.type === filterType);
    }
    if (!showCompletedTasks) {
      processedTasks = processedTasks.filter(task => task.status !== StatusEnum.COMPLETED);
    }
    return processedTasks;
  }, [tasks, showCompletedTasks, filterSprint, filterType]);

  useEffect(() => {
    // Force re-filtering when dependencies change
  }, [tasks, showCompletedTasks, filterSprint, filterType]);

  const handleMoveTask = async (taskId: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    handleMenuClose();
    const allTasks = [...tasks];
    const taskIndex = allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const [movedTask] = allTasks.splice(taskIndex, 1);

    if (direction === 'up') {
      const newIndex = taskIndex - 1;
      if (newIndex >= 0) allTasks.splice(newIndex, 0, movedTask);
    } else if (direction === 'down') {
      const newIndex = taskIndex + 1;
      if (newIndex < allTasks.length + 1) allTasks.splice(newIndex, 0, movedTask);
    } else if (direction === 'top') {
      allTasks.unshift(movedTask);
    } else if (direction === 'bottom') {
      allTasks.push(movedTask);
    }

    setTasks(allTasks);
    await window.electron.database.updateTasksOrder(allTasks.map(t => t.id));
  };

  const handleSortModelChange = (model: GridSortModel) => {
    setIsColumnSortActive(model.length > 0);
  };

  const handleAddTask = async () => {
    if (!newTask.estimate || newTask.estimate <= 0) {
      alert('Estimate must be greater than 0.');
      return;
    }
    const taskToCreate: Partial<Task> = { ...newTask, createdAt: new Date().toLocaleDateString(), updateStatusDate: new Date().toLocaleDateString(), spendTime: 0, startTimer: null };
    try {
      await createTask(taskToCreate);
      setNewTask({ title: '', description: '', status: StatusEnum.TO_DO, priority: PriorityEnum.MEDIUM, estimate: 1, link: '', type: TaskTypeEnum.TASK });
      setOpenDialog(false);
    } catch (error) {
      console.error('Failed to add task', error);
    }
  };

  const handleStatusChange = async (newStatus: StatusEnum, task: Task) => {
    setEditingStatusId(null);
    if (task.status === newStatus) return;

    const updatedTask = { ...task, status: newStatus };
    await updateTask(updatedTask);

    if (newStatus === StatusEnum.COMPLETED) {
      addXp(10);
      const achievementEarned = await checkForAchievements('TASK_COMPLETED', { task: updatedTask });
      if (achievementEarned) {
        triggerRewardAnimation('achievement');
      } else {
        triggerRewardAnimation('standard');
      }
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await deleteTask(id);
    } catch (error) {
      console.error('Failed to delete task', error);
    }
    handleMenuClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, taskId: number) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setCurrentMenuTaskId(taskId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setCurrentMenuTaskId(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      renderCell: (params: GridRenderCellParams<any, Task>) => (
        <Typography
          sx={{
            textDecoration: params.row.status === StatusEnum.COMPLETED ? 'line-through' : 'none',
            color: params.row.status === StatusEnum.COMPLETED ? 'text.disabled' : 'text.primary',
            fontStyle: params.row.status === StatusEnum.COMPLETED ? 'italic' : 'normal',
          }}
        >
          {params.value}
        </Typography>
      )
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      renderCell: (params: GridRenderCellParams<any, Task>) => {
        let color: 'error' | 'info' | 'warning' | 'default' = 'default';
        if (params.value === TaskTypeEnum.BUG) color = 'error';
        else if (params.value === TaskTypeEnum.FEATURE) color = 'info';
        else if (params.value === TaskTypeEnum.DOC) color = 'warning';
        return <Chip label={params.value} color={color} size="small" />;
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params: GridRenderCellParams<any, Task>) => {
        if (params.row.id === editingStatusId) {
          return (
            <Select
              value={params.value}
              onChange={(e) => handleStatusChange(e.target.value as StatusEnum, params.row)}
              onBlur={() => setEditingStatusId(null)}
              autoFocus
              open
              size="small"
              sx={{ width: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem value={StatusEnum.TO_DO}>To Do</MenuItem>
              <MenuItem value={StatusEnum.IN_PROGRESS}>In Progress</MenuItem>
              <MenuItem value={StatusEnum.IN_REVIEW}>In Review</MenuItem>
              <MenuItem value={StatusEnum.COMPLETED}>Completed</MenuItem>
            </Select>
          );
        }

        let color: 'success' | 'primary' | 'default' | 'warning' = 'default';
        let customStyle = {};

        if (params.value === StatusEnum.COMPLETED) color = 'success';
        else if (params.value === StatusEnum.IN_PROGRESS) color = 'primary';
        else if (params.value === StatusEnum.IN_REVIEW) customStyle = { backgroundColor: '#ede7f6', color: '#5e35b1' };

        return <Chip label={params.value} color={color} sx={customStyle} size="small" onClick={(e) => { e.stopPropagation(); setEditingStatusId(params.row.id); }} />;
      }
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params: any) => <div style={{ height: '15px', width: '15px', backgroundColor: getPriorityColor(params.value), borderRadius: '50%' }} />,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'timer',
      headerName: 'Time Left',
      sortable: false,
      width: 150,
      renderCell: (params: GridRenderCellParams<any, Task>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Box sx={{ width: '100px' }}>
            <Timer
              startTimer={params.row.startTimer}
              spendTime={params.row.spendTime}
              estimate={params.row.estimate}
              context="list"
            />
          </Box>
          {params.row.startTimer ? (
            <IconButton color="error" onClick={(e) => { e.stopPropagation(); stopTimer(params.row.id); }}>
              <PauseCircleOutlineIcon />
            </IconButton>
          ) : (
            <IconButton color="primary" onClick={(e) => { e.stopPropagation(); startTimer(params.row.id); }} disabled={anyTimerRunning}>
              <PlayCircleOutlineIcon />
            </IconButton>
          )}
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      sortable: false,
      width: 60,
      align: 'center',
      renderCell: (params: any) => (
        <IconButton
          aria-label="more"
          onClick={(e) => handleMenuOpen(e, params.row.id)}
          size="small"
        >
          <MoreVertIcon />
        </IconButton>
      ),
    },
  ];

  const currentTaskIndex = filteredTasks.findIndex(t => t.id === currentMenuTaskId);

  return (
    <Box sx={{ height: 'calc(100vh - 128px)', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 1 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter by Sprint</InputLabel>
          <Select value={filterSprint} label="Filter by Sprint" onChange={(e) => setFilterSprint(e.target.value)}>
            <MenuItem value="all">All Sprints</MenuItem>
            <MenuItem value="backlog">Backlog</MenuItem>
            <Divider />
            {sprints.map(sprint => (
              <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select value={filterType} label="Filter by Type" onChange={(e) => setFilterType(e.target.value)}>
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value={TaskTypeEnum.TASK}>Task</MenuItem>
            <MenuItem value={TaskTypeEnum.BUG}>Bug</MenuItem>
            <MenuItem value={TaskTypeEnum.FEATURE}>Feature</MenuItem>
            <MenuItem value={TaskTypeEnum.DOC}>Doc</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <DataGrid
        rows={filteredTasks}
        columns={columns}
        onRowClick={(params) => navigate(`/task/${params.id}`)}
        onSortModelChange={handleSortModelChange}
        sx={{ '& .MuiDataGrid-row:hover': { cursor: 'pointer' } }}
      />
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMoveTask(currentMenuTaskId!, 'up')} disabled={isColumnSortActive || currentTaskIndex === 0}>
          <ListItemIcon><ArrowUpwardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Move Up</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMoveTask(currentMenuTaskId!, 'down')} disabled={isColumnSortActive || currentTaskIndex === filteredTasks.length - 1}>
          <ListItemIcon><ArrowDownwardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Move Down</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMoveTask(currentMenuTaskId!, 'top')} disabled={isColumnSortActive || currentTaskIndex === 0}>
          <ListItemIcon><VerticalAlignTopIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Move to Top</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMoveTask(currentMenuTaskId!, 'bottom')} disabled={isColumnSortActive || currentTaskIndex === filteredTasks.length - 1}>
          <ListItemIcon><VerticalAlignBottomIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Move to Bottom</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeleteTask(currentMenuTaskId!)}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      <SpeedDial
        ariaLabel="Task Actions"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => {}}
        onOpen={() => {}}
        direction="up"
      >
        <SpeedDialAction
          key="add"
          icon={<AddIcon />}
          tooltipTitle="Add New Task"
          onClick={() => setOpenDialog(true)}
        />
        <SpeedDialAction
          key="toggle-completed"
          icon={showCompletedTasks ? <VisibilityOffIcon /> : <VisibilityIcon />}
          tooltipTitle={showCompletedTasks ? 'Hide Completed' : 'Show Completed'}
          onClick={() => setShowCompletedTasks(!showCompletedTasks)}
        />
      </SpeedDial>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add New Task</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="standard"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="standard"
            multiline
            rows={3}
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
          />
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
             <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newTask.priority}
                  label="Priority"
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as PriorityEnum })}
                >
                  <MenuItem value={PriorityEnum.LOW}>Low</MenuItem>
                  <MenuItem value={PriorityEnum.MEDIUM}>Medium</MenuItem>
                  <MenuItem value={PriorityEnum.HIGH}>High</MenuItem>
                </Select>
             </FormControl>
             <TextField
               label="Estimate (h)"
               type="number"
               fullWidth
               value={newTask.estimate}
               onChange={(e) => setNewTask({ ...newTask, estimate: Number(e.target.value) })}
             />
             <Autocomplete
                fullWidth
                options={Object.values(TaskTypeEnum)}
                value={newTask.type}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setNewTask({ ...newTask, type: newValue as TaskTypeEnum });
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Type" />}
                disableClearable
             />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={newTask.tags || []}
              onChange={(event, newValue) => setNewTask({ ...newTask, tags: newValue })}
              renderTags={(value: readonly string[], getTagProps) =>
                value.map((option: string, index: number) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} variant="standard" label="Tags" placeholder="Add tags" />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleAddTask} variant="contained" color="primary">Add Task</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default List;
