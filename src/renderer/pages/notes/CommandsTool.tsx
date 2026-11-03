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
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import { MONO_FONT } from './highlight';
import useCopy from './useCopy';
import {
  CliCommand,
  CommandGroup,
  CommandsState,
  PACKAGE_COLORS,
  PACKAGE_COLOR_HEX,
  SETTINGS_KEY,
  cloneGroupInto,
  commandLabel,
  duplicateGroup,
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
import type {
  RunSnapshot,
  RunStep,
  StepStatus,
} from '../../../main/commandRunner';
import {
  DEFAULT_READY_TIMEOUT,
  ReadyType,
  describeReady,
} from '../../../main/readyCheck';

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

type ShownStatus = StepStatus | RunSnapshot['status'] | 'live' | null;

/** A background process that is up (its "ready when" passed) - no spinner. */
const stepShown = (step: RunStep): ShownStatus =>
  step.status === 'running' &&
  step.background &&
  (!step.ready || step.readyState === 'ready')
    ? 'live'
    : step.status;
/** A package whose background steps are all up counts as ready. */
const runShown = (run: RunSnapshot): ShownStatus =>
  run.status === 'running' && run.readyAt ? 'live' : run.status;

function StatusIcon({
  status,
  size = 16,
}: {
  status: ShownStatus;
  size?: number;
}) {
  const sx = { fontSize: size };
  if (status === 'live') {
    return (
      <Box
        title="Ready - still running in the background"
        sx={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: '50%',
            bgcolor: 'success.main',
            animation: 'thingyLive 2s ease-in-out infinite',
            '@keyframes thingyLive': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,197,94,.55)' },
              '50%': { boxShadow: '0 0 0 4px rgba(34,197,94,0)' },
            },
          }}
        />
      </Box>
    );
  }
  if (status === 'running')
    return <CircularProgress size={size - 2} thickness={5} />;
  if (status === 'waiting') {
    return <HourglassTopIcon color="info" sx={sx} />;
  }
  if (status === 'ok') return <CheckCircleIcon color="success" sx={sx} />;
  if (status === 'failed') return <ErrorIcon color="error" sx={sx} />;
  if (status === 'stopped') return <StopIcon color="warning" sx={sx} />;
  if (status === 'skipped')
    return <RemoveCircleOutlineIcon sx={{ ...sx, color: 'text.disabled' }} />;
  return <RadioButtonUncheckedIcon sx={{ ...sx, color: 'text.disabled' }} />;
}

const READY_LABELS: Record<string, string> = {
  container: 'Container is ready',
  port: 'Port is open',
  url: 'URL responds',
  output: 'Output contains',
  quiet: 'Output goes quiet',
};
const READY_PLACEHOLDERS: Record<string, string> = {
  container: 'shop-db-1',
  port: '5432  or  localhost:8080',
  url: 'http://localhost:8080/actuator/health',
  output: 'Started Application  or  /ready in \\d+/',
  quiet: '3',
};
const READY_HELP: Record<string, string> = {
  container:
    'Healthcheck if it has one, otherwise a real DB probe (pg_isready, mysqladmin ping...). Waits while the image pulls / starts.',
  port: 'A TCP connect works. With Docker the port may open before the DB is ready - prefer "Container is ready".',
  url: 'Any HTTP answer below 500.',
  output:
    "Text (any case) or /regex/ in this step's output - good for dev servers and watchers.",
  quiet:
    'Seconds without new output, after it printed something - for watchers with no clear "ready" line.',
};

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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Select
            size="small"
            value={draft.ready?.type || 'none'}
            onChange={(e) => {
              const type = e.target.value as ReadyType;
              setDraft((d) => ({
                ...d,
                ready:
                  type === 'none'
                    ? null
                    : {
                        type,
                        target:
                          d.ready?.type === type
                            ? d.ready.target
                            : type === 'quiet'
                              ? '3'
                              : '',
                        timeout: d.ready?.timeout ?? DEFAULT_READY_TIMEOUT,
                      },
              }));
            }}
            sx={{ minWidth: 190, fontSize: 14 }}
            aria-label="Ready when"
            renderValue={(v) =>
              v === 'none' ? 'Ready when it ends' : READY_LABELS[v as ReadyType]
            }
          >
            <MenuItem value="none">Nothing extra</MenuItem>
            {(Object.keys(READY_LABELS) as ReadyType[]).map((t) => (
              <MenuItem key={t} value={t}>
                {READY_LABELS[t]}
              </MenuItem>
            ))}
          </Select>
          {draft.ready && (
            <>
              <TextField
                size="small"
                value={draft.ready.target}
                placeholder={READY_PLACEHOLDERS[draft.ready.type]}
                helperText={READY_HELP[draft.ready.type]}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    ready: d.ready
                      ? { ...d.ready, target: e.target.value }
                      : null,
                  }))
                }
                sx={{ flex: 1 }}
                InputProps={{ sx: { fontFamily: MONO_FONT, fontSize: 13 } }}
              />
              <TextField
                size="small"
                type="number"
                label="Timeout s"
                value={draft.ready.timeout}
                helperText="0 = no limit"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    ready: d.ready
                      ? {
                          ...d.ready,
                          timeout: Math.max(0, Number(e.target.value) || 0),
                        }
                      : null,
                  }))
                }
                sx={{ width: 100 }}
              />
            </>
          )}
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
  const [hint, setHint] = useState<string | null>(null);
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
        ready: c.ready || null,
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
    const map = new Map<string, ShownStatus>();
    runs.forEach((run) =>
      run.steps.forEach((st) => {
        if (!map.has(st.id) && st.status !== 'pending') {
          map.set(st.id, stepShown(st));
        }
      }),
    );
    return map;
  }, [runs]);
  // command id -> the live step running it (run + index), for its Stop button
  const liveSteps = useMemo(() => {
    const map = new Map<string, { runId: string; index: number }>();
    runs
      .filter((r) => r.status === 'running')
      .forEach((run) =>
        run.steps.forEach((st, index) => {
          if (
            !map.has(st.id) &&
            (st.status === 'running' || st.status === 'waiting')
          ) {
            map.set(st.id, { runId: run.id, index });
          }
        }),
      );
    return map;
  }, [runs]);
  // package id -> its running run (newest first)
  const runningGroups = useMemo(() => {
    const map = new Map<string, RunSnapshot>();
    runs.forEach((r) => {
      if (r.status === 'running' && r.groupId && !map.has(r.groupId)) {
        map.set(r.groupId, r);
      }
    });
    return map;
  }, [runs]);

  // --- drag & drop ---
  const onRowDragOver = (
    e: React.DragEvent,
    groupId: string,
    index: number,
  ) => {
    if (!drag) return;
    // a package dragged into another package is copied in at that spot
    if (drag.type === 'group' && drag.id === groupId) return;
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
      } else if (drag.type === 'group' && drop.type === 'command') {
        const source = state.groups.find((g) => g.id === drag.id);
        change(cloneGroupInto(state, drag.id, drop.groupId, drop.index));
        if (source) {
          setHint(
            `Copied ${source.commands.length} command(s) from \u201c${source.name}\u201d`,
          );
          setTimeout(() => setHint(null), 3000);
        }
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
  const draggedGroup =
    drag?.type === 'group' ? state.groups.find((g) => g.id === drag.id) : null;
  const dropLine = (
    <Box
      sx={{ position: 'relative', height: 2, mx: 1, my: draggedGroup ? 1 : 0 }}
    >
      <Box sx={{ height: 2, borderRadius: 1, bgcolor: 'primary.main' }} />
      {draggedGroup && drop?.type === 'command' && (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            left: 24,
            top: -9,
            px: 0.75,
            borderRadius: 1,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: 10,
            lineHeight: '18px',
          }}
        >
          copy {draggedGroup.commands.length} command(s) of {draggedGroup.name}{' '}
          here
        </Typography>
      )}
    </Box>
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
              {c.ready && (
                <Tooltip
                  title={`Next step waits until ${describeReady(c.ready)}`}
                >
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={
                      <HourglassTopIcon sx={{ fontSize: '12px !important' }} />
                    }
                    label={describeReady(c.ready)}
                    sx={{ height: 18, fontSize: 10, maxWidth: 200 }}
                  />
                </Tooltip>
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
            sx={{
              display: 'flex',
              opacity: liveSteps.has(c.id) ? 1 : 0.5,
              transition: 'opacity .15s',
            }}
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
            {liveSteps.has(c.id) ? (
              <Tooltip title="Stop it (a package it runs in goes on with the next step)">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    const live = liveSteps.get(c.id)!;
                    window.electron.commands.stopStep(live.runId, live.index);
                  }}
                  aria-label={`Stop ${commandLabel(c)}`}
                >
                  <StopIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>
            ) : (
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
            )}
          </Box>
        </Box>
      </React.Fragment>
    );
  };

  const renderGroup = (group: CommandGroup, index: number) => {
    const groupRun = runningGroups.get(group.id);
    const groupReady = !!groupRun?.readyAt;
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
              drag && drop?.type === 'command' && drop.groupId === group.id
                ? 'primary.main'
                : 'divider',
            ...(group.color && {
              borderLeft: `4px solid ${PACKAGE_COLOR_HEX[group.color]}`,
              bgcolor: alpha(PACKAGE_COLOR_HEX[group.color], 0.05),
            }),
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
                sx={{
                  fontWeight: 700,
                  flex: 1,
                  minWidth: 0,
                  cursor: 'text',
                  color: group.color
                    ? PACKAGE_COLOR_HEX[group.color]
                    : undefined,
                }}
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
            {groupRun ? (
              <>
                <Tooltip
                  title={
                    groupReady
                      ? 'Ready - its background steps keep running'
                      : 'Running - click to see it'
                  }
                >
                  <Button
                    size="small"
                    color={groupReady ? 'success' : 'primary'}
                    onClick={() => {
                      setSelectedRun(groupRun.id);
                      setSelectedStep(null);
                    }}
                    startIcon={
                      groupReady ? (
                        <StatusIcon status="live" size={14} />
                      ) : (
                        <CircularProgress size={12} color="inherit" />
                      )
                    }
                    sx={{ ml: 0.5, py: 0.25, minWidth: 0 }}
                  >
                    {groupReady ? 'Ready' : 'Running'}
                  </Button>
                </Tooltip>
                <Tooltip title="Stop the package (and everything it started)">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => window.electron.commands.stop(groupRun.id)}
                    aria-label={`Stop ${group.name}`}
                  >
                    <StopIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={!group.commands.length}
                onClick={() => start(group.commands, group.name, group)}
                startIcon={<PlayArrowIcon />}
                sx={{ ml: 0.5, py: 0.25, minWidth: 0 }}
              >
                Run all
              </Button>
            )}
          </Box>
          {open && (
            <Box
              sx={{ mt: 0.5 }}
              onDragOver={(e) => {
                if (drag?.type !== 'group' || drag.id === group.id) return;
                e.preventDefault();
                e.stopPropagation();
                if (drop?.type !== 'command' || drop.groupId !== group.id) {
                  setDrop({
                    type: 'command',
                    groupId: group.id,
                    index: group.commands.length,
                  });
                }
              }}
            >
              {group.commands.map((c, i) => renderCommand(group, c, i))}
              {dropAtEnd && dropLine}
              {!group.commands.length && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  sx={{ px: 4, py: 1 }}
                >
                  {drag
                    ? 'Drop here'
                    : 'Empty - add a command, drag one here, or drop a whole package to copy it in.'}
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
          {hint && <Chip size="small" color="success" label={hint} />}
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
                  <StatusIcon status={runShown(selected)} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {selected.label}
                  </Typography>
                  {selected.status === 'running' && selected.readyAt && (
                    <Typography
                      variant="caption"
                      color="success.main"
                      sx={{ fontWeight: 600 }}
                      noWrap
                    >
                      ready in {duration(selected.startedAt, selected.readyAt)}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {new Date(selected.startedAt).toLocaleTimeString()} ·{' '}
                    {duration(
                      selected.startedAt,
                      selected.endedAt ?? selected.readyAt,
                    )}
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
                <StatusIcon status={runShown(r)} />
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
              {selected.readyAt ? 'Stop all' : 'Stop'}
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
                  <StatusIcon status={stepShown(step)} size={15} />
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
                    {step.ready && step.readyState && (
                      <Typography
                        component="span"
                        variant="caption"
                        color={
                          step.readyState === 'failed'
                            ? 'error.main'
                            : step.readyState === 'ready'
                              ? 'success.main'
                              : 'info.main'
                        }
                        sx={{ ml: 1 }}
                      >
                        {step.readyState === 'waiting'
                          ? `waiting: ${step.ready}${step.readyDetail ? ` (${step.readyDetail})` : ''}`
                          : step.readyState === 'ready'
                            ? 'ready'
                            : 'not ready'}
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
                    {duration(step.startedAt, step.endedAt ?? step.readyAt)}
                  </Typography>
                  {selected.status === 'running' &&
                    (step.status === 'running' ||
                      step.status === 'waiting') && (
                      <Tooltip
                        title={
                          step.status === 'waiting'
                            ? 'Stop waiting - the package goes on'
                            : 'Stop this step - the package goes on'
                        }
                      >
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.electron.commands.stopStep(selected.id, i);
                          }}
                          aria-label={`Stop ${step.name}`}
                          sx={{ p: 0.25 }}
                        >
                          <StopIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
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
        {groupMenu && (
          <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Color
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 0.75,
                mt: 0.5,
                flexWrap: 'wrap',
                maxWidth: 220,
              }}
            >
              <Tooltip title="No color">
                <Box
                  component="button"
                  aria-label="No color"
                  onClick={() => {
                    change(
                      updateGroup(state, groupMenu.group.id, { color: null }),
                    );
                    setGroupMenu(null);
                  }}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: 2,
                    borderColor: groupMenu.group.color
                      ? 'divider'
                      : 'text.primary',
                    bgcolor: 'transparent',
                    p: 0,
                    background: (t) =>
                      `linear-gradient(135deg, transparent 45%, ${t.palette.text.disabled} 45%, ${t.palette.text.disabled} 55%, transparent 55%)`,
                  }}
                />
              </Tooltip>
              {PACKAGE_COLORS.map((c) => (
                <Box
                  key={c}
                  component="button"
                  aria-label={`Color ${c}`}
                  title={c}
                  onClick={() => {
                    change(
                      updateGroup(state, groupMenu.group.id, { color: c }),
                    );
                    setGroupMenu(null);
                  }}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    p: 0,
                    border: 2,
                    borderColor:
                      groupMenu.group.color === c
                        ? 'text.primary'
                        : 'transparent',
                    bgcolor: PACKAGE_COLOR_HEX[c],
                    outline: 'none',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
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
            if (groupMenu) change(duplicateGroup(state, groupMenu.group.id));
            setGroupMenu(null);
          }}
        >
          Duplicate
        </MenuItem>
        {groupMenu &&
          groupMenu.group.commands.length > 0 &&
          state.groups
            .filter((g) => g.id !== groupMenu.group.id)
            .map((g) => (
              <MenuItem
                key={g.id}
                onClick={() => {
                  change(cloneGroupInto(state, groupMenu.group.id, g.id));
                  setGroupMenu(null);
                }}
              >
                <Typography variant="body2" noWrap>
                  Copy into <b>{g.name}</b>
                </Typography>
              </MenuItem>
            ))}
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
