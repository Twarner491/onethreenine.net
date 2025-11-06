import { useDrag } from 'react-dnd';
import type { BoardItem, User } from './types';
import { PostItNote } from './items/PostItNote';
import { PolaroidPhoto } from './items/PolaroidPhoto';
import { ListCard } from './items/ListCard';
import { Receipt } from './items/Receipt';
import { EventCard } from './items/EventCard';
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface PinnedItemProps {
  item: BoardItem;
  onUpdate: (id: string, updates: Partial<BoardItem>) => void;
  onDelete: (id: string) => void;
  isEditMode: boolean;
  users: User[];
  currentUserId?: string;
}

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

export function PinnedItem({ item, onUpdate, onDelete, isEditMode, users, currentUserId }: PinnedItemProps) {
  // Select random masking tape and rotation once and keep it consistent
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10, // Random rotation between -5 and 5 degrees
    []
  );
  
  const [isRotating, setIsRotating] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'board-item',
    item: { id: item.id },
    canDrag: isEditMode && !isRotating,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (_draggedItem, monitor) => {
      const offset = monitor.getSourceClientOffset();
      if (offset) {
        onUpdate(item.id, { x: offset.x, y: offset.y });
      }
    },
  }), [item.id, isEditMode, isRotating]);

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

  const renderContent = () => {
    switch (item.type) {
      case 'note':
        return (
          <PostItNote 
            content={item.content}
            color={item.color}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={isEditMode}
            users={users}
          />
        );
      case 'photo':
        return (
          <PolaroidPhoto 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={isEditMode}
            userId={currentUserId}
          />
        );
      case 'list':
        return (
          <ListCard 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={isEditMode}
            users={users}
          />
        );
      case 'receipt':
        return (
          <Receipt 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={isEditMode}
          />
        );
      case 'menu':
        return (
          <EventCard 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={isEditMode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={(node) => {
        drag(node);
        itemRef.current = node;
      }}
      className="absolute group"
      style={{
        left: item.x,
        top: item.y,
        transform: `rotate(${item.rotation || 0}deg)`,
        cursor: isEditMode && !isRotating ? 'move' : 'default',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging || isRotating ? 1000 : 1,
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
      
      {/* Rotation handle - top-left corner only */}
      {isEditMode && (
        <button
          onMouseDown={handleRotateStart}
          className="absolute -top-2 -left-2 w-7 h-7 bg-gray-100 text-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md hover:shadow-lg hover:bg-blue-100 hover:text-blue-600 hover:scale-110 active:scale-95 flex items-center justify-center border border-gray-200"
          style={{ 
            pointerEvents: 'auto',
            zIndex: 45,
            cursor: isRotating ? 'grabbing' : 'grab',
          }}
          title="Rotate"
        >
          <svg 
            width="13" 
            height="13" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      )}
      
      {renderContent()}
      
      {/* Delete button - renders last to be on top */}
      {isEditMode && (
        <button
          onClick={() => onDelete(item.id)}
          className="absolute -top-2 -right-2 w-7 h-7 bg-gray-100 text-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md hover:shadow-lg hover:bg-red-100 hover:text-red-600 hover:scale-110 active:scale-95 flex items-center justify-center border border-gray-200"
          style={{ 
            pointerEvents: 'auto',
            zIndex: 50
          }}
          title="Delete"
        >
          <Trash2 size={13} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
