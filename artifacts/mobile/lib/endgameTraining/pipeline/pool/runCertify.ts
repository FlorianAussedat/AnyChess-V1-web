/**
 * Certify pending candidates via Syzygy (move −1 profile).
 */
import { loadCandidates, saveCandidates, loadCuration, saveCuration } from './io.ts';
import { certifyMoveMinusOne } from './certifyCandidate.ts';
import { PATHS } from './paths.ts';
import type { CurationDecision, PoolCandidate } from './types.ts';

export type CertifyRunOptions = {
  limit?: number;
  pauseMs?: number;
  autoAccept?: boolean;
  reviewer?: string;
  /** Re-attempt candidates rejected due to tablebase unknown/timeouts. */
  retryUnknown?: boolean;
};

export type CertifyRunReport = {
  processed: number;
  certified: number;
  rejected: number;
  autoAccepted: number;
  rejectionReasons: Record<string, number>;
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export async function runCertification(
  options: CertifyRunOptions = {},
): Promise<CertifyRunReport> {
  const file = loadCandidates(PATHS.candidates);
  const curation = loadCuration(PATHS.curation);
  const report: CertifyRunReport = {
    processed: 0,
    certified: 0,
    rejected: 0,
    autoAccepted: 0,
    rejectionReasons: {},
  };

  const limit = options.limit ?? Infinity;
  let processed = 0;

  const updated: PoolCandidate[] = [];

  for (const candidate of file.candidates) {
    if (candidate.pipelineStatus === 'certified') {
      updated.push(candidate);
      continue;
    }
    if (candidate.pipelineStatus === 'rejected') {
      if (
        options.retryUnknown &&
        candidate.rejectionReason?.includes('unknown')
      ) {
        // fall through to retry
      } else {
        updated.push(candidate);
        continue;
      }
    }
    if (processed >= limit) {
      updated.push(candidate);
      continue;
    }

    const errorMove = candidate.errorMoveUci;
    if (!errorMove) {
      updated.push({
        ...candidate,
        pipelineStatus: 'rejected',
        rejectionReason: 'missing-error-move',
      });
      bump(report.rejectionReasons, 'missing-error-move');
      report.rejected += 1;
      processed += 1;
      continue;
    }

    processed += 1;
    report.processed += 1;

    const result = await certifyMoveMinusOne(candidate, errorMove, {
      pauseMs: options.pauseMs ?? 100,
    });

    if (!result.ok) {
      updated.push({
        ...candidate,
        pipelineStatus: 'rejected',
        rejectionReason: result.reason,
      });
      bump(report.rejectionReasons, result.reason);
      report.rejected += 1;
      continue;
    }

    updated.push(result.candidate);
    report.certified += 1;

    if (options.autoAccept) {
      const existing = curation.decisions[result.candidate.positionId];
      if (!existing || existing.status === 'rejected') {
        const decision: CurationDecision = {
          positionId: result.candidate.positionId,
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
          reviewer: options.reviewer ?? 'pipeline-auto',
          notes: 'Auto-accepted after Syzygy move−1 certification',
        };
        curation.decisions[result.candidate.positionId] = decision;
        report.autoAccepted += 1;
      }
    }
  }

  saveCandidates(PATHS.candidates, { ...file, candidates: updated });
  if (options.autoAccept) {
    saveCuration(PATHS.curation, curation);
  }

  return report;
}
