import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { ContentCopy, OpenInFull } from '@mui/icons-material';
import { format } from 'date-fns';
import { Note } from '../../types';

const NotesList: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    tags: '',
    project: ''
  });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [summaryDialogNote, setSummaryDialogNote] = useState<Note | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [notes, searchTerm]);

  const loadNotes = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_NOTES' });
      const allNotes = response.notes || [];
      setNotes(allNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    if (!searchTerm.trim()) {
      setFilteredNotes(notes);
      return;
    }

    const filtered = notes.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredNotes(filtered);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, note: Note) => {
    setAnchorEl(event.currentTarget);
    setSelectedNote(note);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedNote(null);
  };

  const handleEdit = () => {
    if (selectedNote) {
      setEditForm({
        title: selectedNote.title,
        tags: selectedNote.tags.join(', '),
        project: selectedNote.project
      });
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (selectedNote) {
      try {
        await chrome.runtime.sendMessage({
          type: 'DELETE_NOTE',
          data: { id: selectedNote.id }
        });
        await loadNotes();
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
    handleMenuClose();
  };

  const handleSaveEdit = async () => {
    if (selectedNote) {
      const updatedNote = {
        ...selectedNote,
        title: editForm.title,
        tags: editForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        project: editForm.project,
        updatedAt: new Date()
      };

      try {
        await chrome.runtime.sendMessage({
          type: 'SAVE_NOTE',
          data: { note: updatedNote }
        });
        await loadNotes();
        setEditDialogOpen(false);
      } catch (error) {
        console.error('Error updating note:', error);
      }
    }
  };

  const openNote = (note: Note) => {
    if (note.url) {
      chrome.tabs.create({ url: note.url });
    }
  };

  const renderRating = (rating?: number) => {
    if (!rating) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
        <Typography variant="body2" color="text.secondary">
          {rating}/5
        </Typography>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box className="loading">
        <div className="loading-spinner"></div>
        <Typography>Loading notes...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Notes ({filteredNotes.length})
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search notes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Notes List */}
      {filteredNotes.length > 0 ? (
        <List sx={{ p: 0 }}>
          {filteredNotes.map((note, index) => (
            <React.Fragment key={note.id}>
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: 0 }}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" sx={{ flex: 1 }}>
                            {note.title}
                          </Typography>
                          {renderRating(note.rating)}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box sx={{ position: 'relative', mb: 1, pr: 8 }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ whiteSpace: 'pre-wrap' }}
                            >
                              {note.summary.length > 150 ? `${note.summary.substring(0,150)}...` : note.summary}
                            </Typography>
                            {note.summary.length > 150 && (
                              <Box sx={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  aria-label="Open full summary dialog"
                                  onClick={() => setSummaryDialogNote(note)}
                                >
                                  <OpenInFull fontSize="inherit" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Copy full summary"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(note.summary);
                                      setCopyFeedback(note.id);
                                      setTimeout(() => setCopyFeedback(null), 1500);
                                    } catch {}
                                  }}
                                >
                                  <ContentCopy fontSize="inherit" />
                                </IconButton>
                              </Box>
                            )}
                            {copyFeedback === note.id && (
                              <Typography variant="caption" sx={{ position: 'absolute', bottom: -6, right: 8, color: 'success.main' }}>Copied</Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(note.createdAt), 'MMM d, yyyy')}
                            </Typography>
                            {note.source && (
                              <Typography variant="caption" color="text.secondary">
                                • {note.source}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {note.tags.map((tag, tagIndex) => (
                              <Chip
                                key={tagIndex}
                                label={tag}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '10px', height: 20 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => handleMenuOpen(e, note)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </CardContent>
              </Card>
            </React.Fragment>
          ))}
        </List>
      ) : (
        <Box className="empty-state">
          <div className="empty-state-icon">📝</div>
          <Typography className="empty-state-title">
            {searchTerm ? 'No notes found' : 'No notes yet'}
          </Typography>
          <Typography className="empty-state-description">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Start by selecting text on any webpage and right-clicking to summarize with AI'
            }
          </Typography>
        </Box>
      )}

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {/* Add Open Link menu item if note has a URL */}
        {selectedNote && selectedNote.url && (
          <MenuItem
            onClick={() => {
              window.open(selectedNote.url, '_blank', 'noopener,noreferrer');
              handleMenuClose();
            }}
          >
            <OpenInNewIcon sx={{ mr: 1 }} />
            Open Link
          </MenuItem>
        )}
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Note</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={editForm.tags}
            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Project"
            value={editForm.project}
            onChange={(e) => setEditForm({ ...editForm, project: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Full Summary Dialog */}
      <Dialog
        open={!!summaryDialogNote}
        onClose={() => setSummaryDialogNote(null)}
        maxWidth="md"
        fullWidth
        aria-labelledby="full-summary-title"
      >
        <DialogTitle id="full-summary-title">Full Summary</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 400 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            {summaryDialogNote?.title}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {summaryDialogNote?.summary}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={async () => {
              if (summaryDialogNote) {
                try { await navigator.clipboard.writeText(summaryDialogNote.summary); } catch {}
              }
            }}
            startIcon={<ContentCopy fontSize="small" />}
          >
            Copy
          </Button>
          <Button onClick={() => setSummaryDialogNote(null)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotesList; 