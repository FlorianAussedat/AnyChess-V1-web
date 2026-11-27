import React from 'react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler } from '../../../lib/theoreticalEndgame/__tests__/uiShims/reactNative.ts';
import { AvatarField as RealAvatarField } from '../AvatarField.tsx';
import { avatarCropPreview } from '../../../lib/profile/avatarCrop.ts';
function AvatarField(props: React.ComponentProps<typeof RealAvatarField>) {
  return (
    <RealAvatarField
      prepareSource={async (uri) => ({ uri, width: 0, height: 0 })}
      {...props}
    />
  );
}
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
    await byId(root, 'avatar-choice-import').props.onPress();
  });
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
  it('drags in both axes and exports the exact preview position after zooming', async () => {
    let input:
      | Parameters<
          NonNullable<React.ComponentProps<typeof AvatarField>['prepareImage']>
        >[0]
      | undefined;
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="previous"
          onChange={() => {}}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
          prepareImage={async (next) => {
            input = next;
            return { dataUrl: 'data:image/png;base64,next' };
          }}
        />,
      );
    });
    await openCrop(root, { width: 800, height: 600 });
    await act(async () => {
      byId(root, 'avatar-crop-zoom').props.onLayout({
        nativeEvent: { layout: { width: 200 } },
      });
    });
    await act(async () => {
      byId(root, 'avatar-crop-zoom').props.onResponderGrant({
        nativeEvent: { locationX: 100 },
      });
    });
    await act(async () => {
      byId(root, 'avatar-crop-frame').props.onResponderGrant({
        nativeEvent: { pageX: 80, pageY: 60 },
      });
    });
    assert.equal(
      byId(root, 'avatar-crop-frame').props.onResponderTerminationRequest(),
      false,
    );
    await act(async () => {
      byId(root, 'avatar-crop-frame').props.onResponderMove({
        nativeEvent: { pageX: 30, pageY: 85 },
      });
    });
    const visible = byId(root, 'avatar-crop-preview').props.style;
    await act(async () => {
      await byId(root, 'avatar-crop-confirm').props.onPress();
    });
    assert.ok(input?.position);
    assert.ok(input.position.x > 0.5 && input.position.y < 0.5);
    const expected = avatarCropPreview(
      800,
      600,
      220,
      input.zoom!,
      input.position,
    );
    assert.deepEqual(
      [visible.width, visible.height, visible.left, visible.top],
      [expected.width, expected.height, expected.left, expected.top],
    );
    await act(async () => {
      root.unmount();
    });
  });

  it('keeps the previous avatar on read errors and ignores a late import after cancel', async () => {
    const pending = deferred<{ uri: string; width: number; height: number }>();
    let saves = 0,
      attempts = 0;
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <RealAvatarField
          username="Ada"
          imageUri="previous"
          onChange={() => {
            saves++;
          }}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
          prepareSource={async () => {
            attempts++;
            return attempts === 1 ? { error: 'failed' } : pending.promise;
          }}
        />,
      );
    });
    await act(async () => {
      byId(root, 'avatar-field-add').props.onPress();
    });
    await act(async () => {
      await byId(root, 'avatar-choice-import').props.onPress();
    });
    assert.ok(byId(root, 'avatar-crop-error-modal'));
    assert.equal(byId(root, 'avatar-field-image').props.source.uri, 'previous');
    let importing!: Promise<void>;
    await act(async () => {
      importing = byId(root, 'avatar-choice-import').props.onPress();
    });
    await act(async () => {
      byId(root, 'avatar-choice-cancel').props.onPress();
    });
    await act(async () => {
      pending.resolve({ uri: 'late', width: 200, height: 100 });
      await importing;
    });
    assert.equal(root.root.findByType('Modal').props.visible, false);
    assert.equal(saves, 0);
    await act(async () => {
      root.unmount();
    });
  });

  it('serializes mascot/removal saves, displays failures, and blocks cancellation during durable saving', async () => {
    const pending = deferred<'failed'>();
    let calls = 0;
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="previous"
          onChange={async () => {
            calls++;
            return pending.promise;
          }}
          mascotSource={() => ({ uri: 'bundled' })}
        />,
      );
    });
    await act(async () => {
      byId(root, 'avatar-field-add').props.onPress();
    });
    await act(async () => {
      await byId(root, 'avatar-choice-mascot').props.onPress();
    });
    await act(async () => {
      byId(root, 'avatar-mascot-player-knight-dj').props.onPress();
    });
    let saving!: Promise<void>;
    await act(async () => {
      saving = byId(root, 'avatar-mascot-confirm').props.onPress();
    });
    await act(async () => {
      byId(root, 'avatar-mascot-confirm').props.onPress();
      root.root.findByType('Modal').props.onRequestClose();
    });
    assert.equal(calls, 1);
    assert.equal(root.root.findByType('Modal').props.visible, true);
    assert.equal(byId(root, 'avatar-mascot-cancel').props.disabled, true);
    await act(async () => {
      pending.resolve('failed');
      await saving;
    });
    assert.ok(byId(root, 'avatar-crop-error-modal'));
    assert.equal(byId(root, 'avatar-field-image').props.source.uri, 'previous');
    await act(async () => {
      byId(root, 'avatar-mascot-cancel').props.onPress();
    });
    await act(async () => {
      await byId(root, 'avatar-field-remove').props.onPress();
    });
    assert.ok(byId(root, 'avatar-save-error'));
    await act(async () => {
      root.unmount();
    });
  });

  it('reports a deferred sync failure outside the closed dialog instead of claiming success', async () => {
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="previous"
          onChange={async () => 'sync_failed'}
          pickImage={async () => ({ uri: PHOTO, mime: 'image/jpeg' })}
          prepareImage={async () => ({ dataUrl: 'data:image/png;base64,next' })}
        />,
      );
    });
    await openCrop(root, { width: 200, height: 200 });
    await act(async () => {
      await byId(root, 'avatar-crop-confirm').props.onPress();
    });
    assert.equal(root.root.findByType('Modal').props.visible, false);
    assert.ok(byId(root, 'avatar-save-error').props.children);
    await act(async () => {
      root.unmount();
    });
  });
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
    const listeners = [
      ...(BackHandler as { listeners: Set<() => boolean> }).listeners,
    ];
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
        track.props.onLayout({
          nativeEvent: { layout: { width: 200, height: 44 } },
        });
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
      const actual = avatarCropPreview(source.width, source.height, 220, 2);
      assert.equal(preview.width, actual.width);
      assert.equal(preview.height, actual.height);
      assert.equal(preview.left, actual.left);
      assert.equal(preview.top, actual.top);
      const side = Math.min(source.width, source.height) / 2;
      assert.equal(expected.crop.width, side);
      assert.equal(expected.crop.height, side);
      await act(async () => {
        byId(root!, 'avatar-use-full').props.onPress();
      });
      assert.equal(
        byId(root!, 'avatar-crop-preview').props.style.width,
        expected.imageWidth,
      );
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
    assert.match(
      byId(root!, 'avatar-crop-error-modal').props.children,
      /réessayer/,
    );
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
    assert.match(
      byId(root!, 'avatar-crop-error-modal').props.children,
      /cette version/,
    );
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

  it('confirms a mascot, and cancel keeps the previous avatar', async () => {
    const changes: Array<string | null> = [];
    const mascots: string[] = [];
    let root: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(
        <AvatarField
          username="Ada"
          imageUri="data:image/png;base64,old"
          onChange={(next, context) => {
            changes.push(next);
            if (context?.mascotId) mascots.push(context.mascotId);
          }}
          mascotSource={() => ({ uri: 'mascot' })}
        />,
      );
    });
    await act(async () => {
      byId(root!, 'avatar-field-add').props.onPress();
    });
    await act(async () => {
      byId(root!, 'avatar-choice-cancel').props.onPress();
    });
    assert.deepEqual(changes, []);
    await act(async () => {
      byId(root!, 'avatar-field-add').props.onPress();
    });
    await act(async () => {
      await byId(root!, 'avatar-choice-mascot').props.onPress();
    });
    await act(async () => {
      byId(root!, 'avatar-mascot-classic-knight-soundwave').props.onPress();
    });
    assert.equal(
      byId(root!, 'avatar-mascot-classic-knight-soundwave').props
        .accessibilityState.selected,
      true,
    );
    await act(async () => {
      byId(root!, 'avatar-mascot-cancel').props.onPress();
    });
    assert.deepEqual(mascots, []);
    await act(async () => {
      byId(root!, 'avatar-field-add').props.onPress();
    });
    await act(async () => {
      await byId(root!, 'avatar-choice-mascot').props.onPress();
    });
    await act(async () => {
      byId(root!, 'avatar-mascot-player-knight-dj').props.onPress();
    });
    await act(async () => {
      await byId(root!, 'avatar-mascot-confirm').props.onPress();
    });
    assert.deepEqual(mascots, ['player-knight-dj']);
    assert.equal(changes[0], null);
    assert.equal(root!.root.findByType('Modal').props.visible, false);
    await act(async () => {
      root!.unmount();
    });
  });
});
