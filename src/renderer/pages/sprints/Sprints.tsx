import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Select,
  MenuItem,
  Grid,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArchiveIcon from '@mui/icons-material/Archive';
import EditIcon from '@mui/icons-material/Edit';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Date & Calendar
import { DayPicker, DateRange } from 'react-day-picker';
import { format, isWeekend, eachDayOfInterval, isSameDay, differenceInBusinessDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import 'react-day-picker/dist/style.css'; // Ensure this is loaded or handled by your CSS loader

import { getSprints, createSprint, updateSprintStatus, updateSprint } from '../../services/SprintService';
import { useTimer } from '../../context/TimerContext';
import { useGamification } from '../../context/GamificationContext';
import { SprintInterface } from '../../interfaces/sprint.interface';

// Custom styles for the calendar to match the theme
const calendarStyle = `
  .rdp {
    --rdp-cell-size: 40px;
    --rdp-accent-color: #219ebc;
    --rdp-background-color: #e0f7fa; 
    margin: 0;
  }
  .rdp-day_selected:not([disabled]) { 
    background-color: #219ebc; 
    color: white;
  }
  .rdp-day_today {
    font-weight: bold;
    color: #fb8500;
  }
  .excluded-day {
    background-color: #ffb703 !important;
    color: #023047 !important;
    text-decoration: line-through;
    opacity: 0.8;
  }
`;

const formatDateForInput = (date: Date | string): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

function Sprints() {
  const navigate = useNavigate();
  const [sprints, setSprints] = useState<SprintInterface[]>([]);
  const [isFormOpen, setIsModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<SprintInterface | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(formatDateForInput(new Date()));
  const [endDate, setEndDate] = useState('');
  const [excludedDates, setExcludedDates] = useState<Date[]>([]);
  const [manualCapacity, setManualCapacity] = useState<number | null>(null); // If user overrides
  
  const { tasks } = useTimer();
  const { checkForAchievements, triggerRewardAnimation } = useGamification();

  const fetchSprints = async () => {
    const sprintsData = await getSprints();
    // Ensure data integrity
    setSprints(sprintsData.map(s => ({
        ...s,
        excludedDates: s.excludedDates ? s.excludedDates.map(d => new Date(d)) : []
    })));
  };

  useEffect(() => {
    fetchSprints();
  }, []);

  // --- Capacity Logic ---
  const calculatedCapacity = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 0;

    const days = eachDayOfInterval({ start, end });
    let workDays = 0;

    days.forEach(day => {
        const isExcluded = excludedDates.some(ex => isSameDay(ex, day));
        const isWe = isWeekend(day);
        
        // Logic: Standard workday is Mon-Fri.
        // If it's a weekend, it's NOT a workday unless specifically included? 
        // For simplicity: Weekends are off. Excluded dates are off.
        // If user wants to work on weekend, they can't currently "un-exclude" it if logic is strict.
        // Let's assume standard logic: Workdays = All Days - Weekends - Excluded.
        
        if (!isWe && !isExcluded) {
            workDays++;
        }
    });

    return workDays * 8; // 8 hours per day
  }, [startDate, endDate, excludedDates]);

  const finalCapacity = manualCapacity !== null ? manualCapacity : calculatedCapacity;

  // --- Handlers ---

  const handleOpenForm = (sprint?: SprintInterface) => {
      if (sprint) {
          setEditingSprint(sprint);
          setName(sprint.name);
          setStartDate(formatDateForInput(sprint.startDate));
          setEndDate(formatDateForInput(sprint.endDate));
          // Parse excluded dates
          const excluded = sprint.excludedDates 
             ? (Array.isArray(sprint.excludedDates) && typeof sprint.excludedDates[0] === 'string' 
                ? sprint.excludedDates.map(d => new Date(d)) 
                : sprint.excludedDates as unknown as Date[])
             : [];
          setExcludedDates(excluded || []);
          setManualCapacity(sprint.capacity && sprint.capacity !== calculatedCapacity ? sprint.capacity : null);
      } else {
          setEditingSprint(null);
          setName('');
          setStartDate(formatDateForInput(new Date()));
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 14);
          setEndDate(formatDateForInput(nextWeek));
          setExcludedDates([]);
          setManualCapacity(null);
      }
      setIsModalOpen(true);
  };

  const handleDayClick = (day: Date) => {
      if (!startDate || !endDate) return;
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Only allow toggling days within range
      if (day < start || day > end) return;

      // If weekend, ignore for now (or could allow making it a workday later)
      if (isWeekend(day)) return;

      const isExcluded = excludedDates.some(d => isSameDay(d, day));
      if (isExcluded) {
          setExcludedDates(prev => prev.filter(d => !isSameDay(d, day)));
      } else {
          setExcludedDates(prev => [...prev, day]);
      }
  };

  const handleSaveSprint = async () => {
    if (!name || !startDate || !endDate) return;

    const payload = {
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        capacity: finalCapacity,
        excludedDates: excludedDates.map(d => d.toISOString())
    };

    if (editingSprint) {
        await updateSprint({ ...payload, id: editingSprint.id, status: editingSprint.status });
    } else {
        await createSprint(payload);
        const earned = await checkForAchievements('SPRINT_CREATED');
        if (earned) triggerRewardAnimation('achievement');
    }
    
    setIsModalOpen(false);
    fetchSprints();
  };

  const handleUpdateSprintStatus = async (sprintId: number, status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED') => {
    setEditingStatusId(null);
    await updateSprintStatus(sprintId, status);
    fetchSprints();
  };

  // --- Render ---

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Sprint Name', flex: 1 },
    { 
        field: 'dates', 
        headerName: 'Duration', 
        width: 200, 
        renderCell: (params) => (
            <Typography variant="body2">
                {new Date(params.row.startDate).toLocaleDateString()} - {new Date(params.row.endDate).toLocaleDateString()}
            </Typography>
        )
    },
    {
        field: 'capacity',
        headerName: 'Capacity',
        width: 120,
        renderCell: (params) => (
            <Typography variant="body2" color="text.secondary">
                {params.row.capacity ? `${params.row.capacity}h` : '-'}
            </Typography>
        )
    },
    { 
        field: 'status', 
        headerName: 'Status', 
        width: 150,
        renderCell: (params) => {
            if (params.row.id === editingStatusId) {
                return (
                    <Select
                        value={params.value}
                        onChange={(e) => handleUpdateSprintStatus(params.row.id, e.target.value as any)}
                        onBlur={() => setEditingStatusId(null)}
                        autoFocus
                        open
                        size="small"
                        sx={{ width: '100%' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MenuItem value="UPCOMING">Upcoming</MenuItem>
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="COMPLETED">Completed</MenuItem>
                    </Select>
                );
            }

            return (
                <Chip 
                    label={params.value} 
                    size="small" 
                    color={params.value === 'ACTIVE' ? 'primary' : params.value === 'COMPLETED' ? 'success' : 'default'} 
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingStatusId(params.row.id);
                    }}
                />
            );
        }
    },
    {
        field: 'actions',
        headerName: 'Actions',
        width: 100,
        sortable: false,
        renderCell: (params) => (
            <Box>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenForm(params.row); }}>
                    <EditIcon fontSize="small" />
                </IconButton>
            </Box>
        )
    }
  ];

  return (
    <Box sx={{ height: 'calc(100vh - 128px)', width: '100%' }}>
      <style>{calendarStyle}</style>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 300 }}>Sprint Management</Typography>
      
      <Paper elevation={0} sx={{ height: '100%', bgcolor: 'background.default' }}>
          <DataGrid
            rows={sprints}
            columns={columns}
            onRowClick={(params) => navigate(`/sprints/${params.id}`)}
            sx={{ border: 'none', '& .MuiDataGrid-cell': { borderBottom: '1px solid #f0f0f0' } }}
          />
      </Paper>

      <SpeedDial
        ariaLabel="Sprint Actions"
        sx={{ position: 'absolute', bottom: 72, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<AddIcon />}
          tooltipTitle="Create New Sprint"
          onClick={() => handleOpenForm()}
        />
      </SpeedDial>

      {/* Sprint Form Dialog */}
      <Dialog open={isFormOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ pb: 1 }}>{editingSprint ? 'Edit Sprint' : 'Plan New Sprint'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 0 }}>
                {/* Left Col: Inputs */}
                <Grid item xs={12} md={5}>
                    <TextField 
                        label="Sprint Name" 
                        fullWidth 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        sx={{ mb: 3 }} 
                    />
                    
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField 
                                label="Start Date" 
                                type="date" 
                                fullWidth 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                InputLabelProps={{ shrink: true }} 
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField 
                                label="End Date" 
                                type="date" 
                                fullWidth 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                InputLabelProps={{ shrink: true }} 
                            />
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #eee' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Capacity Settings
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography>Calculated:</Typography>
                            <Typography variant="h6" color="primary">{calculatedCapacity}h</Typography>
                        </Box>
                        {manualCapacity !== null && (
                             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography color="warning.main">Override:</Typography>
                                <Typography variant="h6">{manualCapacity}h</Typography>
                             </Box>
                        )}
                        <Typography variant="caption" color="text.secondary">
                            * Based on 8h/day excluding weekends and marked days.
                        </Typography>
                    </Box>
                </Grid>

                {/* Right Col: Calendar */}
                <Grid item xs={12} md={7}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Select Non-Working Days (Holidays)
                        </Typography>
                        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 1, bgcolor: 'background.paper' }}>
                            <DayPicker 
                                mode="multiple"
                                min={1} // Just to force render
                                selected={excludedDates}
                                onDayClick={handleDayClick}
                                month={startDate ? new Date(startDate) : new Date()}
                                fromDate={startDate ? new Date(startDate) : undefined}
                                toDate={endDate ? new Date(endDate) : undefined}
                                modifiers={{
                                    weekend: (date) => isWeekend(date),
                                    excluded: (date) => excludedDates.some(d => isSameDay(d, date))
                                }}
                                modifiersClassNames={{
                                    excluded: 'excluded-day'
                                }}
                                disabled={(date) => isWeekend(date)}
                                footer={
                                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                            <Box component="span" sx={{ width: 10, height: 10, bgcolor: '#ffb703', borderRadius: '50%' }} /> Holiday
                                            <Box component="span" sx={{ width: 10, height: 10, bgcolor: '#219ebc', borderRadius: '50%' }} /> Active Range
                                        </Typography>
                                    </Box>
                                }
                            />
                        </Box>
                    </Box>
                </Grid>
            </Grid>

          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setIsModalOpen(false)} color="inherit">Cancel</Button>
              <Button 
                onClick={handleSaveSprint} 
                variant="contained" 
                startIcon={<CheckCircleIcon />}
                disabled={!name || !startDate || !endDate}
            >
                Confirm Plan
              </Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Sprints;