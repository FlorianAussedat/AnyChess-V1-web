/**
 * Light PGN game indexing — headers + offsets only.
 * Does NOT parse movetext, build GameTrees, or allocate per-game move strings.
 *
 * Offsets are UTF-16 code-unit indices into the source string (JS string.slice).
 * Callers that keep a File/Blob can still hold the source text once for extract,
 * or re-read via extractPgnSlice — never parse unselected games.
 */
export type PgnGameIndexEntry = {
  index: number;
  white?: string;
  black?: string;
  event?: string;
  date?: string;
  result?: string;
  site?: string;
  /** Inclusive start offset in the source string. */
  startOffset: number;
  /** Exclusive end offset in the source string. */
  endOffset: number;
};

export type PgnLightIndexResult = {
  entries: PgnGameIndexEntry[];
  indexedMs: number;
  /** Source length scanned (chars). */
  sourceLength: number;
};

const HEADER_LINE_RE = /^\[(\w+)\s+"(.*)"\]\s*$/;

function trimLine(raw: string): string {
  let s = raw;
  if (s.endsWith('\r')) s = s.slice(0, -1);
  return s.trim();
}

function parseHeaderLine(
  line: string,
): { key: string; value: string } | null {
  const m = line.match(HEADER_LINE_RE);
  if (!m) return null;
  return { key: m[1]!, value: m[2]! };
}

function optionalHeader(
  headers: Record<string, string>,
  key: string,
): string | undefined {
  const v = headers[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t || t === '?') return undefined;
  return t;
}

function entryFromHeaders(
  index: number,
  headers: Record<string, string>,
  startOffset: number,
  endOffset: number,
): PgnGameIndexEntry {
  return {
    index,
    white: optionalHeader(headers, 'White'),
    black: optionalHeader(headers, 'Black'),
    event: optionalHeader(headers, 'Event'),
    date: optionalHeader(headers, 'Date'),
    result: optionalHeader(headers, 'Result'),
    site: optionalHeader(headers, 'Site'),
    startOffset,
    endOffset,
  };
}

/**
 * Scan a PGN string once and build a lightweight game catalog.
 * Avoids `split(/\r?\n/)` into a giant array: walks with indexOf.
 */
export function indexPgnGamesLight(pgnText: string): PgnLightIndexResult {
  const started = Date.now();
  const text = typeof pgnText === 'string' ? pgnText : '';
  const entries: PgnGameIndexEntry[] = [];

  let i = 0;
  let gameStart = 0;
  let headers: Record<string, string> = {};
  let inMoves = false;
  let sawAnything = false;

  const flush = (endOffset: number) => {
    if (!sawAnything && Object.keys(headers).length === 0 && !inMoves) return;
    // Skip empty trailing flush
    if (Object.keys(headers).length === 0 && !inMoves) return;
    entries.push(
      entryFromHeaders(entries.length, headers, gameStart, endOffset),
    );
    headers = {};
    inMoves = false;
    sawAnything = false;
  };

  while (i < text.length) {
    let lineEnd = text.indexOf('\n', i);
    if (lineEnd < 0) lineEnd = text.length;
    const rawLine = text.slice(i, lineEnd);
    const line = trimLine(rawLine);

    if (line.startsWith('[')) {
      if (inMoves) {
        flush(i);
        gameStart = i;
      }
      const parsed = parseHeaderLine(line);
      if (parsed) {
        headers[parsed.key] = parsed.value;
        sawAnything = true;
      }
    } else if (line !== '') {
      inMoves = true;
      sawAnything = true;
    }

    i = lineEnd < text.length ? lineEnd + 1 : lineEnd;
  }

  if (sawAnything || Object.keys(headers).length > 0 || inMoves) {
    flush(text.length);
  }

  // Trim trailing whitespace from last endOffset without reallocating games
  if (entries.length > 0) {
    const last = entries[entries.length - 1]!;
    let end = last.endOffset;
    while (end > last.startOffset && /\s/.test(text[end - 1]!)) end -= 1;
    last.endOffset = end;
  }

  const indexedMs = Date.now() - started;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(`Indexed ${entries.length} games in ${indexedMs} ms`);
  }

  return { entries, indexedMs, sourceLength: text.length };
}

/** Human-readable row title for the selection list. */
export function formatPgnGameIndexTitle(entry: PgnGameIndexEntry): string {
  const white = entry.white?.trim();
  const black = entry.black?.trim();
  if (white || black) {
    const players = `${white || '?'} – ${black || '?'}`;
    const meta = [entry.event, entry.date, entry.result]
      .map((x) => x?.trim())
      .filter(Boolean)
      .join(' · ');
    return meta ? `${players}\n${meta}` : players;
  }
  if (entry.event?.trim()) {
    const meta = [entry.date, entry.result].filter(Boolean).join(' · ');
    return meta ? `${entry.event}\n${meta}` : entry.event;
  }
  return `Partie ${entry.index + 1}`;
}

/** Single-line search haystack. */
export function pgnGameIndexSearchText(entry: PgnGameIndexEntry): string {
  return [entry.white, entry.black, entry.event, entry.date, entry.site, entry.result]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterPgnGameIndex(
  entries: readonly PgnGameIndexEntry[],
  query: string,
): PgnGameIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice();
  return entries.filter((e) => pgnGameIndexSearchText(e).includes(q));
}

export function extractPgnSlice(
  source: string,
  entry: Pick<PgnGameIndexEntry, 'startOffset' | 'endOffset'>,
): string {
  const start = Math.max(0, entry.startOffset);
  const end = Math.min(source.length, entry.endOffset);
  if (end <= start) return '';
  return source.slice(start, end).trim();
}

/**
 * Toggle selection with a hard cap. Returns next set + whether the add was blocked.
 */
export function togglePgnGameSelection(
  selected: ReadonlySet<number>,
  index: number,
  max = 10,
): { selected: Set<number>; blocked: boolean } {
  const next = new Set(selected);
  if (next.has(index)) {
    next.delete(index);
    return { selected: next, blocked: false };
  }
  if (next.size >= max) {
    return { selected: next, blocked: true };
  }
  next.add(index);
  return { selected: next, blocked: false };
}
