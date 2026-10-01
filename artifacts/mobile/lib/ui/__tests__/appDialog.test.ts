import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  __resetAppDialogStoreForTests,
  getAppDialogRequest,
  presentAppDialog,
  resolveAppDialog,
} from '../appDialogStore.ts';
import {
  buildDialogActions,
  layoutDialogActions,
  shouldUseActionRow,
} from '../appDialogActions.ts';
import { confirmAction } from '../../openings/confirmAction.ts';
import { confirmActiveSessionBack } from '../../activitySessions/confirmDiscard.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('app dialog store', () => {
  beforeEach(() => {
    __resetAppDialogStoreForTests();
  });

  it('shows title and empty message for Quitter la partie ?', () => {
    let confirmed = 0;
    let cancelled = 0;
    presentAppDialog({
      title: 'Quitter la partie ?',
      message: '',
      cancelLabel: 'Annuler',
      confirmLabel: 'Quitter',
      variant: 'confirm',
      onConfirm: () => {
        confirmed += 1;
      },
      onCancel: () => {
        cancelled += 1;
      },
    });
    const queued = getAppDialogRequest();
    assert.equal(queued?.title, 'Quitter la partie ?');
    assert.equal(queued?.confirmLabel, 'Quitter');
    assert.equal(queued?.cancelLabel, 'Annuler');
    assert.equal(queued?.message, '');
    resolveAppDialog('cancel');
    assert.equal(cancelled, 1);
    assert.equal(confirmed, 0);
    assert.equal(getAppDialogRequest(), null);
  });

  it('shows message and confirm runs only onConfirm', () => {
    let confirmed = false;
    presentAppDialog({
      title: 'Abandonner l’exercice ?',
      message: 'Votre progression actuelle sera perdue.',
      cancelLabel: 'Annuler',
      confirmLabel: 'Abandonner',
      variant: 'destructive',
      onConfirm: () => {
        confirmed = true;
      },
    });
    const queued = getAppDialogRequest();
    assert.equal(queued?.message, 'Votre progression actuelle sera perdue.');
    resolveAppDialog('confirm');
    assert.equal(confirmed, true);
    assert.equal(getAppDialogRequest(), null);
  });

  it('Android back maps to cancel and does not confirm', () => {
    let confirmed = 0;
    let cancelled = 0;
    presentAppDialog({
      title: 'Quitter la partie ?',
      message: '',
      cancelLabel: 'Annuler',
      confirmLabel: 'Quitter',
      variant: 'confirm',
      onConfirm: () => {
        confirmed += 1;
      },
      onCancel: () => {
        cancelled += 1;
      },
    });
    resolveAppDialog('cancel');
    assert.equal(cancelled, 1);
    assert.equal(confirmed, 0);
  });

  it('confirmAction presents a dialog without native Alert', () => {
    confirmAction('Quitter la partie ?', '', () => {});
    const queued = getAppDialogRequest();
    assert.equal(queued?.title, 'Quitter la partie ?');
    assert.equal(queued?.confirmLabel, 'Confirmer');
    assert.equal(queued?.cancelLabel, 'Annuler');
  });

  it('session back confirm keeps an empty message (title only)', () => {
    confirmActiveSessionBack('partie', 'game-1', () => {});
    const queued = getAppDialogRequest();
    assert.equal(queued?.title, 'Quitter la partie ?');
    assert.equal(queued?.message, '');
    assert.equal(queued?.confirmLabel, 'Quitter');
    assert.equal(queued?.cancelLabel, 'Annuler');
  });

  it('queues a second present instead of replacing the waiting request', () => {
    let first = 0;
    let second = 0;
    presentAppDialog({
      title: 'First',
      message: '',
      variant: 'confirm',
      onConfirm: () => {
        first += 1;
      },
    });
    presentAppDialog({
      title: 'Second',
      message: '',
      variant: 'confirm',
      onConfirm: () => {
        second += 1;
      },
    });
    assert.equal(getAppDialogRequest()?.title, 'First');
    resolveAppDialog('confirm');
    assert.equal(first, 1);
    assert.equal(getAppDialogRequest()?.title, 'Second');
    resolveAppDialog('cancel');
    assert.equal(second, 0);
    assert.equal(getAppDialogRequest(), null);
  });
});

describe('dialog action layout', () => {
  it('places Annuler left and Quitter right', () => {
    const actions = buildDialogActions({
      cancelLabel: 'Annuler',
      confirmLabel: 'Quitter',
      onCancel: () => {},
      onConfirm: () => {},
    });
    const row = layoutDialogActions(actions, true);
    assert.equal(row[0]?.label, 'Annuler');
    assert.equal(row[0]?.variant, 'secondary');
    assert.equal(row[1]?.label, 'Quitter');
    assert.equal(row[1]?.variant, 'primary');
  });

  it('omits the message action when only a confirm button is provided', () => {
    const actions = buildDialogActions({
      confirmLabel: 'OK',
      onConfirm: () => {},
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.label, 'OK');
    assert.equal(actions[0]?.testID, 'app-dialog-confirm');
  });

  it('dialog without cancel still builds a single confirm action', () => {
    const actions = buildDialogActions({
      confirmLabel: 'Compris',
      onConfirm: () => {},
    });
    assert.deepEqual(
      actions.map((a) => a.label),
      ['Compris'],
    );
  });

  it('stacks two actions on very narrow screens', () => {
    assert.equal(shouldUseActionRow(2, 390), true);
    assert.equal(shouldUseActionRow(2, 320), false);
    assert.equal(shouldUseActionRow(1, 390), false);
    assert.equal(shouldUseActionRow(3, 390), false);
  });
});

describe('native Alert.alert is gone from confirmation paths', () => {
  it('confirmAction no longer imports Alert', () => {
    const src = stripComments(read('lib/openings/confirmAction.ts'));
    assert.doesNotMatch(src, /Alert\.alert/);
    assert.doesNotMatch(src, /window\.confirm/);
    assert.match(src, /presentAppDialog/);
  });

  it('root layout mounts AppDialogHost above the app', () => {
    const layout = read('app/_layout.tsx');
    const host = read('components/ui/AppDialogHost.tsx');
    assert.match(layout, /AppDialogHost/);
    assert.match(host, /useSyncExternalStore/);
  });

  it('AppDialog uses AnyChess tokens, AppButton, and Android back = cancel', () => {
    const dialog = read('components/ui/AppDialog.tsx');
    const actions = read('lib/ui/appDialogActions.ts');
    assert.match(dialog, /DesignTokens/);
    assert.match(dialog, /AppButton/);
    assert.match(dialog, /onRequestClose=\{handleRequestClose\}/);
    assert.match(dialog, /onCancel\?\.\(\)/);
    assert.match(actions, /app-dialog-cancel/);
    assert.match(actions, /app-dialog-confirm/);
    assert.match(dialog, /app-dialog-title/);
    assert.match(dialog, /dismissOnBackdrop = false/);
    assert.match(dialog, /colors\.card/);
    assert.match(dialog, /colors\.border/);
    assert.match(dialog, /variant=\{kind\}/);
    assert.doesNotMatch(dialog, /Alert\.alert/);
  });

  it('confirmation screens call confirmAction instead of Alert.alert', () => {
    const files = [
      'app/parties/index.tsx',
      'app/utilisateur.tsx',
      'app/parametres.tsx',
      'app/records.tsx',
      'app/visualisation/records.tsx',
      'app/puzzles/records.tsx',
      'components/review/FinishGameOverlay.tsx',
      'lib/activitySessions/confirmDiscard.ts',
      'app/openings/manage.tsx',
    ];
    for (const rel of files) {
      const src = read(rel);
      assert.doesNotMatch(src, /Alert\.alert/, rel);
      assert.match(src, /confirmAction/, rel);
    }
  });

  it('choice / retry confirm modals reuse AppDialog', () => {
    const choice = read('components/openings/OpeningChoiceModal.tsx');
    const retry = read('components/exercise/TryAgainPromptModal.tsx');
    assert.match(choice, /from '@\/components\/ui\/AppDialog'/);
    assert.doesNotMatch(choice, /from 'react-native'/);
    assert.match(retry, /from '@\/components\/ui\/AppDialog'/);
    assert.match(retry, /cancelLabel="Non"/);
    assert.match(retry, /confirmLabel="Oui"/);
  });

  it('no Alert.alert( or window.confirm( remains in mobile source', () => {
    const files = walkTsFiles(mobileRoot);
    const offenders: string[] = [];
    for (const full of files) {
      if (full.includes(`${join('lib', 'ui', '__tests__')}`)) continue;
      const stripped = stripComments(readFileSync(full, 'utf8'));
      if (/Alert\.alert\s*\(/.test(stripped) || /window\.confirm\s*\(/.test(stripped)) {
        offenders.push(full.slice(mobileRoot.length + 1));
      }
    }
    assert.deepEqual(offenders, []);
  });
});
