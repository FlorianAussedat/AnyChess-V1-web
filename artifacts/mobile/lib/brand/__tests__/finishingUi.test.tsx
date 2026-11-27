import assert from 'node:assert/strict';
import { register } from 'node:module';
import { describe, it } from 'node:test';
import React from 'react';
register('./finishingUiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { AppDialog } = await import('../../../components/ui/AppDialog.tsx');
const { DifficultySelector, DifficultyCard } =
  await import('../../../components/difficulty/DifficultySelector.tsx');
const { ModeCard } = await import('../../../components/home/ModeCard.tsx');
const { dimensions } = await import('./finishingNative.ts');
const { state } = await import('../../navigation/__tests__/uiRuntime.ts');
const { MAIN_MODE_CARD_META } = await import('../../app/mainModeCards.ts');
const { translate } = await import('../../i18n/messages.ts');
const { DesignTokens } = await import('../../../constants/designTokens.ts');
const style = (v: any): any => (Array.isArray(v) ? Object.assign({}, ...v.map(style)) : v || {});
describe('finishing UI', () => {
  for (const language of ['fr', 'en'] as const) {
    it(`keeps every difficulty selectable with translated labels and functional icons (${language})`, async () => {
      state.language = language;
      const chosen: string[] = [];
      let root: any;
      await act(async () => {
        root = create(<DifficultySelector value="expert" onChange={(id) => chosen.push(id)} />);
      });
      const buttons = root.root.findAllByType('Pressable');
      assert.equal(buttons.length, 4);
      for (const button of buttons) {
        assert.ok(
          button.props.accessibilityLabel &&
            !button.props.accessibilityLabel.startsWith('difficulty.'),
        );
        await act(async () => button.props.onPress());
      }
      assert.deepEqual(chosen, ['debutant', 'confirme', 'expert', 'grandMaitre']);
      assert.equal(buttons.filter((b: any) => b.props.accessibilityState.selected).length, 1);
      for (const icon of root.root.findAllByType('Image'))
        assert.ok(
          ['school-outline', 'book-outline', 'ribbon-outline', 'trophy-outline'].includes(
            icon.props.name,
          ),
        );
      await act(async () => root.unmount());
    });
    it(`keeps seven home destinations readable and actionable at small widths and large fonts (${language})`, async () => {
      for (const width of [320, 412])
        for (const fontScale of [1, 2]) {
          Object.assign(dimensions, { width, fontScale });
          for (const mode of MAIN_MODE_CARD_META) {
            let pressed = 0;
            let root: any;
            const title = translate(language, `modes.${mode.id}.title` as any);
            const description = translate(language, `modes.${mode.id}.description` as any);
            await act(async () => {
              root = create(
                <ModeCard
                  modeId={mode.id}
                  title={title}
                  description={description}
                  iconName={mode.iconName}
                  illustration={{ uri: 'bundled-official' }}
                  onPress={() => pressed++}
                />,
              );
            });
            const button = root.root.findByType('Pressable');
            assert.equal(button.props.accessibilityLabel, `${title}. ${description}`);
            await act(async () => button.props.onPress());
            assert.equal(pressed, 1);
            for (const text of root.root.findAllByType('Text'))
              assert.equal(text.props.numberOfLines, undefined);
            assert.equal(
              style(root.root.findAllByType('View')[0].props.style).flexDirection,
              width < 360 || fontScale > 1.3 ? 'column' : 'row',
            );
            const image = root.root.findAllByType('Image').find((i: any) => i.props.source);
            assert.equal(image.props.cachePolicy, 'memory-disk');
            await act(async () => root.unmount());
          }
        }
    });
  }
  it('exposes standalone difficulty cards as selected accessible buttons', async () => {
    let root: any;
    let changes = 0;
    await act(async () => {
      root = create(<DifficultyCard id="expert" selected onPress={() => changes++} />);
    });
    const button = root.root.findByType('Pressable');
    assert.equal(button.props.accessibilityRole, 'button');
    assert.equal(button.props.accessibilityState.selected, true);
    await act(async () => button.props.onPress());
    assert.equal(changes, 1);
    await act(async () => root.unmount());
  });
  it('keeps long destructive confirmations scrollable and cancellable via Android Back', async () => {
    Object.assign(dimensions, { width: 320, height: 480, fontScale: 2 });
    let cancelled = 0;
    let confirmed = 0;
    let root: any;
    await act(async () => {
      root = create(
        <AppDialog
          visible
          title={'Title '.repeat(20)}
          message={'Message '.repeat(200)}
          variant="destructive"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={() => cancelled++}
          onConfirm={() => confirmed++}
        />,
      );
    });
    const card = root.root
      .findAllByType('Animated.View')
      .find((v: any) => v.props.testID === 'app-dialog');
    assert.equal(style(card.props.style).maxHeight, 408);
    const scroll = root.root.findByType('ScrollView');
    assert.equal(scroll.findAllByType('Pressable').length, 2);
    const destructive = scroll
      .findAllByType('Pressable')
      .find((b: any) => b.props.testID === 'app-dialog-confirm');
    assert.equal(
      style(destructive.props.style({ pressed: false })).backgroundColor,
      DesignTokens.color.destructive,
    );
    await act(async () => root.root.findByType('Modal').props.onRequestClose());
    assert.equal(cancelled, 1);
    assert.equal(confirmed, 0);
    await act(async () => destructive.props.onPress());
    assert.equal(confirmed, 1);
    await act(async () => root.unmount());
  });
});

it('preserves a persisted session through Home quit cancellation, Android Back and resume', async () => {
  const { ResumeActivities } = await import('../../../components/home/ResumeActivities.tsx');
  const { __setActivitySessionsStorageForTests, upsertActivitySession, getActivitySession } =
    await import('../../activitySessions/ActivitySessionsStore.ts');
  const { MemoryKeyValueStorage } = await import('../../storage/KeyValueStorage.ts');
  const { getAppDialogRequest, resolveAppDialog, __resetAppDialogStoreForTests } =
    await import('../../ui/appDialogStore.ts');
  __setActivitySessionsStorageForTests(new MemoryKeyValueStorage());
  __resetAppDialogStoreForTests();
  state.language = 'fr';
  state.stack = ['/'];
  await upsertActivitySession({
    id: 'pr07',
    kind: 'classic',
    modeId: 'classic',
    noun: 'partie',
    title: 'Partie de démonstration',
    summary: '1. e4',
    route: '/classic?sessionId=pr07',
    updatedAt: 1,
    inProgress: true,
    payload: { history: ['e4'] },
  });
  let root: any;
  await act(async () => {
    root = create(<ResumeActivities />);
  });
  const quit = root.root
    .findAllByType('Pressable')
    .find((b: any) => b.props.testID === 'resume-activity-quit-pr07');
  assert.ok(style(quit.props.style({ pressed: false })).minHeight >= DesignTokens.minTouchTarget);
  await act(async () => quit.props.onPress());
  const request = getAppDialogRequest();
  assert.ok(request);
  assert.equal(request.variant, 'destructive');
  let dialog: any;
  await act(async () => {
    dialog = create(
      <AppDialog
        visible
        title={request.title}
        message={request.message}
        variant={request.variant}
        cancelLabel={request.cancelLabel}
        confirmLabel={request.confirmLabel}
        onCancel={() => resolveAppDialog('cancel')}
        onConfirm={() => resolveAppDialog('confirm')}
      />,
    );
  });
  await act(async () => dialog.root.findByType('Modal').props.onRequestClose());
  assert.equal(getAppDialogRequest(), null);
  assert.deepEqual(getActivitySession('pr07')?.payload, { history: ['e4'] });
  await act(async () =>
    root.root
      .findAllByType('Pressable')
      .find((b: any) => b.props.testID === 'resume-activity-resume-pr07')
      .props.onPress(),
  );
  assert.equal(state.stack.at(-1), '/classic?sessionId=pr07');
  assert.deepEqual(getActivitySession('pr07')?.payload, { history: ['e4'] });
  await act(async () => {
    dialog.unmount();
    root.unmount();
  });
});
