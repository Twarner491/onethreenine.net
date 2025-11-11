import { useDrag } from 'react-dnd';
import type { BoardItem, User } from './types';
import { PostItNote } from './items/PostItNote';
import { PolaroidPhoto } from './items/PolaroidPhoto';
import { ListCard } from './items/ListCard';
import { Receipt } from './items/Receipt';
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

export function PinnedItem({ item, onUpdate, onDelete, isEditMode, users, currentUserId, onMobileEditingChange, isSelected, onSelect }: PinnedItemProps) {
  // Select random masking tape and rotation once and keep it consistent
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10, // Random rotation between -5 and 5 degrees
    []
  );
  
  // Only show edit mode when the item is selected AND user has edit permissions
  const shouldShowEditMode = isEditMode && isSelected;
  
  const [isRotating, setIsRotating] = useState(false);
  const [isMobileEditing, setIsMobileEditing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const itemRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const isTouchDevice_ = useMemo(() => isTouchDevice(), []);
  
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
    canDrag: isEditMode && !isRotating && !isMobileEditing,
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
          // Subtract workspace offset and the cursor offset from when drag started
          const newX = clientOffset.x - workspaceRect.left - _draggedItem.offsetX;
          const newY = clientOffset.y - workspaceRect.top - _draggedItem.offsetY;
          
          // Check if actually dragged (moved more than 5px)
          const dragDistance = Math.sqrt(
            Math.pow(newX - dragStartPosRef.current.x, 2) + 
            Math.pow(newY - dragStartPosRef.current.y, 2)
          );
          setHasDragged(dragDistance > 5);
          onUpdate(item.id, { x: newX, y: newY });
        }
      }
    },
  }), [item.id, item.x, item.y, isEditMode, isRotating, isMobileEditing, onUpdate]);

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

  // Handle item click - for mobile editing or desktop selection
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

    // For desktop (non-touch devices), just select the item
    if (!isTouchDevice_ && isEditMode) {
      e.stopPropagation();
      onSelect();
      return;
    }

    // For touch devices, enter mobile editing mode
    if (!isTouchDevice_ || !isEditMode || isMobileEditing) return;

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
  }, [isTouchDevice_, isEditMode, isMobileEditing, hasDragged, onMobileEditingChange, item.id, onSelect]);

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
        return (
          <EventCard 
            content={item.content}
            onChange={(content) => onUpdate(item.id, { content })}
            isEditMode={shouldShowEditMode}
          />
        );
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
      // End at center with optimal scale, straightened
      const scale = calculateOptimalScale();
      return `translate(-50%, -50%) scale(${scale}) rotate(0deg)`;
    };
    
    return createPortal(
      <div
        data-mobile-editing-portal
        className="group"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: getTransform(),
          zIndex: 10000,
          transition: 'transform 0.3s ease-out',
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
        
        {renderContent()}
        
        {/* Mobile editing mode: close button and delete button */}
        <div 
          className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex gap-4"
          style={{
            // Scale buttons inversely to maintain consistent size
            transform: `translateX(-50%) scale(${1 / calculateOptimalScale()})`,
            transformOrigin: 'center top',
          }}
        >
          <button
            onClick={() => {
              setIsMobileEditing(false);
              onMobileEditingChange?.(false, null);
            }}
            className="px-5 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 active:scale-95 font-semibold text-base flex items-center gap-2 min-w-[100px] justify-center"
            style={{ 
              pointerEvents: 'auto',
              zIndex: 50,
              minHeight: '44px', // iOS touch target size
            }}
          >
            <span>✓</span>
            <span>Done</span>
          </button>
          <button
            onClick={() => {
              setIsMobileEditing(false);
              onMobileEditingChange?.(false, null);
              onDelete(item.id);
            }}
            className="px-5 py-3 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 active:scale-95 font-semibold text-base flex items-center gap-2 min-w-[110px] justify-center"
            style={{ 
              pointerEvents: 'auto',
              zIndex: 50,
              minHeight: '44px', // iOS touch target size
            }}
          >
            <Trash2 size={16} strokeWidth={2.5} />
            Delete
          </button>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {renderMobileEditingPortal()}
      
      <div
        ref={(node) => {
          if (!isMobileEditing) {
            drag(node);
            itemRef.current = node;
          }
        }}
        className="absolute group"
        onClick={handleItemClick}
        onTouchStart={handleItemClick}
        style={{
          left: item.x,
          top: item.y,
          transform: `rotate(${item.rotation || 0}deg)`,
          cursor: isEditMode && !isRotating ? 'move' : 'default',
          opacity: isDragging ? 0.2 : (isMobileEditing ? 0 : 1),
          zIndex: isDragging || isRotating ? 1000 : 1,
          transition: isDragging ? 'none' : 'opacity 0.3s ease-out',
          pointerEvents: (isDragging || isMobileEditing) ? 'none' : 'auto',
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
    </>
  );
}
