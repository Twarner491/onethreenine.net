import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createBoardItem, 
  getAllBoardItems, 
  updateBoardItem, 
  deleteBoardItem,
  getOrCreateUser,
  createSnapshot,
  getAllSnapshots,
  createMenuEntry,
  getAllMenuEntries
} from '../../src/lib/supabase';

describe('Data Layer (Offline LocalStorage Mock)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Board Items Management', () => {
    it('creates and retrieves a new board item', async () => {
      const created = await createBoardItem(
        'note',
        150,
        250,
        { text: 'Test Sticky Note' },
        'user_123',
        3,
        '#fef3c7'
      );
      expect(created).toBeDefined();
      expect(created.id).toMatch(/^item_/);
      expect(created.type).toBe('note');
      expect(created.x).toBe(150);
      expect(created.y).toBe(250);
      expect(created.content).toEqual({ text: 'Test Sticky Note' });
      expect(created.created_by).toBe('user_123');
      expect(created.created_at).toBeDefined();

      const allItems = await getAllBoardItems();
      expect(allItems).toHaveLength(1);
      expect(allItems[0].id).toBe(created.id);
    });

    it('updates an existing board item', async () => {
      const created = await createBoardItem(
        'note',
        100,
        100,
        { text: 'Original Content' },
        'user_123'
      );

      const updated = await updateBoardItem(created.id, {
        x: 300,
        y: 400,
        content: { text: 'Updated Content' },
      });

      expect(updated.x).toBe(300);
      expect(updated.y).toBe(400);
      expect(updated.content).toEqual({ text: 'Updated Content' });

      const allItems = await getAllBoardItems();
      expect(allItems[0].x).toBe(300);
      expect(allItems[0].y).toBe(400);
    });

    it('deletes a board item by id', async () => {
      const item1 = await createBoardItem('note', 0, 0, { text: 'Note 1' }, 'user_1');
      const item2 = await createBoardItem('note', 50, 50, { text: 'Note 2' }, 'user_2');

      expect(await getAllBoardItems()).toHaveLength(2);

      await deleteBoardItem(item1.id);
      const remaining = await getAllBoardItems();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(item2.id);
    });
  });

  describe('User Management', () => {
    it('creates a new user with a valid palette color', async () => {
      const user = await getOrCreateUser('Alice');
      expect(user).toBeDefined();
      expect(user.id).toMatch(/^user_/);
      expect(user.name).toBe('Alice');
      expect(user.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('idempotently returns existing user case-insensitively', async () => {
      const user1 = await getOrCreateUser('Bob');
      const user2 = await getOrCreateUser('bob');
      expect(user1.id).toBe(user2.id);
      expect(user1.color).toBe(user2.color);
    });
  });

  describe('Snapshots & Menus', () => {
    it('creates a snapshot preserving current board items', async () => {
      await createBoardItem('note', 10, 10, { text: 'Pinned item' }, 'user_1');

      const snapshot = await createSnapshot('2026-10-10');
      expect(snapshot).toBeDefined();
      expect(snapshot.snapshot_date).toBe('2026-10-10');
      expect(snapshot.item_count).toBe(1);

      const snapshots = await getAllSnapshots();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe(snapshot.id);
    });

    it('creates and fetches menu entries', async () => {
      const sections = [{ title: 'Mains', items: [{ name: 'Spaghetti', description: 'Homemade' }] }];
      const menu = await createMenuEntry('2026-10-10', sections, [], 'Dinner');

      expect(menu).toBeDefined();
      expect(menu.menu_date).toBe('2026-10-10');
      expect(menu.title).toBe('Dinner');

      const menus = await getAllMenuEntries();
      expect(menus).toHaveLength(1);
      expect(menus[0].sections).toEqual(sections);
    });
  });
});
