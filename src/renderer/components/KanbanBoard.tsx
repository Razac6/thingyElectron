import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  IconButton,
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import TimerIcon from '@mui/icons-material/Timer';
import { Task } from '../../interfaces/task.interface';
import { StatusEnum } from '../../enums/status.enum';
import { PriorityEnum } from '../../enums/priority.enum';

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (task: Task, newStatus: StatusEnum) => void;
  onTaskClick: (taskId: number) => void;
  onStartTimer: (taskId: number) => void;
  onStopTimer: (taskId: number) => void;
  anyTimerRunning: boolean;
}

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

const COLUMN_CONFIG = [
  { status: StatusEnum.TO_DO, label: 'To Do', color: '#e9ecef' },
  { status: StatusEnum.IN_PROGRESS, label: 'In Progress', color: '#e3f2fd' },
  { status: StatusEnum.IN_REVIEW, label: 'In Review', color: '#f3e5f5' },
  { status: StatusEnum.COMPLETED, label: 'Completed', color: '#e8f5e9' },
];

export function KanbanBoard({
  tasks,
  onStatusChange,
  onTaskClick,
  onStartTimer,
  onStopTimer,
  anyTimerRunning,
}: KanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('taskId', taskId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: StatusEnum) => {
    const taskId = parseInt(e.dataTransfer.getData('taskId'), 10);
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== status) {
      onStatusChange(task, status);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        height: '100%',
        overflowX: 'auto',
        pb: 2,
        px: 1,
        '&::-webkit-scrollbar': { height: 8 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(0,0,0,0.1)',
          borderRadius: 4,
        },
      }}
    >
      {COLUMN_CONFIG.map((col) => (
        <Box
          key={col.status}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col.status)}
          sx={{
            flex: '0 0 280px',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: col.color,
            borderRadius: 2,
            p: 1.5,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 800,
              mb: 2,
              color: '#023047',
              opacity: 0.8,
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              letterSpacing: '0.05rem',
            }}
          >
            {col.label} ({tasks.filter((t) => t.status === col.status).length})
          </Typography>

          <Stack spacing={1.5} sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {tasks
              .filter((t) => t.status === col.status)
              .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
              .map((task) => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => onTaskClick(task.id)}
                  sx={{
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' },
                    borderLeft: `4px solid ${getPriorityColor(task.priority as PriorityEnum)}`,
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                  }}
                >
                  <CardContent sx={{ p: '12px !important' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        mb: 1,
                        color: '#023047',
                        lineHeight: 1.2,
                      }}
                    >
                      {task.title}
                    </Typography>

                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box display="flex" gap={0.5} alignItems="center">
                        <TimerIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {task.estimate}h
                        </Typography>
                        {task.type && (
                          <Chip
                            label={task.type}
                            size="small"
                            sx={{ fontSize: '0.6rem', height: 18, ml: 1 }}
                          />
                        )}
                      </Box>

                      <Box onClick={(e) => e.stopPropagation()}>
                        {task.startTimer ? (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => onStopTimer(task.id)}
                          >
                            <PauseCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={
                              anyTimerRunning ||
                              task.status === StatusEnum.COMPLETED
                            }
                            onClick={() => onStartTimer(task.id)}
                          >
                            <PlayCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
