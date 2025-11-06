import type { BoardItem, User } from './types';
import { PinnedItem } from './PinnedItem';

interface PegboardCanvasProps {
  items: BoardItem[];
  onUpdateItem: (id: string, updates: Partial<BoardItem>) => void;
  onDeleteItem: (id: string) => void;
  isEditMode: boolean;
  users: User[];
  currentUserId?: string;
}

export function PegboardCanvas({ items, onUpdateItem, onDeleteItem, isEditMode, users, currentUserId }: PegboardCanvasProps) {
  return (
    <div 
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Pegboard holes in a perfect grid */}
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
      
      {/* Render all pinned items */}
      {items.map((item) => (
        <PinnedItem
          key={item.id}
          item={item}
          onUpdate={onUpdateItem}
          onDelete={onDeleteItem}
          isEditMode={isEditMode}
          users={users}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
