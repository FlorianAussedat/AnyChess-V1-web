/**
 * Build a SetUp PGN from a custom starting FEN and SAN plies.
 * Uses `1...` when Black moves first so the Lecteur parser accepts the line.
 */
export function pgnFromFenAndSans(input: {
  startFen: string;
  moveSans: readonly string[];
  headers?: Record<string, string>;
}): string {
  const startFen = input.startFen.trim();
  const parts = startFen.split(/\s+/);
  const blackFirst = parts[1] === 'b';
  const fullMove = Number(parts[5]) > 0 ? Number(parts[5]) : 1;

  const headers: Record<string, string> = {
    Event: 'AnyChess',
    Site: 'AnyChess',
    Result: '*',
    ...input.headers,
    FEN: startFen,
    SetUp: '1',
  };

  const headerLines = Object.entries(headers).map(
    ([key, value]) => `[${key} "${value}"]`,
  );

  const moves: string[] = [];
  let moveNum = fullMove;
  let whiteToMove = !blackFirst;
  for (const san of input.moveSans) {
    if (whiteToMove) {
      moves.push(`${moveNum}. ${san}`);
      whiteToMove = false;
    } else {
      moves.push(moves.length === 0 ? `${moveNum}... ${san}` : san);
      whiteToMove = true;
      moveNum += 1;
    }
  }

  const result = headers.Result ?? '*';
  const movetext = moves.length > 0 ? `${moves.join(' ')} ${result}` : result;
  return `${headerLines.join('\n')}\n\n${movetext}\n`;
}

export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
}
