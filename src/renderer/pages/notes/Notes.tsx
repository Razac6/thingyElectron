import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  IconButton,
  Grid,
  Fab,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../../services/DatabaseService';

interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: string;
  userId?: number;
}

function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({
    title: '',
    content: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchNotes();
      setNotes(data);
    } catch (err) {
      setError('Failed to load notes. Please make sure you are logged in.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleSave = async () => {
    try {
      if (isEditing && currentNote.id) {
        await updateNote(currentNote as Note);
      } else {
        await createNote({
          title: currentNote.title || 'Untitled Note',
          content: currentNote.content || '',
          createdAt: new Date().toISOString(),
        });
      }
      setOpenDialog(false);
      setCurrentNote({ title: '', content: '' });
      setIsEditing(false);
      loadNotes(); // Refresh notes list
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      loadNotes(); // Refresh notes list
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const openAddDialog = () => {
    setCurrentNote({ title: '', content: '' });
    setIsEditing(false);
    setOpenDialog(true);
  };

  const openEditDialog = (note: Note) => {
    setCurrentNote(note);
    setIsEditing(true);
    setOpenDialog(true);
  };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Typography color="error" sx={{ textAlign: 'center', mt: 4 }}>{error}</Typography>;
  }

  return (
    <Box>
      <Grid container spacing={3}>
        {notes.map((note) => (
          <Grid item xs={12} sm={6} md={4} key={note.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="div">
                  {note.title}
                </Typography>
                <Typography
                  sx={{ mb: 1.5 }}
                  color="text.secondary"
                  variant="caption"
                >
                  {new Date(note.createdAt).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {note.content}
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => openEditDialog(note)} size="small">
                  <EditIcon />
                </IconButton>
                <IconButton
                  onClick={() => handleDelete(note.id!)}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        onClick={openAddDialog}
      >
        <AddIcon />
      </Fab>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth>
        <DialogTitle>{isEditing ? 'Edit Note' : 'New Note'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={currentNote.title}
            onChange={(e) =>
              setCurrentNote({ ...currentNote, title: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label="Content"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={currentNote.content}
            onChange={(e) =>
              setCurrentNote({ ...currentNote, content: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Notes;
