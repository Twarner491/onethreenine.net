import assert from 'node:assert/strict';
import test from 'node:test';
import { thumbnailFingerprint } from '../scripts/board-thumbnail-fingerprint.mjs';

const board = [{ id: '1', created_by: 'author', content: { imageUrl: 'old', caption: 'Photo' }, x: 50 }];
const users = [{ id: 'author', color: 'red' }, { id: 'other', color: 'green' }];

test('unchanged rendering inputs have a stable fingerprint', () => {
  const reordered = [{ x: 50, content: { caption: 'Photo', imageUrl: 'old' }, created_by: 'author', id: '1' }];
  assert.equal(thumbnailFingerprint(board, users, 'source'),
    thumbnailFingerprint(reordered, [{ id: 'author', color: 'red' }], 'source'));
});

test('a new photo, changed author color or rendering source causes a capture', () => {
  const baseline = thumbnailFingerprint(board, users, 'source');
  assert.notEqual(baseline, thumbnailFingerprint([{ ...board[0], content: { imageUrl: 'new' } }], users, 'source'));
  assert.notEqual(baseline, thumbnailFingerprint(board, [{ id: 'author', color: 'blue' }], 'source'));
  assert.notEqual(baseline, thumbnailFingerprint(board, users, 'new source'));
});
