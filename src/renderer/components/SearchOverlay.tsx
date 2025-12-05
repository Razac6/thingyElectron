import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Box,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Paper,
  styled,
  IconButton,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useTimer } from '../context/TimerContext';
import { createTask } from '../services/DatabaseService';
import { Task } from '../../interfaces/task.interface';
import { TaskTypeEnum } from '../../enums/task-type.enum';
import { StatusEnum } from '../../enums/status.enum';
import { PriorityEnum } from '../../enums/priority.enum';

const SearchContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '20%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '60%',
  maxWidth: 700,
  padding: theme.spacing(2),
  outline: 'none',
}));

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { tasks, setTasks } = useTimer();
  const navigate = useNavigate();

  const filteredTasks = useMemo(() => {
    if (!query || isAdding) {
      return [];
    }
    const lowerCaseQuery = query.toLowerCase();
    return tasks.filter(task => {
      const titleMatch = task.title.toLowerCase().includes(lowerCaseQuery);
      // Check if any tag matches, handling the case where tags might be undefined
      const tagMatch = task.tags && task.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery));
      return titleMatch || tagMatch;
    }).slice(0, 5);
  }, [query, tasks, isAdding]);

  const handleSelectTask = (taskId: number) => {
    onClose();
    navigate(`/task/${taskId}`);
  };

  const handleQuickAdd = async () => {
    if (!query) return;

    const titleRegex = /\s(\d+(\.\d+)?)[hH]$/;
    const match = query.match(titleRegex);
    let title = query;
    let estimate = 1; // Default estimate to 1 if not specified

    if (match && match[1]) {
      title = query.replace(titleRegex, '').trim();
      estimate = parseFloat(match[1]);
    }

    const newTask: Partial<Task> = {
      title,
      description: '',
      status: StatusEnum.TO_DO,
      updateStatusDate: new Date().toLocaleDateString(),
      estimate,
      priority: PriorityEnum.MEDIUM,
      link: '',
      createdAt: new Date().toLocaleDateString(),
      spendTime: 0,
      startTimer: null,
      type: TaskTypeEnum.TASK,
      sprintId: null,
      tags: [],
    };

    try {
      const createdTask = await createTask(newTask, 1);
      setTasks((prev) => [...prev, createdTask]);
      onClose();
      navigate(`/task/${createdTask.id}`);
    } catch (error) {
      console.error('Failed to quick-add task', error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (isAdding) {
        handleQuickAdd();
      } else if (filteredTasks.length > 0) {
        handleSelectTask(filteredTasks[0].id);
      }
    }
  };

  const placeholder = isAdding ? "Enter new task title (e.g., 'Fix bug 2h') and press Enter..." : "Search by title or #tag...";

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        backdropFilter: 'blur(4px)',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <SearchContainer>
        <TextField
          fullWidth
          variant="standard"
          placeholder={placeholder}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiInput-underline:before': { borderBottom: 'none' },
            '& .MuiInput-underline:after': { borderBottom: 'none' },
            '& .MuiInputBase-input': {
              fontSize: '1.5rem',
              padding: '10px 0',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {isAdding ? <AddIcon sx={{ fontSize: '2rem', mr: 1 }} /> : <SearchIcon sx={{ fontSize: '2rem', mr: 1 }} />}
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setIsAdding(!isAdding)} title={isAdding ? "Switch to Search Mode" : "Switch to Add Mode"}>
                  {isAdding ? <SearchIcon /> : <AddIcon />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        {!isAdding && query && (
          <List>
            {filteredTasks.length > 0 ? (
              filteredTasks.map(task => (
                <ListItemButton key={task.id} onClick={() => handleSelectTask(task.id)}>
                  <ListItemText primary={task.title} secondary={task.tags?.join(' ')} />
                </ListItemButton>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="No tasks found." />
              </ListItem>
            )}
          </List>
        )}
      </SearchContainer>
    </Modal>
  );
}
