import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { PegboardCanvas } from './PegboardCanvas';
import { Toolbar } from './Toolbar';
import { MobileOnboarding, useMobileOnboarding } from './MobileOnboarding';
import { DesktopOnboarding, useDesktopOnboarding } from './DesktopOnboarding';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { BoardItem, User } from './types';
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
import { useIsMobile, detectMobile } from './ui/use-mobile';

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

// Undo history entry type
interface UndoEntry {
  type: 'update' | 'delete' | 'create';
  itemId: string;
  previousState: BoardItem | null; // null for create (undo = delete)
  newState: BoardItem | null; // null for delete (undo = restore)
}

const MAX_UNDO_HISTORY = 50;

export default function App() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showViewerSettings, setShowViewerSettings] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // Use robust mobile detection hook
  const isMobile = useIsMobile();
  
  const [isUserViewerMode, setIsUserViewerMode] = useState(() => {
    // Auto-start in viewer mode on mobile for easier browsing
    if (typeof window !== 'undefined') {
      return detectMobile();
    }
    return false;
  });
  const [isJiggleMode, setIsJiggleMode] = useState(false);
  
  const { hasSeenOnboarding: hasSeenMobileOnboarding, markAsSeen: markMobileAsSeen } = useMobileOnboarding();
  const { hasSeenOnboarding: hasSeenDesktopOnboarding, markAsSeen: markDesktopAsSeen } = useDesktopOnboarding();
  
  // Undo/Redo history for Ctrl+Z and Ctrl+Shift+Z functionality
  const undoHistoryRef = useRef<UndoEntry[]>([]);
  const redoHistoryRef = useRef<UndoEntry[]>([]);
  const [showMobileOnboarding, setShowMobileOnboarding] = useState(false);
  const [showDesktopOnboarding, setShowDesktopOnboarding] = useState(false);
  const [forceShowMobileOnboarding, setForceShowMobileOnboarding] = useState(false);
  const [forceShowDesktopOnboarding, setForceShowDesktopOnboarding] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Track pending updates to avoid conflicts with real-time sync
  const pendingUpdatesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const localUpdatesRef = useRef<Map<string, Partial<BoardItem>>>(new Map());
  
  // Check if current user is in MonaLisa viewer mode (special read-only account)
  const isMonaLisaMode = currentUser?.name.toLowerCase() === 'monalisa';
  
  // Combined viewer mode - either MonaLisa mode or user-toggled viewer mode
  const isViewerMode = isMonaLisaMode || isUserViewerMode;

  // Select appropriate backend for DnD
  const dndBackend = isTouchDevice() ? TouchBackend : HTML5Backend;
  const dndOptions = isTouchDevice() ? { 
    enableMouseEvents: true,
    delayTouchStart: 0, // No delay for immediate touch dragging
    ignoreContextMenu: true,
  } : undefined;

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

  // Update viewer mode when mobile state changes
  useEffect(() => {
    // If transitioning to mobile, enable viewer mode by default
    if (isMobile) {
      setIsUserViewerMode(true);
    }
  }, [isMobile]);

  // Show onboarding for users who haven't seen it
  useEffect(() => {
    if (currentUser && !isLoading) {
      if (isMobile && !hasSeenMobileOnboarding) {
        setShowMobileOnboarding(true);
      } else if (!isMobile && !hasSeenDesktopOnboarding) {
        setShowDesktopOnboarding(true);
      }
    }
  }, [isMobile, currentUser, hasSeenMobileOnboarding, hasSeenDesktopOnboarding, isLoading]);

  // Handle #instructions hash to show onboarding
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#instructions') {
        // Show appropriate onboarding based on device
        if (isMobile) {
          setForceShowMobileOnboarding(true);
          setShowMobileOnboarding(true);
        } else {
          setForceShowDesktopOnboarding(true);
          setShowDesktopOnboarding(true);
        }
        // Clear the hash after showing
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    
    // Check on mount
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isMobile]);

  // Refs to store handleUndo/handleRedo to avoid dependency ordering issues
  const handleUndoRef = useRef<() => void>(() => {});
  const handleRedoRef = useRef<() => void>(() => {});
  
  // Keyboard shortcuts: Escape for exit, Ctrl+Z for undo, Ctrl+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedoRef.current();
        return;
      }
      
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
        return;
      }
      
      if (e.key === 'Escape') {
        if (isJiggleMode) {
          setIsJiggleMode(false);
        } else if (isMonaLisaMode) {
        setShowViewerSettings(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMonaLisaMode, isJiggleMode]);

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
        updated_by: (item as any).updated_by,
        z_index: (item as any).z_index,
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
        updated_by: (item as any).updated_by,
        z_index: (item as any).z_index,
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
            updated_by: payload.new.updated_by,
            z_index: payload.new.z_index,
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
            updated_by: payload.new.updated_by,
            z_index: payload.new.z_index,
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

  const handleAddItem = async (type: 'note' | 'photo' | 'list' | 'receipt') => {
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
    debounce(async (id: string, updates: Partial<BoardItem>, userId?: string) => {
      try {
        const supabaseUpdates: any = {};
        if (updates.x !== undefined) supabaseUpdates.x = updates.x;
        if (updates.y !== undefined) supabaseUpdates.y = updates.y;
        if (updates.rotation !== undefined) supabaseUpdates.rotation = updates.rotation;
        // Track who made this edit
        if (userId) supabaseUpdates.updated_by = userId;

        await updateBoardItem(id, supabaseUpdates);
        
        // Clear local update tracking after successful sync
        localUpdatesRef.current.delete(id);
        
        // Finalize undo entry - the drag sequence is complete
        const originalPos = lastUndoPositionRef.current.get(id);
        if (originalPos) {
          // Get current state of the item
          const currentItem = items.find(item => item.id === id);
          if (currentItem) {
            // Create undo entry with the original position before drag started
            const previousState: BoardItem = {
              ...currentItem,
              x: originalPos.x,
              y: originalPos.y,
              rotation: originalPos.rotation,
            };
            undoHistoryRef.current.push({
              type: 'update',
              itemId: id,
              previousState,
              newState: currentItem,
            });
            // Keep history limited
            if (undoHistoryRef.current.length > MAX_UNDO_HISTORY) {
              undoHistoryRef.current.shift();
            }
          }
          lastUndoPositionRef.current.delete(id);
        }
      } catch (error) {
        console.error('Error updating position:', error);
        localUpdatesRef.current.delete(id);
        lastUndoPositionRef.current.delete(id);
      }
    }, 300),
    [items]
  );

  // Debounced update function for content
  const debouncedContentUpdate = useCallback(
    debounce(async (id: string, content: any, userId?: string) => {
      try {
        const supabaseUpdates: any = { content };
        // Track who made this edit
        if (userId) supabaseUpdates.updated_by = userId;
        
        await updateBoardItem(id, supabaseUpdates);
        
        // Clear local update tracking after successful sync
        localUpdatesRef.current.delete(id);
      } catch (error) {
        console.error('Error updating content:', error);
        localUpdatesRef.current.delete(id);
      }
    }, 500),
    []
  );

  // Add entry to undo history (clears redo history)
  const pushUndoEntry = useCallback((entry: UndoEntry) => {
    undoHistoryRef.current.push(entry);
    // Clear redo history when a new action is performed
    redoHistoryRef.current = [];
    // Keep history limited
    if (undoHistoryRef.current.length > MAX_UNDO_HISTORY) {
      undoHistoryRef.current.shift();
    }
  }, []);
  
  // Undo the last action (pushes to redo stack)
  const handleUndo = useCallback(async () => {
    if (undoHistoryRef.current.length === 0) {
      return;
    }
    
    const entry = undoHistoryRef.current.pop()!;
    
    try {
      if (entry.type === 'update' && entry.previousState) {
        // Get current state before restoring for redo
        const currentItem = items.find(item => item.id === entry.itemId);
        
        // Restore previous state
        const restoredItem = entry.previousState;
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === entry.itemId ? restoredItem : item
          )
        );
        await updateBoardItem(entry.itemId, {
          x: restoredItem.x,
          y: restoredItem.y,
          rotation: restoredItem.rotation,
          content: restoredItem.content,
          color: restoredItem.color,
        });
        
        // Push to redo stack (inverse: current becomes previous, restored becomes new)
        if (currentItem) {
          redoHistoryRef.current.push({
            type: 'update',
            itemId: entry.itemId,
            previousState: restoredItem,
            newState: currentItem,
          });
        }
        
        toast.success('Undone');
      } else if (entry.type === 'delete' && entry.previousState) {
        // Restore deleted item
        const restoredItem = entry.previousState;
        setItems(prevItems => [...prevItems, restoredItem]);
        await createBoardItem(
          restoredItem.type,
          restoredItem.x,
          restoredItem.y,
          restoredItem.content,
          restoredItem.created_by || '',
          restoredItem.rotation,
          restoredItem.color
        );
        
        // Push to redo stack (inverse: redo will delete this item)
        redoHistoryRef.current.push({
          type: 'create',
          itemId: entry.itemId,
          previousState: null,
          newState: restoredItem,
        });
        
        toast.success('Item restored');
      } else if (entry.type === 'create' && entry.newState) {
        // Delete the created item
        const itemToDelete = items.find(item => item.id === entry.itemId);
        setItems(prevItems => prevItems.filter(item => item.id !== entry.itemId));
        await deleteBoardItem(entry.itemId);
        
        // Push to redo stack (inverse: redo will recreate this item)
        if (itemToDelete) {
          redoHistoryRef.current.push({
            type: 'delete',
            itemId: entry.itemId,
            previousState: itemToDelete,
            newState: null,
          });
        }
        
        toast.success('Creation undone');
      }
    } catch (error) {
      console.error('Error undoing action:', error);
      toast.error('Failed to undo');
    }
  }, [items]);
  
  // Redo the last undone action
  const handleRedo = useCallback(async () => {
    if (redoHistoryRef.current.length === 0) {
      return;
    }
    
    const entry = redoHistoryRef.current.pop()!;
    
    try {
      if (entry.type === 'update' && entry.newState) {
        // Apply the "new" state from the redo entry
        const restoredItem = entry.newState;
        const currentItem = items.find(item => item.id === entry.itemId);
        
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === entry.itemId ? restoredItem : item
          )
        );
        await updateBoardItem(entry.itemId, {
          x: restoredItem.x,
          y: restoredItem.y,
          rotation: restoredItem.rotation,
          content: restoredItem.content,
          color: restoredItem.color,
        });
        
        // Push back to undo stack
        if (currentItem) {
          undoHistoryRef.current.push({
            type: 'update',
            itemId: entry.itemId,
            previousState: currentItem,
            newState: restoredItem,
          });
        }
        
        toast.success('Redone');
      } else if (entry.type === 'delete' && entry.previousState) {
        // Re-delete the item
        setItems(prevItems => prevItems.filter(item => item.id !== entry.itemId));
        await deleteBoardItem(entry.itemId);
        
        // Push back to undo stack
        undoHistoryRef.current.push({
          type: 'delete',
          itemId: entry.itemId,
          previousState: entry.previousState,
          newState: null,
        });
        
        toast.success('Redone');
      } else if (entry.type === 'create' && entry.newState) {
        // Re-create the item
        const restoredItem = entry.newState;
        setItems(prevItems => [...prevItems, restoredItem]);
        await createBoardItem(
          restoredItem.type,
          restoredItem.x,
          restoredItem.y,
          restoredItem.content,
          restoredItem.created_by || '',
          restoredItem.rotation,
          restoredItem.color
        );
        
        // Push back to undo stack
        undoHistoryRef.current.push({
          type: 'create',
          itemId: entry.itemId,
          previousState: null,
          newState: restoredItem,
        });
        
        toast.success('Redone');
      }
    } catch (error) {
      console.error('Error redoing action:', error);
      toast.error('Failed to redo');
    }
  }, [items]);
  
  // Keep undo/redo refs updated
  useEffect(() => {
    handleUndoRef.current = handleUndo;
  }, [handleUndo]);
  
  useEffect(() => {
    handleRedoRef.current = handleRedo;
  }, [handleRedo]);
  
  // Track last position for undo (only track first change in a drag sequence)
  const lastUndoPositionRef = useRef<Map<string, { x: number; y: number; rotation: number }>>(new Map());

  const handleUpdateItem = (id: string, updates: Partial<BoardItem>) => {
    // Prevent updates in viewer mode
    if (isViewerMode) {
      return;
    }

    // Track undo for position/rotation changes (only first change in sequence)
    if ((updates.x !== undefined || updates.y !== undefined || updates.rotation !== undefined)) {
      const currentItem = items.find(item => item.id === id);
      if (currentItem && !lastUndoPositionRef.current.has(id)) {
        // Store the original position before this drag sequence starts
        lastUndoPositionRef.current.set(id, {
          x: currentItem.x,
          y: currentItem.y,
          rotation: currentItem.rotation || 0,
        });
      }
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
      debouncedPositionUpdate(id, updates, currentUser?.id);
    } else if (updates.content !== undefined) {
      debouncedContentUpdate(id, updates.content, currentUser?.id);
    } else {
      // For other updates (like color), sync immediately
      localUpdatesRef.current.delete(id);
      const supabaseUpdates = { ...updates, updated_by: currentUser?.id };
      updateBoardItem(id, supabaseUpdates as any).catch(error => {
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

    // Store item for undo before deleting
    const itemToDelete = items.find(item => item.id === id);

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
      
      // Add to undo history after successful delete
      if (itemToDelete) {
        pushUndoEntry({
          type: 'delete',
          itemId: id,
          previousState: itemToDelete,
          newState: null,
        });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
      // Reload on error
      loadInitialData();
    }
  };

  // Bring item to front (highest z-index)
  const handleBringToFront = useCallback((id: string) => {
    const maxZ = Math.max(...items.map(item => item.z_index || 0), 0);
    const newZIndex = maxZ + 1;
    
    // Mark as having local update to prevent real-time overwrite
    localUpdatesRef.current.set(id, { z_index: newZIndex });
    
    // Update locally
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, z_index: newZIndex } : item
      )
    );
    
    // Update in database
    updateBoardItem(id, { z_index: newZIndex } as any)
      .then(() => {
        // Clear local update flag after successful save
        setTimeout(() => localUpdatesRef.current.delete(id), 500);
      })
      .catch(error => {
        console.error('Error updating z-index:', error);
        localUpdatesRef.current.delete(id);
      });
  }, [items]);

  // Send item to back (lowest z-index)
  const handleSendToBack = useCallback((id: string) => {
    const minZ = Math.min(...items.map(item => item.z_index || 0), 0);
    const newZIndex = minZ - 1;
    
    // Mark as having local update to prevent real-time overwrite
    localUpdatesRef.current.set(id, { z_index: newZIndex });
    
    // Update locally
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, z_index: newZIndex } : item
      )
    );
    
    // Update in database
    updateBoardItem(id, { z_index: newZIndex } as any)
      .then(() => {
        // Clear local update flag after successful save
        setTimeout(() => localUpdatesRef.current.delete(id), 500);
      })
      .catch(error => {
        console.error('Error updating z-index:', error);
        localUpdatesRef.current.delete(id);
      });
  }, [items]);

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

  // Art TV content (shared between normal and MonaLisa modes)
  const mainContent = (
    <>
          <PegboardCanvas 
            items={items}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            isEditMode={!!currentUser && !isViewerMode}
            users={users}
            currentUserId={currentUser?.id}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            isViewerMode={isViewerMode}
            isJiggleMode={isJiggleMode}
            onEnterJiggleMode={() => setIsJiggleMode(true)}
            onExitJiggleMode={() => setIsJiggleMode(false)}
            isMobile={isMobile}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
        isArtTVMode={isMonaLisaMode}
          />
    </>
  );

  return (
    <>
      <DndProvider backend={dndBackend} options={dndOptions}>
        {/* MonaLisa Art TV Mode - full screen with vignette frame */}
        {isMonaLisaMode ? (
          <div className="w-screen h-screen overflow-hidden relative">
            {mainContent}
            
            {/* Art TV vignette frame overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: `
                  inset 0 0 100px 40px rgba(0, 0, 0, 0.7),
                  inset 0 0 200px 80px rgba(0, 0, 0, 0.4),
                  inset 0 0 300px 100px rgba(0, 0, 0, 0.2)
                `,
                zIndex: 9999,
              }}
            />
          </div>
        ) : (
          <div className="w-screen h-screen overflow-hidden">
            {mainContent}
        
        {/* Show toolbar for everyone, but viewer mode gets modified toolbar */}
        <Toolbar 
          onAddItem={handleAddItem}
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isViewerMode={isMonaLisaMode}
          isUserViewerMode={isUserViewerMode}
          onToggleViewerMode={() => setIsUserViewerMode(prev => !prev)}
          isJiggleMode={isJiggleMode}
          onExitJiggleMode={() => setIsJiggleMode(false)}
        />
          </div>
        )}

        {/* MonaLisa art TV mode: settings dialog (no visible hints) */}
        {isMonaLisaMode && (
          <>
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
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowViewerSettings(false)}
                          className="flex-1 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm"
                        >
                          Close
                        </button>
                        <button
                          onClick={handleLogout}
                          className="flex-1 px-4 py-4 rounded-lg bg-red-900/10 text-red-900 border border-red-900/20 transition-all hover:bg-red-900/20 hover:border-red-900/30 font-medium text-sm"
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
        
        {/* Mobile Onboarding */}
        {showMobileOnboarding && (
          <MobileOnboarding 
            onComplete={() => {
              setShowMobileOnboarding(false);
              setForceShowMobileOnboarding(false);
              markMobileAsSeen();
            }}
            forceShow={forceShowMobileOnboarding}
          />
        )}
        
        {/* Desktop Onboarding */}
        {showDesktopOnboarding && (
          <DesktopOnboarding 
            onComplete={() => {
              setShowDesktopOnboarding(false);
              setForceShowDesktopOnboarding(false);
              markDesktopAsSeen();
            }}
            forceShow={forceShowDesktopOnboarding}
          />
        )}
      </DndProvider>
    </>
  );
}
