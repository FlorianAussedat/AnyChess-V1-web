import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listMascotIds } from '../mascotCatalog.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

describe('mascot catalog', () => {
  it('lists every bundled mascot file and no invented id', () => {
    const source = readFileSync(join(root, 'components/profile/mascotImages.ts'), 'utf8');
    const required = [...source.matchAll(/require\('(@\/assets\/brand\/mascots\/[^']+)'\)/g)].map((match) =>
      match[1].replace('@/assets/brand/mascots/', ''),
    );
    const onDisk = [
      ...readdirSync(join(root, 'assets/brand/mascots'))
        .filter((name) => name.endsWith('.png'))
        .map((name) => name),
      ...readdirSync(join(root, 'assets/brand/mascots/difficulty'))
        .filter((name) => name.endsWith('.png'))
        .map((name) => `difficulty/${name}`),
    ];
    assert.deepEqual(required.sort(), onDisk.sort());
    assert.equal(required.length, listMascotIds().length);
    for (const id of listMascotIds()) {
      assert.match(source, new RegExp(`'${id}'`));
    }
    for (const file of required) {
      assert.equal(existsSync(join(root, 'assets/brand/mascots', file)), true);
    }
  });
});
