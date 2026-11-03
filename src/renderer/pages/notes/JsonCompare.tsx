import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import CheckIcon from '@mui/icons-material/Check';
import CodeArea from './CodeArea';
import DiffView from './DiffView';
import { diffJson, formatJson, parseJson, JsonDifference } from './jsonTools';
import { Note } from './notesModel';
import { MONO_FONT } from './highlight';
import useCopy from './useCopy';

// Compare two JSON documents (e.g. API responses copied from the browser): both sides are
// editable, the diff is computed on normalised (pretty-printed, optionally key-sorted)
// JSON, shown either side by side or as a list of changes by JSON path.

const preview = (value: unknown) => {
  const text = JSON.stringify(value);
  if (text === undefined) return 'undefined';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

function Side({
  label,
  value,
  onChange,
  notes,
  onSaveAsNote,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  notes: Note[];
  onSaveAsNote: (content: string, title: string) => void;
}) {
  const parsed = parseJson(value);
  const { copy, copied } = useCopy();
  const jsonNotes = notes.filter((n) => n.format === 'json');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ mr: 1 }}>
          {label}
        </Typography>
        <Tooltip title="Paste from clipboard">
          <IconButton
            size="small"
            aria-label={`Paste into ${label}`}
            onClick={async () => onChange(await navigator.clipboard.readText())}
          >
            <ContentPasteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Format">
          <span>
            <IconButton
              size="small"
              aria-label={`Format ${label}`}
              disabled={!parsed.ok}
              onClick={() => parsed.ok && onChange(formatJson(parsed.value))}
            >
              <FormatAlignLeftIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton
            size="small"
            aria-label={`Copy ${label}`}
            onClick={() => copy(value)}
          >
            {copied ? (
              <CheckIcon fontSize="small" color="success" />
            ) : (
              <ContentCopyIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        {jsonNotes.length > 0 && (
          <Select
            size="small"
            value=""
            displayEmpty
            onChange={(e) => {
              const n = jsonNotes.find((x) => x.id === Number(e.target.value));
              if (n) onChange(n.content);
            }}
            renderValue={() => 'Load note…'}
            sx={{ ml: 'auto', fontSize: '0.8rem', height: 30, minWidth: 120 }}
          >
            {jsonNotes.map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.title || 'Untitled'}
              </MenuItem>
            ))}
          </Select>
        )}
        <Button
          size="small"
          disabled={!parsed.ok}
          onClick={() => onSaveAsNote(value, `${label} JSON`)}
          sx={{ ml: jsonNotes.length ? 0 : 'auto', whiteSpace: 'nowrap' }}
        >
          Save as note
        </Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 220 }}>
        <CodeArea
          value={value}
          onChange={onChange}
          language="json"
          ariaLabel={`${label} JSON`}
          placeholder="Paste JSON here…"
          errorLine={!parsed.ok && value.trim() ? parsed.line : undefined}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          mt: 0.5,
          color: parsed.ok || !value.trim() ? 'text.secondary' : 'error.main',
          minHeight: 20,
        }}
        noWrap
      >
        {!value.trim() ? ' ' : parsed.ok ? 'Valid JSON' : parsed.error}
      </Typography>
    </Box>
  );
}

export default function JsonCompare({
  notes,
  onSaveAsNote,
}: {
  notes: Note[];
  onSaveAsNote: (content: string, title: string) => void;
}) {
  const theme = useTheme();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [sortKeys, setSortKeys] = useState(true);
  const [mode, setMode] = useState<'lines' | 'paths'>('lines');
  const [onlyChanges, setOnlyChanges] = useState(true);
  const { copy, copied } = useCopy();

  const a = parseJson(left);
  const b = parseJson(right);
  const ready = a.ok && b.ok;

  const normalized = useMemo(() => {
    if (!a.ok || !b.ok) return null;
    return {
      left: formatJson(a.value, 2, sortKeys),
      right: formatJson(b.value, 2, sortKeys),
      differences: diffJson(a.value, b.value),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, right, sortKeys]);

  const kindColor = (d: JsonDifference) =>
    ({
      added: theme.palette.success.main,
      removed: theme.palette.error.main,
      changed: theme.palette.warning.main,
    })[d.kind];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
        minHeight: 0,
      }}
    >
      <Paper
        sx={{
          p: 2,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 1.5,
          minHeight: 320,
        }}
      >
        <Side
          label="Left"
          value={left}
          onChange={setLeft}
          notes={notes}
          onSaveAsNote={onSaveAsNote}
        />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="Swap sides">
            <IconButton
              aria-label="Swap sides"
              onClick={() => {
                setLeft(right);
                setRight(left);
              }}
            >
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Side
          label="Right"
          value={right}
          onChange={setRight}
          notes={notes}
          onSaveAsNote={onSaveAsNote}
        />
      </Paper>

      <Paper
        sx={{
          p: 2,
          flex: 1,
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="subtitle2">Differences</Typography>
          {normalized && (
            <Typography variant="body2" color="text.secondary">
              {normalized.differences.length === 0
                ? 'No differences'
                : `${normalized.differences.length} difference${normalized.differences.length === 1 ? '' : 's'}`}
            </Typography>
          )}
          <Box
            sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={sortKeys}
                  onChange={(e) => setSortKeys(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Ignore key order</Typography>}
            />
            {mode === 'lines' && (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={onlyChanges}
                    onChange={(e) => setOnlyChanges(e.target.checked)}
                  />
                }
                label={<Typography variant="body2">Only changes</Typography>}
              />
            )}
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_, v) => v && setMode(v)}
            >
              <ToggleButton value="lines">Side by side</ToggleButton>
              <ToggleButton value="paths">By path</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {!ready && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 3, textAlign: 'center' }}
          >
            Paste valid JSON on both sides to see the differences.
          </Typography>
        )}

        {normalized && mode === 'lines' && (
          <DiffView
            left={normalized.left}
            right={normalized.right}
            leftLabel="Left"
            rightLabel="Right"
            onlyChanges={onlyChanges}
          />
        )}

        {normalized && mode === 'paths' && (
          <Box
            sx={{ overflow: 'auto', fontFamily: MONO_FONT, fontSize: '0.8rem' }}
          >
            {normalized.differences.map((d) => (
              <Box
                key={`${d.kind}${d.path}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns:
                    '80px minmax(160px, 1fr) minmax(0, 1fr) minmax(0, 1fr) 32px',
                  gap: 1.5,
                  alignItems: 'center',
                  py: 0.5,
                  px: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                  '&:first-of-type': { borderTop: 0 },
                }}
              >
                <Box
                  sx={{
                    fontFamily: 'inherit',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: kindColor(d),
                    bgcolor: alpha(kindColor(d), 0.1),
                    borderRadius: 1,
                    px: 0.75,
                    textAlign: 'center',
                  }}
                >
                  {d.kind}
                </Box>
                <Box
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={d.path}
                >
                  {d.path}
                </Box>
                <Box
                  sx={{
                    color: 'error.main',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.kind === 'added' ? '' : preview(d.left)}
                </Box>
                <Box
                  sx={{
                    color: 'success.main',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.kind === 'removed' ? '' : preview(d.right)}
                </Box>
                <Tooltip title={copied === d.path ? 'Copied!' : 'Copy path'}>
                  <IconButton
                    size="small"
                    onClick={() => copy(d.path, d.path)}
                    aria-label="Copy path"
                  >
                    {copied === d.path ? (
                      <CheckIcon sx={{ fontSize: 16 }} color="success" />
                    ) : (
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
