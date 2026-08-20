/**
 * Offline Lichess pipeline — parse, apply first move, reject KvK, dedupe.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyUci,
  loadLichessCsvSync,
  parseLichessPuzzleRow,
  toPipelineFields,
} from '../lichessCsv.ts';
import { validateStartFen } from '../validateCandidate.ts';
import { FenDedupeSet, fenSignature } from '../qualityFilters.ts';
import { runPipeline } from '../runPipeline.ts';
import type { PipelineAnalyzer } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '../__fixtures__/sample-lichess.csv');

describe('lichessCsv', () => {
  it('parses puzzle rows and applies the first (error) move', () => {
    const rows = loadLichessCsvSync(fixture);
    assert.ok(rows.length >= 4);
    const syn1 = rows.find((r) => r.puzzleId === 'SYN001');
    assert.ok(syn1);
    assert.equal(syn1!.fen, '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1');
    assert.equal(syn1!.moves[0], 'd6e7');

    const fields = toPipelineFields(syn1!);
    assert.ok(fields);
    assert.equal(fields!.defender, 'black');
    assert.equal(fields!.errorMove, 'd6e7');
    const after = applyUci(syn1!.fen, 'd6e7');
    assert.ok(after);
    assert.equal(fields!.afterErrorFen, after);
    // After Kd6-e7, white to move
    assert.match(after!, / w /);
  });

  it('parseLichessPuzzleRow maps official columns', () => {
    const headers = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'Themes'];
    const row = parseLichessPuzzleRow(headers, [
      'ABC12',
      '8/8/8/4k3/4P3/4K3/8/8 b - - 0 1',
      'e5f6 e3f4',
      '1400',
      'endgame pawnEndgame',
    ]);
    assert.ok(row);
    assert.equal(row!.puzzleId, 'ABC12');
    assert.equal(row!.rating, 1400);
    assert.deepEqual(row!.themes, ['endgame', 'pawnEndgame']);
  });
});

describe('validateCandidate', () => {
  it('rejects K vs K / insufficient material', () => {
    const kvk = validateStartFen('4k3/8/4K3/8/8/8/8/8 w - - 0 1');
    assert.equal(kvk.ok, false);
    if (!kvk.ok) {
      assert.ok(
        kvk.reason === 'k-vs-k' || kvk.reason === 'insufficient-material',
      );
    }
  });

  it('accepts a drawn-looking KP ending', () => {
    const ok = validateStartFen('8/8/3k4/3P4/3K4/8/8/8 b - - 0 1');
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.family, 'pawn');
      assert.match(ok.materialSignature, /KP/);
    }
  });
});

describe('dedupe', () => {
  it('dedupes by fen signature (normalize castling/ep clocks)', () => {
    const set = new FenDedupeSet();
    assert.equal(set.tryAdd('8/8/3k4/3P4/3K4/8/8/8 b - - 0 1'), true);
    assert.equal(set.tryAdd('8/8/3k4/3P4/3K4/8/8/8 b - - 5 12'), false);
    assert.equal(
      fenSignature('8/8/3k4/3P4/3K4/8/8/8 b - - 0 1'),
      fenSignature('8/8/3k4/3P4/3K4/8/8/8 b - - 9 99'),
    );
  });
});

describe('runPipeline', () => {
  it('runs on the sample fixture with a mock analyzer', async () => {
    const analyzer: PipelineAnalyzer = {
      engineVersion: 'mock-1',
      async evaluate(fen, _defender) {
        // Near-draw on start FENs from fixture; lost after error for SYN001
        if (fen.includes('3k4/3P4/3K4')) {
          // start
          return { scoreCp: 0, mateIn: null, defensiveMoveCount: 4 };
        }
        return { scoreCp: -320, mateIn: null, defensiveMoveCount: 4 };
      },
    };

    const { positions, report } = await runPipeline({
      csvPath: fixture,
      analyzer,
      ids: ['SYN001', 'SYN002', 'SYN005', 'SYN006'],
    });

    assert.equal(report.engineVersion, 'mock-1');
    assert.ok(report.candidatesAnalyzed >= 1);
    // SYN005 is K vs K → rejected
    assert.ok((report.rejectionReasons['k-vs-k'] ?? 0) + (report.rejectionReasons['insufficient-material'] ?? 0) >= 1);
    // At least one accepted KP ending
    assert.ok(positions.length >= 1);
    assert.ok(positions.every((p) => p.id.startsWith('LICHESS-')));
  });

  it('removes duplicate start FENs', async () => {
    const { report } = await runPipeline({
      csvPath: fixture,
      ids: ['SYN001', 'SYN004'],
    });
    assert.ok(report.duplicatesRemoved >= 1);
    assert.ok((report.rejectionReasons['duplicate-fen'] ?? 0) >= 1);
  });
});
