import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Get environment variables
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
// During build time, this might not have env vars, but that's okay since
// the client is only used at runtime in the browser
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Helper function to get or create a user
export async function getOrCreateUser(name: string) {
  const colors = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#e0e7ff', '#fef08a', '#fbcfe8', '#d4d4ff'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  // Check if user with this name already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  // Create new user
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

// Helper function to upload image to Supabase Storage
export async function uploadImage(file: File, userId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  
  const { error } = await supabase.storage
    .from('board-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('board-images')
    .getPublicUrl(fileName);
  
  return publicUrl;
}

// Helper function to create a board item
export async function createBoardItem(
  type: Database['public']['Tables']['board_items']['Row']['type'],
  x: number,
  y: number,
  content: any,
  createdBy: string,
  rotation?: number,
  color?: string
) {
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

// Helper function to update a board item
export async function updateBoardItem(id: string, updates: Partial<Database['public']['Tables']['board_items']['Update']>) {
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

// Helper function to delete a board item
export async function deleteBoardItem(id: string) {
  const { error } = await supabase
    .from('board_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting board item:', error);
    throw error;
  }
}

// Helper function to get all board items
export async function getAllBoardItems() {
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

// Helper function to get all users
export async function getAllUsers() {
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
// SNAPSHOT MANAGEMENT FUNCTIONS
// ============================================

// Helper function to create a snapshot of the current board state
export async function createSnapshot(snapshotDate?: string) {
  const dateToUse = snapshotDate || new Date().toISOString().split('T')[0];
  
  // Get all current board items
  const items = await getAllBoardItems();
  
  // Create snapshot
  const { data, error } = await supabase
    .from('board_snapshots')
    .upsert({
      snapshot_date: dateToUse,
      items_data: items,
      item_count: items.length,
    }, {
      onConflict: 'snapshot_date'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating snapshot:', error);
    throw error;
  }

  return data;
}

// Helper function to get all snapshots
export async function getAllSnapshots() {
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

// Helper function to get a specific snapshot by date
export async function getSnapshotByDate(date: string) {
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

// Helper function to get snapshots within a date range
export async function getSnapshotsByDateRange(startDate: string, endDate: string) {
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

// Helper function to delete a snapshot
export async function deleteSnapshot(id: string) {
  const { error } = await supabase
    .from('board_snapshots')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting snapshot:', error);
    throw error;
  }
}

// Helper function to call the database function to create daily snapshot
export async function triggerDailySnapshot() {
  const { error } = await supabase.rpc('create_daily_snapshot');

  if (error) {
    console.error('Error triggering daily snapshot:', error);
    throw error;
  }
}

// ============================================
// MENU ENTRIES FUNCTIONS
// ============================================

// Helper function to get all menu entries
export async function getAllMenuEntries() {
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

// Helper function to create a menu entry
export async function createMenuEntry(
  menuDate: string,
  sections: any[],
  photos: string[] = [],
  title?: string
) {
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

// Helper function to get a menu entry by date
export async function getMenuEntryByDate(date: string) {
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

// Helper function to delete a menu entry
export async function deleteMenuEntry(id: string) {
  const { error } = await supabase
    .from('menu_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting menu entry:', error);
    throw error;
  }
}

