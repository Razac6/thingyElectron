import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Badge,
  InputAdornment,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DataObjectIcon from '@mui/icons-material/DataObject';
import NotesIcon from '@mui/icons-material/Notes';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
import CheckIcon from '@mui/icons-material/Check';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../../services/DatabaseService';
import NewItemButton from '../../components/NewItemButton';
import { LiquidLoader } from '../../components/LiquidFill';
import NoteEditor from './NoteEditor';
import JsonCompare from './JsonCompare';
import HttpConverter from './HttpConverter';
import Base64Tool from './Base64Tool';
import VersionHistoryDialog, { NoteVersion } from './VersionHistoryDialog';
import {
  Note,
  NoteFilter,
  NoteFormat,
  NoteSort,
  countBy,
  emptyFilter,
  fileToNote,
  filterNotes,
  normalizeNote,
  noteToFile,
  paginate,
  snippet,
  sortNotes,
} from './notesModel';

// Notes: notebooks + tags + search + pagination on the left, the editor on the right,
// plus two developer tools - JSON compare and a DevTools cURL/fetch -> .http converter.

type Mode = 'notes' | 'compare' | 'http' | 'base64';
const PAGE_SIZE = 20;

const relativeDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (new Date().toDateString() === date.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const days = (Date.now() - date.getTime()) / 86400000;
  if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isJsonText = (text: string) => {
  try {
    JSON.parse(text);
    return true;
  } catch (e) {
    return false;
  }
};

function Notes() {
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<NoteFilter>(emptyFilter);
  const [sort, setSort] = useState<NoteSort>('updated');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // bump to reload the editor after a restore
  const [message, setMessage] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  // The note list can be hidden so the editor gets the full width
  const [listOpen, setListOpen] = useState(
    () => localStorage.getItem('notes_list_open') !== 'false',
  );
  const toggleList = () =>
    setListOpen((open) => {
      localStorage.setItem('notes_list_open', String(!open));
      return !open;
    });

  useEffect(() => {
    fetchNotes()
      .then((data) => setNotes((data || []).map(normalizeNote)))
      .finally(() => setIsLoading(false));
  }, []);

  // Opened from global search
  useEffect(() => {
    const noteId = (location.state as any)?.noteId;
    if (noteId) {
      setMode('notes');
      setSelectedId(noteId);
    }
  }, [location.state]);

  useEffect(() => setPage(1), [filter, sort]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const visible = useMemo(
    () => sortNotes(filterNotes(notes, filter), sort),
    [notes, filter, sort],
  );
  const paged = paginate(visible, page, PAGE_SIZE);
  const selected = notes.find((n) => n.id === selectedId) || null;
  const notebooks = countBy(notes.map((n) => n.notebook).filter(Boolean));
  const tags = countBy(notes.flatMap((n) => n.tags));
  const unfiled = notes.filter((n) => !n.notebook).length;

  const create = async (partial: Partial<Note> = {}) => {
    const now = new Date().toISOString();
    const created = normalizeNote(
      await createNote({
        title: '',
        content: '',
        createdAt: now,
        updatedAt: now,
        // New notes land in the notebook / tag / format being viewed
        notebook: filter.notebook || '',
        tags: filter.tag ? [filter.tag] : [],
        pinned: false,
        format: (filter.format || 'markdown') as NoteFormat,
        ...partial,
      }),
    );
    setNotes((list) => [created, ...list]);
    setSelectedId(created.id ?? null);
    setMode('notes');
    return created;
  };

  const save = async (note: Note) => {
    const saved = normalizeNote(await updateNote(note));
    setNotes((list) =>
      list.map((n) =>
        n.id === note.id ? { ...n, ...note, updatedAt: saved.updatedAt } : n,
      ),
    );
  };

  const remove = async (note: Note) => {
    if (!note.id) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Delete "${note.title || 'Untitled'}"? Its version history is deleted too.`,
    );
    if (!ok) return;
    await deleteNote(note.id);
    setNotes((list) => list.filter((n) => n.id !== note.id));
    setSelectedId(null);
  };

  const restore = async (version: NoteVersion) => {
    if (!selected) return;
    const restored: Note = {
      ...selected,
      title: version.title,
      content: version.content,
      format: version.format === 'json' ? 'json' : 'markdown',
    };
    // forceVersion: the current text is kept as a version, so a restore can be undone
    const saved = normalizeNote(
      await updateNote(restored, { forceVersion: true }),
    );
    setNotes((list) =>
      list.map((n) =>
        n.id === restored.id ? { ...restored, updatedAt: saved.updatedAt } : n,
      ),
    );
    setHistoryOpen(false);
    setEditorKey((k) => k + 1);
    flash('Version restored');
  };

  const importFiles = async () => {
    const files = await window.electron.database.importNoteFiles();
    if (!files.length) return;
    const created: Note[] = [];
    // One at a time so they keep the selected files' order
    // eslint-disable-next-line no-restricted-syntax
    for (const f of files) {
      const parsed = fileToNote(f.fileName, f.text);
      if (filter.notebook && !parsed.notebook)
        parsed.notebook = filter.notebook;
      // eslint-disable-next-line no-await-in-loop
      created.push(normalizeNote(await createNote(parsed)));
    }
    setNotes((list) => [...created, ...list]);
    setSelectedId(created[0]?.id ?? null);
    flash(`Imported ${created.length} note${created.length === 1 ? '' : 's'}`);
  };

  const exportNotes = async (list: Note[]) => {
    // Unique file names when several notes share a title
    const used = new Map<string, number>();
    const files = list.map((n) => {
      const file = noteToFile(n);
      const count = used.get(file.fileName) || 0;
      used.set(file.fileName, count + 1);
      return count
        ? {
            ...file,
            fileName: file.fileName.replace(/(\.\w+)$/, `-${count + 1}$1`),
          }
        : file;
    });
    const written = await window.electron.database.exportNoteFiles(files);
    if (written) flash(`Exported ${written} file${written === 1 ? '' : 's'}`);
  };

  const saveAsNote = async (content: string, title: string) => {
    await create({
      title,
      content,
      format: isJsonText(content) ? 'json' : 'markdown',
      notebook: '',
      tags: [],
    });
    flash('Saved as note');
  };

  const setF = (patch: Partial<NoteFilter>) =>
    setFilter((f) => ({ ...f, ...patch }));
  const activeFilters =
    (filter.notebook !== null ? 1 : 0) +
    (filter.tag !== null ? 1 : 0) +
    (filter.pinnedOnly ? 1 : 0) +
    (filter.format !== null ? 1 : 0);
  const filterLabel = [
    filter.pinnedOnly && 'Pinned',
    filter.format === 'json' && 'JSON',
    filter.notebook !== null && (filter.notebook || 'No notebook'),
    filter.tag !== null && `#${filter.tag}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const check = (on: boolean) => (
    <ListItemIcon sx={{ minWidth: 28 }}>
      {on && <CheckIcon fontSize="small" />}
    </ListItemIcon>
  );

  if (isLoading) return <LiquidLoader label="Loading notes" />;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Toolbar: one slim row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5,
          flexWrap: 'wrap',
        }}
      >
        {mode === 'notes' && (
          <Tooltip title={listOpen ? 'Hide note list' : 'Show note list'}>
            <IconButton
              size="small"
              onClick={toggleList}
              aria-label={listOpen ? 'Hide note list' : 'Show note list'}
              sx={{ color: listOpen ? 'text.primary' : 'text.secondary' }}
            >
              <ViewSidebarOutlinedIcon
                fontSize="small"
                sx={{ transform: 'scaleX(-1)' }}
              />
            </IconButton>
          </Tooltip>
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          aria-label="notes mode"
        >
          <ToggleButton value="notes">
            <NotesIcon fontSize="small" sx={{ mr: 1 }} /> Notes
          </ToggleButton>
          <ToggleButton value="compare">
            <DataObjectIcon fontSize="small" sx={{ mr: 1 }} /> Compare JSON
          </ToggleButton>
          <ToggleButton value="http">cURL → HTTP</ToggleButton>
          <ToggleButton value="base64">Base64</ToggleButton>
        </ToggleButtonGroup>
        {message && (
          <Chip size="small" color="success" label={message} sx={{ ml: 1 }} />
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {mode === 'notes' && (
            <>
              <Tooltip title="Import .md / .json files">
                <IconButton
                  size="small"
                  onClick={importFiles}
                  aria-label="Import notes"
                >
                  <FileUploadOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={`Export the ${visible.length} shown note${visible.length === 1 ? '' : 's'}`}
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={!visible.length}
                    onClick={() => exportNotes(visible)}
                    aria-label="Export shown notes"
                  >
                    <FileDownloadOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <NewItemButton
            label="New note"
            onClick={() => create()}
            sx={{ ml: 1 }}
          />
        </Box>
      </Box>

      {mode === 'compare' && (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <JsonCompare notes={notes} onSaveAsNote={saveAsNote} />
        </Box>
      )}
      {mode === 'base64' && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Base64Tool />
        </Box>
      )}
      {mode === 'http' && (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <HttpConverter onSaveAsNote={saveAsNote} />
        </Box>
      )}

      {mode === 'notes' && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: listOpen ? '260px minmax(0, 1fr)' : '1fr',
            gap: 1.5,
          }}
        >
          {/* Note list: search, filter menu, sort, pages */}
          {listOpen && (
            <Paper
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                p: 1,
              }}
            >
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="Search, #tag…"
                  value={filter.query}
                  onChange={(e) => setF({ query: e.target.value })}
                  sx={{ flex: 1 }}
                  InputProps={{
                    inputProps: { 'aria-label': 'Search notes' },
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: filter.query ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setF({ query: '' })}
                          aria-label="Clear search"
                          edge="end"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />
                <Tooltip title="Filter: notebooks, tags, pinned, JSON">
                  <IconButton
                    size="small"
                    onClick={(e) => setFilterAnchor(e.currentTarget)}
                    aria-label="Filter notes"
                  >
                    <Badge
                      color="primary"
                      variant="dot"
                      invisible={!activeFilters}
                    >
                      <FilterListIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.75,
                  mb: 0.25,
                  px: 0.5,
                  minHeight: 24,
                }}
              >
                {activeFilters ? (
                  <Chip
                    size="small"
                    label={filterLabel}
                    onDelete={() =>
                      setFilter({ ...emptyFilter, query: filter.query })
                    }
                    sx={{ maxWidth: 170 }}
                  />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {visible.length} note{visible.length === 1 ? '' : 's'}
                  </Typography>
                )}
                <Select
                  size="small"
                  variant="standard"
                  disableUnderline
                  value={sort}
                  onChange={(e) => setSort(e.target.value as NoteSort)}
                  inputProps={{ 'aria-label': 'Sort notes' }}
                  sx={{
                    ml: 'auto',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  <MenuItem value="updated">Last edited</MenuItem>
                  <MenuItem value="created">Created</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                </Select>
              </Box>

              <Box sx={{ flex: 1, overflow: 'auto', mx: -0.5 }}>
                {paged.items.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {notes.length ? 'No notes match.' : 'No notes yet.'}
                    </Typography>
                    {!notes.length && (
                      <Button
                        size="small"
                        onClick={() => create()}
                        sx={{ mt: 1 }}
                      >
                        Write the first one
                      </Button>
                    )}
                  </Box>
                )}
                {paged.items.map((n) => (
                  <ListItemButton
                    key={n.id}
                    selected={n.id === selectedId}
                    onClick={() => setSelectedId(n.id ?? null)}
                    sx={{
                      borderRadius: 2,
                      px: 1,
                      py: 0.75,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 0.25,
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {n.pinned && (
                        <PushPinIcon
                          sx={{ fontSize: 13, color: 'text.secondary' }}
                        />
                      )}
                      {n.format === 'json' && (
                        <DataObjectIcon
                          sx={{ fontSize: 13, color: 'text.secondary' }}
                        />
                      )}
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        {n.title || 'Untitled'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ flexShrink: 0 }}
                      >
                        {relativeDate(n.updatedAt)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{
                        fontFamily:
                          n.format === 'json' ? 'monospace' : undefined,
                      }}
                    >
                      {[
                        n.notebook,
                        ...n.tags.slice(0, 2).map((t) => `#${t}`),
                        snippet(n, 90) || 'Empty note',
                      ]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Typography>
                  </ListItemButton>
                ))}
              </Box>
              {paged.pageCount > 1 && (
                <Pagination
                  size="small"
                  count={paged.pageCount}
                  page={paged.page}
                  siblingCount={0}
                  onChange={(_, p) => setPage(p)}
                  sx={{ mt: 0.5, alignSelf: 'center' }}
                />
              )}
            </Paper>
          )}

          {/* Editor */}
          <Paper
            sx={{
              p: 1.5,
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selected ? (
              <NoteEditor
                key={`${selected.id}-${editorKey}`}
                note={selected}
                notebooks={notebooks.map(([name]) => name)}
                allTags={tags.map(([t]) => t)}
                onChange={save}
                onDelete={() => remove(selected)}
                onExport={() => exportNotes([selected])}
                onShowHistory={() => setHistoryOpen(true)}
              />
            ) : (
              <Box sx={{ m: 'auto', textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Select a note or create a new one.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Markdown with code highlighting, JSON with validation, version
                  history.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Filters */}
      <Menu
        open={!!filterAnchor}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        PaperProps={{ sx: { maxHeight: 420, minWidth: 220 } }}
      >
        <MenuItem
          dense
          onClick={() => setFilter({ ...emptyFilter, query: filter.query })}
        >
          {check(!activeFilters)}
          <ListItemText>All notes</ListItemText>
          <Typography variant="caption" color="text.secondary">
            {notes.length}
          </Typography>
        </MenuItem>
        <MenuItem
          dense
          onClick={() => setF({ pinnedOnly: !filter.pinnedOnly })}
        >
          {check(filter.pinnedOnly)}
          <ListItemText>Pinned</ListItemText>
          <Typography variant="caption" color="text.secondary">
            {notes.filter((n) => n.pinned).length}
          </Typography>
        </MenuItem>
        <MenuItem
          dense
          onClick={() =>
            setF({ format: filter.format === 'json' ? null : 'json' })
          }
        >
          {check(filter.format === 'json')}
          <ListItemText>JSON only</ListItemText>
          <Typography variant="caption" color="text.secondary">
            {notes.filter((n) => n.format === 'json').length}
          </Typography>
        </MenuItem>
        {notebooks.length > 0 && <ListSubheader>Notebooks</ListSubheader>}
        {notebooks.map(([name, count]) => (
          <MenuItem
            dense
            key={name}
            onClick={() =>
              setF({ notebook: filter.notebook === name ? null : name })
            }
          >
            {check(filter.notebook === name)}
            <FolderOutlinedIcon
              sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }}
            />
            <ListItemText>{name}</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {count}
            </Typography>
          </MenuItem>
        ))}
        {notebooks.length > 0 && unfiled > 0 && (
          <MenuItem
            dense
            onClick={() =>
              setF({ notebook: filter.notebook === '' ? null : '' })
            }
          >
            {check(filter.notebook === '')}
            <ListItemText>No notebook</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {unfiled}
            </Typography>
          </MenuItem>
        )}
        {tags.length > 0 && <ListSubheader>Tags</ListSubheader>}
        {tags.map(([tag, count]) => (
          <MenuItem
            dense
            key={tag}
            onClick={() => setF({ tag: filter.tag === tag ? null : tag })}
          >
            {check(filter.tag === tag)}
            <ListItemText>#{tag}</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {count}
            </Typography>
          </MenuItem>
        ))}
      </Menu>

      {selected && (
        <VersionHistoryDialog
          note={selected}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={restore}
        />
      )}
    </Box>
  );
}

export default Notes;
