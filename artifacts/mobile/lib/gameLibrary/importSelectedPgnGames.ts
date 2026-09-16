/**
 * Import only selected games from an already light-indexed PGN source.
 * Full parse (movetext / chess.js) runs solely for the chosen slices.
 */
import { parsePgn, PgnSyntaxError } from '../repertoire/pgnParser.ts';
import {
  buildImportedGameFromPgnGame,
  type BuildImportedGameOptions,
} from './importPgnGames.ts';
import {
  extractPgnSlice,
  type PgnGameIndexEntry,
} from './indexPgnGamesLight.ts';
import type { ImportedChessGame, ImportPgnResult } from './types.ts';

export type ImportSelectedPgnOptions = BuildImportedGameOptions & {
  /** When set, prefer these display names keyed by game index. */
  displayNamesByIndex?: Record<number, string>;
};

/**
 * Parse + validate only `selected` index entries against `sourceText`.
 * Unselected games are never tokenized.
 */
export function importSelectedPgnGames(
  sourceText: string,
  entries: readonly PgnGameIndexEntry[],
  selectedIndices: readonly number[],
  options: ImportSelectedPgnOptions = {},
): ImportPgnResult & { parsedCount: number } {
  const errors: string[] = [];
  const imported: ImportedChessGame[] = [];
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  let parsedCount = 0;

  const existing = new Set(options.existingFingerprints ?? []);
  const byIndex = new Map(entries.map((e) => [e.index, e]));

  for (const index of selectedIndices) {
    const entry = byIndex.get(index);
    if (!entry) {
      skippedInvalid += 1;
      errors.push(`Game ${index + 1}: missing from index`);
      continue;
    }
    const slice = extractPgnSlice(sourceText, entry);
    if (!slice) {
      skippedInvalid += 1;
      errors.push(`Game ${index + 1}: empty slice`);
      continue;
    }

    parsedCount += 1;
    let parsed;
    try {
      parsed = parsePgn(slice);
    } catch (e) {
      skippedInvalid += 1;
      const message =
        e instanceof PgnSyntaxError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Malformed PGN';
      errors.push(`Game ${index + 1}: ${message}`);
      continue;
    }

    const gameNode = parsed[0];
    if (!gameNode) {
      skippedInvalid += 1;
      errors.push(`Game ${index + 1}: no playable content`);
      continue;
    }

    const displayName = options.displayNamesByIndex?.[index];
    const result = buildImportedGameFromPgnGame(gameNode.headers, gameNode.root, {
      ...options,
      existingFingerprints: existing,
      rawPgn: slice,
    });

    if (result.game) {
      const named = displayName?.trim()
        ? { ...result.game, displayName: displayName.trim() }
        : result.game;
      imported.push(named);
      existing.add(named.fingerprint);
      continue;
    }
    if (result.error === 'duplicate') {
      skippedDuplicates += 1;
      continue;
    }
    skippedInvalid += 1;
    errors.push(`Game ${index + 1}: ${result.error ?? 'invalid'}`);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `Parsed ${parsedCount} games for import (selected ${selectedIndices.length})`,
    );
  }

  return {
    imported,
    skippedDuplicates,
    skippedInvalid,
    errors,
    parsedCount,
  };
}
