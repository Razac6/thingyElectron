// Stat tiles in the Luma dashboard's top row. Which ones show, in what order, and which
// one is highlighted is the user's choice (Settings > Appearance); stored as settings.

export type TileId =
  | 'focusedToday'
  | 'stepsDone'
  | 'focusBlocks'
  | 'tasksDoneToday'
  | 'tasksToDo'
  | 'tasksCompletedAll'
  | 'completionRate'
  | 'weekTotal'
  | 'dailyAverage';

export const TILE_LABELS: Record<TileId, string> = {
  focusedToday: 'Focused today',
  stepsDone: 'Steps done',
  focusBlocks: 'Focus blocks',
  tasksDoneToday: 'Tasks done today',
  tasksToDo: 'Tasks to do',
  tasksCompletedAll: 'Completed (all time)',
  completionRate: 'Completion rate',
  weekTotal: 'This week',
  dailyAverage: 'Daily average',
};

export const ALL_TILES = Object.keys(TILE_LABELS) as TileId[];
export const MAX_TILES = 4;

// Defaults favour today's progress over all-time totals
export const DEFAULT_TILES: TileId[] = [
  'focusedToday',
  'stepsDone',
  'focusBlocks',
  'tasksDoneToday',
];
export const DEFAULT_HIGHLIGHT: TileId = 'tasksDoneToday';

export const TILES_SETTING = 'dashboard_tiles';
export const HIGHLIGHT_SETTING = 'dashboard_tile_highlight';

const isTileId = (value: unknown): value is TileId =>
  typeof value === 'string' && ALL_TILES.includes(value as TileId);

// Settings may hold anything (older versions, manual edits) - keep only valid, unique ids
export const parseTiles = (raw?: string | null): TileId[] => {
  if (!raw) return DEFAULT_TILES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TILES;
    const tiles = Array.from(new Set(parsed.filter(isTileId))).slice(
      0,
      MAX_TILES,
    );
    return tiles.length ? tiles : DEFAULT_TILES;
  } catch (e) {
    return DEFAULT_TILES;
  }
};

export const parseHighlight = (raw?: string | null): TileId | null => {
  if (raw === 'none') return null;
  return isTileId(raw) ? raw : DEFAULT_HIGHLIGHT;
};
