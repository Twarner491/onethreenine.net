import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import type { BoardItem, User } from '../components/types';

export const TV_CACHE_KEY = 'onethreenine-tv-board-v1';
export type TVConnection = 'connecting' | 'live' | 'offline';
export interface TVSnapshot {
  version: 1;
  savedAt: number;
  items: BoardItem[];
  users: User[];
  viewer: User;
}
export interface TVState {
  snapshot: TVSnapshot | null;
  connection: TVConnection;
  error: 'unavailable' | 'missing-viewer' | null;
}
export interface TVSource {
  load(signal: AbortSignal): Promise<TVSnapshot>;
}
export interface TVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class MissingViewerError extends Error {}
const itemTypes = new Set(['note', 'photo', 'list', 'receipt', 'menu']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string';
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** Reject malformed rows before either the renderer or persistent cache can see them. */
function validContent(type: unknown, content: Record<string, unknown>): boolean {
  switch (type) {
    case 'note': return typeof content.text === 'string';
    case 'photo': return (content.imageUrl === null || typeof content.imageUrl === 'string') && typeof content.caption === 'string';
    case 'list': return typeof content.title === 'string' && Array.isArray(content.items) &&
      content.items.every(item => isRecord(item) && typeof item.text === 'string' && typeof item.checked === 'boolean');
    case 'receipt': return typeof content.store === 'string' && typeof content.date === 'string' &&
      finiteNumber(content.total) && Array.isArray(content.items) &&
      content.items.every(item => isRecord(item) && typeof item.name === 'string' && finiteNumber(item.price));
    case 'menu': {
      if (!optionalText(content.title) || !optionalText(content.date)) return false;
      const validDish = (item: unknown) => isRecord(item) && typeof item.name === 'string' && optionalText(item.description);
      if ('sections' in content) return Array.isArray(content.sections) && content.sections.every(section =>
        isRecord(section) && optionalText(section.title) && Array.isArray(section.items) && section.items.every(validDish));
      return Array.isArray(content.items) && content.items.every(validDish);
    }
    default: return false;
  }
}

/** Only accept renderable data, including when reading the local last-good cache. */
export function makeTVSnapshot(items: unknown, users: unknown, savedAt = Date.now()): TVSnapshot {
  if (!Array.isArray(items) || !Array.isArray(users) || !Number.isFinite(savedAt)) {
    throw new Error('Invalid board snapshot');
  }
  const safeItems = items.map((item): BoardItem => {
    if (!isRecord(item) || typeof item.id !== 'string' || !itemTypes.has(String(item.type)) ||
        typeof item.x !== 'number' || !Number.isFinite(item.x) ||
        typeof item.y !== 'number' || !Number.isFinite(item.y) || !isRecord(item.content) ||
        !validContent(item.type, item.content)) {
      throw new Error('Invalid board item');
    }
    return {
      id: item.id, type: item.type as BoardItem['type'], x: item.x, y: item.y,
      content: item.content, rotation: typeof item.rotation === 'number' ? item.rotation : 0,
      color: typeof item.color === 'string' ? item.color : undefined,
      created_by: typeof item.created_by === 'string' ? item.created_by : null,
      updated_by: typeof item.updated_by === 'string' ? item.updated_by : null,
      created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : undefined,
      z_index: typeof item.z_index === 'number' ? item.z_index : undefined,
    };
  });
  const safeUsers = users.map((user): User => {
    if (!isRecord(user) || typeof user.id !== 'string' || typeof user.name !== 'string' ||
        typeof user.color !== 'string') throw new Error('Invalid board profile');
    return {
      id: user.id, name: user.name, color: user.color,
      created_at: typeof user.created_at === 'string' ? user.created_at : undefined,
      updated_at: typeof user.updated_at === 'string' ? user.updated_at : undefined,
    };
  });
  // This display profile is not a Supabase Auth identity or an access-control role.
  // Refuse ambiguity instead of creating a user or choosing a different profile.
  const viewers = safeUsers.filter(user => user.name.toLowerCase() === 'monalisa');
  if (viewers.length !== 1) throw new MissingViewerError('Existing MonaLisa profile unavailable');
  return { version: 1, savedAt, items: safeItems, users: safeUsers, viewer: viewers[0] };
}

/** The entire TV data adapter is SELECT-only; no login, profile or board mutation. */
export function createTVBoardSource(client: SupabaseClient<Database>): TVSource {
  return {
    async load(signal) {
      const [items, users] = await Promise.all([
        client.from('board_items')
          .select('id,type,x,y,rotation,color,content,created_by,created_at,updated_at,updated_by,z_index')
          .order('created_at', { ascending: true }).abortSignal(signal),
        client.from('users').select('id,name,color,created_at,updated_at')
          .order('created_at', { ascending: true }).abortSignal(signal),
      ]);
      if (items.error || users.error) throw new Error('Board read unavailable');
      return makeTVSnapshot(items.data, users.data);
    },
  };
}

export function readTVCache(storage?: TVStorage): TVSnapshot | null {
  try {
    const raw = storage?.getItem(TV_CACHE_KEY);
    if (!raw || raw.length > 8_000_000) return null;
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || typeof data.savedAt !== 'number') return null;
    return makeTVSnapshot(data.items, data.users, data.savedAt);
  } catch {
    return null;
  }
}

/** Serial snapshots with a revision fence: an older in-flight response cannot win. */
export class TVBoardSession {
  private state: TVState;
  private online = true;
  private realtimeConnected = false;
  private fresh = false;
  private dirty = false;
  private disposed = false;
  private revision = 0;
  private draining: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private readonly source: TVSource;
  private readonly storage?: TVStorage;
  private readonly publish: (state: TVState) => void;

  constructor(source: TVSource, publish: (state: TVState) => void, storage?: TVStorage) {
    this.source = source;
    this.publish = publish;
    this.storage = storage;
    const cached = readTVCache(storage);
    this.state = { snapshot: cached, connection: cached ? 'offline' : 'connecting', error: null };
  }

  getState(): TVState { return this.state; }

  private emit() {
    if (this.disposed) return;
    this.state = {
      ...this.state,
      connection: !this.online || this.state.error ? 'offline' :
        this.realtimeConnected && this.fresh ? 'live' : 'connecting',
    };
    this.publish(this.state);
  }

  setOnline(online: boolean): Promise<void> {
    this.online = online;
    if (!online) {
      this.revision++;
      this.fresh = false;
      this.controller?.abort();
      this.emit();
      return Promise.resolve();
    }
    return this.refresh();
  }

  setRealtimeConnected(connected: boolean): Promise<void> {
    this.realtimeConnected = connected;
    if (!connected) {
      this.fresh = false;
      this.emit();
      return Promise.resolve();
    }
    // Realtime does not promise to replay changes missed during sleep/disconnection.
    return this.refresh();
  }

  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.revision++;
    this.dirty = true;
    if (!this.online) return Promise.resolve();
    if (!this.draining) {
      // The microtask also coalesces a burst of same-tick resume/change notifications.
      this.draining = Promise.resolve().then(() => this.drain()).finally(() => {
        this.draining = null;
      });
    }
    return this.draining;
  }

  private async drain() {
    while (this.dirty && this.online && !this.disposed) {
      this.dirty = false;
      const revision = this.revision;
      const controller = new AbortController();
      this.controller = controller;
      // Bounded requests prevent a suspended/broken connection blocking all later resyncs.
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const snapshot = await this.source.load(controller.signal);
        if (this.disposed || revision !== this.revision || controller.signal.aborted) continue;
        this.fresh = true;
        this.state = { ...this.state, snapshot, error: null };
        try { this.storage?.setItem(TV_CACHE_KEY, JSON.stringify(snapshot)); } catch { /* storage full/disabled */ }
        this.emit();
      } catch (error) {
        if (this.disposed || revision !== this.revision) continue;
        this.fresh = false;
        this.state = { ...this.state, error: error instanceof MissingViewerError ? 'missing-viewer' : 'unavailable' };
        this.emit();
      } finally {
        clearTimeout(timeout);
        if (this.controller === controller) this.controller = null;
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.revision++;
    this.controller?.abort();
  }
}
