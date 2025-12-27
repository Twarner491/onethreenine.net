import type { BoardItem, User } from './types';
import { PinnedItem } from './PinnedItem';
import { CustomDragLayer } from './CustomDragLayer';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useIsMobile } from './ui/use-mobile';

interface PegboardCanvasProps {
  items: BoardItem[];
  onUpdateItem: (id: string, updates: Partial<BoardItem>) => void;
  onDeleteItem: (id: string) => void;
  isEditMode: boolean;
  users: User[];
  currentUserId?: string;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  isViewerMode?: boolean;
  isJiggleMode?: boolean;
  onEnterJiggleMode?: () => void;
  onExitJiggleMode?: () => void;
  isMobile?: boolean;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
}

// 54.6" displays are typically 16:9 aspect ratio
const TARGET_ASPECT_RATIO = 16 / 9;
const WORKSPACE_WIDTH = 1920; // Base width for element positioning
const WORKSPACE_HEIGHT = 1080; // Base height for element positioning (16:9)

export function PegboardCanvas({ items, onUpdateItem, onDeleteItem, isEditMode, users, currentUserId, selectedItemId, onSelectItem, isViewerMode, isJiggleMode, onEnterJiggleMode, onExitJiggleMode, isMobile: isMobileProp, onBringToFront, onSendToBack }: PegboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  
  // Use robust mobile detection (use prop if provided, otherwise detect)
  const detectedMobile = useIsMobile();
  const isMobile = isMobileProp !== undefined ? isMobileProp : detectedMobile;
  
  // Base scale (fits workspace to screen)
  const [baseScale, setBaseScale] = useState(1);
  // User zoom multiplier (for mobile pinch-to-zoom)
  const [userZoom, setUserZoom] = useState(1);
  // Combined scale
  const scale = baseScale * userZoom;
  
  // Pan offset for mobile navigation
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  // Base offset (centers workspace on desktop)
  const [baseOffset, setBaseOffset] = useState({ x: 0, y: 0 });
  
  // Touch gesture state
  const touchStateRef = useRef({
    isPanning: false,
    isPinching: false,
    lastTouchX: 0,
    lastTouchY: 0,
    lastPinchDistance: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
  });
  
  const [isMobileEditing, setIsMobileEditing] = useState(false);
  
  // Track which item's context menu is currently open (only one at a time)
  const [activeContextMenuId, setActiveContextMenuId] = useState<string | null>(null);
  
  const handleMobileEditingChange = (isEditing: boolean, _itemId: string | null) => {
    setIsMobileEditing(isEditing);
  };

  // Handle edge panning during jiggle mode drag
  const handleEdgePan = useCallback((deltaX: number, deltaY: number) => {
    if (!isJiggleMode) return;
    
    setPanOffset(prev => {
      // Calculate bounds to prevent panning too far
      const scaledWidth = WORKSPACE_WIDTH * scale;
      const scaledHeight = WORKSPACE_HEIGHT * scale;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Allow generous bounds for edge panning
      const maxPanX = Math.max(0, (scaledWidth - viewportWidth) / 2 + 200);
      const maxPanY = Math.max(0, (scaledHeight - viewportHeight) / 2 + 200);
      
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + deltaX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + deltaY)),
      };
    });
  }, [isJiggleMode, scale]);

  // Calculate base scale and offset
  useEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current) return;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportAspect = viewportWidth / viewportHeight;
      // Use the isMobile state which is already updated by the hook
      const mobile = isMobile;

      let newBaseScale = 1;
      let workspaceWidth, workspaceHeight;
      
      if (viewportAspect > TARGET_ASPECT_RATIO) {
        // Viewport is wider than target - fit to height with padding
        const padding = mobile ? 0 : 40;
        workspaceHeight = viewportHeight - padding * 2;
        workspaceWidth = workspaceHeight * TARGET_ASPECT_RATIO;
        newBaseScale = workspaceWidth / WORKSPACE_WIDTH;
      } else {
        // Viewport is taller than target - fit to width with padding
        const padding = mobile ? 0 : 40;
        workspaceWidth = viewportWidth - padding * 2;
        workspaceHeight = workspaceWidth / TARGET_ASPECT_RATIO;
        newBaseScale = workspaceWidth / WORKSPACE_WIDTH;
      }

      // Calculate offset to center the workspace
      const offsetX = (viewportWidth - workspaceWidth) / 2;
      const offsetY = (viewportHeight - workspaceHeight) / 2;
      
      setBaseScale(newBaseScale);
      setBaseOffset({ x: offsetX, y: offsetY });
      
      // On mobile, start zoomed in so items are readable
      if (mobile && userZoom === 1) {
        // Start at 2x zoom, centered on the middle of the board
        const initialZoom = 2;
        setUserZoom(initialZoom);
        // Center the view on the middle of the workspace
        const scaledWidth = WORKSPACE_WIDTH * newBaseScale * initialZoom;
        const scaledHeight = WORKSPACE_HEIGHT * newBaseScale * initialZoom;
        setPanOffset({
          x: -(scaledWidth - viewportWidth) / 2,
          y: -(scaledHeight - viewportHeight) / 2,
        });
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [isMobile]);

  // Touch event handlers for pan and pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Skip touch handling in jiggle mode to allow react-dnd to handle item dragging
    if (!isMobile || isMobileEditing || isJiggleMode) return;
    
    const touches = e.touches;
    const state = touchStateRef.current;
    
    if (touches.length === 1) {
      // Single touch - prepare for pan
      state.isPanning = true;
      state.lastTouchX = touches[0].clientX;
      state.lastTouchY = touches[0].clientY;
    } else if (touches.length === 2) {
      // Two touches - prepare for pinch
      state.isPanning = false;
      state.isPinching = true;
      
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      state.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
      state.pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      state.pinchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
    }
  }, [isMobile, isMobileEditing, isJiggleMode]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Skip touch handling in jiggle mode to allow react-dnd to handle item dragging
    if (!isMobile || isMobileEditing || isJiggleMode) return;
    
    const touches = e.touches;
    const state = touchStateRef.current;
    
    if (touches.length === 1 && state.isPanning && !state.isPinching) {
      // Pan gesture
      const deltaX = touches[0].clientX - state.lastTouchX;
      const deltaY = touches[0].clientY - state.lastTouchY;
      
      setPanOffset(prev => {
        // Calculate bounds to prevent panning too far
        const scaledWidth = WORKSPACE_WIDTH * scale;
        const scaledHeight = WORKSPACE_HEIGHT * scale;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Allow some overscroll but limit it
        const maxPanX = Math.max(0, (scaledWidth - viewportWidth) / 2 + 100);
        const maxPanY = Math.max(0, (scaledHeight - viewportHeight) / 2 + 100);
        
        return {
          x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + deltaX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + deltaY)),
        };
      });
      
      state.lastTouchX = touches[0].clientX;
      state.lastTouchY = touches[0].clientY;
    } else if (touches.length === 2 && state.isPinching) {
      // Pinch-to-zoom gesture
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      
      const zoomDelta = newDistance / state.lastPinchDistance;
      
      setUserZoom(prev => {
        // Limit zoom range: 0.5x to 4x
        const newZoom = Math.max(0.5, Math.min(4, prev * zoomDelta));
        return newZoom;
      });
      
      // Update pinch center for next frame
      const newCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      const newCenterY = (touches[0].clientY + touches[1].clientY) / 2;
      
      // Pan to keep pinch center stable
      const panDeltaX = newCenterX - state.pinchCenterX;
      const panDeltaY = newCenterY - state.pinchCenterY;
      
      setPanOffset(prev => ({
        x: prev.x + panDeltaX,
        y: prev.y + panDeltaY,
      }));
      
      state.lastPinchDistance = newDistance;
      state.pinchCenterX = newCenterX;
      state.pinchCenterY = newCenterY;
    }
  }, [isMobile, isMobileEditing, isJiggleMode, scale]);

  const handleTouchEnd = useCallback(() => {
    const state = touchStateRef.current;
    state.isPanning = false;
    state.isPinching = false;
  }, []);

  // Calculate final workspace position
  const workspaceOffset = isMobile 
    ? { x: panOffset.x, y: panOffset.y }
    : baseOffset;

  return (
    <>
      {/* Mobile editing backdrop - covers entire viewport */}
      {isMobileEditing && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
          style={{ 
            zIndex: 9999,
            animation: 'fadeIn 0.25s ease-out',
          }}
        />
      )}
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      
      <div 
        ref={containerRef}
        data-corkboard
        className="w-full h-full relative overflow-hidden"
        style={{
          backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          // In jiggle mode, allow touch events for react-dnd dragging
          // Otherwise, 'none' allows our custom pan/zoom handlers
          touchAction: isJiggleMode ? 'manipulation' : (isMobile ? 'none' : 'auto'),
        }}
        onTouchStart={isJiggleMode ? undefined : handleTouchStart}
        onTouchMove={isJiggleMode ? undefined : handleTouchMove}
        onTouchEnd={isJiggleMode ? undefined : handleTouchEnd}
      >
        {/* Cork texture fills entire screen */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '20px 20px',
          }}
        />
        
        {/* Subtle shadow highlights for depth */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `
              radial-gradient(ellipse 800px 800px at 25% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 600px 600px at 75% 75%, rgba(0, 0, 0, 0.2) 0%, transparent 50%)
            `,
          }}
        />
        
        {/* Edge vignette */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.08)',
          }}
        />

        {/* Monalisa Viewer Mode Overlays */}
        {isViewerMode && (
          <>
            {/* Strong vignette */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 250px rgba(0, 0, 0, 0.4), inset 0 0 100px rgba(0, 0, 0, 0.3)',
                zIndex: 9990,
              }}
            />
            {/* "Real" look shader - subtle warm overlay + multiply to darken/richness */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: 'rgba(30, 20, 10, 0.1)',
                mixBlendMode: 'multiply',
                zIndex: 9991,
                pointerEvents: 'none',
              }}
            />
            {/* Film grain / noise texture for realism */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
                opacity: 0.4,
                mixBlendMode: 'overlay',
                zIndex: 9992,
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        {/* 16:9 workspace area for element positioning */}
        <div
          ref={workspaceRef}
          className="absolute"
          onClick={(e) => {
            // Deselect when clicking on background (not on an item)
            if (e.target === e.currentTarget) {
              onSelectItem(null);
              // Exit jiggle mode when clicking background
              if (isJiggleMode) {
                onExitJiggleMode?.();
              }
            }
          }}
          onTouchEnd={(e) => {
            // Exit jiggle mode when tapping background on touch devices
            if (isJiggleMode && e.target === e.currentTarget) {
              onSelectItem(null);
              onExitJiggleMode?.();
            }
          }}
          style={{
            left: `${workspaceOffset.x}px`,
            top: `${workspaceOffset.y}px`,
            width: `${WORKSPACE_WIDTH}px`,
            height: `${WORKSPACE_HEIGHT}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            // Allow touch events for dragging in jiggle mode
            touchAction: isJiggleMode ? 'none' : 'auto',
          }}
        >
        {/* Render all pinned items within the workspace */}
        {/* Filter out empty dinner menu items (those with 'sections' but no actual dishes) */}
        {items
          .filter((item) => {
            // Check if it's a dinner menu (has sections)
            if (item.type === 'menu') {
              const content = item.content as any;
              if (content && 'sections' in content) {
                // It's a dinner menu - only show if there are actual dishes with names
                const hasActualDishes = content.sections?.some(
                  (s: any) => s.items?.some((dish: any) => dish.name && dish.name.trim() !== '')
                );
                return hasActualDishes;
              }
            }
            return true;
          })
          .map((item) => (
            <PinnedItem
              key={item.id}
              item={item}
              onUpdate={onUpdateItem}
              onDelete={onDeleteItem}
              isEditMode={isEditMode}
              users={users}
              currentUserId={currentUserId}
              onMobileEditingChange={handleMobileEditingChange}
              isSelected={selectedItemId === item.id}
              onSelect={() => onSelectItem(item.id)}
              onDeselect={() => onSelectItem(null)}
              scale={scale}
              isJiggleMode={isJiggleMode}
              onEnterJiggleMode={onEnterJiggleMode}
              isMobile={isMobileProp || isMobile}
              onEdgePan={handleEdgePan}
              onBringToFront={onBringToFront}
              onSendToBack={onSendToBack}
              activeContextMenuId={activeContextMenuId}
              onContextMenuOpen={setActiveContextMenuId}
            />
          ))}
      </div>

        {/* Custom drag layer for real-time drag preview */}
        <CustomDragLayer items={items} users={users} currentUserId={currentUserId} scale={scale} />
      </div>
    </>
  );
}
