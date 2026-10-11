import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Get environment variables
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

// Determine whether to run in offline local mock mode or connect to a real Supabase backend.
// If valid Supabase credentials are not provided (or PUBLIC_USE_LOCAL_MOCK is set), fall back to localStorage.
const isLocalMock =
  import.meta.env.PUBLIC_USE_LOCAL_MOCK === 'true' ||
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes('placeholder.supabase.co');

// ============================================
// SUPABASE CLIENT (REAL OR MOCK)
// ============================================
export const supabase = isLocalMock
  ? ({
      channel: () => ({
        on: () => (supabase as any).channel(),
        subscribe: () => {},
      }),
      removeChannel: () => {},
      storage: {
        from: () => ({
          upload: async (fileName: string, file: File) => ({ error: null }),
          getPublicUrl: (fileName: string) => ({
            data: {
              publicUrl:
                typeof window !== 'undefined'
                  ? localStorage.getItem(`img_${fileName}`) || ''
                  : '',
            },
          }),
        }),
      },
      rpc: async (_func: string) => ({ error: null }),
    } as any)
  : createClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );

// ============================================
// LOCAL STORAGE HELPERS
// ============================================
const getLocalData = (key: string) => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const setLocalData = (key: string, data: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

// ============================================
// USER MANAGEMENT
// ============================================
export async function getOrCreateUser(name: string) {
  if (isLocalMock) {
    const users = getLocalData('onethreenine_users');
    const existing = users.find((u: any) => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const colors = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#e0e7ff', '#fef08a', '#fbcfe8', '#d4d4ff'];
    const newUser = {
      id: 'user_' + Date.now().toString(),
      name,
      color: colors[Math.floor(Math.random() * colors.length)],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocalData('onethreenine_users', [...users, newUser]);
    return newUser;
  }

  const colors = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#e0e7ff', '#fef08a', '#fbcfe8', '#d4d4ff'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      name,
      color: randomColor,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  return newUser;
}

export async function getAllUsers() {
  if (isLocalMock) {
    return getLocalData('onethreenine_users');
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }

  return data;
}

// ============================================
// STORAGE
// ============================================
export async function uploadImage(file: File, userId: string) {
  if (isLocalMock) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const fileName = `${userId}/${Date.now()}`;
        try {
          localStorage.setItem(`img_${fileName}`, base64);
        } catch (e) {
          console.warn('LocalStorage quota exceeded for image, returning base64 directly');
        }
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from('board-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('board-images')
    .getPublicUrl(fileName);

  return publicUrl;
}

// ============================================
// BOARD ITEMS
// ============================================
export async function createBoardItem(
  type: Database['public']['Tables']['board_items']['Row']['type'],
  x: number,
  y: number,
  content: any,
  createdBy: string,
  rotation?: number,
  color?: string
) {
  if (isLocalMock) {
    const items = getLocalData('onethreenine_board_items');
    const newItem = {
      id: 'item_' + Date.now().toString() + Math.random().toString(36).substring(2, 7),
      type,
      x,
      y,
      rotation: rotation || 0,
      color: color || null,
      content,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      z_index: 0,
    };
    setLocalData('onethreenine_board_items', [...items, newItem]);
    return newItem;
  }

  const { data, error } = await supabase
    .from('board_items')
    .insert({
      type,
      x,
      y,
      rotation: rotation || 0,
      color,
      content,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating board item:', error);
    throw error;
  }

  return data;
}

export async function updateBoardItem(
  id: string,
  updates: Partial<Database['public']['Tables']['board_items']['Update']>
) {
  if (isLocalMock) {
    let items = getLocalData('onethreenine_board_items');
    let updatedItem: any = null;
    items = items.map((item: any) => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates, updated_at: new Date().toISOString() };
        return updatedItem;
      }
      return item;
    });
    if (updatedItem) {
      setLocalData('onethreenine_board_items', items);
    }
    return updatedItem;
  }

  const { data, error } = await supabase
    .from('board_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating board item:', error);
    throw error;
  }

  return data;
}

export async function deleteBoardItem(id: string) {
  if (isLocalMock) {
    let items = getLocalData('onethreenine_board_items');
    items = items.filter((item: any) => item.id !== id);
    setLocalData('onethreenine_board_items', items);
    return;
  }

  const { error } = await supabase
    .from('board_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting board item:', error);
    throw error;
  }
}

export async function getAllBoardItems() {
  if (isLocalMock) {
    return getLocalData('onethreenine_board_items');
  }

  const { data, error } = await supabase
    .from('board_items')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching board items:', error);
    throw error;
  }

  return data;
}

// ============================================
// SNAPSHOT MANAGEMENT FUNCTIONS
// ============================================
export async function createSnapshot(snapshotDate?: string) {
  if (isLocalMock) {
    const dateToUse = snapshotDate || new Date().toISOString().split('T')[0];
    const items = await getAllBoardItems();
    let snaps = getLocalData('onethreenine_snapshots');
    const snapIndex = snaps.findIndex((s: any) => s.snapshot_date === dateToUse);

    const newSnap = {
      id: 'snap_' + Date.now().toString(),
      snapshot_date: dateToUse,
      items_data: items,
      item_count: items.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (snapIndex >= 0) snaps[snapIndex] = newSnap;
    else snaps.push(newSnap);

    setLocalData('onethreenine_snapshots', snaps);
    return newSnap;
  }

  const dateToUse = snapshotDate || new Date().toISOString().split('T')[0];
  const items = await getAllBoardItems();

  const { data, error } = await supabase
    .from('board_snapshots')
    .upsert(
      {
        snapshot_date: dateToUse,
        items_data: items,
        item_count: items.length,
      },
      {
        onConflict: 'snapshot_date',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error creating snapshot:', error);
    throw error;
  }

  return data;
}

export async function getAllSnapshots() {
  if (isLocalMock) {
    return getLocalData('onethreenine_snapshots').sort((a: any, b: any) =>
      b.snapshot_date.localeCompare(a.snapshot_date)
    );
  }

  const { data, error } = await supabase
    .from('board_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false });

  if (error) {
    console.error('Error fetching snapshots:', error);
    throw error;
  }

  return data;
}

export async function getSnapshotByDate(date: string) {
  if (isLocalMock) {
    return getLocalData('onethreenine_snapshots').find((s: any) => s.snapshot_date === date);
  }

  const { data, error } = await supabase
    .from('board_snapshots')
    .select('*')
    .eq('snapshot_date', date)
    .maybeSingle();

  if (error) {
    console.error('Error fetching snapshot:', error);
    throw error;
  }

  return data;
}

export async function getSnapshotsByDateRange(startDate: string, endDate: string) {
  if (isLocalMock) {
    return getLocalData('onethreenine_snapshots')
      .filter((s: any) => s.snapshot_date >= startDate && s.snapshot_date <= endDate)
      .sort((a: any, b: any) => b.snapshot_date.localeCompare(a.snapshot_date));
  }

  const { data, error } = await supabase
    .from('board_snapshots')
    .select('*')
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: false });

  if (error) {
    console.error('Error fetching snapshots by date range:', error);
    throw error;
  }

  return data;
}

export async function deleteSnapshot(id: string) {
  if (isLocalMock) {
    setLocalData(
      'onethreenine_snapshots',
      getLocalData('onethreenine_snapshots').filter((s: any) => s.id !== id)
    );
    return;
  }

  const { error } = await supabase
    .from('board_snapshots')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting snapshot:', error);
    throw error;
  }
}

export async function triggerDailySnapshot() {
  if (isLocalMock) {
    await createSnapshot();
    return;
  }

  const { error } = await supabase.rpc('create_daily_snapshot');

  if (error) {
    console.error('Error triggering daily snapshot:', error);
    throw error;
  }
}

// ============================================
// MENU ENTRIES FUNCTIONS
// ============================================
export async function getAllMenuEntries() {
  if (isLocalMock) {
    return getLocalData('onethreenine_menus').sort((a: any, b: any) =>
      b.menu_date.localeCompare(a.menu_date)
    );
  }

  const { data, error } = await supabase
    .from('menu_entries')
    .select('*')
    .order('menu_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching menu entries:', error);
    throw error;
  }

  return data;
}

export async function createMenuEntry(
  menuDate: string,
  sections: any[],
  photos: string[] = [],
  title?: string
) {
  if (isLocalMock) {
    const menus = getLocalData('onethreenine_menus');
    const newMenu = {
      id: 'menu_' + Date.now().toString(),
      menu_date: menuDate,
      title,
      sections,
      photos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocalData('onethreenine_menus', [...menus, newMenu]);
    return newMenu;
  }

  const { data, error } = await supabase
    .from('menu_entries')
    .insert({
      menu_date: menuDate,
      title,
      sections,
      photos,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating menu entry:', error);
    throw error;
  }

  return data;
}

export async function getMenuEntryByDate(date: string) {
  if (isLocalMock) {
    return getLocalData('onethreenine_menus').find((m: any) => m.menu_date === date);
  }

  const { data, error } = await supabase
    .from('menu_entries')
    .select('*')
    .eq('menu_date', date)
    .maybeSingle();

  if (error) {
    console.error('Error fetching menu entry:', error);
    throw error;
  }

  return data;
}

export async function deleteMenuEntry(id: string) {
  if (isLocalMock) {
    setLocalData(
      'onethreenine_menus',
      getLocalData('onethreenine_menus').filter((m: any) => m.id !== id)
    );
    return;
  }

  const { error } = await supabase
    .from('menu_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting menu entry:', error);
    throw error;
  }
}
