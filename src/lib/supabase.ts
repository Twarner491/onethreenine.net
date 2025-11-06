import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Get environment variables
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

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

