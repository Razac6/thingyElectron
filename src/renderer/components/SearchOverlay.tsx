import React, { useState, useEffect, useRef } from 'react';
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
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useTimer } from '../context/TimerContext';
import { globalSearch } from '../services/DatabaseService';
import { Task } from '../../interfaces/task.interface';
import { TaskTypeEnum } from '../../enums/TaskTypeEnum';
import { StatusEnum } from '../../enums/status.enum';
import { PriorityEnum } from '../../enums/priority.enum';

const SearchContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '60%',
  maxWidth: 700,
  padding: theme.spacing(2),
  outline: 'none',
}));

interface SearchResult {
  id: number;
  title: string;
  resultType: 'task' | 'note';
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(true); // Default to "add mode"
  const [results, setResults] = useState<SearchResult[]>([]);
  const { createTask } = useTimer(); // Use createTask from context
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Focus the input when the modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!query || isAdding) {
      setResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      const searchResults = await globalSearch(query);
      setResults(searchResults);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, isAdding]);

  const handleSelectResult = (result: SearchResult) => {
    onClose();
    setQuery('');
    if (result.resultType === 'task') {
      navigate(`/task/${result.id}`);
    } else {
      navigate(`/notes`);
    }
  };

  const handleQuickAdd = async () => {
    if (!query) return;

    let title = query;
    let type = TaskTypeEnum.TASK;
    let estimate = 1;

    const typeRegex = /\s#(\w+)\b/;
    const typeMatch = title.match(typeRegex);
    if (typeMatch && typeMatch[1]) {
      const tag = typeMatch[1].toUpperCase();
      if (Object.values(TaskTypeEnum).includes(tag as TaskTypeEnum)) {
        type = tag as TaskTypeEnum;
        title = title.replace(typeRegex, '').trim();
      }
    }

    const timeRegex = /\s(\d+(\.\d+)?)[hH]$/;
    const timeMatch = title.match(timeRegex);
    if (timeMatch && timeMatch[1]) {
      estimate = parseFloat(timeMatch[1]);
      title = title.replace(timeRegex, '').trim();
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
      type,
      tags: [],
    };

    try {
      // Use the context's createTask to ensure the UI updates
      await createTask(newTask);
      onClose();
      setQuery('');
      // No need to navigate, the task list will update automatically
    } catch (error) {
      console.error('Failed to quick-add task', error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (isAdding) {
        handleQuickAdd();
      } else if (results.length > 0) {
        handleSelectResult(results[0]);
      }
    }
  };

  const placeholder = isAdding
    ? "Add a new task... e.g., 'Fix login 3.5h #bug'"
    : 'Search tasks and notes...';

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setQuery('');
      }}
      sx={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <SearchContainer>
        <TextField
          fullWidth
          variant="standard"
          placeholder={placeholder}
          autoFocus
          value={query}
          inputRef={inputRef}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiInput-underline:before': { borderBottom: 'none' },
            '& .MuiInput-underline:after': { borderBottom: 'none' },
            '& .MuiInputBase-input': { fontSize: '1.5rem', padding: '10px 0' },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {isAdding ? <AddIcon sx={{ fontSize: '2rem', mr: 1 }} /> : <SearchIcon sx={{ fontSize: '2rem', mr: 1 }} />}
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setIsAdding(!isAdding)} title={isAdding ? 'Switch to Search Mode' : 'Switch to Add Mode'}>
                  {isAdding ? <SearchIcon /> : <AddIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {!isAdding && query && (
          <List>
            {results.length > 0 ? (
              results.map((result) => (
                <ListItemButton key={`${result.resultType}-${result.id}`} onClick={() => handleSelectResult(result)}>
                  <ListItemText primary={result.title} />
                  {result.resultType === 'note' && <Chip label="Note" size="small" />}
                </ListItemButton>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="No results found." />
              </ListItem>
            )}
          </List>
        )}
      </SearchContainer>
    </Modal>
  );
}
