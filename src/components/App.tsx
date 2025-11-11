import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { PegboardCanvas } from './PegboardCanvas';
import { Toolbar } from './Toolbar';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { BoardItem, User } from './types';
import { OrientationPrompt } from './OrientationPrompt';
import { 
  supabase, 
  getAllBoardItems, 
  getAllUsers, 
  getOrCreateUser, 
  createBoardItem, 
  updateBoardItem, 
  deleteBoardItem 
} from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

// Detect if touch device (safe for SSR)
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export default function App() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showViewerSettings, setShowViewerSettings] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Track pending updates to avoid conflicts with real-time sync
  const pendingUpdatesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const localUpdatesRef = useRef<Map<string, Partial<BoardItem>>>(new Map());
  
  // Check if current user is in viewer mode
  const isViewerMode = currentUser?.name.toLowerCase() === 'monalisa';

  // Select appropriate backend for DnD
  const dndBackend = isTouchDevice() ? TouchBackend : HTML5Backend;
  const dndOptions = isTouchDevice() ? { enableMouseEvents: true } : undefined;

  // Load initial data from Supabase
  useEffect(() => {
    loadInitialData();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isLoading) {
      setupRealtimeSubscriptions();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isLoading]);

  // Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('pegboard-user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
    }
  }, []);

  // Keyboard shortcut for viewer mode (Escape to toggle settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewerMode) {
        setShowViewerSettings(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerMode]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all board items and users from Supabase
      const [itemsData, usersData] = await Promise.all([
        getAllBoardItems(),
        getAllUsers()
      ]);

      // Convert Supabase data to app format
      const formattedItems: BoardItem[] = itemsData.map(item => ({
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
        rotation: item.rotation,
        color: item.color || undefined,
        content: item.content,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      const formattedUsers: User[] = usersData.map(user => ({
        id: user.id,
        name: user.name,
        color: user.color,
        created_at: user.created_at,
        updated_at: user.updated_at,
      }));

      setItems(formattedItems);
      setUsers(formattedUsers);

      // If no items exist, create demo items
      if (formattedItems.length === 0) {
        await createDemoItems();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load data from server');
    } finally {
      setIsLoading(false);
    }
  };

  const createDemoItems = async () => {
    try {
      const demoItems = [
        {
          type: 'note' as const,
          x: 120,
          y: 80,
          rotation: -2,
          color: '#fef3c7',
          content: { text: 'Welcome to onethreenine corkboard! 🏠' }
        },
        {
          type: 'list' as const,
          x: 400,
          y: 100,
          rotation: 1,
          color: '#dbeafe',
          content: { 
            title: 'Grocery List',
            items: [
              { text: 'Milk', checked: false },
              { text: 'Eggs', checked: true },
              { text: 'Bread', checked: false },
              { text: 'Coffee', checked: false }
            ]
          }
        },
        {
          type: 'photo' as const,
          x: 700,
          y: 150,
          rotation: -3,
          color: '#fce7f3',
          content: { 
            imageUrl: null,
            caption: 'Add your photos!'
          }
        }
      ];

      // Create system user for demo items
      const systemUser = await getOrCreateUser('System');

      for (const item of demoItems) {
        await createBoardItem(
          item.type,
          item.x,
          item.y,
          item.content,
          systemUser.id,
          item.rotation,
          item.color
        );
      }

      // Reload items after creating demo items
      const itemsData = await getAllBoardItems();
      const formattedItems: BoardItem[] = itemsData.map(item => ({
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
        rotation: item.rotation,
        color: item.color || undefined,
        content: item.content,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      setItems(formattedItems);
    } catch (error) {
      console.error('Error creating demo items:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Create a channel for real-time updates
    const channel = supabase
      .channel('board_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'board_items'
        },
        (payload) => {
          const newItem: BoardItem = {
            id: payload.new.id,
            type: payload.new.type,
            x: payload.new.x,
            y: payload.new.y,
            rotation: payload.new.rotation,
            color: payload.new.color,
            content: payload.new.content,
            created_by: payload.new.created_by,
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at,
          };
          
          setItems(prevItems => {
            // Only add if not already in the list
            if (prevItems.find(item => item.id === newItem.id)) {
              return prevItems;
            }
            return [...prevItems, newItem];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'board_items'
        },
        (payload) => {
          const itemId = payload.new.id;
          
          // Skip if we have a pending local update for this item
          if (localUpdatesRef.current.has(itemId)) {
            return;
          }

          const updatedItem: BoardItem = {
            id: payload.new.id,
            type: payload.new.type,
            x: payload.new.x,
            y: payload.new.y,
            rotation: payload.new.rotation,
            color: payload.new.color,
            content: payload.new.content,
            created_by: payload.new.created_by,
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at,
          };
          
          setItems(prevItems =>
            prevItems.map(item => item.id === updatedItem.id ? updatedItem : item)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'board_items'
        },
        (payload) => {
          setItems(prevItems =>
            prevItems.filter(item => item.id !== payload.old.id)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          const newUser: User = {
            id: payload.new.id,
            name: payload.new.name,
            color: payload.new.color,
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at,
          };
          setUsers(prevUsers => {
            if (prevUsers.find(user => user.id === newUser.id)) {
              return prevUsers;
            }
            return [...prevUsers, newUser];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          const updatedUser: User = {
            id: payload.new.id,
            name: payload.new.name,
            color: payload.new.color,
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at,
          };
          setUsers(prevUsers =>
            prevUsers.map(user => user.id === updatedUser.id ? updatedUser : user)
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const handleAddItem = async (type: BoardItem['type']) => {
    if (!currentUser) {
      toast.error('Please log in to add items');
      return;
    }

    if (isViewerMode) {
      toast.error('Viewer mode - cannot add items');
      return;
    }

    try {
      const colors = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#e0e7ff'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const content = type === 'note' ? { text: '' } :
                     type === 'list' ? { title: 'New List', items: [] } :
                     type === 'photo' ? { imageUrl: null, caption: '' } :
                     type === 'receipt' ? { store: '', date: new Date().toLocaleDateString(), items: [], total: 0 } :
                     type === 'menu' ? { title: 'New Event', date: '', items: [] } :
                     {};

      const x = Math.random() * (window.innerWidth - 300) + 50;
      const y = Math.random() * (window.innerHeight - 400) + 50;
      const rotation = Math.random() * 6 - 3;

      // Create optimistic item immediately
      const optimisticId = `temp-${Date.now()}`;
      const optimisticItem: BoardItem = {
        id: optimisticId,
        type,
        x,
        y,
        rotation,
        color: randomColor,
        content,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to UI immediately
      setItems(prev => [...prev, optimisticItem]);

      // Create in database
      const createdItem = await createBoardItem(
        type,
        x,
        y,
        content,
        currentUser.id,
        rotation,
        randomColor
      );

      // Replace optimistic item with real one
      setItems(prev => prev.map(item => 
        item.id === optimisticId ? {
          ...item,
          id: createdItem.id,
          created_at: createdItem.created_at,
          updated_at: createdItem.updated_at,
        } : item
      ));

    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  // Debounced update function for position/rotation
  const debouncedPositionUpdate = useCallback(
    debounce(async (id: string, updates: Partial<BoardItem>) => {
      try {
        const supabaseUpdates: any = {};
        if (updates.x !== undefined) supabaseUpdates.x = updates.x;
        if (updates.y !== undefined) supabaseUpdates.y = updates.y;
        if (updates.rotation !== undefined) supabaseUpdates.rotation = updates.rotation;

        await updateBoardItem(id, supabaseUpdates);
        
        // Clear local update tracking after successful sync
        localUpdatesRef.current.delete(id);
      } catch (error) {
        console.error('Error updating position:', error);
        localUpdatesRef.current.delete(id);
      }
    }, 300),
    []
  );

  // Debounced update function for content
  const debouncedContentUpdate = useCallback(
    debounce(async (id: string, content: any) => {
      try {
        await updateBoardItem(id, { content });
        
        // Clear local update tracking after successful sync
        localUpdatesRef.current.delete(id);
      } catch (error) {
        console.error('Error updating content:', error);
        localUpdatesRef.current.delete(id);
      }
    }, 500),
    []
  );

  const handleUpdateItem = (id: string, updates: Partial<BoardItem>) => {
    // Prevent updates in viewer mode
    if (isViewerMode) {
      return;
    }

    // Mark as locally updating
    localUpdatesRef.current.set(id, updates);

    // Update UI immediately (optimistic update)
    setItems(prevItems =>
      prevItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    );

    // Debounce database update based on what changed
    if (updates.x !== undefined || updates.y !== undefined || updates.rotation !== undefined) {
      debouncedPositionUpdate(id, updates);
    } else if (updates.content !== undefined) {
      debouncedContentUpdate(id, updates.content);
    } else {
      // For other updates (like color), sync immediately
      localUpdatesRef.current.delete(id);
      updateBoardItem(id, updates).catch(error => {
        console.error('Error updating item:', error);
        toast.error('Failed to update item');
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    // Prevent deletes in viewer mode
    if (isViewerMode) {
      toast.error('Viewer mode - cannot delete items');
      return;
    }

    try {
      // Optimistically remove from UI
      setItems(prevItems => prevItems.filter(item => item.id !== id));

      // Cancel any pending updates
      localUpdatesRef.current.delete(id);
      if (pendingUpdatesRef.current.has(id)) {
        clearTimeout(pendingUpdatesRef.current.get(id));
        pendingUpdatesRef.current.delete(id);
      }

      await deleteBoardItem(id);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
      // Reload on error
      loadInitialData();
    }
  };

  const handleLogin = async (userData: { name: string }) => {
    try {
      const user = await getOrCreateUser(userData.name);

      const formattedUser: User = {
        id: user.id,
        name: user.name,
        color: user.color,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      setCurrentUser(formattedUser);
      localStorage.setItem('pegboard-user', JSON.stringify(formattedUser));
      
      toast.success(`Welcome, ${user.name}! 👋`);
    } catch (error) {
      console.error('Error logging in:', error);
      toast.error('Failed to log in');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pegboard-user');
    setShowViewerSettings(false);
    toast.success('Logged out successfully');
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-amber-600"></div>
      </div>
    );
  }

  return (
    <>
      <DndProvider backend={dndBackend} options={dndOptions}>
        <div className="w-screen h-screen overflow-hidden">
          <PegboardCanvas 
            items={items}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            isEditMode={!!currentUser && !isViewerMode}
            users={users}
            currentUserId={currentUser?.id}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
          />
        
        {/* Show toolbar for everyone, but viewer mode gets modified toolbar */}
        <Toolbar 
          onAddItem={handleAddItem}
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isViewerMode={isViewerMode}
        />

        {/* Viewer mode: ESC hint and settings dialog */}
        {isViewerMode && (
          <>
            {/* Subtle ESC hint */}
            <div className="fixed bottom-4 right-4 text-xs text-white/50 hover:text-white/80 transition-colors pointer-events-none">
              Press ESC for settings
            </div>

            {/* Settings dialog */}
            {showViewerSettings && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
                  style={{ zIndex: 999998 }}
                  onClick={() => setShowViewerSettings(false)}
                />
                
                {/* Settings Post-it */}
                <div 
                  className="fixed animate-in zoom-in-95 fade-in-0"
                  style={{ 
                    zIndex: 999999,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-1deg)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Masking tape */}
                  <div 
                    className="absolute top-0 left-1/2 z-10 pointer-events-none"
                    style={{
                      width: '80px',
                      height: '35px',
                      transform: `translateX(-50%) translateY(-18px) rotate(3deg)`,
                    }}
                  >
                    <img 
                      src="/assets/images/maskingtape/2ef85379-640c-4e19-9ed3-8ba8485914ae_rw_3840.png"
                      alt="masking tape"
                      className="w-full h-full object-cover"
                      style={{
                        filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
                      }}
                    />
                  </div>

                  <div 
                    className="relative"
                    style={{
                      background: '#fef3c7',
                      borderRadius: '2px',
                      boxShadow: `
                        0 4px 8px rgba(0, 0, 0, 0.15),
                        0 8px 20px rgba(0, 0, 0, 0.1),
                        inset 0 -1px 2px rgba(0, 0, 0, 0.05)
                      `,
                      width: '400px',
                      padding: '48px 64px',
                    }}
                  >
                    <div className="space-y-8">
                      {/* Viewer Mode Info */}
                      <div className="space-y-3 text-center">
                        <h3 className="font-medium text-lg text-amber-900/90">👁️ Viewer Mode</h3>
                        <div className="text-sm text-amber-900/70">
                          Signed in as <span className="font-medium">{currentUser?.name}</span>
                        </div>
                        <div className="text-xs text-amber-900/60">
                          Read-only display • Press ESC to close
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowViewerSettings(false)}
                          className="flex-1 px-4 py-3.5 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm"
                        >
                          Close
                        </button>
                        <button
                          onClick={handleLogout}
                          className="flex-1 px-4 py-3.5 rounded-lg bg-red-900/10 text-red-900 border border-red-900/20 transition-all hover:bg-red-900/20 hover:border-red-900/30 font-medium text-sm"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <Toaster />
        </div>
      </DndProvider>
      
      {/* Orientation prompt - render last to be on top */}
      <OrientationPrompt />
    </>
  );
}
