// JSON helpers for notes and the compare view: validation with a readable position,
// formatting, a tokenizer for syntax highlighting, a structural diff (by path) and a
// line diff of the pretty-printed documents.

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; line?: number; column?: number };

const positionOf = (text: string, index: number) => {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return { line, column };
};

export const parseJson = (text: string): JsonParseResult => {
  if (!text.trim()) return { ok: false, error: 'Empty document' };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    const message = String(e?.message || e);
    // V8: "... at position 42" or "(line 3 column 5)"
    const lc = message.match(/line (\d+) column (\d+)/);
    if (lc) {
      return {
        ok: false,
        error: message,
        line: Number(lc[1]),
        column: Number(lc[2]),
      };
    }
    const pos = message.match(/position (\d+)/);
    if (pos) {
      return { ok: false, error: message, ...positionOf(text, Number(pos[1])) };
    }
    return { ok: false, error: message };
  }
};

export const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeysDeep((value as any)[k])]),
    );
  }
  return value;
};

export const formatJson = (value: unknown, indent = 2, sortKeys = false) =>
  JSON.stringify(sortKeys ? sortKeysDeep(value) : value, null, indent);

// --- Highlighting ----------------------------------------------------------------------

export type TokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punct'
  | 'text';

const TOKEN =
  /("(?:\\.|[^"\\])*"?)(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],:])/g;

/** Splits text into highlight tokens. Tolerant - works on invalid JSON while typing. */
export const tokenizeJson = (text: string) => {
  const tokens: { type: TokenType; text: string }[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  let m = TOKEN.exec(text);
  while (m) {
    if (m.index > last)
      tokens.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      tokens.push({ type: m[2] ? 'key' : 'string', text: m[1] });
      if (m[2]) tokens.push({ type: 'punct', text: m[2] });
    } else if (m[3] !== undefined) tokens.push({ type: 'number', text: m[3] });
    else if (m[4] !== undefined) tokens.push({ type: 'boolean', text: m[4] });
    else if (m[5] !== undefined) tokens.push({ type: 'null', text: m[5] });
    else tokens.push({ type: 'punct', text: m[6] });
    last = m.index + m[0].length;
    m = TOKEN.exec(text);
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
};

// --- Structural diff ---------------------------------------------------------------------

export type DiffKind = 'added' | 'removed' | 'changed';
export interface JsonDifference {
  path: string;
  kind: DiffKind;
  left?: unknown;
  right?: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const childPath = (path: string, key: string | number) => {
  if (typeof key === 'number') return `${path}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
};

/** Differences by JSON path ($.a.b[0]); arrays are compared index by index. */
export const diffJson = (
  left: unknown,
  right: unknown,
  path = '$',
  out: JsonDifference[] = [],
): JsonDifference[] => {
  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    keys.forEach((key) => {
      const p = childPath(path, key);
      if (!(key in right))
        out.push({ path: p, kind: 'removed', left: left[key] });
      else if (!(key in left))
        out.push({ path: p, kind: 'added', right: right[key] });
      else diffJson(left[key], right[key], p, out);
    });
    return out;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i += 1) {
      const p = childPath(path, i);
      if (i >= right.length)
        out.push({ path: p, kind: 'removed', left: left[i] });
      else if (i >= left.length)
        out.push({ path: p, kind: 'added', right: right[i] });
      else diffJson(left[i], right[i], p, out);
    }
    return out;
  }
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    out.push({ path, kind: 'changed', left, right });
  }
  return out;
};

// --- Line diff ---------------------------------------------------------------------------

export interface DiffRow {
  left?: string;
  right?: string;
  leftNo?: number;
  rightNo?: number;
  kind: 'same' | 'removed' | 'added' | 'changed';
}

/**
 * Side-by-side line diff (LCS). Adjacent removed+added runs are paired up as "changed"
 * rows so a modified value shows on one line on both sides.
 */
export const lineDiff = (leftText: string, rightText: string): DiffRow[] => {
  const a = leftText.split('\n');
  const b = rightText.split('\n');
  const n = a.length;
  const m = b.length;
  // Very large documents: skip the O(n*m) table and compare line by line
  if (n * m > 4_000_000) {
    return Array.from({ length: Math.max(n, m) }, (_, i) => ({
      left: a[i],
      right: b[i],
      leftNo: i < n ? i + 1 : undefined,
      rightNo: i < m ? i + 1 : undefined,
      kind: a[i] === b[i] ? 'same' : 'changed',
    }));
  }
  const lcs: Uint32Array[] = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let removed: DiffRow[] = [];
  let added: DiffRow[] = [];
  const flush = () => {
    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k += 1) {
      rows.push({
        left: removed[k].left,
        leftNo: removed[k].leftNo,
        right: added[k].right,
        rightNo: added[k].rightNo,
        kind: 'changed',
      });
    }
    rows.push(...removed.slice(pairs), ...added.slice(pairs));
    removed = [];
    added = [];
  };

  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      rows.push({
        left: a[i],
        right: b[j],
        leftNo: i + 1,
        rightNo: j + 1,
        kind: 'same',
      });
      i += 1;
      j += 1;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      added.push({ right: b[j], rightNo: j + 1, kind: 'added' });
      j += 1;
    } else {
      removed.push({ left: a[i], leftNo: i + 1, kind: 'removed' });
      i += 1;
    }
  }
  flush();
  return rows;
};
