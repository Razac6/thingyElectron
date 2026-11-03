import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { MONO_FONT } from './highlight';
import useCopy from './useCopy';
import {
  CliCommand,
  CommandGroup,
  CommandsState,
  SETTINGS_KEY,
  commandLabel,
  emptyCommand,
  emptyGroup,
  moveCommand,
  moveGroup,
  parseState,
  removeCommand,
  removeGroup,
  saveCommand,
  searchCommands,
  updateGroup,
} from './commandsModel';
import type { RunSnapshot, StepStatus } from '../../../main/commandRunner';

// Your own CLI commands: run one, or a whole package top to bottom (drag & drop to
// reorder / move between packages). Runs keep going in the background; every step has
// its own log, failed steps show why right away and can be re-run (all, from the failed
// step, or just that one).

type DragItem = { type: 'command' | 'group'; id: string } | null;
type DropTarget =
  | { type: 'command'; groupId: string; index: number }
  | { type: 'group'; index: number }
  | null;

const ERROR_LINE = /error|fail|exception|fatal|denied|not found|✖/i;

const duration = (from: number | null, to: number | null) => {
  if (!from) return '';
  const ms = (to || Date.now()) - from;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
};

function StatusIcon({
  status,
  size = 16,
}: {
  status: StepStatus | RunSnapshot['status'] | null;
  size?: number;
}) {
  const sx = { fontSize: size };
  if (status === 'running')
    return <CircularProgress size={size - 2} thickness={5} />;
  if (status === 'ok') return <CheckCircleIcon color="success" sx={sx} />;
  if (status === 'failed') return <ErrorIcon color="error" sx={sx} />;
  if (status === 'stopped') return <StopIcon color="warning" sx={sx} />;
  if (status === 'skipped')
    return <RemoveCircleOutlineIcon sx={{ ...sx, color: 'text.disabled' }} />;
  return <RadioButtonUncheckedIcon sx={{ ...sx, color: 'text.disabled' }} />;
}

// --- edit dialog ----------------------------------------------------------------
function CommandDialog({
  open,
  initial,
  groupId,
  groups,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  initial: CliCommand | null;
  groupId: string;
  groups: CommandGroup[];
  onSave: (command: CliCommand, groupId: string, runNow: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CliCommand>(emptyCommand);
  const [group, setGroup] = useState(groupId);
  const isNew = !groups.some((g) =>
    g.commands.some((c) => c.id === initial?.id),
  );

  useEffect(() => {
    if (open) {
      setDraft(initial || emptyCommand());
      setGroup(groupId);
    }
  }, [open, initial, groupId]);

  const pickFolder = async () => {
    const folder = await window.electron.commands.pickFolder(draft.cwd);
    if (folder) setDraft((d) => ({ ...d, cwd: folder }));
  };
  const valid = !!draft.command.trim();
  const save = (runNow: boolean) =>
    valid && onSave({ ...draft, name: draft.name.trim() }, group, runNow);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { p: 2.5, borderRadius: 3 } }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        {isNew ? 'New command' : 'Edit command'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          size="small"
          label="Name"
          placeholder="e.g. Start Postgres"
          value={draft.name}
          autoFocus
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <TextField
          size="small"
          label="Command"
          placeholder={'docker compose up -d db\nnpm run migrate'}
          value={draft.command}
          multiline
          minRows={3}
          maxRows={12}
          helperText="Runs in your login shell; several lines run as one script. Ctrl/⌘+Enter saves."
          onChange={(e) => setDraft((d) => ({ ...d, command: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(false);
          }}
          InputProps={{ sx: { fontFamily: MONO_FONT, fontSize: 13 } }}
        />
        <TextField
          size="small"
          label="Working directory"
          placeholder="~ (home)"
          value={draft.cwd}
          onChange={(e) => setDraft((d) => ({ ...d, cwd: e.target.value }))}
          InputProps={{
            sx: { fontFamily: MONO_FONT, fontSize: 13 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={pickFolder}
                  aria-label="Pick folder"
                >
                  <FolderOpenOutlinedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Select
            size="small"
            value={group}
            onChange={(e) => setGroup(String(e.target.value))}
            sx={{ minWidth: 180, fontSize: 14 }}
            aria-label="Package"
          >
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
          <Tooltip title="Off for dev servers and watchers: in a package the next step starts without waiting for this one to end.">
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={draft.wait}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, wait: e.target.checked }))
                  }
                />
              }
              label={
                <Typography variant="body2">Wait until it finishes</Typography>
              }
            />
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5 }}>
        {!isNew && initial && (
          <Button
            color="error"
            size="small"
            onClick={() => onDelete(initial.id)}
          >
            Delete
          </Button>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="small"
            disabled={!valid}
            onClick={() => save(true)}
            startIcon={<PlayArrowIcon />}
          >
            Save & run
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            disabled={!valid}
            onClick={() => save(false)}
          >
            Save
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

// --- log view -------------------------------------------------------------------
function LogView({ text, filter }: { text: string; filter: string }) {
  const theme = useTheme();
  const ref = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  const lines = useMemo(() => {
    const all = text.split('\n');
    const q = filter.trim().toLowerCase();
    const shown = q ? all.filter((l) => l.toLowerCase().includes(q)) : all;
    return shown.slice(-4000);
  }, [text, filter]);

  useEffect(() => {
    if (ref.current && stick.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <Box
      component="pre"
      ref={ref}
      onScroll={(e: React.UIEvent<HTMLPreElement>) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      sx={{
        m: 0,
        p: 1.5,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        fontFamily: MONO_FONT,
        fontSize: 12,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        bgcolor: alpha(theme.palette.text.primary, 0.04),
        borderRadius: 2,
      }}
    >
      {lines.length === 1 && !lines[0] ? (
        <Box component="span" sx={{ color: 'text.disabled' }}>
          No output yet.
        </Box>
      ) : (
        lines.map((line, i) => {
          let color: string | undefined;
          if (line.startsWith('▶') || line.startsWith('$ '))
            color = theme.palette.primary.main;
          else if (line.startsWith('──')) color = theme.palette.text.secondary;
          else if (ERROR_LINE.test(line)) color = theme.palette.error.main;
          return (
            // eslint-disable-next-line react/no-array-index-key
            <Box
              key={i}
              component="span"
              sx={{
                display: 'block',
                color,
                fontWeight: line.startsWith('▶') ? 700 : 400,
              }}
            >
              {line || ' '}
            </Box>
          );
        })
      )}
    </Box>
  );
}

// --- main ---------------------------------------------------------------------
export default function CommandsTool() {
  const theme = useTheme();
  const [state, setState] = useState<CommandsState | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{
    command: CliCommand | null;
    groupId: string;
  } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{
    anchor: HTMLElement;
    group: CommandGroup;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragItem>(null);
  const [drop, setDrop] = useState<DropTarget>(null);
  const [runs, setRuns] = useState<RunSnapshot[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [output, setOutput] = useState('');
  const [logFilter, setLogFilter] = useState('');
  const [, tick] = useState(0);
  const { copy, copied } = useCopy();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // --- persistence ---
  useEffect(() => {
    window.electron.database.getAllSettings().then((settings: any) => {
      setState(parseState(settings?.[SETTINGS_KEY]));
    });
    window.electron.commands.runs().then((list) => {
      setRuns(list);
      if (list[0]) setSelectedRun(list[0].id);
    });
  }, []);

  const change = useCallback((next: CommandsState) => {
    setState(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.electron.database.setSetting(SETTINGS_KEY, JSON.stringify(next));
    }, 300);
  }, []);

  // --- live runs / output ---
  useEffect(() => {
    const offRun = window.electron.ipcRenderer.on('commands:run', (payload) => {
      const run = payload as RunSnapshot;
      setRuns((list) =>
        [run, ...list.filter((r) => r.id !== run.id)].sort(
          (a, b) => b.startedAt - a.startedAt,
        ),
      );
    });
    return offRun;
  }, []);

  const selected = runs.find((r) => r.id === selectedRun) || null;

  useEffect(() => {
    if (!selectedRun) {
      setOutput('');
      return undefined;
    }
    let alive = true;
    window.electron.commands
      .output(selectedRun, selectedStep)
      .then((text) => alive && setOutput(text));
    const off = window.electron.ipcRenderer.on('commands:output', (payload) => {
      const { runId, chunk, step } = payload as {
        runId: string;
        chunk: string;
        step: number | null;
      };
      if (runId !== selectedRun) return;
      if (selectedStep !== null && step !== selectedStep) return;
      setOutput((text) => text + chunk);
    });
    return () => {
      alive = false;
      off();
    };
  }, [selectedRun, selectedStep]);

  // durations of running steps
  useEffect(() => {
    if (!runs.some((r) => r.status === 'running')) return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [runs]);

  // --- running ---
  const start = async (
    commands: CliCommand[],
    label: string,
    group?: CommandGroup,
  ) => {
    const run = await window.electron.commands.run(
      commands.map((c) => ({
        id: c.id,
        name: commandLabel(c),
        command: c.command,
        cwd: c.cwd,
        wait: c.wait,
      })),
      {
        label,
        groupId: group?.id || null,
        stopOnError: group ? group.stopOnError : true,
      },
    );
    if (run) {
      setRuns((list) => [run, ...list.filter((r) => r.id !== run.id)]);
      setSelectedRun(run.id);
      setSelectedStep(null);
      setLogFilter('');
    }
  };

  const rerun = async (options?: { from?: number; only?: number }) => {
    if (!selected) return;
    const run = await window.electron.commands.rerun(selected.id, options);
    if (run) {
      setRuns((list) => [run, ...list.filter((r) => r.id !== run.id)]);
      setSelectedRun(run.id);
      setSelectedStep(options?.only !== undefined ? 0 : null);
    }
  };

  const clearHistory = async () => {
    await window.electron.commands.clear();
    const list = await window.electron.commands.runs();
    setRuns(list);
    setSelectedRun(list[0]?.id || null);
    setSelectedStep(null);
  };

  // Latest status of each command (from the newest run it was part of)
  const lastStatus = useMemo(() => {
    const map = new Map<string, StepStatus>();
    runs.forEach((run) =>
      run.steps.forEach((s) => {
        if (!map.has(s.id) && s.status !== 'pending') map.set(s.id, s.status);
      }),
    );
    return map;
  }, [runs]);
  const runningGroups = useMemo(
    () =>
      new Set(
        runs
          .filter((r) => r.status === 'running' && r.groupId)
          .map((r) => r.groupId),
      ),
    [runs],
  );

  // --- drag & drop ---
  const onRowDragOver = (
    e: React.DragEvent,
    groupId: string,
    index: number,
  ) => {
    if (drag?.type !== 'command') return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    setDrop({ type: 'command', groupId, index: index + (after ? 1 : 0) });
  };
  const onGroupDragOver = (
    e: React.DragEvent,
    group: CommandGroup,
    index: number,
  ) => {
    if (drag?.type === 'command') {
      // over the header / empty space: append to the group
      e.preventDefault();
      if (drop?.type !== 'command' || drop.groupId !== group.id) {
        setDrop({
          type: 'command',
          groupId: group.id,
          index: group.commands.length,
        });
      }
    } else if (drag?.type === 'group') {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDrop({
        type: 'group',
        index: index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0),
      });
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (state && drag && drop) {
      if (drag.type === 'command' && drop.type === 'command') {
        change(moveCommand(state, drag.id, drop.groupId, drop.index));
      } else if (drag.type === 'group' && drop.type === 'group') {
        change(moveGroup(state, drag.id, drop.index));
      }
    }
    setDrag(null);
    setDrop(null);
  };
  const endDrag = () => {
    setDrag(null);
    setDrop(null);
  };

  if (!state) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const groups = searchCommands(state, query);
  const searching = !!query.trim();
  const dropLine = (
    <Box sx={{ height: 2, mx: 1, borderRadius: 1, bgcolor: 'primary.main' }} />
  );

  const renderCommand = (group: CommandGroup, c: CliCommand, index: number) => {
    const status = lastStatus.get(c.id) || null;
    const isDropBefore =
      drop?.type === 'command' &&
      drop.groupId === group.id &&
      drop.index === index;
    return (
      <React.Fragment key={c.id}>
        {isDropBefore && dropLine}
        <Box
          draggable={!searching}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', c.id);
            setDrag({ type: 'command', id: c.id });
          }}
          onDragEnd={endDrag}
          onDragOver={(e) => onRowDragOver(e, group.id, index)}
          onDrop={onDrop}
          onDoubleClick={() => setEditing({ command: c, groupId: group.id })}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pl: 0.5,
            pr: 1,
            py: 0.5,
            borderRadius: 2,
            opacity: drag?.id === c.id ? 0.4 : 1,
            '&:hover': { bgcolor: 'action.hover' },
            '&:hover .row-actions': { opacity: 1 },
          }}
        >
          <DragIndicatorIcon
            sx={{
              fontSize: 18,
              color: 'text.disabled',
              cursor: searching ? 'default' : 'grab',
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ width: 16, textAlign: 'right' }}
          >
            {index + 1}
          </Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {commandLabel(c)}
              </Typography>
              {!c.wait && (
                <Chip
                  size="small"
                  label="background"
                  sx={{ height: 18, fontSize: 10 }}
                />
              )}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="div"
              title={`${c.cwd ? `${c.cwd}\n` : ''}${c.command}`}
              sx={{ fontFamily: MONO_FONT, fontSize: 11 }}
            >
              {c.cwd && (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  {c.cwd} ${' '}
                </Box>
              )}
              {c.command.split('\n').join(' ; ')}
            </Typography>
          </Box>
          <Tooltip title={status ? `Last run: ${status}` : 'Not run yet'}>
            <Box sx={{ display: 'flex' }}>
              <StatusIcon status={status} size={15} />
            </Box>
          </Tooltip>
          <Box
            className="row-actions"
            sx={{ display: 'flex', opacity: 0.5, transition: 'opacity .15s' }}
          >
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => setEditing({ command: c, groupId: group.id })}
                aria-label={`Edit ${commandLabel(c)}`}
              >
                <EditOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Run this command">
              <IconButton
                size="small"
                color="primary"
                onClick={() => start([c], commandLabel(c))}
                aria-label={`Run ${commandLabel(c)}`}
              >
                <PlayArrowIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </React.Fragment>
    );
  };

  const renderGroup = (group: CommandGroup, index: number) => {
    const running = runningGroups.has(group.id);
    const open = !group.collapsed || searching;
    const isDropBefore = drop?.type === 'group' && drop.index === index;
    const dropAtEnd =
      drop?.type === 'command' &&
      drop.groupId === group.id &&
      drop.index === group.commands.length;
    return (
      <React.Fragment key={group.id}>
        {isDropBefore && dropLine}
        <Paper
          variant="outlined"
          onDragOver={(e) => onGroupDragOver(e, group, index)}
          onDrop={onDrop}
          sx={{
            borderRadius: 3,
            p: 1,
            opacity: drag?.type === 'group' && drag.id === group.id ? 0.4 : 1,
            borderColor:
              drag?.type === 'command' &&
              drop?.type === 'command' &&
              drop.groupId === group.id
                ? 'primary.main'
                : 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              draggable={!searching}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', group.id);
                setDrag({ type: 'group', id: group.id });
              }}
              onDragEnd={endDrag}
              sx={{ display: 'flex', cursor: searching ? 'default' : 'grab' }}
              title="Drag to reorder packages"
            >
              <DragIndicatorIcon
                sx={{ fontSize: 18, color: 'text.disabled' }}
              />
            </Box>
            <IconButton
              size="small"
              onClick={() =>
                change(
                  updateGroup(state, group.id, { collapsed: !group.collapsed }),
                )
              }
              aria-label={open ? 'Collapse package' : 'Expand package'}
              sx={{ p: 0.25 }}
            >
              {open ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
            {renaming === group.id ? (
              <TextField
                size="small"
                variant="standard"
                autoFocus
                defaultValue={group.name}
                onBlur={(e) => {
                  change(
                    updateGroup(state, group.id, {
                      name: e.target.value.trim() || group.name,
                    }),
                  );
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                sx={{ flex: 1 }}
              />
            ) : (
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, flex: 1, minWidth: 0, cursor: 'text' }}
                noWrap
                onDoubleClick={() => setRenaming(group.id)}
              >
                {group.name}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {group.commands.length}
                </Typography>
              </Typography>
            )}
            <Tooltip
              title={
                group.stopOnError
                  ? 'Stops at the first failing step (click to keep going)'
                  : 'Keeps going after a failing step (click to stop on errors)'
              }
            >
              <Chip
                size="small"
                variant="outlined"
                label={
                  group.stopOnError ? 'stop on error' : 'continue on error'
                }
                onClick={() =>
                  change(
                    updateGroup(state, group.id, {
                      stopOnError: !group.stopOnError,
                    }),
                  )
                }
                sx={{ height: 20, fontSize: 11 }}
              />
            </Tooltip>
            <Tooltip title="Add command">
              <IconButton
                size="small"
                onClick={() => setEditing({ command: null, groupId: group.id })}
                aria-label={`Add command to ${group.name}`}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={(e) => setGroupMenu({ anchor: e.currentTarget, group })}
              aria-label={`${group.name} menu`}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
            <Button
              size="small"
              variant="contained"
              disableElevation
              disabled={!group.commands.length || running}
              onClick={() => start(group.commands, group.name, group)}
              startIcon={
                running ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <PlayArrowIcon />
                )
              }
              sx={{ ml: 0.5, py: 0.25, minWidth: 0 }}
            >
              {running ? 'Running' : 'Run all'}
            </Button>
          </Box>
          {open && (
            <Box sx={{ mt: 0.5 }}>
              {group.commands.map((c, i) => renderCommand(group, c, i))}
              {dropAtEnd && dropLine}
              {!group.commands.length && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  sx={{ px: 4, py: 1 }}
                >
                  {drag?.type === 'command'
                    ? 'Drop here'
                    : 'Empty - add a command or drag one here.'}
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      </React.Fragment>
    );
  };

  const failedIndex = selected
    ? selected.steps.findIndex((s) => s.status === 'failed')
    : -1;

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(340px, 0.9fr) minmax(0, 1.1fr)',
        gap: 1.5,
      }}
    >
      {/* Left: packages */}
      <Box
        sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 1 }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <IconButton
                  size="small"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              ) : undefined,
            }}
          />
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => change({ groups: [...state.groups, emptyGroup()] })}
          >
            Package
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={() =>
              setEditing({ command: null, groupId: state.groups[0].id })
            }
          >
            Command
          </Button>
        </Box>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            pb: 1,
          }}
          onDragOver={(e) => {
            if (drag?.type === 'group') {
              e.preventDefault();
            }
          }}
          onDrop={onDrop}
        >
          {groups.map(renderGroup)}
          {drop?.type === 'group' &&
            drop.index === state.groups.length &&
            dropLine}
          {searching && !groups.length && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', mt: 3 }}
            >
              Nothing matches “{query}”.
            </Typography>
          )}
        </Box>
      </Box>

      {/* Right: runs + logs */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Select
            size="small"
            displayEmpty
            value={selected?.id || ''}
            onChange={(e) => {
              setSelectedRun(String(e.target.value) || null);
              setSelectedStep(null);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              '& .MuiSelect-select': {
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
              },
            }}
            aria-label="Run"
            renderValue={() =>
              selected ? (
                <>
                  <StatusIcon status={selected.status} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {selected.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {new Date(selected.startedAt).toLocaleTimeString()} ·{' '}
                    {duration(selected.startedAt, selected.endedAt)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No runs yet - press ▶ on a command or a package
                </Typography>
              )
            }
          >
            {runs.map((r) => (
              <MenuItem key={r.id} value={r.id} sx={{ gap: 1 }}>
                <StatusIcon status={r.status} />
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                  {r.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(r.startedAt).toLocaleTimeString()}
                </Typography>
              </MenuItem>
            ))}
          </Select>
          {selected?.status === 'running' ? (
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<StopIcon />}
              onClick={() => window.electron.commands.stop(selected.id)}
            >
              Stop
            </Button>
          ) : (
            selected && (
              <>
                {failedIndex > 0 && (
                  <Tooltip
                    title={`Skip the steps that passed and start at “${selected.steps[failedIndex].name}”`}
                  >
                    <Button
                      size="small"
                      startIcon={<ReplayIcon />}
                      onClick={() => rerun({ from: failedIndex })}
                    >
                      From failed
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="Run it again">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                    onClick={() => rerun()}
                  >
                    Rerun
                  </Button>
                </Tooltip>
              </>
            )
          )}
          <Tooltip title="Clear finished runs">
            <span>
              <IconButton
                size="small"
                disabled={!runs.some((r) => r.status !== 'running')}
                onClick={clearHistory}
                aria-label="Clear finished runs"
              >
                <DeleteSweepOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {selected && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              maxHeight: '40%',
              overflow: 'auto',
              flexShrink: 0,
            }}
          >
            {selected.steps.length > 1 && (
              <Box
                onClick={() => setSelectedStep(null)}
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor:
                    selectedStep === null
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  All output
                </Typography>
              </Box>
            )}
            {selected.steps.map((step, i) => (
              <Box key={`${step.id}-${i}`}>
                <Box
                  onClick={() =>
                    setSelectedStep(
                      selected.steps.length > 1 && selectedStep === i
                        ? null
                        : i,
                    )
                  }
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.4,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    bgcolor:
                      selectedStep === i
                        ? alpha(theme.palette.primary.main, 0.1)
                        : 'transparent',
                    '&:hover': {
                      bgcolor:
                        selectedStep === i
                          ? alpha(theme.palette.primary.main, 0.14)
                          : 'action.hover',
                    },
                    '&:hover .step-actions': { opacity: 1 },
                  }}
                >
                  <StatusIcon status={step.status} size={15} />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: step.status === 'failed' ? 700 : 400,
                    }}
                  >
                    {step.name}
                    {step.background && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        background
                      </Typography>
                    )}
                  </Typography>
                  {step.status === 'failed' && step.code !== null && (
                    <Typography variant="caption" color="error.main">
                      exit {step.code}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ minWidth: 48, textAlign: 'right' }}
                  >
                    {duration(step.startedAt, step.endedAt)}
                  </Typography>
                  {selected.status !== 'running' && (
                    <Box
                      className="step-actions"
                      sx={{
                        display: 'flex',
                        opacity: step.status === 'failed' ? 1 : 0,
                      }}
                    >
                      <Tooltip title="Run only this step">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            rerun({ only: i });
                          }}
                          aria-label={`Run only ${step.name}`}
                          sx={{ p: 0.25 }}
                        >
                          <PlayArrowIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {i > 0 && selected.steps.length > 1 && (
                        <Tooltip title="Rerun from this step">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              rerun({ from: i });
                            }}
                            aria-label={`Rerun from ${step.name}`}
                            sx={{ p: 0.25 }}
                          >
                            <ReplayIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  )}
                </Box>
                {step.status === 'failed' &&
                  step.tail &&
                  selectedStep !== i && (
                    <Box
                      component="pre"
                      onClick={() => setSelectedStep(i)}
                      title="Show the full log of this step"
                      sx={{
                        m: 0,
                        ml: 4,
                        mr: 1,
                        mb: 0.5,
                        px: 1,
                        py: 0.5,
                        fontFamily: MONO_FONT,
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'error.main',
                        bgcolor: alpha(theme.palette.error.main, 0.07),
                        borderRadius: 1.5,
                        cursor: 'pointer',
                      }}
                    >
                      {step.tail}
                    </Box>
                  )}
              </Box>
            ))}
          </Box>
        )}

        {selected && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Filter log lines…"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              sx={{ flex: 1, '& input': { py: 0.5, fontSize: 13 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {selectedStep === null
                ? 'all steps'
                : selected.steps[selectedStep]?.name}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy log'}>
              <IconButton
                size="small"
                onClick={() => copy(output)}
                aria-label="Copy log"
              >
                {copied ? (
                  <CheckIcon fontSize="small" />
                ) : (
                  <ContentCopyIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {selected ? (
          <LogView text={output} filter={logFilter} />
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', maxWidth: 340 }}
            >
              Save the commands you run all the time, group them into packages
              and run a package top to bottom with one click. Logs of every step
              land here.
            </Typography>
          </Box>
        )}
      </Paper>

      <Menu
        anchorEl={groupMenu?.anchor}
        open={!!groupMenu}
        onClose={() => setGroupMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (groupMenu) setRenaming(groupMenu.group.id);
            setGroupMenu(null);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (groupMenu) {
              const copyGroup = {
                ...groupMenu.group,
                ...emptyGroup(`${groupMenu.group.name} copy`),
                stopOnError: groupMenu.group.stopOnError,
              };
              copyGroup.commands = groupMenu.group.commands.map((c) => ({
                ...c,
                ...{ id: emptyCommand().id },
              }));
              change({ groups: [...state.groups, copyGroup] });
            }
            setGroupMenu(null);
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            if (
              groupMenu &&
              (!groupMenu.group.commands.length ||
                // eslint-disable-next-line no-alert
                window.confirm(
                  `Delete “${groupMenu.group.name}” and its ${groupMenu.group.commands.length} command(s)?`,
                ))
            ) {
              change(removeGroup(state, groupMenu.group.id));
            }
            setGroupMenu(null);
          }}
        >
          Delete package
        </MenuItem>
      </Menu>

      <CommandDialog
        open={!!editing}
        initial={editing?.command || null}
        groupId={editing?.groupId || state.groups[0].id}
        groups={state.groups}
        onClose={() => setEditing(null)}
        onDelete={(id) => {
          change(removeCommand(state, id));
          setEditing(null);
        }}
        onSave={(command, groupId, runNow) => {
          change(saveCommand(state, groupId, command));
          setEditing(null);
          if (runNow) start([command], commandLabel(command));
        }}
      />
    </Box>
  );
}
