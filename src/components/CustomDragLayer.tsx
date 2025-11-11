import { useDragLayer } from 'react-dnd';
import type { BoardItem, User } from './types';
import { PostItNote } from './items/PostItNote';
import { PolaroidPhoto } from './items/PolaroidPhoto';
import { ListCard } from './items/ListCard';
import { Receipt } from './items/Receipt';
import { EventCard } from './items/EventCard';

interface CustomDragLayerProps {
  items: BoardItem[];
  users: User[];
  currentUserId?: string;
}

export function CustomDragLayer({ items, users, currentUserId }: CustomDragLayerProps) {
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
        return (
          <EventCard 
            content={draggedItem.content}
            onChange={() => {}}
            isEditMode={false}
          />
        );
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
          transform: `rotate(${draggedItem.rotation || 0}deg)`,
          opacity: 0.9,
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
}

