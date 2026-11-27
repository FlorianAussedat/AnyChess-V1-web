import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { register, createRequire } from 'node:module';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MAIN_ROUTES, backFallback, backToPrevious, navigateMainTab, resolveActiveTab } from '../routes.ts';

register('./uiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { NavigationShell } = await import('../../../components/navigation/NavigationShell.tsx');
const { GeneralMenu } = await import('../../../components/navigation/GeneralMenu.tsx');
const { ScreenHeader } = await import('../../../components/ScreenHeader.tsx');
const { useActiveSessionBack } = await import('../../../hooks/useActiveSessionBack.ts');
const { state, router, removalListeners } = await import('./uiRuntime.ts');
const { useWebNavigationGuard } = await import('../../../hooks/useWebNavigationGuard.ts');
const { BackHandler } = await import('../../theoreticalEndgame/__tests__/uiShims/reactNative.ts');
const { __resetAppDialogStoreForTests, getAppDialogRequest, resolveAppDialog } =
  await import('../../ui/appDialogStore.ts');
const { __setActivitySessionsStorageForTests, upsertActivitySession, getActivitySession } =
  await import('../../activitySessions/ActivitySessionsStore.ts');
const { MemoryKeyValueStorage } = await import('../../storage/KeyValueStorage.ts');

const mobile = new URL('../../../', import.meta.url);
function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path) : /\.tsx$/.test(path) ? [path] : [];
  });
}
// Enumerate the real app directory, including future routes: only four main screens qualify.
const app = new URL('app/', mobile).pathname;
const paths = routeFiles(app)
  .map(file => file.slice(app.length).replace(/\.tsx$/, '').replace(/\/index$/, ''))
  .filter(path => !path.endsWith('_layout') && !path.startsWith('+'))
  .map(path => path === 'index' ? '/' : `/${path}`);

beforeEach(() => {
  Object.assign(state, { path: '/', stack: ['/'], language: 'fr', safeBottom: 24,
    user: null, sessionReady: true, platform: 'android' });
  BackHandler.listeners.clear();
  removalListeners.clear();
  __resetAppDialogStoreForTests();
  __setActivitySessionsStorageForTests(new MemoryKeyValueStorage());
});

describe('main navigation shell and tab history', () => {
  it('keeps a bounded stack with the actual React Navigation StackRouter', async () => {
    const require = createRequire(import.meta.url);
    const expoRequire = createRequire(require.resolve('expo-router'));
    const { StackRouter, StackActions } = await import(expoRequire.resolve('@react-navigation/routers'));
    const stackRouter = StackRouter({ initialRouteName: 'index' });
    const config = { routeNames: ['index', 'records', 'utilisateur', 'parametres', 'openings'],
      routeParamList: {}, routeGetIdList: {} };
    let stack = stackRouter.getInitialState(config);
    const navigation = {
      replace(path: string) {
        stack = stackRouter.getStateForAction(stack,
          StackActions.replace(path === '/' ? 'index' : path.slice(1)), config)!;
      },
    };
    for (let index = 0; index < 20; index++) {
      for (const target of MAIN_ROUTES) {
        const current = stack.routes[stack.index].name;
        navigateMainTab(navigation, current === 'index' ? '/' : `/${current}`, target);
        assert.equal(stack.routes.length, 1);
        assert.equal(stack.routes[0].name, target === '/' ? 'index' : target.slice(1));
      }
    }
  });

  it('leaves stored PGN, preferences, and suspended sessions untouched while navigating', async () => {
    const storage = new MemoryKeyValueStorage();
    const values = { 'pgn-library': '[Event "Saved game"]\n1. e4 e5',
      preferences: '{"language":"en"}', 'suspended-session': '{"history":["e4"]}' };
    for (const [key, value] of Object.entries(values)) await storage.setItem(key, value);
    __setActivitySessionsStorageForTests(storage);
    await upsertActivitySession({ id: 'suspended', kind: 'classic', modeId: 'classic',
      noun: 'partie', title: 'Saved session', summary: 'e4', route: '/classic', updatedAt: 1,
      inProgress: true, payload: { history: ['e4'] } });
    const keys = [...await storage.getAllKeys()].sort();
    const before = await Promise.all(keys.map(key => storage.getItem(key)));
    for (const target of MAIN_ROUTES) navigateMainTab(router, state.path, target);
    backToPrevious(router, state.path);
    assert.deepEqual([...await storage.getAllKeys()].sort(), keys);
    assert.deepEqual(await Promise.all(keys.map(key => storage.getItem(key))), before);
    assert.deepEqual(getActivitySession('suspended')?.payload, { history: ['e4'] });
  });

  it('renders the bar only on the four main screens and never reserves space elsewhere', async () => {
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<NavigationShell introDone><span /></NavigationShell>); });
    for (const path of [...paths, '/records/details', '/utilisateur/details', '/parametres/details']) {
      state.path = path;
      await act(async () => { view.update(<NavigationShell introDone><span /></NavigationShell>); });
      assert.equal(view.root.findAllByProps({ testID: 'bottom-navigation' }).length > 0,
        MAIN_ROUTES.includes(path as never), path);
      const content = view.root.findByProps({ testID: 'navigation-content' });
      assert.deepEqual(content.props.style, { flex: 1 }, path);
    }
    await act(async () => { view.unmount(); });
  });

  it('hides navigation during the intro and places the safe-area bar in normal flow', async () => {
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<NavigationShell introDone={false}><span /></NavigationShell>); });
    assert.equal(view.root.findAllByProps({ testID: 'bottom-navigation' }).length, 0);
    await act(async () => { view.update(<NavigationShell introDone><span /></NavigationShell>); });
    const bar = view.root.findByProps({ testID: 'bottom-navigation' });
    assert.equal(bar.parent?.props.style[1].paddingBottom, 24);
    assert.equal(bar.parent?.props.style[0].position, undefined);
    await act(async () => { view.unmount(); });
  });

  it('repeated tab presses and active presses keep one peer, preserving earlier history', async () => {
    state.stack = ['/openings', '/'];
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<NavigationShell introDone><span /></NavigationShell>); });
    for (let index = 0; index < 12; index++) {
      for (const [id, path] of [['records', '/records'], ['utilisateur', '/utilisateur'],
        ['parametres', '/parametres'], ['home', '/']]) {
        await act(async () => {
          view.root.findByProps({ testID: `nav-${id}` }).props.onPress();
          view.update(<NavigationShell introDone><span /></NavigationShell>);
        });
        assert.equal(state.path, path);
        assert.deepEqual(state.stack, ['/openings', path]);
        const tab = view.root.findAllByProps({ testID: `nav-${id}` }).find(node => node.props.accessibilityRole === 'tab')!;
        assert.deepEqual(tab.props.accessibilityState, { selected: true });
        await act(async () => { tab.props.onPress(); });
        assert.equal(state.stack.length, 2);
      }
    }
    await act(async () => { view.unmount(); });
  });
});

describe('back history, Android, and existing protections', () => {
  it('browser route removal preserves an activity on cancel and allows leaving only after confirm', async () => {
    state.platform = 'web';
    await upsertActivitySession({ id: 'web-session', kind: 'classic', modeId: 'classic',
      noun: 'partie', title: 'Game', summary: 'e4', route: '/classic', updatedAt: 1,
      inProgress: true, payload: { history: ['e4'] } });
    let left = false;
    function Guarded() {
      useActiveSessionBack({ sessionActive: true, kind: 'partie', activityId: 'web-session',
        onLeave: () => { left = true; }, onNavigateBack: () => {} });
      return null;
    }
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<Guarded />); });
    let blocked = 0;
    const attempt = () => { for (const listener of removalListeners) listener({ preventDefault: () => { blocked++; } }); };
    attempt();
    assert.equal(blocked, 1);
    resolveAppDialog('cancel');
    assert.deepEqual(getActivitySession('web-session')?.payload, { history: ['e4'] });
    assert.equal(left, false);
    attempt(); resolveAppDialog('confirm');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(left, true);
    assert.equal(getActivitySession('web-session'), null);
    attempt(); // The confirmed leave must not recursively prompt again.
    assert.equal(blocked, 2);
    assert.equal(getAppDialogRequest(), null);
    await act(async () => { view.unmount(); });
    assert.equal(removalListeners.size, 0);
  });

  it('browser editor guard respects save/discard and resets for a new edit', async () => {
    state.platform = 'web';
    let prompted = 0;
    let allow!: () => void;
    function Editor({ dirty }: { dirty: boolean }) {
      allow = useWebNavigationGuard(dirty, () => { prompted++; });
      return null;
    }
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<Editor dirty />); });
    let blocked = 0;
    const attempt = () => { for (const listener of removalListeners) listener({ preventDefault: () => { blocked++; } }); };
    attempt(); assert.equal(prompted, 1); assert.equal(blocked, 1);
    allow(); attempt(); assert.equal(blocked, 1);
    await act(async () => { view.update(<Editor dirty={false} />); });
    await act(async () => { view.update(<Editor dirty />); });
    attempt(); assert.equal(prompted, 2); assert.equal(blocked, 2);
    await act(async () => { view.unmount(); });
  });

  it('default header back and Android use the route fallback when opened directly', async () => {
    state.path = '/parties/analyzer'; state.stack = [state.path];
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<ScreenHeader title="Analyzer" />); });
    await act(async () => { view.root.findByProps({ testID: 'back-btn' }).props.onPress(); });
    assert.equal(state.path, '/parties');
    state.path = '/openings/annotate'; state.stack = [state.path];
    await act(async () => { view.update(<ScreenHeader title="Editor" />); });
    [...BackHandler.listeners].at(-1)!();
    assert.equal(state.path, '/openings/manage');
    await act(async () => { view.unmount(); });
  });

  it('returns through several nested screens and uses a coherent direct-link fallback', () => {
    state.stack = ['/', '/openings', '/openings/manage', '/openings/annotate', '/parties/analyzer'];
    for (const expected of ['/openings/annotate', '/openings/manage', '/openings', '/']) {
      backToPrevious(router, state.stack.at(-1)!);
      assert.equal(state.path, expected);
    }
    for (const [path, target] of [
      ['/parties/analyzer', '/parties'], ['/openings/annotate', '/openings/manage'],
      ['/openings/folder-123', '/openings/learn'], ['/quiz-ouverture/culture', '/quiz-ouverture'],
      ['/puzzles/defends-nulle-history', '/puzzles/defends-nulle'],
      ['/puzzles/finales-theoriques-play', '/puzzles/finales-theoriques'],
      ['/creer-compte', '/utilisateur'], ['/parametres', '/'],
    ]) {
      state.stack = [path];
      backToPrevious(router, path);
      assert.equal(state.path, target);
      assert.notEqual(backFallback(path), path);
    }
    assert.equal(resolveActiveTab('/profil'), null);
  });

  it('Android and the header call the same editor callback, clean up, and use its latest state', async () => {
    let dirty = true;
    let prompted = 0;
    let left = 0;
    const requestLeave = () => { if (dirty) prompted++; else left++; };
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<ScreenHeader onBack={requestLeave} title="Editor" />); });
    await act(async () => { view.root.findByProps({ testID: 'back-btn' }).props.onPress(); });
    assert.equal(prompted, 1);
    assert.equal([...BackHandler.listeners].at(-1)!(), true);
    assert.equal(prompted, 2);
    assert.equal(left, 0);
    dirty = false;
    [...BackHandler.listeners].at(-1)!();
    assert.equal(left, 1);
    await act(async () => { view.unmount(); });
    assert.equal(BackHandler.listeners.size, 0);
  });

  for (const kind of ['partie', 'exercice'] as const) {
    it(`keeps ${kind} sessions on cancel; confirms deletion before leaving via either back control`, async () => {
      await upsertActivitySession({ id: 'nav-session', kind: 'classic', modeId: 'classic',
        noun: 'partie', title: 'Session', summary: 'e4', route: '/classic', updatedAt: 1,
        inProgress: true, payload: { history: ['e4'] } });
      let left = false;
      function Guarded() {
        const back = useActiveSessionBack({ sessionActive: true, kind, activityId: 'nav-session',
          onLeave: () => { left = true; }, onNavigateBack: () => { throw new Error('bypassed guard'); },
          captureHardwareBack: true });
        return <ScreenHeader onBack={back} title="Session" />;
      }
      let view!: ReturnType<typeof create>;
      await act(async () => { view = create(<Guarded />); });
      await act(async () => { view.root.findByProps({ testID: 'back-btn' }).props.onPress(); });
      assert.ok(getAppDialogRequest());
      resolveAppDialog('cancel');
      assert.deepEqual(getActivitySession('nav-session')?.payload, { history: ['e4'] });
      assert.equal(left, false);
      [...BackHandler.listeners].at(-1)!();
      assert.ok(getAppDialogRequest());
      resolveAppDialog('confirm');
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(getActivitySession('nav-session'), null);
      assert.equal(left, true);
      await act(async () => { view.unmount(); });
    });
  }
});

describe('general menu and translations', () => {
  for (const language of ['fr', 'en'] as const) {
    for (const connected of [false, true]) {
      it(`${language}: exposes the existing account and settings for ${connected ? 'members' : 'guests'}`, async () => {
        state.language = language;
        state.user = connected ? { id: 'mock-user' } : null;
        let view!: ReturnType<typeof create>;
        await act(async () => { view = create(<GeneralMenu />); });
        await act(async () => { view.root.findByProps({ testID: 'general-menu' }).props.onPress(); });
        const request = getAppDialogRequest()!;
        assert.ok(request.title.length > 0);
        const account = request.actions!.find(action => action.testID === 'general-menu-account')!;
        assert.match(account.label, connected ? /compte|account/ : /Connexion|Sign in/);
        account.onPress();
        assert.equal(state.path, '/utilisateur');
        request.actions!.find(action => action.testID === 'general-menu-settings')!.onPress();
        assert.equal(state.path, '/parametres');
        assert.equal(state.stack.length, 1);
        await act(async () => { view.unmount(); });
      });
    }
  }
  it('keeps an explicit existing account section on both user screen branches', () => {
    const source = readFileSync(new URL('app/utilisateur.tsx', mobile), 'utf8');
    assert.equal(source.match(/<CloudAccountSection/g)?.length, 2);
    assert.equal(source.match(/<GeneralMenu/g)?.length, 2);
  });
});
