import React from 'react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler } from '../../../lib/theoreticalEndgame/__tests__/uiShims/reactNative.ts';
import { AvatarField } from '../AvatarField.tsx';
import { avatarPreviewLayout } from '../../../lib/profile/avatarImage.ts';

const PHOTO = 'file://portrait.jpg';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function byId(root: TestRenderer.ReactTestRenderer, testID: string) {
  return root.root.findByProps({ testID });
}

async function openCrop(
  root: TestRenderer.ReactTestRenderer,
  source: { width: number; height: number },
) {
  await act(async () => {
    await byId(root, 'avatar-field-add').props.onPress();
  });
  const modal = root.root.findByType('Modal');
  assert.equal(modal.props.visible, true);
  await act(async () => {
    byId(root, 'avatar-crop-slot').props.onLayout({
      nativeEvent: { layout: { width: 280, height: 220 } },
    });
    byId(root, 'avatar-crop-preview').props.onLoad({
      nativeEvent: { source },
    });
  });
}

describe('avatar crop dialog', () => {
  it('opens after a photo is chosen and closes on cancel and Android back', async () => {
    let changes = 0;
    let root: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="data:image/png;base64,old"
          onChange={() => {
            changes += 1;
          }}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
        />,
      );
    });
    assert.equal(root!.root.findByType('Modal').props.visible, false);
    await openCrop(root!, { width: 300, height: 600 });
    assert.equal(byId(root!, 'avatar-crop-preview').props.source.uri, PHOTO);
    await act(async () => {
      byId(root!, 'avatar-crop-cancel').props.onPress();
    });
    assert.equal(root!.root.findByType('Modal').props.visible, false);
    assert.equal(changes, 0);

    await openCrop(root!, { width: 300, height: 600 });
    await act(async () => {
      root!.root.findByType('Modal').props.onRequestClose();
    });
    assert.equal(root!.root.findByType('Modal').props.visible, false);

    await openCrop(root!, { width: 300, height: 600 });
    const listeners = [...(BackHandler as { listeners: Set<() => boolean> }).listeners];
    assert.equal(listeners.length, 1);
    await act(async () => {
      assert.equal(listeners[0]!(), true);
    });
    assert.equal(root!.root.findByType('Modal').props.visible, false);
    assert.equal(changes, 0);
    await act(async () => {
      root!.unmount();
    });
  });

  it('moves the crop with the slider and keeps the preview on the saved rectangle', async () => {
    const shapes = [
      { width: 300, height: 600 },
      { width: 640, height: 360 },
      { width: 400, height: 400 },
    ];
    for (const source of shapes) {
      let root: TestRenderer.ReactTestRenderer;
      await act(async () => {
        root = TestRenderer.create(
          <AvatarField
            username="Ada"
            imageUri={null}
            onChange={() => {}}
            pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
          />,
        );
      });
      await openCrop(root!, source);
      await act(async () => {
        const track = byId(root!, 'avatar-crop-zoom');
        track.props.onLayout({ nativeEvent: { layout: { width: 200, height: 44 } } });
      });
      await act(async () => {
        byId(root!, 'avatar-crop-zoom').props.onResponderGrant({
          nativeEvent: { locationX: 100 },
        });
      });
      const expected = avatarPreviewLayout({
        imageWidth: source.width,
        imageHeight: source.height,
        maxWidth: 280,
        maxHeight: 220,
        zoom: 2,
      });
      const frame = byId(root!, 'avatar-crop-frame').props.style;
      const preview = byId(root!, 'avatar-crop-preview').props.style;
      assert.equal(frame.width, expected.frameWidth);
      assert.equal(frame.height, expected.frameHeight);
      assert.equal(frame.width, frame.height);
      assert.ok(frame.borderRadius > 0);
      assert.equal(preview.width, expected.imageWidth);
      assert.equal(preview.height, expected.imageHeight);
      assert.equal(preview.transform[0].scale.current, 2);
      const side = Math.min(source.width, source.height) / 2;
      assert.equal(expected.crop.width, side);
      assert.equal(expected.crop.height, side);
      await act(async () => {
        byId(root!, 'avatar-use-full').props.onPress();
      });
      assert.equal(byId(root!, 'avatar-crop-preview').props.style.transform[0].scale.current, 1);
      await act(async () => {
        root!.unmount();
      });
    }
  });

  it('saves the cropped photo, reports a failure, and allows another try', async () => {
    const saved: string[] = [];
    let attempts = 0;
    let root: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="data:image/png;base64,old"
          onChange={(next) => {
            if (typeof next === 'string') saved.push(next);
          }}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
          prepareImage={async () => {
            attempts += 1;
            if (attempts === 1) return { error: 'failed' };
            return { dataUrl: 'data:image/png;base64,new' };
          }}
        />,
      );
    });
    await openCrop(root!, { width: 400, height: 400 });
    await act(async () => {
      await byId(root!, 'avatar-crop-confirm').props.onPress();
    });
    assert.equal(root!.root.findByType('Modal').props.visible, true);
    assert.match(byId(root!, 'avatar-crop-error-modal').props.children, /réessayer/);
    assert.equal(byId(root!, 'avatar-crop-confirm').props.disabled, false);
    assert.equal(saved.length, 0);
    await act(async () => {
      await byId(root!, 'avatar-crop-confirm').props.onPress();
    });
    assert.deepEqual(saved, ['data:image/png;base64,new']);
    assert.equal(root!.root.findByType('Modal').props.visible, false);
    await act(async () => {
      root!.unmount();
    });
  });

  it('explains a missing native crop without changing the current photo', async () => {
    let changes = 0;
    let root: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="data:image/png;base64,old"
          onChange={() => {
            changes += 1;
          }}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/webp' })}
          prepareImage={async () => ({ error: 'unavailable' })}
        />,
      );
    });
    await openCrop(root!, { width: 400, height: 300 });
    await act(async () => {
      await byId(root!, 'avatar-crop-confirm').props.onPress();
    });
    assert.equal(changes, 0);
    assert.match(byId(root!, 'avatar-crop-error-modal').props.children, /cette version/);
    await act(async () => {
      byId(root!, 'avatar-crop-cancel').props.onPress();
    });
    assert.equal(root!.root.findByType('Modal').props.visible, false);
    assert.equal(changes, 0);
    await act(async () => {
      root!.unmount();
    });
  });

  it('ignores a second validation and a result that arrives after cancel', async () => {
    const first = deferred<{ dataUrl: string }>();
    let prepares = 0;
    let inflight: Promise<unknown> = Promise.resolve();
    const saved: string[] = [];
    let root: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="data:image/png;base64,old"
          onChange={(next) => {
            if (typeof next === 'string') saved.push(next);
          }}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
          prepareImage={() => {
            prepares += 1;
            return first.promise;
          }}
        />,
      );
    });
    await openCrop(root!, { width: 200, height: 200 });
    await act(async () => {
      inflight = byId(root!, 'avatar-crop-confirm').props.onPress();
    });
    await act(async () => {
      byId(root!, 'avatar-crop-confirm').props.onPress();
    });
    assert.equal(prepares, 1);
    assert.equal(byId(root!, 'avatar-crop-confirm').props.disabled, true);
    await act(async () => {
      byId(root!, 'avatar-crop-cancel').props.onPress();
    });
    await act(async () => {
      first.resolve({ dataUrl: 'data:image/png;base64,late' });
      await inflight;
    });
    assert.deepEqual(saved, []);
    assert.equal(root!.root.findByType('Modal').props.visible, false);

    await act(async () => {
      root!.unmount();
    });
  });
});
