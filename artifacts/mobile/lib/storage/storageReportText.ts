import type { StorageReport } from './storageDiagnostics.ts';
import type { MessageKey } from '../i18n/messages.ts';
const categories: MessageKey[] = [
  'storage.openings',
  'storage.games',
  'storage.translations',
  'storage.queue',
  'storage.mastery',
  'storage.preferences',
  'storage.profile',
  'storage.openingQuiz',
  'storage.moveNaming',
  'storage.playMove',
  'storage.blind',
  'storage.puzzleHistory',
  'storage.puzzleStreaks',
  'storage.cultureHistory',
  'storage.cultureFeedback',
  'storage.endgames',
  'storage.theoretical',
  'storage.continueLine',
];
type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;
/** Fixed labels/numeric aggregates only. Never format raw root keys or contents. */
export function storageReportText(report: StorageReport, t: Translate): string {
  const size = (bytes: number) =>
    t('storage.size', { value: Math.ceil(bytes / 1024) });
  const lines = [
    t('storage.total', { size: size(report.measuredPhysicalValueBytes) }),
    t('storage.shared', { size: size(report.blocks.sharedPoolBytes ?? 0) }),
    t('storage.backups', {
      count: report.snapshots.backups,
      size: size(report.snapshots.backupPhysicalBytes),
    }),
    t('storage.workspaces', {
      count: report.snapshots.workspaces,
      size: size(report.snapshots.workspacePhysicalBytes),
    }),
    t('storage.blocks', {
      count: report.blocks.count,
      referenced: report.blocks.referencedCount,
      candidates: report.blocks.unreferencedCandidateCount,
    }),
    t('storage.integrity', {
      unreadable: report.unreadableRows,
      invalid: report.snapshots.invalidOrUnreadableRoots,
    }),
    '',
    t('storage.categories'),
    ...report.categories.map(
      (row, i) =>
        `${t(categories[i])} : ${size(row.bytes)}${row.unreadable ? ' — ' + t('storage.unreadable') : ''}`,
    ),
    '',
    t('storage.avatars', { size: size(report.otherCopies.avatarBytes) }),
    t('storage.guest', { size: size(report.otherCopies.guestVaultBytes) }),
  ];
  if(!report.blocks.referencesComplete)lines.push('',t('storage.incomplete'));
  const failure = report.lastFailure;
  lines.push(
    '',
    failure
      ? t('storage.failure', {
          stage: failure.stage,
          kind: failure.kind,
          category:
            failure.category === null
              ? t('storage.recovery')
              : t(categories[failure.category]),
          size: size(failure.requestedBytes),
        })
      : t('storage.noFailure'),
  );
  lines.push('', t('storage.limits'));
  return lines.join('\n');
}
