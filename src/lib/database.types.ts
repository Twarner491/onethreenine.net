export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      board_items: {
        Row: {
          id: string
          type: 'note' | 'photo' | 'list' | 'receipt' | 'menu'
          x: number
          y: number
          rotation: number
          color: string | null
          content: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'note' | 'photo' | 'list' | 'receipt' | 'menu'
          x: number
          y: number
          rotation?: number
          color?: string | null
          content: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'note' | 'photo' | 'list' | 'receipt' | 'menu'
          x?: number
          y?: number
          rotation?: number
          color?: string | null
          content?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      board_snapshots: {
        Row: {
          id: string
          snapshot_date: string
          items_data: Json
          item_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          snapshot_date: string
          items_data: Json
          item_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          snapshot_date?: string
          items_data?: Json
          item_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_entries: {
        Row: {
          id: string
          menu_date: string
          title: string | null
          sections: Json
          photos: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          menu_date: string
          title?: string | null
          sections: Json
          photos?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          menu_date?: string
          title?: string | null
          sections?: Json
          photos?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      board_items_with_users: {
        Row: {
          id: string
          type: 'note' | 'photo' | 'list' | 'receipt' | 'menu'
          x: number
          y: number
          rotation: number
          color: string | null
          content: Json
          created_by: string | null
          created_at: string
          updated_at: string
          creator_name: string | null
          creator_color: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_daily_snapshot: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

