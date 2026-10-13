import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { ensureMainActivitySingleTask, REQUIRED_CONFIG_CHANGES } = require(
  '../../../plugins/androidActivity.cjs',
);

describe('ensureMainActivitySingleTask', () => {
  it('forces singleTask and the config changes that recreate the activity', () => {
    const manifest = {
      application: [
        {
          activity: [
            {
              $: {
                'android:name': '.MainActivity',
                'android:launchMode': 'standard',
                'android:configChanges': 'keyboard|orientation',
              },
            },
          ],
        },
      ],
    };

    ensureMainActivitySingleTask(manifest);
    const activity = manifest.application[0].activity[0].$;
    assert.equal(activity['android:launchMode'], 'singleTask');
    const flags = activity['android:configChanges'].split('|');
    for (const flag of REQUIRED_CONFIG_CHANGES) {
      assert.ok(flags.includes(flag), flag);
    }
    assert.equal(flags.filter((flag) => flag === 'keyboard').length, 1);
  });
});
