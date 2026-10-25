import test from 'node:test';
import assert from 'node:assert/strict';
import { createTVBoardSource, makeTVSnapshot, readTVCache, TVBoardSession } from '../src/lib/tv-board-session.ts';
import type { TVSnapshot, TVState } from '../src/lib/tv-board-session.ts';

const users = [{ id: 'display-1', name: 'MonaLisa', color: '#fff' }];
const items = [{ id: 'item-1', type: 'note', x: 100, y: 200, content: { text: 'first' } }];
const snapshot = (text = 'first') => makeTVSnapshot([{ ...items[0], content: { text } }], users);
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function storage(initial: string | null = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

test('existing case-insensitive MonaLisa is required, without profile creation', () => {
  assert.equal(makeTVSnapshot([], [{ ...users[0], name: 'MONALISA' }]).viewer.id, 'display-1');
  assert.throws(() => makeTVSnapshot(items, []), /MonaLisa/);
  assert.throws(() => makeTVSnapshot(items, [{ ...users[0], name: 'Mona Lisa' }]), /MonaLisa/);
  assert.throws(() => makeTVSnapshot(items, [...users, { ...users[0], id: 'ambiguous' }]), /MonaLisa/);
});

test('an intentionally empty board is valid and does not trigger demo seeding', async () => {
  const session = new TVBoardSession({ load: async () => makeTVSnapshot([], users) }, () => {});
  await session.setRealtimeConnected(true);
  assert.deepEqual(session.getState().snapshot?.items, []);
  assert.equal(session.getState().connection, 'live');
  session.dispose();
});

test('source performs only SELECT reads and forwards abort signals', async () => {
  const calls: unknown[] = [];
  const signal = new AbortController().signal;
  const client = { from(table: string) {
    assert.ok(['board_items', 'users'].includes(table));
    return { select(columns: string) {
      calls.push([table, columns]);
      return { order() { return { abortSignal(received: AbortSignal) {
        assert.equal(received, signal);
        return Promise.resolve({ data: table === 'users' ? users : items, error: null });
      } }; } };
    } };
  } };
  const result = await createTVBoardSource(client as never).load(signal);
  assert.equal(calls.length, 2);
  assert.equal(result.viewer.name, 'MonaLisa');
  assert.equal(result.items.length, 1);
});

test('read failures do not become a successful empty snapshot', async () => {
  const client = { from() { return { select() { return { order() { return { abortSignal() {
    return Promise.resolve({ data: null, error: { message: 'unavailable' } });
  } }; } }; } }; } };
  await assert.rejects(createTVBoardSource(client as never).load(new AbortController().signal), /unavailable/);
});

test('same-tick resync requests coalesce into one query', async () => {
  let count = 0;
  const session = new TVBoardSession({ load: async () => { count++; return snapshot(); } }, () => {});
  await Promise.all([session.refresh(), session.refresh(), session.refresh()]);
  assert.equal(count, 1);
  session.dispose();
});

test('unchanged resyncs preserve snapshot identity, asset timestamp and cache without publishing', async () => {
  let reads = 0;
  let writes = 0;
  const updates: TVState[] = [];
  const session = new TVBoardSession({ load: async () => {
    reads++;
    const content = reads === 1 ? { text: 'same', extra: { a: 1, b: 2 } } : { extra: { b: 2, a: 1 }, text: 'same' };
    return makeTVSnapshot([{ ...items[0], content }], users, reads * 100);
  } }, state => updates.push(state), { getItem: () => null, setItem: () => { writes++; } });
  await session.setRealtimeConnected(true);
  const original = session.getState().snapshot;
  await session.refresh();
  await session.refresh();
  assert.equal(reads, 3);
  assert.equal(session.getState().snapshot, original);
  assert.equal(session.getState().snapshot?.savedAt, 100);
  assert.equal(updates.length, 1);
  assert.equal(writes, 1);
  await session.setOnline(false);
  await session.setOnline(true);
  assert.equal(session.getState().connection, 'live');
  assert.equal(session.getState().snapshot, original);
  assert.equal(writes, 1);
  session.dispose();
});

test('recovery polling is quiet while live and resumes only when disconnected', async () => {
  let reads = 0;
  const session = new TVBoardSession({ load: async () => { reads++; return snapshot(); } }, () => {});
  await session.setRealtimeConnected(true);
  await session.refreshIfDisconnected();
  await session.refreshIfDisconnected();
  assert.equal(reads, 1);
  await session.setRealtimeConnected(false);
  await session.refreshIfDisconnected();
  assert.equal(reads, 2);
  await session.setRealtimeConnected(true);
  await session.refreshIfDisconnected();
  assert.equal(reads, 3);
  session.dispose();
});

test('actual content changes publish a fresh monotonic snapshot identity', async () => {
  let reads = 0;
  const updates: TVState[] = [];
  const session = new TVBoardSession({ load: async () => makeTVSnapshot([{ ...items[0], content: { text: String(++reads) } }], users, 100) }, state => updates.push(state));
  await session.setRealtimeConnected(true);
  const original = session.getState().snapshot;
  await session.refresh();
  assert.notEqual(session.getState().snapshot, original);
  assert.equal(session.getState().snapshot?.savedAt, 101);
  assert.equal(session.getState().snapshot?.items[0].content.text, '2');
  assert.equal(updates.length, 2);
  session.dispose();
});

test('a newer resync invalidates an in-flight response and deleted items stay removed', async () => {
  const first = deferred<TVSnapshot>();
  let count = 0;
  const updates: TVState[] = [];
  const session = new TVBoardSession({ load: () => ++count === 1 ? first.promise : Promise.resolve(makeTVSnapshot([], users)) }, state => updates.push(state));
  const done = session.refresh();
  await tick();
  session.refresh();
  first.resolve(snapshot('old response'));
  await done;
  assert.equal(count, 2);
  assert.equal(updates.some(state => state.snapshot?.items.length === 1), false);
  assert.deepEqual(session.getState().snapshot?.items, []);
  session.dispose();
});

test('cache restores offline, remains visible on failure, then reconnect replaces it', async () => {
  const saved = storage(JSON.stringify(snapshot('cached')));
  let fail = true;
  const session = new TVBoardSession({ load: async () => { if (fail) throw new Error('offline'); return snapshot('latest'); } }, () => {}, saved);
  assert.equal(session.getState().connection, 'offline');
  assert.equal(session.getState().snapshot?.items[0].content.text, 'cached');
  await session.refresh();
  assert.equal(session.getState().snapshot?.items[0].content.text, 'cached');
  assert.equal(session.getState().error, 'unavailable');
  fail = false;
  await session.setRealtimeConnected(true);
  assert.equal(session.getState().connection, 'live');
  assert.equal(session.getState().snapshot?.items[0].content.text, 'latest');
  assert.equal(readTVCache(saved)?.items[0].content.text, 'latest');
  session.dispose();
});

test('offline transition invalidates pending data and reconnect performs fresh read', async () => {
  const first = deferred<TVSnapshot>();
  let count = 0;
  let firstSignal: AbortSignal | undefined;
  const session = new TVBoardSession({ load: signal => {
    count++;
    if (count === 1) { firstSignal = signal; return first.promise; }
    return Promise.resolve(snapshot('reconnected'));
  } }, () => {});
  const done = session.refresh();
  await tick();
  await session.setOnline(false);
  assert.equal(firstSignal?.aborted, true);
  first.resolve(snapshot('stale'));
  await done;
  assert.equal(session.getState().snapshot, null);
  await session.setOnline(true);
  assert.equal(session.getState().snapshot?.items[0].content.text, 'reconnected');
  session.dispose();
});

test('invalid/full storage cannot break a live display and caches only approved profile fields', async () => {
  assert.equal(readTVCache(storage('{invalid')), null);
  assert.equal(readTVCache(storage(JSON.stringify({ version: 2, items, users }))), null);
  assert.equal(readTVCache(storage(JSON.stringify({ version: 1, savedAt: 1, items: [{ nope: true }], users }))), null);
  const cleaned = makeTVSnapshot(items, [{ ...users[0], privateContact: 'must not be cached' }]);
  assert.equal(JSON.stringify(cleaned).includes('privateContact'), false);
  const session = new TVBoardSession({ load: async () => snapshot() }, () => {}, {
    getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); },
  });
  await session.setRealtimeConnected(true);
  assert.equal(session.getState().connection, 'live');
  session.dispose();
});

test('malformed card content is rejected before rendering or caching', async () => {
  for (const [type, content] of [
    ['receipt', {}],
    ['receipt', { store: 'test', date: '', items: [{ name: 'item', price: '1.00' }], total: 1 }],
    ['note', { text: {} }],
    ['photo', { imageUrl: {}, caption: '' }],
    ['list', { title: 'test', items: null }],
    ['menu', { sections: [{ items: [{ name: {} }] }] }],
  ]) {
    const bad = [{ ...items[0], type, content }];
    assert.throws(() => makeTVSnapshot(bad, users), /Invalid board item/);
    assert.equal(readTVCache(storage(JSON.stringify({ version: 1, savedAt: 1, items: bad, users }))), null);
  }
  const saved = storage(JSON.stringify(snapshot('last good')));
  const session = new TVBoardSession({ load: async () => makeTVSnapshot([{ ...items[0], type: 'receipt', content: {} }], users) }, () => {}, saved);
  await session.refresh();
  assert.equal(session.getState().snapshot?.items[0].content.text, 'last good');
  assert.equal(readTVCache(saved)?.items[0].content.text, 'last good');
  assert.equal(session.getState().error, 'unavailable');
  session.dispose();
});

test('all supported display card shapes remain valid', () => {
  const cards = [
    { type: 'note', content: { text: '' } },
    { type: 'photo', content: { imageUrl: null, caption: '' } },
    { type: 'list', content: { title: '', items: [{ text: 'entry', checked: false }] } },
    { type: 'receipt', content: { store: '', date: '', items: [{ name: 'item', price: 2 }], total: 2 } },
    { type: 'menu', content: { title: 'Dinner', sections: [{ title: '', items: [{ name: 'Soup' }] }] } },
    { type: 'menu', content: { title: 'Event', items: [{ name: 'Meet up', description: '' }] } },
  ].map((card, index) => ({ ...items[0], id: String(index), ...card }));
  assert.equal(makeTVSnapshot(cards, users).items.length, cards.length);
});

test('missing viewer shows a distinct failure, without replacing last good board', async () => {
  const session = new TVBoardSession({ load: async () => makeTVSnapshot(items, []) }, () => {}, storage(JSON.stringify(snapshot())));
  await session.refresh();
  assert.equal(session.getState().error, 'missing-viewer');
  assert.equal(session.getState().snapshot?.viewer.id, users[0].id);
  session.dispose();
});

test('disposing cancels work and ignores a late response', async () => {
  const response = deferred<TVSnapshot>();
  let count = 0;
  let signal: AbortSignal | undefined;
  const session = new TVBoardSession({ load: next => { signal = next; return response.promise; } }, () => { count++; });
  const done = session.refresh();
  await tick();
  session.dispose();
  response.resolve(snapshot());
  await done;
  assert.equal(signal?.aborted, true);
  assert.equal(count, 0);
  assert.equal(session.getState().snapshot, null);
});
