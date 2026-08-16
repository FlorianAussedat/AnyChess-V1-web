import type { ImportedChessGame, ImportedGameHeaders } from './types.ts';

export function gamePlayersTitle(headers: ImportedGameHeaders): string {
  const white = headers.white?.trim() || '?';
  const black = headers.black?.trim() || '?';
  return `${white} – ${black}`;
}

export function gameSubtitle(game: ImportedChessGame): string {
  const parts: string[] = [];
  if (game.headers.event) parts.push(game.headers.event);
  if (game.headers.date && game.headers.date !== '????.??.??') {
    parts.push(game.headers.date);
  }
  if (game.headers.result) parts.push(game.headers.result);
  return parts.join(' · ');
}
