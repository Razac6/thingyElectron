import {
  DEFAULT_HIGHLIGHT,
  DEFAULT_TILES,
  MAX_TILES,
  parseHighlight,
  parseTiles,
} from './dashboardTiles';

describe('dashboardTiles', () => {
  it('falls back to the defaults for missing or broken settings', () => {
    expect(parseTiles(undefined)).toEqual(DEFAULT_TILES);
    expect(parseTiles('not json')).toEqual(DEFAULT_TILES);
    expect(parseTiles('{"a":1}')).toEqual(DEFAULT_TILES);
    expect(parseTiles('[]')).toEqual(DEFAULT_TILES);
  });

  it('keeps the saved order, dropping unknown and duplicate ids', () => {
    expect(
      parseTiles(
        JSON.stringify(['weekTotal', 'bogus', 'stepsDone', 'weekTotal']),
      ),
    ).toEqual(['weekTotal', 'stepsDone']);
  });

  it(`never shows more than ${MAX_TILES} tiles`, () => {
    const many = [
      'focusedToday',
      'stepsDone',
      'focusBlocks',
      'tasksDoneToday',
      'weekTotal',
    ];
    expect(parseTiles(JSON.stringify(many))).toHaveLength(MAX_TILES);
  });

  it('supports turning the highlight off', () => {
    expect(parseHighlight('none')).toBeNull();
    expect(parseHighlight('weekTotal')).toBe('weekTotal');
    expect(parseHighlight('bogus')).toBe(DEFAULT_HIGHLIGHT);
  });
});
