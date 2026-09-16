/**
 * HTML review artifact for pool curation.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadCandidates, loadCuration } from './io.ts';
import { PATHS } from './paths.ts';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function writeReviewHtml(outputPath: string = PATHS.reviewHtml): void {
  const candidates = loadCandidates(PATHS.candidates);
  const curation = loadCuration(PATHS.curation);

  const rows = candidates.candidates
    .map((c) => {
      const decision = curation.decisions[c.positionId];
      const status = decision?.status ?? c.pipelineStatus;
      const fenEnc = encodeURIComponent(c.initialFen.replace(/ /g, '_'));
      return `<tr>
        <td><a href="https://lichess.org/analysis/standard/${fenEnc}">${escapeHtml(c.positionId)}</a></td>
        <td><code>${escapeHtml(c.initialFen)}</code></td>
        <td>${escapeHtml(c.playerColor)}</td>
        <td>${c.source.rating ?? '—'}</td>
        <td>${c.source.popularity ?? '—'}</td>
        <td>${escapeHtml((c.source.themes ?? []).join(', '))}</td>
        <td>${c.quality.pieceCount}</td>
        <td>${c.originCriticalMove?.verdictBefore ?? '—'}</td>
        <td>${escapeHtml(c.originCriticalMove?.san ?? c.errorMoveUci ?? '—')}</td>
        <td>${c.originCriticalMove?.verdictAfter ?? '—'}</td>
        <td>${c.quality.safeMoveCount ?? '—'}</td>
        <td>${c.quality.pressureCp ?? '—'}</td>
        <td>${escapeHtml(c.family)}</td>
        <td>${escapeHtml(c.rejectionReason ?? '')}</td>
        <td>${escapeHtml(status)}</td>
      </tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Défends la nulle — revue pool</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
    th { background: #f0f0f0; position: sticky; top: 0; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <h1>Défends la nulle — revue des candidates</h1>
  <p>Généré ${escapeHtml(new Date().toISOString())} — ${candidates.candidates.length} candidates</p>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>FEN</th><th>Joueur</th><th>Rating</th><th>Pop</th><th>Tags</th>
        <th>Pièces</th><th>Avant</th><th>Coup fautif</th><th>Après</th>
        <th>Cops sûrs</th><th>Pression</th><th>Famille</th><th>Rejet</th><th>Statut</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, 'utf8');
}
