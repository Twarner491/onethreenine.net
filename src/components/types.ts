export interface BoardItem {
  id: string;
  type: 'note' | 'photo' | 'list' | 'receipt' | 'menu';
  x: number;
  y: number;
  content: any;
  rotation?: number;
  color?: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
  z_index?: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  twitterHandle?: string;
  profilePic?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BoardSnapshot {
  id: string;
  snapshot_date: string;
  items_data: BoardItem[];
  item_count: number;
  created_at: string;
  updated_at: string;
}

