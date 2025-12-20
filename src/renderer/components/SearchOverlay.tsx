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
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useTimer } from '../context/TimerContext';
import { globalSearch, getTagAnalytics, getTagByName, getAllTags } from '../services/DatabaseService';
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

const TYPE_OPTIONS = ['BUG', 'FEATURE', 'DOC', 'TASK'];

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(true);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [aiEstimate, setAiEstimate] = useState<number | null>(null);
  
  // Autocomplete State
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<'TYPE' | 'TAG' | null>(null);
  const [suggestionList, setSuggestionList] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  const { createTask } = useTimer();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const parseQueryForAI = (text: string) => {
      let mutableTitle = text;
      let tags: string[] = [];
      const tagMatches = Array.from(mutableTitle.matchAll(/(?:\s|^)#([\w-]+)(?=\s|$)/g));
      tags = [...new Set(tagMatches.map(m => m[1]))];
      
      for (const tag of tags) {
          mutableTitle = mutableTitle.replace(new RegExp(`\\s?#${tag}\\b`, 'g'), '').trim();
      }
      mutableTitle = mutableTitle.replace(/@(bug|feature|doc|task)/i, '').trim();
      mutableTitle = mutableTitle.replace(/\b(\d+(\.\d+)?)(h|m)\b/i, '').trim();
      return { title: mutableTitle, tags };
  };

  useEffect(() => {
    const fetchAiEstimate = async () => {
        if (!isAdding || query.length < 3) {
            setAiEstimate(null);
            return;
        }
        const { title, tags } = parseQueryForAI(query);
        if (!title) {
            setAiEstimate(null);
            return;
        }

        try {
            const userId = localStorage.getItem('userId') ? JSON.parse(localStorage.getItem('userId')!) : 1;
            const predMin = await window.electron.database.predictDuration({ title, tags, userId, priority: 'Medium' });
            setAiEstimate(Number((predMin / 60).toFixed(1)));
        } catch (e) {
            console.error("AI Estimate fetch failed", e);
        }
    };

    const debounce = setTimeout(fetchAiEstimate, 800);
    return () => clearTimeout(debounce);
  }, [query, isAdding]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      const fetchTags = async () => {
        const tags = await getAllTags();
        setAvailableTags(tags || []);
      };
      fetchTags();
    }
  }, [open]);

  // Handle Autocomplete Trigger
  useEffect(() => {
    if (!isAdding) {
      setShowSuggestions(null);
      return;
    }

    const lastChar = query.slice(-1);
    const words = query.split(' ');
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('@')) {
      const filter = currentWord.substring(1).toUpperCase();
      const filtered = TYPE_OPTIONS.filter(t => t.startsWith(filter));
      // Always show if started typing @, even if no match (though types are fixed)
      if (filtered.length > 0) {
        setSuggestionList(filtered);
        setShowSuggestions('TYPE');
        setSuggestionIndex(0);
      } else {
        setShowSuggestions(null);
      }
    } else if (currentWord.includes('#')) {
      // Robust detection for # inside word or at start
      const parts = currentWord.split('#');
      const tagPart = parts[parts.length - 1]; // Get everything after the last #
      const filter = tagPart.toLowerCase();
      
      const filtered = availableTags.filter(t => t.toLowerCase().startsWith(filter));
      
      // We show suggestions if there are matches. 
      // If there are NO matches, we DON'T show the dropdown, 
      // but the user can still type the new tag and it will be parsed by handleQuickAdd.
      if (filtered.length > 0) {
        setSuggestionList(filtered);
        setShowSuggestions('TAG');
        setSuggestionIndex(0);
      } else {
        setShowSuggestions(null);
      }
    } else {
      setShowSuggestions(null);
    }
  }, [query, isAdding, availableTags]);

  const handleApplySuggestion = (value: string) => {
    // Split the query by space to find the current word
    const words = query.split(' ');
    const lastWord = words[words.length - 1];

    let newLastWord = '';
    if (showSuggestions === 'TAG') {
      const lastHashIndex = lastWord.lastIndexOf('#');
      if (lastHashIndex !== -1) {
        newLastWord = lastWord.substring(0, lastHashIndex + 1) + value;
      } else {
        // Fallback, though this state should ideally not be reached if showSuggestions is 'TAG'
        newLastWord = '#' + value; 
      }
    } else if (showSuggestions === 'TYPE') {
      const lastAtIndex = lastWord.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        newLastWord = lastWord.substring(0, lastAtIndex + 1) + value;
      } else {
        // Fallback, though this state should ideally not be reached if showSuggestions is 'TYPE'
        newLastWord = '@' + value;
      }
    }

    // Replace the last word in the words array with the newLastWord
    words[words.length - 1] = newLastWord;
    
    // Join all words back and add a space at the end for continuous typing
    setQuery(words.join(' ') + ' ');
    setShowSuggestions(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleAnalytics = async () => {
      if (!isAdding || !query.includes('#')) {
        setSuggestion(null);
        return;
      }
      const tagRegex = /#(\w+)/g;
      const matches = query.match(tagRegex);
      if (matches) {
        const lastTag = matches[matches.length - 1].substring(1);
        const tag: any = await getTagByName(lastTag);
        if (tag && tag.id) {
          const analytics: any = await getTagAnalytics(tag.id);
          if (analytics && analytics.completed_count > 0) {
            const hours = (analytics.ema / (1000 * 60 * 60)).toFixed(1);
            const stdDevHours = (analytics.std_dev / (1000 * 60 * 60)).toFixed(1);
            setSuggestion(`Avg time for #${lastTag}: ~${hours}h (± ${stdDevHours}h)`);
          } else {
            setSuggestion(`No analytics for #${lastTag} yet. Complete some tasks with this tag!`);
          }
        } else {
          setSuggestion(null);
        }
      }
    };

    const debounce = setTimeout(handleAnalytics, 500);
    return () => clearTimeout(debounce);
  }, [query, isAdding]);

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

    let mutableTitle = query; // Use a mutable variable for progressive cleaning
    let type = TaskTypeEnum.TASK;
    let estimate = 1;
    let tags: string[] = [];

    // 1. Parse Type (@bug, @feature, @doc, @task)
    const typeMatch = mutableTitle.match(/@(bug|feature|doc|task)/i);
    if (typeMatch) {
      const typeStr = typeMatch[1].toUpperCase();
      if (typeStr === 'BUG') type = TaskTypeEnum.BUG;
      else if (typeStr === 'FEATURE') type = TaskTypeEnum.FEATURE;
      else if (typeStr === 'DOC') type = TaskTypeEnum.DOC;
      else if (typeStr === 'TASK') type = TaskTypeEnum.TASK;
      
      mutableTitle = mutableTitle.replace(typeMatch[0], '').trim();
    }

    // 2. Parse Estimate (e.g., 2h, 0.5h, 30m)
    const timeMatch = mutableTitle.match(/\b(\d+(\.\d+)?)(h|m)\b/i);
    if (timeMatch) {
      const value = parseFloat(timeMatch[1]);
      const unit = timeMatch[3].toLowerCase();
      if (unit === 'h') estimate = value;
      else if (unit === 'm') estimate = parseFloat((value / 60).toFixed(2));
      
      mutableTitle = mutableTitle.replace(timeMatch[0], '').trim();
    }

    // 3. Parse Tags (#tag) for the DB array
    const tagMatches = mutableTitle.matchAll(/(?:\s|^)#([\w-]+)(?=\s|$)/g);
    let tempTags: string[] = [];
    for (const match of tagMatches) {
        tempTags.push(match[1]);
    }
    tags = [...new Set(tempTags)]; // Remove duplicates
    
    // Clean mutableTitle from extracted tags for the final title
    for (const tag of tags) {
        mutableTitle = mutableTitle.replace(new RegExp(`\\s?#${tag}\\b`, 'g'), '').trim();
    }
    const finalTitle = mutableTitle.trim();


    const newTask: Partial<Task> = {
      title: finalTitle,
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
      tags: tags, // Pass extracted tags to DB
    };

    try {
      const createdTask = await createTask(newTask);
      onClose();
      setQuery('');
      if (createdTask && createdTask.id) {
        navigate(`/task/${createdTask.id}`);
      }
    } catch (error) {
      console.error('Failed to quick-add task', error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (showSuggestions && suggestionList.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSuggestionIndex((prev) => (prev + 1) % suggestionList.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSuggestionIndex((prev) => (prev - 1 + suggestionList.length) % suggestionList.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        handleApplySuggestion(suggestionList[suggestionIndex]);
        return;
      }
      if (event.key === 'Escape') {
         setShowSuggestions(null);
         return;
      }
    }

    if (event.key === 'Enter') {
      if (isAdding) {
        handleQuickAdd();
      } else if (results.length > 0) {
        handleSelectResult(results[0]);
      }
    }
  };

  const placeholder = isAdding
    ? "Add task: 'Fix login @bug #backend 2h'"
    : 'Search tasks and notes...';

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setQuery('');
        setSuggestion(null);
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
        
        {/* Suggestion Popover UI */}
        {showSuggestions && suggestionList.length > 0 && (
          <Paper elevation={3} sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
            <List dense>
              {suggestionList.map((item, index) => (
                <ListItemButton 
                  key={item} 
                  selected={index === suggestionIndex}
                  onClick={() => handleApplySuggestion(item)}
                >
                   <ListItemText primary={showSuggestions === 'TYPE' ? `@${item}` : `#${item}`} />
                   {index === suggestionIndex && <Typography variant="caption" color="text.secondary">↵ Enter</Typography>}
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}

        {suggestion && !showSuggestions && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {suggestion}
            </Typography>
          </Box>
        )}

        {aiEstimate !== null && isAdding && !showSuggestions && (
            <Box 
                sx={{ 
                    mt: 0.5, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5, 
                    color: '#219ebc',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 }
                }}
                onClick={() => {
                    const cleanQuery = query.replace(/\b(\d+(\.\d+)?)(h|m)\b/i, '').trim();
                    setQuery(`${cleanQuery} ${aiEstimate}h`);
                    inputRef.current?.focus();
                }}
            >
                <SmartToyIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" fontWeight="bold">
                    AI suggests: {aiEstimate}h estimate (Click to apply)
                </Typography>
            </Box>
        )}
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
