import type { BoardItem, User } from './types';
import { PinnedItem } from './PinnedItem';
import { CustomDragLayer } from './CustomDragLayer';
import { useEffect, useRef, useState } from 'react';

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
}

// 54.6" displays are typically 16:9 aspect ratio
const TARGET_ASPECT_RATIO = 16 / 9;
const WORKSPACE_WIDTH = 1920; // Base width for element positioning
const WORKSPACE_HEIGHT = 1080; // Base height for element positioning (16:9)

export function PegboardCanvas({ items, onUpdateItem, onDeleteItem, isEditMode, users, currentUserId, selectedItemId, onSelectItem, isViewerMode }: PegboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [workspaceOffset, setWorkspaceOffset] = useState({ x: 0, y: 0 });
  const [isMobileEditing, setIsMobileEditing] = useState(false);
  
  const handleMobileEditingChange = (isEditing: boolean, _itemId: string | null) => {
    setIsMobileEditing(isEditing);
  };

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportAspect = viewportWidth / viewportHeight;

      let scale = 1;
      let workspaceWidth, workspaceHeight;
      
      if (viewportAspect > TARGET_ASPECT_RATIO) {
        // Viewport is wider than target - fit to height with padding
        const padding = 40;
        workspaceHeight = viewportHeight - padding * 2;
        workspaceWidth = workspaceHeight * TARGET_ASPECT_RATIO;
        scale = workspaceWidth / WORKSPACE_WIDTH;
      } else {
        // Viewport is taller than target - fit to width with padding
        const padding = 40;
        workspaceWidth = viewportWidth - padding * 2;
        workspaceHeight = workspaceWidth / TARGET_ASPECT_RATIO;
        scale = workspaceWidth / WORKSPACE_WIDTH;
      }

      // Calculate offset to center the workspace
      const offsetX = (viewportWidth - workspaceWidth) / 2;
      const offsetY = (viewportHeight - workspaceHeight) / 2;
      
      setScale(scale);
      setWorkspaceOffset({ x: offsetX, y: offsetY });
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

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
        className="w-full h-full relative overflow-hidden"
        style={{
          backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
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
            />
          ))}
      </div>

        {/* Custom drag layer for real-time drag preview */}
        <CustomDragLayer items={items} users={users} currentUserId={currentUserId} />
      </div>
    </>
  );
}
