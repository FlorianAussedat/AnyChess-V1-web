import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearChessWorkspaceSessions,
  closeChessWorkspaceSession,
  createChessWorkspaceSession,
  getChessWorkspaceSession,
} from '../WorkspaceSessionRegistry.ts';
import { validateWorkspacePayload } from '../types.ts';
import { workspacePayloadFromFen } from '../buildWorkspacePayload.ts';

test('validates a free-play FEN payload', () => {
  const payload = workspacePayloadFromFen({
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    title: 'FEN',
  });
  const checked = validateWorkspacePayload(payload);
  assert.equal(checked.ok, true);
});

test('rejects unknown workspace version', () => {
  const checked = validateWorkspacePayload({
    schemaVersion: 99,
    workspaceMode: 'reader',
    source: 'manual-pgn',
    title: 'Bad',
    initialFen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    orientation: 'white',
  });
  assert.equal(checked.ok, false);
});

test('registers and closes a workspace session', () => {
  clearChessWorkspaceSessions();
  const payload = workspacePayloadFromFen({
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    title: 'Workspace',
  });
  const id = createChessWorkspaceSession(payload, 'overlay');
  assert.ok(id.startsWith('workspace-'));
  assert.equal(getChessWorkspaceSession(id)?.payload.title, 'Workspace');
  closeChessWorkspaceSession(id);
  assert.equal(getChessWorkspaceSession(id), null);
});
