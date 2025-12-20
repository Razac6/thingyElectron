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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArchiveIcon from '@mui/icons-material/Archive';
import EditIcon from '@mui/icons-material/Edit';
import { getSprints, createSprint, updateSprintStatus, updateSprint } from '../../services/SprintService';
import { useTimer } from '../../context/TimerContext';
import { useGamification } from '../../context/GamificationContext';

const formatDateForInput = (date: Date | string): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
}

function Sprints() {
  const navigate = useNavigate();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isFormOpen, setIsModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  
  const [sprintForm, setSprintForm] = useState({
      name: '',
      startDate: formatDateForInput(new Date()),
      endDate: ''
  });

  const { tasks } = useTimer();
  const { checkForAchievements, triggerRewardAnimation } = useGamification();
  const [suggestedCapacity, setSuggestedCapacity] = useState(0);

  const fetchSprintsAndCapacity = async () => {
    const sprintsData = await getSprints();
    setSprints(sprintsData);
    const avgCapacity = await window.electron.database.getAverageSprintCapacity();
    setSuggestedCapacity(avgCapacity);
  };

  useEffect(() => {
    fetchSprintsAndCapacity();
  }, []);

  const handleOpenForm = (sprint?: Sprint) => {
      if (sprint) {
          setEditingSprint(sprint);
          setSprintForm({
              name: sprint.name,
              startDate: formatDateForInput(sprint.startDate),
              endDate: formatDateForInput(sprint.endDate)
          });
      } else {
          setEditingSprint(null);
          setSprintForm({
              name: '',
              startDate: formatDateForInput(new Date()),
              endDate: ''
          });
      }
      setIsModalOpen(true);
  };

  const handleSaveSprint = async () => {
    if (!sprintForm.name || !sprintForm.startDate || !sprintForm.endDate) return;

    if (editingSprint) {
        const updated = {
            ...editingSprint,
            name: sprintForm.name,
            startDate: new Date(sprintForm.startDate).toISOString(),
            endDate: new Date(sprintForm.endDate).toISOString()
        };
        await updateSprint(updated);
    } else {
        const newSprint = { 
            name: sprintForm.name, 
            startDate: new Date(sprintForm.startDate).toISOString(), 
            endDate: new Date(sprintForm.endDate).toISOString() 
        };
        const createdSprint = await createSprint(newSprint);
        const earned = await checkForAchievements('SPRINT_CREATED');
        if (earned) triggerRewardAnimation('achievement');
    }
    
    setIsModalOpen(false);
    fetchSprintsAndCapacity();
  };

  const handleUpdateSprintStatus = async (sprintId: number, status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED') => {
    setEditingStatusId(null);
    await updateSprintStatus(sprintId, status);
    fetchSprintsAndCapacity();
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Sprint Name', flex: 1 },
    { 
        field: 'dates', 
        headerName: 'Duration', 
        width: 250, 
        renderCell: (params) => (
            <Typography variant="body2">
                {new Date(params.row.startDate).toLocaleDateString()} - {new Date(params.row.endDate).toLocaleDateString()}
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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 300 }}>Sprint Management</Typography>
      
      <Box sx={{ height: '100%' }}>
          <DataGrid
            rows={sprints}
            columns={columns}
            onRowClick={(params) => navigate(`/sprints/${params.id}`)}
            sx={{ cursor: 'pointer', bgcolor: 'background.paper' }}
          />
      </Box>

      <SpeedDial
        ariaLabel="Sprint Actions"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<AddIcon />}
          tooltipTitle="Create New Sprint"
          onClick={() => handleOpenForm()}
        />
      </SpeedDial>

      {/* Sprint Form Dialog */}
      <Dialog open={isFormOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>{editingSprint ? 'Edit Sprint' : 'New Sprint'}</DialogTitle>
          <DialogContent>
              <TextField 
                label="Name" 
                fullWidth 
                value={sprintForm.name} 
                onChange={(e) => setSprintForm({...sprintForm, name: e.target.value})} 
                sx={{ mt: 1, mb: 2 }} 
              />
              <TextField 
                label="Start Date" 
                type="date" 
                fullWidth 
                value={sprintForm.startDate} 
                onChange={(e) => setSprintForm({...sprintForm, startDate: e.target.value})} 
                InputLabelProps={{ shrink: true }} 
                sx={{ mb: 2 }} 
              />
              <TextField 
                label="End Date" 
                type="date" 
                fullWidth 
                value={sprintForm.endDate} 
                onChange={(e) => setSprintForm({...sprintForm, endDate: e.target.value})} 
                InputLabelProps={{ shrink: true }} 
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveSprint} variant="contained">Save</Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Sprints;
