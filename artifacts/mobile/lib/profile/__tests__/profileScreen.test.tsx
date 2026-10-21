import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { register } from 'node:module';
import React from 'react';
import { ProfileStore } from '../ProfileStore.ts';

register('./profileUiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { state, defaultKeyValueStorage: storage } =
  await import('./profileUiRuntime.ts');
const { default: UserScreen } = await import('../../../app/utilisateur.tsx');
beforeEach(async () => {
  await storage.multiRemove([...(await storage.getAllKeys())]);
  state.store = new ProfileStore(storage);
  await state.store.update({
    username: 'Ada',
    rapidRangeId: '1600-1799',
    blitzRangeId: '1200-1399',
    bulletRangeId: '800-999',
    chessYears: 7,
  });
  state.user = { id: 'account-a', email: 'ada@example.com' };
  state.ready = true;
  state.language = 'fr';
});
function node(view: ReturnType<typeof create>, testID: string) {
  return view.root.findByProps({ testID });
}

describe('personal profile screen and existing account access', () => {
  it('orders identity, chess information, data links, and the existing account without duplicating the username', async () => {
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(<UserScreen />);
    });
    for (const id of [
      'profil-summary',
      'profil-row-username',
      'profil-row-rapid',
      'profil-row-blitz',
      'profil-row-bullet',
      'profil-row-years',
      'profil-row-repertoires',
      'profil-row-records',
      'profil-account-section',
      'general-menu',
    ])
      assert.ok(node(view, id));
    assert.equal(node(view, 'profil-row-rapid').props.value, '1600–1799');
    const order: string[] = [];
    const walk = (value: ReturnType<typeof create>['root']) => {
      if (value.props.testID && !order.includes(value.props.testID))
        order.push(value.props.testID);
      for (const child of value.children)
        if (typeof child !== 'string') walk(child);
    };
    walk(view.root);
    assert.ok(
      order.indexOf('profil-summary') < order.indexOf('profil-row-rapid'),
    );
    assert.ok(
      order.indexOf('profil-row-years') <
        order.indexOf('profil-row-repertoires'),
    );
    assert.ok(
      order.indexOf('profil-row-records') <
        order.indexOf('profil-account-section'),
    );
    await act(async () => {
      node(view, 'profil-account-section').props.onLayout({
        nativeEvent: { layout: { y: 640 } },
      });
      node(view, 'profil-account-shortcut').props.onPress();
    });
    assert.deepEqual(state.scroll, { y: 640, animated: true });
    assert.ok(node(view, 'existing-account-widget'));
    await act(async () => {
      view.unmount();
    });
  });

  it('edits and persists the username, each independent rating, and years of practice', async () => {
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(<UserScreen />);
    });
    await act(async () => {
      node(view, 'profil-row-username').props.onPress();
    });
    await act(async () => {
      node(view, 'profil-username-input').props.onChangeText('  Grace  ');
    });
    await act(async () => {
      await node(view, 'profil-username-save').props.onPress();
    });
    for (const [kind, rating] of [
      ['rapid', '2200+'],
      ['blitz', '1800-1999'],
      ['bullet', '1600-1799'],
    ]) {
      await act(async () => {
        node(view, `profil-row-${kind}`).props.onPress();
      });
      await act(async () => {
        node(view, `profil-level-${rating}`).props.onPress();
      });
    }
    await act(async () => {
      node(view, 'profil-row-years').props.onPress();
    });
    await act(async () => {
      node(view, 'profil-years-12').props.onPress();
    });
    const restored = await new ProfileStore(storage).ensureLoaded();
    assert.equal(restored.username, 'Grace');
    assert.equal(restored.rapidRangeId, '2200+');
    assert.equal(restored.blitzRangeId, '1800-1999');
    assert.equal(restored.bulletRangeId, '1600-1799');
    assert.equal(restored.chessYears, 12);
    await act(async () => {
      view.unmount();
    });
  });

  it('keeps the editor and prior profile on a save failure', async () => {
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(<UserScreen />);
    });
    await act(async () => {
      node(view, 'profil-row-username').props.onPress();
    });
    await act(async () => {
      node(view, 'profil-username-input').props.onChangeText('Lost');
    });
    const write = storage.setItem.bind(storage);
    storage.setItem = async () => {
      throw Error('disk');
    };
    await act(async () => {
      await node(view, 'profil-username-save').props.onPress();
    });
    assert.equal(state.store.getProfile().username, 'Ada');
    assert.ok(node(view, 'profil-edit-error'));
    storage.setItem = write;
    await act(async () => {
      view.unmount();
    });
  });

  for (const language of ['fr', 'en'] as const) {
    it(`${language}: retains the account widget and PR 01 menu for guests`, async () => {
      state.user = null;
      state.language = language;
      let view!: ReturnType<typeof create>;
      await act(async () => {
        view = create(<UserScreen />);
      });
      assert.ok(node(view, 'utilisateur-guest-card'));
      assert.ok(node(view, 'existing-account-widget'));
      assert.ok(node(view, 'general-menu'));
      assert.equal(
        view.root.findAllByProps({ testID: 'profil-summary' }).length,
        0,
      );
      await act(async () => {
        view.unmount();
      });
    });
  }
});
