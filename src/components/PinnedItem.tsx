import { useDrag } from 'react-dnd';
import type { BoardItem, User } from './types';
import { PostItNote } from './items/PostItNote';
import { PolaroidPhoto } from './items/PolaroidPhoto';
import { ListCard } from './items/ListCard';
import { Receipt } from './items/Receipt';
import { MenuCard } from './items/MenuCard';
import { EventCard } from './items/EventCard';
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

interface PinnedItemProps {
  item: BoardItem;
  onUpdate: (id: string, updates: Partial<BoardItem>) => void;
  onDelete: (id: string) => void;
  isEditMode: boolean;
  users: User[];
  currentUserId?: string;
  onMobileEditingChange?: (isEditing: boolean, itemId: string | null) => void;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect?: () => void;
  scale: number;
  isJiggleMode?: boolean;
  onEnterJiggleMode?: () => void;
  isMobile?: boolean;
  onEdgePan?: (deltaX: number, deltaY: number) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  maxZIndex?: number;
  minZIndex?: number;
  activeContextMenuId?: string | null;
  onContextMenuOpen?: (id: string | null) => void;
  readOnlyContextMenu?: boolean;
}

interface DragItem {
  id: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

// Detect if touch device (safe for SSR)
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

const maskingTapeTextures = [
  '/assets/images/maskingtape/10c87e82-99cf-4df0-b47b-8f650d4b21e9_rw_1920.png',
  '/assets/images/maskingtape/1672c350-9ee4-4030-bca2-abbf9a2756d7_rw_600.png',
  '/assets/images/maskingtape/2ef85379-640c-4e19-9ed3-8ba8485914ae_rw_3840.png',
  '/assets/images/maskingtape/3f238238-e95b-48db-8685-59ae3016ff81_rw_1920.png',
  '/assets/images/maskingtape/494681b1-8ef8-400e-a219-50102c1ee98b_rw_1200.png',
  '/assets/images/maskingtape/5c1ae790-9d7f-40f8-9fe8-0601ef68794d_rw_600.png',
  '/assets/images/maskingtape/884001be-0d19-4cd9-8f07-f930d2f0e6ee_rw_1200.png',
  '/assets/images/maskingtape/9e4367ef-5bd2-44f2-8779-3b4fdd3f696a_rw_1920.png',
  '/assets/images/maskingtape/a05a2d05-7a39-433e-bf76-597003f7789b_rw_1920.png',
  '/assets/images/maskingtape/d868c31c-996d-40bd-ace9-324d7457e1fc_rw_600.png',
  '/assets/images/maskingtape/f08402eb-b275-4034-8d66-4981f93ad679_rw_1200.png',
];

export function PinnedItem({ item, onUpdate, onDelete, isEditMode, users, currentUserId, onMobileEditingChange, isSelected, onSelect, onDeselect, scale, isJiggleMode, onEnterJiggleMode, isMobile, onEdgePan, onBringToFront, onSendToBack, maxZIndex, minZIndex, activeContextMenuId, onContextMenuOpen, readOnlyContextMenu }: PinnedItemProps) {
  // Select random masking tape and rotation once and keep it consistent
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10, // Random rotation between -5 and 5 degrees
    []
  );
  
  // Random jiggle animation delay for variety
  const jiggleDelay = useMemo(() => Math.random() * 0.3, []);
  
  // Only show edit mode when the item is selected AND user has edit permissions
  const shouldShowEditMode = isEditMode && isSelected;
  
  const [isRotating, setIsRotating] = useState(false);
  const [isMobileEditing, setIsMobileEditing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [isRotationDragging, setIsRotationDragging] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(item.rotation || 0);
  const itemRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });
  const rotationStartAngleRef = useRef(0);
  const rotationStartValueRef = useRef(0);
  const isTouchDevice_ = useMemo(() => isTouchDevice(), []);
  
  // Context menu state - coordinated with parent to ensure only one is open at a time
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const isContextMenuOpen = activeContextMenuId === item.id && contextMenuPos !== null;
  
  // Get creator info
  const creator = useMemo(() => {
    if (!item.created_by) return null;
    return users.find(u => u.id === item.created_by) || null;
  }, [item.created_by, users]);
  
  // Get editor info (person who last updated the item)
  const editor = useMemo(() => {
    if (!item.updated_by) return null;
    return users.find(u => u.id === item.updated_by) || null;
  }, [item.updated_by, users]);
  
  // Check if the item was edited (updated_at is significantly different from created_at)
  const wasEdited = useMemo(() => {
    if (!item.created_at || !item.updated_at) return false;
    const created = new Date(item.created_at).getTime();
    const updated = new Date(item.updated_at).getTime();
    // Consider edited if updated more than 1 second after creation
    return (updated - created) > 1000;
  }, [item.created_at, item.updated_at]);
  
  // Check if edited by a different person
  const editedByDifferentPerson = useMemo(() => {
    if (!wasEdited || !item.updated_by) return false;
    return item.updated_by !== item.created_by;
  }, [wasEdited, item.updated_by, item.created_by]);
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  // Handle context menu (right-click) - desktop only
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Show context menu in edit mode or read-only context menu mode (for timeline), but not on mobile
    if ((!isEditMode && !readOnlyContextMenu) || isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    onContextMenuOpen?.(item.id); // Notify parent to close other menus
  }, [isEditMode, readOnlyContextMenu, isMobile, item.id, onContextMenuOpen]);
  
  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null);
    onContextMenuOpen?.(null);
  }, [onContextMenuOpen]);
  
  // Close context menu when another menu opens or when clicking outside
  useEffect(() => {
    if (activeContextMenuId !== item.id && contextMenuPos !== null) {
      setContextMenuPos(null);
    }
  }, [activeContextMenuId, item.id, contextMenuPos]);
  
  // Close context menu when clicking outside
  useEffect(() => {
    if (!isContextMenuOpen) return;
    
    const handleClick = () => closeContextMenu();
    const handleScroll = () => closeContextMenu();
    
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isContextMenuOpen, closeContextMenu]);
  
  // Keep currentRotation in sync with item.rotation
  useEffect(() => {
    if (!isRotationDragging) {
      setCurrentRotation(item.rotation || 0);
    }
  }, [item.rotation, isRotationDragging]);
  
  // State for desktop inline rotation (on the actual element, not portal)
  // Uses local state during rotation to avoid calling onUpdate until done
  const [isDesktopRotating, setIsDesktopRotating] = useState(false);
  const [desktopRotationValue, setDesktopRotationValue] = useState(item.rotation || 0); // Local rotation during drag
  const [hoveredCorner, setHoveredCorner] = useState<number | null>(null);
  const desktopRotationStartAngleRef = useRef(0);
  const desktopRotationStartValueRef = useRef(0);
  const desktopRotationCenterRef = useRef({ x: 0, y: 0 });
  // Track the last persisted rotation to handle sequential rotations correctly
  const lastPersistedRotationRef = useRef(item.rotation || 0);
  
  // Rotation drag handlers for corners (portal version)
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!portalRef.current) return 0;
    
    const rect = portalRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate angle from center to touch point
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, []);
  
  // Desktop inline rotation - get angle from item center
  const getAngleFromItemCenter = useCallback((clientX: number, clientY: number) => {
    if (!itemRef.current) return 0;
    
    const rect = itemRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, []);
  
  const handleRotationStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    rotationStartAngleRef.current = getAngleFromCenter(clientX, clientY);
    rotationStartValueRef.current = currentRotation;
    setIsRotationDragging(true);
  }, [getAngleFromCenter, currentRotation]);
  
  const handleRotationMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isRotationDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const currentAngle = getAngleFromCenter(clientX, clientY);
    const angleDelta = currentAngle - rotationStartAngleRef.current;
    
    // Update rotation
    const newRotation = rotationStartValueRef.current + angleDelta;
    setCurrentRotation(newRotation);
  }, [isRotationDragging, getAngleFromCenter]);
  
  const handleRotationEnd = useCallback(() => {
    if (isRotationDragging) {
      // Save the final rotation to the item
      onUpdate(item.id, { rotation: currentRotation });
      setIsRotationDragging(false);
    }
  }, [isRotationDragging, currentRotation, item.id, onUpdate]);
  
  // Add global event listeners for rotation drag (portal version)
  useEffect(() => {
    if (!isRotationDragging) return;
    
    const handleMove = (e: TouchEvent | MouseEvent) => handleRotationMove(e);
    const handleEnd = () => handleRotationEnd();
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isRotationDragging, handleRotationMove, handleRotationEnd]);
  
  // Desktop inline rotation handlers - completely self-contained
  // Uses local state during rotation, only calls onUpdate when rotation ends
  // This prevents any position drift or re-render issues during rotation
  
  const handleDesktopRotationStart = useCallback((e: React.MouseEvent) => {
    if (!isEditMode || isMobile) return;
    e.stopPropagation();
    e.preventDefault();
    
    if (!itemRef.current) return;
    
    // Get the element's bounding rect for center calculation
    // The center of the axis-aligned bounding box of a rotated rectangle
    // IS the same as the center of the original rectangle (the rotation point)
    // because the element rotates around its center (default transform-origin)
    const rect = itemRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Store center in ref for use during move
    desktopRotationCenterRef.current = { x: centerX, y: centerY };
    
    // Calculate initial angle from center to mouse
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    desktopRotationStartAngleRef.current = startAngle;
    
    // Use the last persisted rotation value, not item.rotation which may be stale
    // This handles sequential rotations from different corners correctly
    const currentRotation = lastPersistedRotationRef.current;
    desktopRotationStartValueRef.current = currentRotation;
    
    // Set local rotation to current value
    setDesktopRotationValue(currentRotation);
    setIsDesktopRotating(true);
  }, [isEditMode, isMobile]);
  
  // Handle rotation move - uses refs to avoid stale closures
  useEffect(() => {
    if (!isDesktopRotating) return;
    
    const handleMove = (e: MouseEvent) => {
      // Calculate current angle from stored center
      const dx = e.clientX - desktopRotationCenterRef.current.x;
      const dy = e.clientY - desktopRotationCenterRef.current.y;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      // Calculate delta from start angle
      const angleDelta = currentAngle - desktopRotationStartAngleRef.current;
      const newRotation = desktopRotationStartValueRef.current + angleDelta;
      
      // Update LOCAL state only - no parent update during drag
      setDesktopRotationValue(newRotation);
    };
    
    const handleEnd = () => {
      // Only NOW update the parent with the final rotation value
      // Get the current rotation value from the ref since state might be stale
      setIsDesktopRotating(false);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [isDesktopRotating]);
  
  // When rotation ends, persist the final value to the parent
  // This effect runs when isDesktopRotating changes from true to false
  const prevDesktopRotatingRef = useRef(false);
  const justFinishedRotatingRef = useRef(false);
  useEffect(() => {
    if (prevDesktopRotatingRef.current && !isDesktopRotating) {
      // Rotation just ended - persist the final rotation value
      lastPersistedRotationRef.current = desktopRotationValue;
      justFinishedRotatingRef.current = true;
      onUpdate(item.id, { rotation: desktopRotationValue });
    }
    prevDesktopRotatingRef.current = isDesktopRotating;
  }, [isDesktopRotating, desktopRotationValue, item.id, onUpdate]);
  
  // Keep lastPersistedRotationRef in sync with item.rotation when not rotating
  // BUT only when item.rotation actually changes from an external source (real-time sync)
  // Skip if we just finished rotating ourselves (to prevent overwriting our new value)
  useEffect(() => {
    if (!isDesktopRotating && !justFinishedRotatingRef.current) {
      lastPersistedRotationRef.current = item.rotation || 0;
    }
    // Reset the just-finished flag when item.rotation catches up to our persisted value
    if (item.rotation === lastPersistedRotationRef.current) {
      justFinishedRotatingRef.current = false;
    }
  }, [item.rotation, isDesktopRotating]);
  
  // Long press detection for mobile jiggle mode
  const LONG_PRESS_DURATION = 500; // ms
  
  const handleLongPressStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isEditMode || isJiggleMode || isMobileEditing) return;
    
    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      onEnterJiggleMode?.();
    }, LONG_PRESS_DURATION);
  }, [isMobile, isEditMode, isJiggleMode, isMobileEditing, onEnterJiggleMode]);
  
  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  
  const handleLongPressMove = useCallback(() => {
    // Cancel long press if user moves
    handleLongPressEnd();
  }, [handleLongPressEnd]);

  // Custom touch drag handlers for jiggle mode
  // 1 finger = move only (rotation is desktop-only)
  const handleJiggleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isJiggleMode || !isMobile) return;
    
    e.stopPropagation();
    
    // Only handle 1-finger drag - rotation is desktop only
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        itemX: item.x,
        itemY: item.y,
      };
      setIsTouchDragging(true);
    }
  }, [isJiggleMode, isMobile, item.x, item.y]);

  const handleJiggleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isJiggleMode) return;
    
    e.stopPropagation();
    // Note: Don't call preventDefault() - touchAction: 'none' handles it
    
    // Only handle 1-finger drag - rotation is desktop only
    if (!isTouchDragging || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    // Convert screen delta to workspace coordinates (accounting for scale)
    const newX = touchStartRef.current.itemX + (deltaX / scale);
    const newY = touchStartRef.current.itemY + (deltaY / scale);
    
    onUpdate(item.id, { x: newX, y: newY });
    
    // Edge panning - detect when near screen edges and pan the view
    const EDGE_THRESHOLD = 60; // pixels from edge to trigger pan
    const PAN_SPEED = 8; // pixels to pan per move event
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let panDeltaX = 0;
    let panDeltaY = 0;
    
    // Check left edge
    if (touch.clientX < EDGE_THRESHOLD) {
      panDeltaX = PAN_SPEED;
    }
    // Check right edge
    else if (touch.clientX > viewportWidth - EDGE_THRESHOLD) {
      panDeltaX = -PAN_SPEED;
    }
    
    // Check top edge
    if (touch.clientY < EDGE_THRESHOLD) {
      panDeltaY = PAN_SPEED;
    }
    // Check bottom edge
    else if (touch.clientY > viewportHeight - EDGE_THRESHOLD) {
      panDeltaY = -PAN_SPEED;
    }
    
    // Request pan if near edge
    if (panDeltaX !== 0 || panDeltaY !== 0) {
      onEdgePan?.(panDeltaX, panDeltaY);
      // Also update the touch start reference so the item stays under finger
      touchStartRef.current.x -= panDeltaX;
      touchStartRef.current.y -= panDeltaY;
    }
  }, [isTouchDragging, isJiggleMode, scale, onUpdate, item.id, onEdgePan]);

  const handleJiggleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // End touch drag
    if (isTouchDragging) {
      setIsTouchDragging(false);
    }
  }, [isTouchDragging]);
  
  const [{ isDragging }, drag, preview] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: 'board-item',
    item: (monitor) => {
      setHasDragged(false);
      dragStartPosRef.current = { x: item.x, y: item.y };
      
      // Get the initial mouse position when drag starts
      const initialClientOffset = monitor.getInitialClientOffset();
      
      if (initialClientOffset && itemRef.current) {
        // Get the actual screen position of the element
        const rect = itemRef.current.getBoundingClientRect();
        
        // Calculate offset from cursor to element's top-left corner in screen coordinates
        const offsetX = initialClientOffset.x - rect.left;
        const offsetY = initialClientOffset.y - rect.top;
        
        return { 
          id: item.id, 
          x: item.x, 
          y: item.y,
          offsetX,
          offsetY,
        };
      }
      
      return { 
        id: item.id, 
        x: item.x, 
        y: item.y,
        offsetX: 0,
        offsetY: 0,
      };
    },
    canDrag: isEditMode && !isRotating && !isDesktopRotating && hoveredCorner === null && !isMobileEditing && (!isMobile || isJiggleMode),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (_draggedItem, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (clientOffset && _draggedItem && itemRef.current) {
        // Get the workspace element to calculate the proper position
        const workspaceElement = itemRef.current.parentElement;
        if (workspaceElement) {
          const workspaceRect = workspaceElement.getBoundingClientRect();
          
          // Calculate position in workspace coordinates
          // The workspace is scaled, so we need to convert screen coordinates to workspace coordinates
          // 1. Get the screen position where the element should be placed (cursor minus drag offset)
          // 2. Convert from screen coordinates to workspace coordinates by dividing by scale
          const screenX = clientOffset.x - workspaceRect.left - _draggedItem.offsetX;
          const screenY = clientOffset.y - workspaceRect.top - _draggedItem.offsetY;
          
          // Convert screen coordinates to workspace coordinates by dividing by scale
          const newX = screenX / scale;
          const newY = screenY / scale;
          
          // Check if actually dragged (moved more than 5px in workspace coordinates)
          const dragDistance = Math.sqrt(
            Math.pow(newX - dragStartPosRef.current.x, 2) + 
            Math.pow(newY - dragStartPosRef.current.y, 2)
          );
          setHasDragged(dragDistance > 5);
          onUpdate(item.id, { x: newX, y: newY });
        }
      }
    },
  }), [item.id, item.x, item.y, isEditMode, isRotating, isMobileEditing, onUpdate, scale, isMobile, isJiggleMode]);

  // Use empty image as drag preview to show custom preview
  useEffect(() => {
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    preview(img, { captureDraggingState: false });
  }, [preview]);

  const getCenter = useCallback(() => {
    if (!itemRef.current) return { x: 0, y: 0 };
    const rect = itemRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  const getAngle = useCallback((clientX: number, clientY: number) => {
    const center = getCenter();
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, [getCenter]);

  const handleRotateStart = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    
    setIsRotating(true);
    startAngleRef.current = getAngle(e.clientX, e.clientY);
    startRotationRef.current = item.rotation || 0;
  }, [isEditMode, getAngle, item.rotation]);

  const handleRotateMove = useCallback((e: MouseEvent) => {
    if (!isRotating) return;
    
    const currentAngle = getAngle(e.clientX, e.clientY);
    const angleDiff = currentAngle - startAngleRef.current;
    const newRotation = startRotationRef.current + angleDiff;
    
    onUpdate(item.id, { rotation: newRotation });
  }, [isRotating, getAngle, onUpdate, item.id]);

  const handleRotateEnd = useCallback(() => {
    setIsRotating(false);
  }, []);

  // Add/remove rotation event listeners
  useEffect(() => {
    if (isRotating) {
      window.addEventListener('mousemove', handleRotateMove);
      window.addEventListener('mouseup', handleRotateEnd);
      return () => {
        window.removeEventListener('mousemove', handleRotateMove);
        window.removeEventListener('mouseup', handleRotateEnd);
      };
    }
  }, [isRotating, handleRotateMove, handleRotateEnd]);

  // Handle item click - opens centered editing modal on both desktop and mobile
  const handleItemClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't trigger on button clicks
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    // Don't trigger if user just dragged the element
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    // Don't trigger if we're rotating - rotation is separate from editing
    if (isDesktopRotating) {
      return;
    }

    // For desktop in edit mode, open the centered editing modal (same as mobile)
    if (!isMobile && isEditMode && !isMobileEditing) {
      e.stopPropagation();
      
      // Capture the current position for smooth transition
      if (itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect();
        setStartPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
      
      setIsMobileEditing(true);
      onMobileEditingChange?.(true, item.id);
      onSelect();
      
      requestAnimationFrame(() => {
        setIsTransitioning(true);
      });
      return;
    }

    // For mobile in jiggle mode, don't enter editing modal - just allow drag
    if (isMobile && isJiggleMode) {
      e.stopPropagation();
      onSelect();
      return;
    }

    // For mobile not in jiggle mode, enter mobile editing mode
    if (!isMobile || !isEditMode || isMobileEditing) return;

    // Enter mobile editing mode
    e.preventDefault();
    e.stopPropagation();
    
    // Capture the current position for smooth transition
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setStartPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    
    // Start everything immediately
    setIsMobileEditing(true);
    onMobileEditingChange?.(true, item.id);
    onSelect(); // Select the item to enable edit mode
    
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      setIsTransitioning(true);
    });
  }, [isEditMode, isMobileEditing, hasDragged, onMobileEditingChange, item.id, onSelect, isMobile, isJiggleMode, isDesktopRotating]);

  // Reset transition state when exiting mobile editing
  useEffect(() => {
    if (!isMobileEditing) {
      setIsTransitioning(false);
    }
  }, [isMobileEditing]);

  // Handle click outside to exit mobile editing
  useEffect(() => {
    if (!isMobileEditing) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const portalElement = document.querySelector('[data-mobile-editing-portal]');
      if (portalElement && !portalElement.contains(e.target as Node)) {
        setIsMobileEditing(false);
        onMobileEditingChange?.(false, null);
      }
    };

    // Add small delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileEditing, onMobileEditingChange]);

  const renderContent = () => {
    switch (item.type) {
      case 'note':
        return (
          <PostItNote 
            content={item.content}
            color={item.color}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={shouldShowEditMode}
            users={users}
          />
        );
      case 'photo':
        return (
          <PolaroidPhoto 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={shouldShowEditMode}
            userId={currentUserId}
          />
        );
      case 'list':
        return (
          <ListCard 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={shouldShowEditMode}
            users={users}
          />
        );
      case 'receipt':
        return (
          <Receipt 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={shouldShowEditMode}
          />
        );
      case 'menu':
        // Check if this is a dinner menu (has sections) or an event (has items at top level)
        const menuContent = item.content as any;
        const isDinnerMenu = menuContent && 'sections' in menuContent;
        
        if (isDinnerMenu) {
          return (
            <MenuCard 
              content={item.content}
            />
          );
        } else {
          // It's an event card
        return (
          <EventCard 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={shouldShowEditMode}
          />
        );
        }
      default:
        return null;
    }
  };

  // Calculate optimal scale to fit element + buttons in viewport
  const calculateOptimalScale = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Estimate element dimensions (most items are around 250-300px wide)
    const estimatedWidth = 300;
    const estimatedHeight = 350;
    
    // Button toolbar height (including spacing)
    const toolbarHeight = 80;
    
    // Padding from screen edges
    const padding = 40;
    
    // Calculate max scale that fits within viewport
    const maxWidthScale = (viewportWidth - padding * 2) / estimatedWidth;
    const maxHeightScale = (viewportHeight - padding * 2 - toolbarHeight) / estimatedHeight;
    
    // Use smaller of the two, but cap between 0.7 and 1.2
    const optimalScale = Math.min(maxWidthScale, maxHeightScale);
    return Math.max(0.7, Math.min(1.2, optimalScale));
  };

  // Render mobile editing view in a portal at document root
  const renderMobileEditingPortal = () => {
    if (!isMobileEditing) return null;
    
    // Calculate transform for smooth transition
    const getTransform = () => {
      if (!isTransitioning) {
        // Start from original position
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        const translateX = startPosition.x - screenCenterX;
        const translateY = startPosition.y - screenCenterY;
        
        return `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(1) rotate(${item.rotation || 0}deg)`;
      }
      // End at center with optimal scale, using current rotation (which updates during drag)
      const portalScale = calculateOptimalScale();
      return `translate(-50%, -50%) scale(${portalScale}) rotate(${currentRotation}deg)`;
    };
    
    return createPortal(
      <div
        ref={portalRef}
        data-mobile-editing-portal
        className="group"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: getTransform(),
          zIndex: 10000,
          transition: isRotationDragging ? 'none' : 'transform 0.3s ease-out',
          pointerEvents: 'auto',
          willChange: 'transform',
        }}
      >
        {/* Masking tape */}
        <div 
          className="absolute top-0 left-1/2 z-10 pointer-events-none"
          style={{
            width: '80px',
            height: '35px',
            transform: `translateX(-50%) translateX(8px) translateY(-18px) rotate(${tapeRotation}deg)`,
          }}
        >
          <img 
            src={tapeTexture}
            alt="masking tape"
            className="w-full h-full object-cover"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
            }}
          />
        </div>
        
        {/* Rotation is handled on the main element, not in the popup */}
        
        {renderContent()}
        
        {/* Editing mode: action buttons (Done and Delete only) */}
        <div 
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex gap-3"
          style={{
            // Scale buttons inversely to maintain consistent size
            transform: `translateX(-50%) scale(${1 / calculateOptimalScale()})`,
            transformOrigin: 'center top',
          }}
        >
          {/* Done button */}
          <button
            onClick={() => {
              setIsMobileEditing(false);
              onMobileEditingChange?.(false, null);
              onDeselect?.();
            }}
            className="px-5 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 active:scale-95 font-semibold text-base flex items-center gap-2 min-w-[90px] justify-center"
            style={{ 
              pointerEvents: 'auto',
              zIndex: 50,
              minHeight: '44px',
            }}
          >
            <span>✓</span>
            <span>Done</span>
          </button>
          
          {/* Delete button */}
          <button
            onClick={() => {
              setIsMobileEditing(false);
              onMobileEditingChange?.(false, null);
              onDelete(item.id);
            }}
            className="px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 active:scale-95 font-semibold text-base flex items-center gap-2 justify-center"
            style={{ 
              pointerEvents: 'auto',
              zIndex: 50,
              minHeight: '44px',
            }}
          >
            <Trash2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>,
      document.body
    );
  };

  // Jiggle animation style (pause during touch drag for smooth movement)
  const jiggleStyle = isJiggleMode && isMobile && !isTouchDragging ? {
    animation: `jiggle 0.15s ease-in-out infinite`,
    animationDelay: `${jiggleDelay}s`,
  } : {};

  // No desktop selection highlight - we use the centered modal instead
  const selectionStyle = {};

  // Render context menu portal
  const renderContextMenu = () => {
    if (!isContextMenuOpen || !contextMenuPos) return null;
    
    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: contextMenuPos.y,
          left: contextMenuPos.x,
          zIndex: 100000,
          minWidth: '200px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu container with paper texture */}
        <div
          style={{
            background: '#fefbf6',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {/* Creator details section */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              background: 'rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#78716c', marginBottom: '6px' }}>
              Card Details
            </div>
            
            {/* Created by section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              {creator && (
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: creator.color || '#a8a29e',
                  }}
                />
              )}
              <span style={{ fontSize: '13px', color: '#44403c', fontWeight: 500 }}>
                {creator?.name || 'Unknown user'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#78716c', marginBottom: wasEdited ? '8px' : '0' }}>
              Created {formatDate(item.created_at)}
            </div>
            
            {/* Edited section - only show if the item was edited */}
            {wasEdited && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  {editedByDifferentPerson && editor ? (
                    <>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: editor.color || '#a8a29e',
                        }}
                      />
                      <span style={{ fontSize: '13px', color: '#44403c', fontWeight: 500 }}>
                        {editor.name}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#78716c', fontStyle: 'italic' }}>
                      Edited {formatDate(item.updated_at)}
                    </span>
                  )}
                </div>
                {editedByDifferentPerson && editor && (
                  <div style={{ fontSize: '11px', color: '#78716c' }}>
                    Edited {formatDate(item.updated_at)}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Actions section - only show in edit mode, not read-only */}
          {!readOnlyContextMenu && (
          <div style={{ padding: '4px 0' }}>
            {/* Edit button */}
            <button
              onClick={() => {
                closeContextMenu();
                // Trigger the editing modal
                if (itemRef.current) {
                  const rect = itemRef.current.getBoundingClientRect();
                  setStartPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  });
                }
                setIsMobileEditing(true);
                onMobileEditingChange?.(true, item.id);
                onSelect();
                requestAnimationFrame(() => {
                  setIsTransitioning(true);
                });
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#44403c',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit
            </button>
            
            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
            
            <button
              onClick={() => {
                onBringToFront?.(item.id);
                closeContextMenu();
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#44403c',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 11 12 6 7 11"></polyline>
                <polyline points="17 18 12 13 7 18"></polyline>
              </svg>
              Bring to Front
            </button>
            
            <button
              onClick={() => {
                onSendToBack?.(item.id);
                closeContextMenu();
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#44403c',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 13 12 18 17 13"></polyline>
                <polyline points="7 6 12 11 17 6"></polyline>
              </svg>
              Send to Back
            </button>
            
            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.08)', margin: '4px 0' }} />
            
            {/* Delete button */}
            <button
              onClick={() => {
                onDelete(item.id);
                closeContextMenu();
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            Delete
          </button>
          </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {renderMobileEditingPortal()}
      {renderContextMenu()}
      
      {/* Jiggle animation keyframes */}
      {isJiggleMode && isMobile && (
        <style>{`
          @keyframes jiggle {
            0%, 100% { transform: rotate(${(isDesktopRotating ? desktopRotationValue : (item.rotation || 0)) - 1}deg); }
            50% { transform: rotate(${(isDesktopRotating ? desktopRotationValue : (item.rotation || 0)) + 1}deg); }
          }
        `}</style>
      )}
      
      <div
        ref={(node) => {
          if (!isMobileEditing) {
            drag(node);
            itemRef.current = node;
          }
        }}
        className="absolute group"
        onClick={handleItemClick}
        onContextMenu={handleContextMenu}
        // In jiggle mode, use custom touch drag handlers
        // Otherwise, use long-press detection handlers
        onTouchStart={isJiggleMode ? handleJiggleTouchStart : (e) => {
          handleLongPressStart(e);
        }}
        onTouchMove={isJiggleMode ? handleJiggleTouchMove : () => {
          handleLongPressMove();
        }}
        onTouchEnd={isJiggleMode ? handleJiggleTouchEnd : (e) => {
          handleLongPressEnd();
          // Trigger edit modal on touch end (not start) to allow for scrolling detection
          if (isMobile && isEditMode && !isMobileEditing) {
            handleItemClick(e);
          }
        }}
        onTouchCancel={isJiggleMode ? handleJiggleTouchEnd : handleLongPressEnd}
        style={{
          left: item.x,
          top: item.y,
          // Use local rotation value during desktop rotation, otherwise use item.rotation
          transform: `rotate(${isDesktopRotating ? desktopRotationValue : (item.rotation || 0)}deg)`,
          cursor: isDesktopRotating ? 'grabbing' : (isEditMode && !isRotating ? 'move' : 'default'),
          opacity: isMobileEditing ? 0 : (isDragging ? 0 : (isTouchDragging ? 0.7 : 1)),
          zIndex: (isDragging || isRotating || isSelected || isTouchDragging || isDesktopRotating) ? 1000 : (item.z_index || 1),
          transition: (isDragging || isTouchDragging || isDesktopRotating) ? 'none' : 'opacity 0.3s ease-out, box-shadow 0.2s ease-out',
          pointerEvents: (isDragging || isMobileEditing) ? 'none' : 'auto',
          // In jiggle mode, prevent default touch behaviors
          touchAction: isJiggleMode ? 'none' : 'auto',
          // Visual feedback during touch drag or desktop rotation
          boxShadow: (isTouchDragging || isDesktopRotating) ? '0 8px 32px rgba(0,0,0,0.3)' : undefined,
          ...jiggleStyle,
          ...selectionStyle,
        }}
      >
      {/* Masking tape */}
      <div 
        className="absolute top-0 left-1/2 z-10 pointer-events-none"
        style={{
          width: '80px',
          height: '35px',
          transform: `translateX(-50%) translateX(8px) translateY(-18px) rotate(${tapeRotation}deg)`,
        }}
      >
        <img 
          src={tapeTexture}
          alt="masking tape"
          className="w-full h-full object-cover"
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
          }}
        />
      </div>
      
      {/* Desktop corner rotation handles - invisible, custom rotate cursors per corner */}
      {isEditMode && !isMobile && !isMobileEditing && (
        <>
          {[
            { top: '-12px', left: '-12px', cursor: '/assets/TopLeft.svg' },
            { top: '-12px', right: '-12px', cursor: '/assets/TopRight.svg' },
            { bottom: '-12px', left: '-12px', cursor: '/assets/BottomLeft.svg' },
            { bottom: '-12px', right: '-12px', cursor: '/assets/BottomRight.svg' },
          ].map((pos, idx) => (
            <div
              key={idx}
              onMouseDown={handleDesktopRotationStart}
              onClick={(e) => {
                // Prevent click from bubbling up to trigger the editing modal
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseEnter={() => setHoveredCorner(idx)}
              onMouseLeave={() => setHoveredCorner(null)}
          style={{ 
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                right: pos.right,
                bottom: pos.bottom,
                width: '24px',
                height: '24px',
                zIndex: 20,
                background: 'transparent',
                cursor: `url("${pos.cursor}") 12 12, pointer`,
              }}
            />
          ))}
        </>
      )}
      
        {renderContent()}
        
      </div>
    </>
  );
}
