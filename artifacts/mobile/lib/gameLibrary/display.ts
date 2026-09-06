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

function isBadNameToken(v: string): boolean {
  return !v || v === '?' || /^unknown$/i.test(v) || /^joueur/i.test(v);
}

function hasUsablePlayers(headers: ImportedGameHeaders): boolean {
  const white = headers.white?.trim() ?? '';
  const black = headers.black?.trim() ?? '';
  return !isBadNameToken(white) && !isBadNameToken(black);
}

function usableEvent(headers: ImportedGameHeaders): string | null {
  const event = headers.event?.trim() ?? '';
  return isBadNameToken(event) ? null : event;
}

/** True when metadata already provides a usable library title (players or event). */
export function gameHasUsableName(headers: ImportedGameHeaders): boolean {
  return hasUsablePlayers(headers) || usableEvent(headers) != null;
}

/** Title shown in the library: displayName, else players, else event. */
export function gameLibraryTitle(game: ImportedChessGame): string {
  const named = game.displayName?.trim();
  if (named) return named;
  if (hasUsablePlayers(game.headers)) {
    return gamePlayersTitle(game.headers);
  }
  const event = usableEvent(game.headers);
  if (event) return event;
  return gamePlayersTitle(game.headers);
}
