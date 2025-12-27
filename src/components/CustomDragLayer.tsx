import { useDragLayer } from 'react-dnd';
import type { BoardItem, User } from './types';
import { PostItNote } from './items/PostItNote';
import { PolaroidPhoto } from './items/PolaroidPhoto';
import { ListCard } from './items/ListCard';
import { Receipt } from './items/Receipt';
import { EventCard } from './items/EventCard';
import { MenuCard } from './items/MenuCard';

interface CustomDragLayerProps {
  items: BoardItem[];
  users: User[];
  currentUserId?: string;
  scale?: number;
}

export function CustomDragLayer({ items, users, currentUserId, scale = 1 }: CustomDragLayerProps) {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    currentOffset: monitor.getClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || !currentOffset || !item) {
    return null;
  }

  // Find the actual item being dragged
  const draggedItem = items.find((i) => i.id === item.id);
  if (!draggedItem) {
    return null;
  }

  const renderContent = () => {
    switch (draggedItem.type) {
      case 'note':
        return (
          <PostItNote 
            content={draggedItem.content}
            color={draggedItem.color}
            onChange={() => {}}
            isEditMode={false}
            users={users}
          />
        );
      case 'photo':
        return (
          <PolaroidPhoto 
            content={draggedItem.content}
            onChange={() => {}}
            isEditMode={false}
            userId={currentUserId}
          />
        );
      case 'list':
        return (
          <ListCard 
            content={draggedItem.content}
            onChange={() => {}}
            isEditMode={false}
            users={users}
          />
        );
      case 'receipt':
        return (
          <Receipt 
            content={draggedItem.content}
            onChange={() => {}}
            isEditMode={false}
          />
        );
      case 'menu':
        // Check if this is a dinner menu (has sections) or an event (has items at top level)
        const menuContent = draggedItem.content as any;
        const isDinnerMenu = menuContent && 'sections' in menuContent;
        
        if (isDinnerMenu) {
          return (
            <MenuCard 
              content={draggedItem.content}
            />
          );
        } else {
          return (
            <EventCard 
              content={draggedItem.content}
              onChange={() => {}}
              isEditMode={false}
            />
          );
        }
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 10000,
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: currentOffset.x - (item.offsetX || 0),
          top: currentOffset.y - (item.offsetY || 0),
          transform: `scale(${scale}) rotate(${draggedItem.rotation || 0}deg)`,
          transformOrigin: 'top left',
          opacity: 0.7,
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
}

