import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DataGrid,
  GridRenderCellParams,
  GridCellParams,
  GridSortModel,
  GridColDef,
} from '@mui/x-data-grid';
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
  List as MuiList,
  ListItem,
  CircularProgress,
  Tooltip,
  Grid,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
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
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import TimerIcon from '@mui/icons-material/Timer';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import { renderTextWithIcons } from '../../utils/emojiIcons';
import { StatusEnum } from '../../../enums/status.enum';
import { PriorityEnum } from '../../../enums/priority.enum';
import { TaskTypeEnum } from '../../../enums/task-type.enum';
import Timer from '../../components/Timer';
import { getSprints } from '../../services/SprintService';
import { useTimer } from '../../context/TimerContext';
import { useGamification } from '../../context/GamificationContext';
import { Task } from '../../../interfaces/task.interface';
import {
  getAllTags,
  getChecklistItems,
  toggleChecklistItem,
} from '../../services/DatabaseService';
import { KanbanBoard } from '../../components/KanbanBoard';

const getPriorityColor = (priority: PriorityEnum) => {
  switch (priority) {
    case PriorityEnum.HIGH:
      return '#d32f2f';
    case PriorityEnum.MEDIUM:
      return '#ffb300';
    case PriorityEnum.LOW:
      return '#1976d2';
    default:
      return '#9e9e9e';
  }
};

function List() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tasks,
    setTasks,
    startTimer,
    stopTimer,
    updateTask,
    createTask,
    deleteTask,
  } = useTimer();
  const { addXp, checkForAchievements, triggerRewardAnimation } =
    useGamification();
  const [sprints, setSprints] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: StatusEnum.TO_DO,
    priority: PriorityEnum.MEDIUM,
    estimate: 1,
    storyPoints: 0,
    link: '',
    type: TaskTypeEnum.TASK,
    sprintId: null,
  });

  // Handle Quick Add Draft from Extension
  useEffect(() => {
    if (location.state && location.state.draftTask) {
      const draft = location.state.draftTask;
      setNewTask((prev) => ({
        ...prev,
        title: draft.title,
        description: draft.description || '', // Use URL as description/link
        link: draft.sourceUrl || '',
        storyPoints: draft.storyPoints || 0,
        type: TaskTypeEnum.TASK, // Default, user can change
      }));
      setOpenDialog(true);
      // Clear state so it doesn't reopen on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [currentMenuTaskId, setCurrentMenuTaskId] = useState<null | number>(
    null,
  );
  const [filterSprint, setFilterSprint] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isColumnSortActive, setIsColumnSortActive] = useState(false);
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [view, setView] = useState<'list' | 'board'>(() => {
    return (localStorage.getItem('task_view') as 'list' | 'board') || 'list';
  });

  // Procrastination Detection
  const [procrastinationRisks, setProcrastinationRisks] = useState<any[]>([]);

  // Inline subtasks - shown expanded by default whenever a task has any; collapsedTaskIds
  // tracks rows the user has manually collapsed. Adding/removing subtasks stays in TaskDetail -
  // this is just a quick glance + check-off helper.
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<number>>(
    new Set(),
  );
  const [checklistsByTask, setChecklistsByTask] = useState<
    Record<number, any[]>
  >({});

  // AI & Drag States
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<any[]>([]);
  const [showAiSuccess, setShowAiSuccess] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragTargetTaskId, setDragTargetTaskId] = useState<number | null>(null);

  const [isFilterInitializing, setIsFilterInitializing] = useState(true);

  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const sprintsData = await getSprints();
        setSprints(sprintsData);

        // Auto-set filter to active sprint, then latest, then 'all'
        if (filterSprint === 'all') {
          const activeSprint = sprintsData.find(
            (s: any) => s.status === 'ACTIVE',
          );
          if (activeSprint) {
            setFilterSprint(String(activeSprint.id));
          } else if (sprintsData.length > 0) {
            const latest = [...sprintsData].sort((a, b) => b.id - a.id)[0];
            setFilterSprint(String(latest.id));
          }
        }
      } finally {
        setIsFilterInitializing(false);
      }
    };
    const fetchTags = async () => {
      const tags = await getAllTags();
      setAvailableTags(tags || []);
    };
    fetchSprints();
    fetchTags();
  }, []);

  // Load procrastination risks when tasks change
  useEffect(() => {
    const fetchProcrastinationRisks = async () => {
      const userStr = localStorage.getItem('userId');
      if (!userStr) return;
      const userId = JSON.parse(userStr);

      try {
        const risks =
          await window.electron.database.analyzeProcrastination(userId);
        setProcrastinationRisks(risks || []);
      } catch (error) {
        console.error('Failed to analyze procrastination:', error);
      }
    };

    if (tasks.length > 0) {
      fetchProcrastinationRisks();
    }
  }, [tasks]);

  // Load subtasks for every task so rows with subtasks can show them expanded by default.
  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const entries = await Promise.all(
          tasks.map(
            async (t: any) => [t.id, await getChecklistItems(t.id)] as const,
          ),
        );
        setChecklistsByTask(Object.fromEntries(entries));
      } catch (error) {
        console.error('Failed to load subtasks:', error);
      }
    };

    if (tasks.length > 0) {
      fetchChecklists();
    }
  }, [tasks]);

  const anyTimerRunning = tasks.some((task) => task.startTimer !== null);

  const handleAutoSchedule = async () => {
    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : 1;

    try {
      const proposal =
        await window.electron.database.getProposedSchedule(userId);
      setProposedTasks(proposal);
      setIsProposalOpen(true);
    } catch (error) {
      console.error('AI Schedule Preview failed', error);
    }
  };

  const handleAcceptProposal = async () => {
    try {
      const userStr = localStorage.getItem('userId');
      const userId = userStr ? JSON.parse(userStr) : 1;

      if (proposedTasks.length === 0) {
        setIsProposalOpen(false);
        return;
      }

      const proposedIds = proposedTasks.map((t) => t.id);
      const allTaskIds = tasks.map((t) => t.id);

      // Tasks NOT in proposal (e.g. completed or filtered out by AI)
      const otherIds = allTaskIds.filter((id) => !proposedIds.includes(id));

      // New order: Proposal first, then others
      const finalOrder = [...proposedIds, ...otherIds];

      await window.electron.database.updateTasksOrder(finalOrder);

      const updatedTasks = await window.electron.database.getTasks(userId);
      setTasks(updatedTasks);
      setSortModel([]);
      setIsColumnSortActive(false);

      setIsProposalOpen(false);
      setShowAiSuccess(true);
      setTimeout(() => setShowAiSuccess(false), 4000);
    } catch (error) {
      console.error('AI Schedule Apply failed', error);
    }
  };

  const handleAiSuggestEstimate = async () => {
    if (!newTask.title) return;
    setIsPredicting(true);
    try {
      const taskForPrediction = {
        title: newTask.title,
        priority: newTask.priority,
        tags: newTask.tags || [],
        userId: localStorage.getItem('userId')
          ? JSON.parse(localStorage.getItem('userId')!)
          : 1,
      };
      const predictionMin =
        await window.electron.database.predictDuration(taskForPrediction);
      const hours = Number((predictionMin / 60).toFixed(1));
      setNewTask((prev) => ({ ...prev, estimate: hours }));
    } catch (error) {
      console.error('AI Prediction failed', error);
    } finally {
      setIsPredicting(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (event: React.DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (event: React.DragEvent, targetTaskId: number) => {
    // Update target visual only if different to prevent flicker
    if (draggedTaskId !== targetTaskId && dragTargetTaskId !== targetTaskId) {
      setDragTargetTaskId(targetTaskId);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent, targetTaskId: number) => {
    event.preventDefault();
    event.stopPropagation();

    setDragTargetTaskId(null); // Clear visual cue

    if (draggedTaskId === null || draggedTaskId === targetTaskId) return;

    const allTasks = [...tasks];
    const oldIndex = allTasks.findIndex((t) => t.id === draggedTaskId);
    const newIndex = allTasks.findIndex((t) => t.id === targetTaskId);

    if (oldIndex === -1 || newIndex === -1) return;

    const [movedTask] = allTasks.splice(oldIndex, 1);
    allTasks.splice(newIndex, 0, movedTask);

    setTasks(allTasks);
    await window.electron.database.updateTasksOrder(allTasks.map((t) => t.id));
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragTargetTaskId(null);
  };

  const getRowClassName = (params: any) => {
    let classes = '';
    if (params.row.id === dragTargetTaskId) {
      classes += 'drop-target-row ';
    }
    return classes;
  };

  const filteredTasks = useMemo(() => {
    let processedTasks = [...tasks];
    processedTasks = processedTasks.filter((task) => task.type !== 'MEETING');

    if (filterSprint === 'backlog') {
      processedTasks = processedTasks.filter((task) => !task.sprintId);
    } else if (filterSprint !== 'all') {
      processedTasks = processedTasks.filter(
        (task) => String(task.sprintId) === String(filterSprint),
      );
    }
    if (filterType !== 'all') {
      processedTasks = processedTasks.filter(
        (task) => task.type === filterType,
      );
    }
    if (!showCompletedTasks) {
      processedTasks = processedTasks.filter(
        (task) => task.status !== StatusEnum.COMPLETED,
      );
    }

    return processedTasks;
  }, [tasks, showCompletedTasks, filterSprint, filterType]);

  const handleMoveTask = async (
    taskId: number,
    direction: 'up' | 'down' | 'top' | 'bottom',
  ) => {
    handleMenuClose();
    const allTasks = [...tasks];
    const taskIndex = allTasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const [movedTask] = allTasks.splice(taskIndex, 1);

    if (direction === 'up') {
      const newIndex = taskIndex - 1;
      if (newIndex >= 0) allTasks.splice(newIndex, 0, movedTask);
    } else if (direction === 'down') {
      const newIndex = taskIndex + 1;
      if (newIndex < allTasks.length + 1)
        allTasks.splice(newIndex, 0, movedTask);
    } else if (direction === 'top') {
      allTasks.unshift(movedTask);
    } else if (direction === 'bottom') {
      allTasks.push(movedTask);
    }

    setTasks(allTasks);
    await window.electron.database.updateTasksOrder(allTasks.map((t) => t.id));
  };

  const handleSortModelChange = (model: GridSortModel) => {
    setIsColumnSortActive(model.length > 0);
  };

  const handleAddTask = async () => {
    if (!newTask.estimate || newTask.estimate <= 0) {
      alert('Estimate must be greater than 0.');
      return;
    }
    const taskToCreate: Partial<Task> = {
      ...newTask,
      createdAt: new Date().toLocaleDateString(),
      updateStatusDate: new Date().toLocaleDateString(),
      spendTime: 0,
      startTimer: null,
    };
    try {
      await createTask(taskToCreate);
      setNewTask({
        title: '',
        description: '',
        status: StatusEnum.TO_DO,
        priority: PriorityEnum.MEDIUM,
        estimate: 1,
        link: '',
        type: TaskTypeEnum.TASK,
      });
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
      const achievementEarned = await checkForAchievements('TASK_COMPLETED', {
        task: updatedTask,
      });
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

  const handleToggleCollapse = (taskId: number) => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleToggleSubtask = async (
    taskId: number,
    itemId: number,
    currentStatus: number,
  ) => {
    try {
      const updated = await toggleChecklistItem(itemId, !currentStatus);
      setChecklistsByTask((prev) => ({ ...prev, [taskId]: updated || [] }));
    } catch (error) {
      console.error('Failed to toggle subtask', error);
    }
  };

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    taskId: number,
  ) => {
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
      field: 'displayOrder',
      headerName: 'Order',
      width: 0,
      hide: true,
      sortable: true,
      type: 'number',
    },
    {
      field: 'drag',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params: GridRenderCellParams<any, Task>) => (
        <div
          draggable={!isColumnSortActive}
          onDragStart={(e) => handleDragStart(e, params.row.id)}
          onDragEnter={(e) => handleDragEnter(e, params.row.id)}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(e, params.row.id)}
          style={{
            cursor: isColumnSortActive ? 'default' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            opacity: isColumnSortActive ? 0.3 : 1,
          }}
          title={
            isColumnSortActive ? 'Clear sort to reorder' : 'Drag to reorder'
          }
        >
          <DragIndicatorIcon
            color={params.row.id === dragTargetTaskId ? 'primary' : 'action'}
          />
        </div>
      ),
    },
    {
      field: 'expand',
      headerName: '',
      width: 40,
      sortable: false,
      renderCell: (params: GridRenderCellParams<any, Task>) => {
        const items = checklistsByTask[params.row.id];
        if (!items || items.length === 0) return null;
        const isExpanded = !collapsedTaskIds.has(params.row.id);
        const doneCount = items.filter((i: any) => i.isCompleted).length;
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <Tooltip title={`${doneCount}/${items.length} subtasks`}>
              <IconButton
                size="small"
                sx={{ p: 0.25 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCollapse(params.row.id);
                }}
              >
                {isExpanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      cellClassName: (params: GridCellParams<any, Task>) => {
        const items = checklistsByTask[params.row.id];
        const isExpanded =
          !!items && items.length > 0 && !collapsedTaskIds.has(params.row.id);
        return isExpanded ? 'task-title-cell-expanded' : '';
      },
      renderCell: (params: GridRenderCellParams<any, Task>) => {
        const risk = procrastinationRisks.find(
          (r) => r.taskId === params.row.id,
        );
        const isHighRisk = risk && risk.risk > 0.7;
        const subtasks = checklistsByTask[params.row.id] || [];
        const isExpanded =
          subtasks.length > 0 && !collapsedTaskIds.has(params.row.id);

        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              width: '100%',
              height: '100%',
              py: isExpanded ? 0.5 : 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
              }}
            >
              <Typography
                sx={{
                  textDecoration:
                    params.row.status === StatusEnum.COMPLETED
                      ? 'line-through'
                      : 'none',
                  color:
                    params.row.status === StatusEnum.COMPLETED
                      ? 'text.disabled'
                      : 'text.primary',
                  fontStyle:
                    params.row.status === StatusEnum.COMPLETED
                      ? 'italic'
                      : 'normal',
                  flex: 1,
                }}
              >
                {params.value}
              </Typography>
              {isHighRisk && (
                <Tooltip
                  title={
                    <Box>
                      <Typography
                        variant="caption"
                        fontWeight="bold"
                        display="block"
                      >
                        Procrastination Risk: {Math.round(risk.risk * 100)}%
                      </Typography>
                      <Divider
                        sx={{ my: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }}
                      />
                      {risk.reasons.map((reason: string, idx: number) => (
                        <Typography key={idx} variant="caption" display="block">
                          • {reason}
                        </Typography>
                      ))}
                      <Divider
                        sx={{ my: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }}
                      />
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ mt: 0.5 }}
                      >
                        {renderTextWithIcons(risk.suggestion)}
                      </Typography>
                    </Box>
                  }
                  arrow
                >
                  <Chip
                    icon={<WarningAmberIcon />}
                    label="Risk"
                    size="small"
                    color="warning"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                </Tooltip>
              )}
            </Box>

            {isExpanded && (
              <Box sx={{ width: '100%' }} onClick={(e) => e.stopPropagation()}>
                {subtasks.map((item: any) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      minHeight: 26,
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={!!item.isCompleted}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSubtask(
                          params.row.id,
                          item.id,
                          item.isCompleted,
                        );
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0.25 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        textDecoration: item.isCompleted
                          ? 'line-through'
                          : 'none',
                        color: item.isCompleted
                          ? 'text.disabled'
                          : 'text.secondary',
                      }}
                    >
                      {item.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      },
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
      },
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
              onChange={(e) =>
                handleStatusChange(e.target.value as StatusEnum, params.row)
              }
              onClose={() => setEditingStatusId(null)}
              defaultOpen
              autoFocus
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
        else if (params.value === StatusEnum.IN_REVIEW)
          customStyle = { backgroundColor: '#ede7f6', color: '#5e35b1' };

        return (
          <Chip
            label={params.value}
            color={color}
            sx={customStyle}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setEditingStatusId(params.row.id);
            }}
          />
        );
      },
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params: any) => (
        <div
          style={{
            height: '15px',
            width: '15px',
            backgroundColor: getPriorityColor(params.value),
            borderRadius: '50%',
          }}
        />
      ),
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
            <IconButton
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                stopTimer(params.row.id);
              }}
            >
              <PauseCircleOutlineIcon />
            </IconButton>
          ) : (
            <IconButton
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                startTimer(params.row.id);
              }}
              disabled={anyTimerRunning}
            >
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

  const currentTaskIndex = filteredTasks.findIndex(
    (t) => t.id === currentMenuTaskId,
  );

  return (
    <Box
      sx={{
        height: 'calc(100vh - 128px)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexShrink: 0,
        }}
      >
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(e, next) => {
            if (next) {
              setView(next);
              localStorage.setItem('task_view', next);
            }
          }}
          size="small"
          aria-label="view switcher"
        >
          <ToggleButton value="list" aria-label="list view">
            <ViewListIcon fontSize="small" sx={{ mr: 1 }} /> List
          </ToggleButton>
          <ToggleButton value="board" aria-label="board view">
            <ViewWeekIcon fontSize="small" sx={{ mr: 1 }} /> Board
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={[
              { id: 'all', name: 'All Sprints' },
              { id: 'backlog', name: 'Backlog' },
              ...sprints,
            ]}
            getOptionLabel={(option) => option.name}
            value={
              filterSprint === 'all'
                ? { id: 'all', name: 'All Sprints' }
                : filterSprint === 'backlog'
                  ? { id: 'backlog', name: 'Backlog' }
                  : sprints.find((s) => s.id === Number(filterSprint)) || null
            }
            onChange={(event, newValue) => {
              if (newValue) setFilterSprint(String(newValue.id));
              else setFilterSprint('all');
            }}
            renderInput={(params) => (
              <TextField {...params} label="Filter by Sprint" />
            )}
            disableClearable
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter by Type</InputLabel>
            <Select
              value={filterType}
              label="Filter by Type"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value={TaskTypeEnum.TASK}>Task</MenuItem>
              <MenuItem value={TaskTypeEnum.BUG}>Bug</MenuItem>
              <MenuItem value={TaskTypeEnum.FEATURE}>Feature</MenuItem>
              <MenuItem value={TaskTypeEnum.DOC}>Doc</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {showAiSuccess && (
        <Alert severity="success" sx={{ mb: 1, flexShrink: 0 }}>
          Kolejka zadań zaktualizowana.
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {isFilterInitializing ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : view === 'list' ? (
          <DataGrid
            rows={filteredTasks}
            columns={columns}
            getRowClassName={getRowClassName}
            getRowHeight={(params) => {
              const items = checklistsByTask[params.id as number];
              return items &&
                items.length > 0 &&
                !collapsedTaskIds.has(params.id as number)
                ? 'auto'
                : undefined;
            }}
            onRowClick={(params) => navigate(`/task/${params.id}`)}
            sortModel={sortModel}
            onSortModelChange={(model) => {
              setSortModel(model);
              handleSortModelChange(model);
            }}
            sx={{
              height: '100%',
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
              '& .drop-target-row': {
                borderTop: '3px solid #2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.05) !important',
              },
              '& .task-title-cell-expanded': {
                whiteSpace: 'normal !important',
                overflow: 'visible !important',
                alignItems: 'flex-start !important',
              },
            }}
          />
        ) : (
          <Box sx={{ height: '100%' }}>
            <KanbanBoard
              tasks={filteredTasks}
              onStatusChange={(task, newStatus) =>
                handleStatusChange(newStatus, task)
              }
              onTaskClick={(id) => navigate(`/task/${id}`)}
              onStartTimer={(id) => startTimer(id)}
              onStopTimer={(id) => stopTimer(id)}
              anyTimerRunning={anyTimerRunning}
            />
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            startTimer(currentMenuTaskId!, 'pomodoro');
          }}
          disabled={anyTimerRunning}
        >
          <ListItemIcon>
            <TimerIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Start Pomodoro</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMoveTask(currentMenuTaskId!, 'up')}
          disabled={isColumnSortActive || currentTaskIndex === 0}
        >
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move Up</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMoveTask(currentMenuTaskId!, 'down')}
          disabled={
            isColumnSortActive || currentTaskIndex === filteredTasks.length - 1
          }
        >
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move Down</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMoveTask(currentMenuTaskId!, 'top')}
          disabled={isColumnSortActive || currentTaskIndex === 0}
        >
          <ListItemIcon>
            <VerticalAlignTopIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move to Top</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMoveTask(currentMenuTaskId!, 'bottom')}
          disabled={
            isColumnSortActive || currentTaskIndex === filteredTasks.length - 1
          }
        >
          <ListItemIcon>
            <VerticalAlignBottomIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move to Bottom</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeleteTask(currentMenuTaskId!)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <SpeedDial
        ariaLabel="Task Actions"
        sx={{ position: 'absolute', bottom: 72, right: 16 }}
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
          key="ai-schedule"
          icon={<AutoFixHighIcon color="secondary" />}
          tooltipTitle="AI Auto-Planner"
          onClick={handleAutoSchedule}
        />
        <SpeedDialAction
          key="toggle-completed"
          icon={showCompletedTasks ? <VisibilityOffIcon /> : <VisibilityIcon />}
          tooltipTitle={
            showCompletedTasks ? 'Hide Completed' : 'Show Completed'
          }
          onClick={() => setShowCompletedTasks(!showCompletedTasks)}
        />
      </SpeedDial>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="sm"
      >
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
            onChange={(e) =>
              setNewTask({ ...newTask, description: e.target.value })
            }
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newTask.priority}
                  label="Priority"
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      priority: e.target.value as PriorityEnum,
                    })
                  }
                >
                  <MenuItem value={PriorityEnum.LOW}>Low</MenuItem>
                  <MenuItem value={PriorityEnum.MEDIUM}>Medium</MenuItem>
                  <MenuItem value={PriorityEnum.HIGH}>High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
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
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Story Points"
                type="number"
                fullWidth
                value={newTask.storyPoints}
                onChange={(e) =>
                  setNewTask({
                    ...newTask,
                    storyPoints: Number(e.target.value),
                  })
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Estimate (h)"
                type="number"
                fullWidth
                value={newTask.estimate}
                onChange={(e) =>
                  setNewTask({ ...newTask, estimate: Number(e.target.value) })
                }
                InputProps={{
                  endAdornment: (
                    <Tooltip title="AI Suggest Estimate">
                      <IconButton
                        onClick={handleAiSuggestEstimate}
                        disabled={isPredicting || !newTask.title}
                        size="small"
                        color="secondary"
                      >
                        {isPredicting ? (
                          <CircularProgress size={20} />
                        ) : (
                          <SmartToyIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Sprint</InputLabel>
                <Select
                  value={newTask.sprintId || ''}
                  label="Sprint"
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      sprintId:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                >
                  <MenuItem value="">
                    <em>Backlog</em>
                  </MenuItem>
                  {sprints.map((sprint: any) => (
                    <MenuItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={newTask.tags || []}
              onChange={(event, newValue) =>
                setNewTask({ ...newTask, tags: newValue })
              }
              renderTags={(value: readonly string[], getTagProps) =>
                value.map((option: string, index: number) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="standard"
                  label="Tags"
                  placeholder="Add tags"
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleAddTask} variant="contained" color="primary">
            Add Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Proposal Dialog */}
      <Dialog
        open={isProposalOpen}
        onClose={() => setIsProposalOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Propozycja Planu AI</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom color="text.secondary">
            Oto optymalna kolejność zadań, wyliczona na podstawie priorytetów,
            deadline'ów sprintu oraz Twojej aktualnej dyspozycji (Neural Core).
          </Typography>
          <MuiList sx={{ maxHeight: 400, overflow: 'auto' }}>
            {proposedTasks.map((task, index) => (
              <ListItem key={task.id} divider sx={{ alignItems: 'flex-start' }}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="subtitle1"
                        component="span"
                        fontWeight="bold"
                      >
                        {index + 1}.
                      </Typography>
                      <Typography variant="subtitle1" component="span">
                        {task.title}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Chip
                        label={task.status}
                        size="small"
                        color={
                          task.status === StatusEnum.COMPLETED
                            ? 'success'
                            : task.status === StatusEnum.IN_PROGRESS
                              ? 'primary'
                              : task.status === StatusEnum.IN_REVIEW
                                ? 'secondary'
                                : 'default'
                        }
                      />
                      <Box
                        sx={{
                          height: 15,
                          width: 15,
                          borderRadius: '50%',
                          bgcolor: getPriorityColor(task.priority),
                          display: 'inline-block',
                        }}
                      />
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        {renderTextWithIcons(task.aiReason)}
                      </Typography>
                      {task.neuralEstimate > 0 && (
                        <Chip
                          label={`AI: ${task.neuralEstimate.toFixed(1)}h`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </MuiList>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsProposalOpen(false)}>Anuluj</Button>
          <Button
            onClick={handleAcceptProposal}
            variant="contained"
            color="secondary"
            startIcon={<AutoFixHighIcon />}
          >
            Zastosuj Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default List;
