import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Calendar, Camera, ChevronLeft, ChevronRight, Utensils, X } from 'lucide-react';
import { getAllSnapshots, createSnapshot, getAllMenuEntries, getAllUsers } from '../lib/supabase';
import { toast } from 'sonner';
import type { BoardItem, User } from './types';
import { PinnedItem } from './PinnedItem';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useIsMobile } from './ui/use-mobile';

interface Snapshot {
  id: string;
  snapshot_date: string;
  items_data: BoardItem[];
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface MenuEntry {
  id: string;
  menu_date: string;
  title: string | null;
  sections: any[];
  photos: string[];
  created_at: string;
  updated_at: string;
}

interface TimelineItem {
  type: 'snapshot' | 'menu';
  date: string;
  data: Snapshot | MenuEntry;
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

const paperTextures = [
  '/assets/images/paper/2337696d-9c85-4330-839d-4102c2c8da38_rw_1920.png',
  '/assets/images/paper/44fe7d03-7726-46a0-9b17-5790a11fe42d_rw_3840.png',
  '/assets/images/paper/572e1f03-ee6d-4a6b-95d8-9fec367c58a9_rw_1920.png',
  '/assets/images/paper/7e962015-0433-412b-a317-f61b5443a8d7_rw_1920.png',
];

export default function Timeline() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [menuEntries, setMenuEntries] = useState<MenuEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<MenuEntry | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [activeContextMenuId, setActiveContextMenuId] = useState<string | null>(null);
  
  // Use robust mobile detection
  const isMobile = useIsMobile();
  
  // Mobile pan/zoom state for snapshot view
  const [mobileScale, setMobileScale] = useState(1);
  const [mobileOffset, setMobileOffset] = useState({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);
  
  // Reset pan/zoom when snapshot changes
  useEffect(() => {
    setMobileScale(1);
    setMobileOffset({ x: 0, y: 0 });
  }, [selectedSnapshot, selectedMenu]);
  
  // Initialize filter from URL hash
  const [filter, setFilter] = useState<'all' | 'menu' | 'snapshot'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (hash === 'meals') return 'menu';
      if (hash === 'snapshots') return 'snapshot';
    }
    return 'all';
  });

  // Update URL hash when filter changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let hash = '';
      if (filter === 'menu') hash = '#meals';
      if (filter === 'snapshot') hash = '#snapshots';
      
      // Only update if changed to avoid history spam
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash || window.location.pathname);
      }
    }
  }, [filter]);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'meals') setFilter('menu');
      else if (hash === 'snapshots') setFilter('snapshot');
      else setFilter('all');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Select random masking tape and rotation once
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10,
    []
  );
  const paperTexture = useMemo(() => 
    paperTextures[Math.floor(Math.random() * paperTextures.length)],
    []
  );

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard navigation for snapshot view
  useEffect(() => {
    if (!selectedSnapshot && !selectedMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSnapshot(null);
        setSelectedMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSnapshot, selectedMenu]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [snapshotsData, menuData, usersData] = await Promise.all([
        getAllSnapshots(),
        getAllMenuEntries(),
        getAllUsers()
      ]);
      
      const formattedSnapshots: Snapshot[] = snapshotsData.map(snapshot => ({
        ...snapshot,
        items_data: (snapshot.items_data as unknown as BoardItem[]) || []
      }));
      
      setSnapshots(formattedSnapshots);
      setMenuEntries((menuData || []).map(entry => ({
        ...entry,
        sections: (entry.sections || []) as any[],
        photos: (entry.photos || []) as string[]
      })));
      setUsers(usersData.map(user => ({
        id: user.id,
        name: user.name,
        color: user.color,
        created_at: user.created_at,
        updated_at: user.updated_at,
      })));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load timeline');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      setIsCreatingSnapshot(true);
      await createSnapshot();
      toast.success('Snapshot created successfully!');
      await loadData();
    } catch (error) {
      console.error('Error creating snapshot:', error);
      toast.error('Failed to create snapshot');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Parse date parts manually to avoid timezone issues since we want the exact date string
    // Format: YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date using local time constructor but with values from string
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Combine and sort timeline items
  const timelineItems: TimelineItem[] = useMemo(() => {
    let items: TimelineItem[] = [];

    if (filter === 'all' || filter === 'snapshot') {
      items = [
        ...items,
        ...snapshots.map(snapshot => ({
          type: 'snapshot' as const,
          date: snapshot.snapshot_date,
          data: snapshot
        }))
      ];
    }

    if (filter === 'all' || filter === 'menu') {
      items = [
        ...items,
        ...menuEntries.map(menu => ({
          type: 'menu' as const,
          date: menu.menu_date,
          data: menu
        }))
      ];
    }
    
    // Sort by date descending
    return items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      
      // If dates are same, sort by created_at
      const createdA = new Date(a.data.created_at).getTime();
      const createdB = new Date(b.data.created_at).getTime();
      return createdB - createdA;
    });
  }, [snapshots, menuEntries, filter]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen overflow-hidden relative">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
              backgroundSize: '40px 40px',
              backgroundPosition: '20px 20px',
            }}
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-600/30 border-t-amber-600"></div>
        </div>
      </div>
    );
  }

  // If a menu is selected, show it
  if (selectedMenu) {
    // Generate random positions for photos
    const photoPositions = selectedMenu.photos?.map(() => ({
      rotation: (Math.random() - 0.5) * 12,
      tapeRotation: (Math.random() - 0.5) * 15,
      tapeTexture: maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    })) || [];

    // Find current menu index for navigation
    const currentMenuIndex = menuEntries.findIndex(m => m.id === selectedMenu.id);
    const hasPrevMenu = currentMenuIndex < menuEntries.length - 1;
    const hasNextMenu = currentMenuIndex > 0;

    const navigateMenu = (direction: 'prev' | 'next') => {
      const newIndex = direction === 'prev' ? currentMenuIndex + 1 : currentMenuIndex - 1;
      if (newIndex >= 0 && newIndex < menuEntries.length) {
        setSelectedMenu(menuEntries[newIndex]);
      }
    };

    // Mobile menu view - same pan/zoom viewer as snapshots
    if (isMobile) {
      // Start with a smaller default scale for menu viewing
      const MENU_DEFAULT_SCALE = 0.55;
      const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
      
      // Touch handlers for menu pan/zoom
      const handleMenuTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
          lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          lastPinchDistanceRef.current = null;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastPinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
          lastTouchRef.current = null;
        }
      };
      
      const handleMenuTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && lastTouchRef.current) {
          const dx = e.touches[0].clientX - lastTouchRef.current.x;
          const dy = e.touches[0].clientY - lastTouchRef.current.y;
          setMobileOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && lastPinchDistanceRef.current) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const scaleDelta = distance / lastPinchDistanceRef.current;
          setMobileScale(prev => Math.max(0.3, Math.min(3, prev * scaleDelta)));
          lastPinchDistanceRef.current = distance;
        }
      };
      
      const handleMenuTouchEnd = () => {
        lastTouchRef.current = null;
        lastPinchDistanceRef.current = null;
      };
      
      return (
        <div 
          className="w-screen h-screen overflow-hidden relative"
          onTouchStart={handleMenuTouchStart}
          onTouchMove={handleMenuTouchMove}
          onTouchEnd={handleMenuTouchEnd}
          style={{ touchAction: 'none' }}
        >
          {/* Corkboard Background */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
                backgroundSize: '40px 40px',
                backgroundPosition: '20px 20px',
              }}
            />
          </div>

          {/* Pannable/zoomable content */}
          <div
            style={{
              position: 'absolute',
              left: screenCenterX + mobileOffset.x,
              top: 120 + mobileOffset.y,
              transform: `translate(-50%, 0) scale(${mobileScale * MENU_DEFAULT_SCALE})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Menu Paper */}
            <div
              className="relative mx-auto mb-8"
              style={{
                transform: 'rotate(-0.5deg)',
                width: '300px',
              }}
            >
              {/* Masking tape */}
              <div 
                className="absolute top-0 left-1/2 z-10 pointer-events-none"
                style={{
                  width: '60px',
                  height: '26px',
                  transform: `translateX(-50%) translateY(-14px) rotate(${tapeRotation}deg)`,
                }}
              >
                <img 
                  src={tapeTexture}
                  alt="masking tape"
                  className="w-full h-full object-cover"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
                />
              </div>

              {/* Paper content */}
              <div 
                className="relative bg-white shadow-lg"
                style={{
                  boxShadow: `
                    4px 4px 12px rgba(0,0,0,0.3), 
                    0 8px 20px rgba(0,0,0,0.2),
                    inset 0 1px 0 rgba(255,255,255,0.8),
                    inset 0 -1px 0 rgba(0,0,0,0.05)
                  `,
                  padding: '28px 20px 20px',
                }}
              >
                {/* Paper texture */}
                <div 
                  className="absolute inset-0 opacity-[0.15] pointer-events-none"
                  style={{
                    backgroundImage: `url(${paperTexture})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mixBlendMode: 'multiply',
                  }}
                />
                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="text-center mb-3">
                    <h1 
                      className="text-base tracking-[0.2em] font-normal text-stone-600 uppercase"
                      style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}
                    >
                      Menu
                    </h1>
                    <div 
                      className="text-xs text-stone-400 mt-1"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {formatDate(selectedMenu.menu_date)}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-b border-gray-200 mb-3" />

                  {/* Sections */}
                  <div className="space-y-3">
                    {selectedMenu.sections.map((section: any, sectionIndex: number) => (
                      <div key={sectionIndex}>
                        {section.title && (
                          <div 
                            className="text-xs font-medium uppercase tracking-wider text-center text-stone-400 mb-1.5"
                            style={{ 
                              fontFamily: 'Cormorant Garamond, Georgia, serif',
                              letterSpacing: '0.1em',
                            }}
                          >
                            {section.title}
                          </div>
                        )}
                        <div className="space-y-1">
                          {section.items?.map((item: any, itemIndex: number) => (
                            <div key={itemIndex} className="text-center">
                              <div 
                                className="text-sm text-stone-600"
                                style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}
                              >
                                {item.name}
                              </div>
                              {item.description && (
                                <div 
                                  className="text-xs italic text-stone-400 mt-0.5"
                                  style={{ fontFamily: 'Inter, sans-serif' }}
                                >
                                  {item.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Polaroid Photos - stacked below menu */}
            {selectedMenu.photos && selectedMenu.photos.length > 0 && (
              <div className="flex flex-col items-center gap-10">
                {selectedMenu.photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative"
                    style={{
                      transform: `rotate(${(photoPositions[index]?.rotation || 0) * 0.5}deg)`,
                    }}
                  >
                    {/* Masking tape for photo */}
                    <div 
                      className="absolute top-0 left-1/2 z-10 pointer-events-none"
                      style={{
                        width: '60px',
                        height: '26px',
                        transform: `translateX(-50%) translateY(-14px) rotate(${photoPositions[index]?.tapeRotation || 0}deg)`,
                      }}
                    >
                      <img 
                        src={photoPositions[index]?.tapeTexture || tapeTexture}
                        alt="masking tape"
                        className="w-full h-full object-cover"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
                      />
                    </div>

                    {/* Polaroid frame - proper border all around */}
                    <div
                      className="bg-white shadow-lg relative"
                      style={{
                        width: '280px',
                        padding: '14px 14px 48px 14px', // More padding at bottom for caption
                        boxShadow: `
                          4px 6px 16px rgba(0,0,0,0.35), 
                          0 10px 24px rgba(0,0,0,0.25)
                        `,
                      }}
                    >
                      {/* Photo area */}
                      <div 
                        className="w-full bg-gray-100 overflow-hidden relative"
                        style={{ aspectRatio: '1/1' }}
                      >
                        <img 
                          src={photo}
                          alt={`Meal photo ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      
                      {/* Caption area - positioned in bottom padding */}
                      <div 
                        className="text-center absolute left-0 right-0"
                        style={{ 
                          bottom: '14px',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '14px',
                          color: '#374151',
                        }}
                      >
                        {formatDate(selectedMenu.menu_date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Header bar with date */}
          <div 
            className="fixed top-4 left-1/2 -translate-x-1/2 z-40"
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              background: `url(${tapeTexture})`,
              backgroundSize: '300% 300%',
              backgroundPosition: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#44250f' }}>
              {formatDate(selectedMenu.menu_date)}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(68, 37, 15, 0.6)', marginTop: '2px' }}>
              {selectedMenu.photos?.length || 0} photo{(selectedMenu.photos?.length || 0) !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Mobile FAB Navigation */}
          {/* Close button - top left */}
          <button
            onClick={() => setSelectedMenu(null)}
            className="fixed z-50 flex items-center justify-center"
            style={{
              top: '16px',
              left: '16px',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: `url(${tapeTexture})`,
              backgroundSize: '200% 200%',
              backgroundPosition: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={20} className="text-amber-900/80" />
          </button>

          {/* Prev/Next FABs - bottom corners */}
          <button
            onClick={() => navigateMenu('prev')}
            disabled={!hasPrevMenu}
            className="fixed z-50 flex items-center justify-center disabled:opacity-40"
            style={{
              bottom: '24px',
              left: '24px',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: `url(${tapeTexture})`,
              backgroundSize: '200% 200%',
              backgroundPosition: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <ChevronLeft size={28} className="text-amber-900/80" />
          </button>

          <button
            onClick={() => navigateMenu('next')}
            disabled={!hasNextMenu}
            className="fixed z-50 flex items-center justify-center disabled:opacity-40"
            style={{
              bottom: '24px',
              right: '24px',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: `url(${tapeTexture})`,
              backgroundSize: '200% 200%',
              backgroundPosition: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: 'none',
              cursor: hasNextMenu ? 'pointer' : 'not-allowed',
            }}
          >
            <ChevronRight size={28} className="text-amber-900/80" />
          </button>
        </div>
      );
    }

    // Desktop menu view
    return (
      <div className="w-screen h-screen overflow-hidden relative">
        {/* Corkboard Background */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
              backgroundSize: '40px 40px',
              backgroundPosition: '20px 20px',
            }}
          />
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: `
                radial-gradient(ellipse 800px 800px at 25% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
                radial-gradient(ellipse 600px 600px at 75% 75%, rgba(0, 0, 0, 0.2) 0%, transparent 50%)
              `,
            }}
          />
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.08)',
            }}
          />
        </div>

        {/* Menu Display with Photos */}
        <div className="absolute inset-0 flex items-center justify-center p-8 overflow-auto">
          <div className="flex items-start gap-8 flex-wrap justify-center">
            {/* Menu Paper */}
            <div
              className="relative"
              style={{
                transform: 'rotate(-0.5deg)',
                maxWidth: '380px',
                width: '100%',
              }}
            >
              {/* Masking tape */}
              <div 
                className="absolute top-0 left-1/2 z-10 pointer-events-none"
                style={{
                  width: '80px',
                  height: '35px',
                  transform: `translateX(-50%) translateY(-18px) rotate(${tapeRotation}deg)`,
                }}
              >
                <img 
                  src={tapeTexture}
                  alt="masking tape"
                  className="w-full h-full object-cover"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
                />
              </div>

              {/* Paper content */}
              <div 
                className="relative bg-white shadow-lg"
                style={{
                  boxShadow: `
                    4px 4px 12px rgba(0,0,0,0.3), 
                    0 8px 20px rgba(0,0,0,0.2),
                    inset 0 1px 0 rgba(255,255,255,0.8),
                    inset 0 -1px 0 rgba(0,0,0,0.05)
                  `,
                  padding: '48px 40px 40px',
                  minHeight: '380px',
                }}
              >
                {/* Paper texture */}
                <div 
                  className="absolute inset-0 opacity-[0.15] pointer-events-none"
                  style={{
                    backgroundImage: `url(${paperTexture})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mixBlendMode: 'multiply',
                  }}
                />

                {/* Back button */}
                <button
                  onClick={() => setSelectedMenu(null)}
                  className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1.5 rounded text-stone-500 transition-all hover:bg-stone-100 text-sm"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>

                {/* Content */}
                <div className="relative z-10 mt-6">
                  {/* Header */}
                  <div className="text-center mb-4">
                    <h1 
                      className="text-base tracking-[0.2em] font-normal text-stone-600 uppercase"
                      style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}
                    >
                      Menu
                    </h1>
                    <div 
                      className="text-xs text-stone-400 mt-1"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {formatDate(selectedMenu.menu_date)}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-b border-gray-200 mb-4" />

                  {/* Sections */}
                  <div className="space-y-4">
                    {selectedMenu.sections.map((section: any, sectionIndex: number) => (
                      <div key={sectionIndex}>
                        {section.title && (
                          <div 
                            className="text-xs font-medium uppercase tracking-wider text-center text-stone-400 mb-2"
                            style={{ 
                              fontFamily: 'Cormorant Garamond, Georgia, serif',
                              letterSpacing: '0.1em',
                            }}
                          >
                            {section.title}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {section.items?.map((item: any, itemIndex: number) => (
                            <div key={itemIndex} className="text-center">
                              <div 
                                className="text-sm text-stone-600"
                                style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}
                              >
                                {item.name}
                              </div>
                              {item.description && (
                                <div 
                                  className="text-xs italic text-stone-400 mt-0.5"
                                  style={{ fontFamily: 'Inter, sans-serif' }}
                                >
                                  {item.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Polaroid Photos */}
            {selectedMenu.photos && selectedMenu.photos.length > 0 && (
              <div className="flex flex-col gap-6">
                {selectedMenu.photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative"
                    style={{
                      transform: `rotate(${photoPositions[index]?.rotation || 0}deg)`,
                    }}
                  >
                    {/* Masking tape for photo */}
                    <div 
                      className="absolute top-0 left-1/2 z-10 pointer-events-none"
                      style={{
                        width: '80px',
                        height: '35px',
                        transform: `translateX(-50%) translateY(-18px) rotate(${photoPositions[index]?.tapeRotation || 0}deg)`,
                      }}
                    >
                      <img 
                        src={photoPositions[index]?.tapeTexture || tapeTexture}
                        alt="masking tape"
                        className="w-full h-full object-cover"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
                      />
                    </div>

                    {/* Polaroid frame */}
                    <div
                      className="bg-white p-4 shadow-lg relative"
                      style={{
                        width: '240px',
                        boxShadow: `
                          4px 6px 16px rgba(0,0,0,0.35), 
                          0 10px 24px rgba(0,0,0,0.25),
                          inset 0 1px 0 rgba(255,255,255,0.9),
                          inset 0 0 20px rgba(255,255,255,0.4)
                        `,
                      }}
                    >
                      {/* Glossy finish overlay */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `
                            linear-gradient(135deg, 
                              rgba(255,255,255,0.6) 0%, 
                              rgba(255,255,255,0.2) 20%, 
                              rgba(255,255,255,0.05) 40%, 
                              transparent 60%, 
                              rgba(0,0,0,0.02) 80%, 
                              rgba(0,0,0,0.05) 100%
                            )
                          `,
                        }}
                      />
                      
                      {/* Glossy highlight */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
                        }}
                      />
                      
                      {/* Fine texture for realism */}
                      <div 
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='5' numOctaves='1' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                        }}
                      />
                      
                      {/* Photo area */}
                      <div className="w-full h-56 bg-gray-100 mb-3 overflow-hidden relative">
                        <img 
                          src={photo}
                          alt={`Meal photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Caption area */}
                      <div 
                        className="text-center relative"
                        style={{ 
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '14px',
                          color: '#374151',
                          minHeight: '24px'
                        }}
                      >
                        {formatDate(selectedMenu.menu_date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Helper function to filter snapshot items based on menu availability for that date
  // Menu items should only be shown if there's a menu entry for the snapshot's date
  const getFilteredSnapshotItems = (snapshot: Snapshot): BoardItem[] => {
    const snapshotDate = snapshot.snapshot_date;
    
    // Check if there's a menu entry for this snapshot's date
    const menuForDate = menuEntries.find(m => m.menu_date === snapshotDate);
    
    if (menuForDate) {
      // There's a menu for this date - keep menu items but update with latest menu data
      // Find menu item(s) in snapshot and replace their content with the latest menu data
      return snapshot.items_data.map((item) => {
        if (item.type === 'menu') {
          // Replace content with the menu entry data for this date
          return {
            ...item,
            content: {
              sections: menuForDate.sections,
              title: menuForDate.title,
            }
          };
        }
        return item;
      });
    } else {
      // No menu for this date - filter out all menu items
      return snapshot.items_data.filter((item) => item.type !== 'menu');
    }
  };

  // Touch handlers for mobile pan/zoom in snapshot view
  const handleSnapshotTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchRef.current = null;
    }
  };

  const handleSnapshotTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      setMobileOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastPinchDistanceRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scaleDelta = distance / lastPinchDistanceRef.current;
      setMobileScale(prev => Math.max(0.5, Math.min(3, prev * scaleDelta)));
      lastPinchDistanceRef.current = distance;
    }
    };

  const handleSnapshotTouchEnd = () => {
    lastTouchRef.current = null;
    lastPinchDistanceRef.current = null;
  };

  // If a snapshot is selected, show it in fullscreen
  if (selectedSnapshot) {
    const currentIndex = snapshots.findIndex(s => s.id === selectedSnapshot.id);
    // Snapshots are sorted newest-first (descending), so:
    // - "prev" (older) = can go to higher index
    // - "next" (newer) = can go to lower index
    const hasPrev = currentIndex < snapshots.length - 1;
    const hasNext = currentIndex > 0;

    // Get filtered items (menu only shown if there's a menu entry for this date)
    const filteredItems = getFilteredSnapshotItems(selectedSnapshot);

    const TARGET_ASPECT_RATIO = 16 / 9;
    const WORKSPACE_WIDTH = 1920;
    
    const calculateScale = () => {
      if (typeof window === 'undefined') return 1;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportAspect = viewportWidth / viewportHeight;
      
      let scale = 1;
      let workspaceWidth, workspaceHeight;
      
      if (viewportAspect > TARGET_ASPECT_RATIO) {
        const padding = 40;
        workspaceHeight = viewportHeight - padding * 2;
        workspaceWidth = workspaceHeight * TARGET_ASPECT_RATIO;
        scale = workspaceWidth / WORKSPACE_WIDTH;
      } else {
        const padding = isMobile ? 0 : 40;
        workspaceWidth = viewportWidth - padding * 2;
        workspaceHeight = workspaceWidth / TARGET_ASPECT_RATIO;
        scale = workspaceWidth / WORKSPACE_WIDTH;
      }
      
      return scale;
    };
    
    const boardScale = calculateScale();
    const workspaceWidth = WORKSPACE_WIDTH * boardScale;
    const workspaceHeight = workspaceWidth / TARGET_ASPECT_RATIO;
    const offsetX = (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2 - workspaceWidth / 2;
    const offsetY = (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2 - workspaceHeight / 2;

    const navigateSnapshot = (direction: 'prev' | 'next') => {
      // Snapshots are sorted newest-first (descending), so:
      // - "prev" (older) = higher index
      // - "next" (newer) = lower index
      const newIndex = direction === 'prev' ? currentIndex + 1 : currentIndex - 1;
      if (newIndex >= 0 && newIndex < snapshots.length) {
        setSelectedSnapshot(snapshots[newIndex]);
      }
    };

    // Mobile FAB navigation
    if (isMobile) {
      return (
        <DndProvider backend={HTML5Backend}>
          <div 
            className="w-screen h-screen overflow-hidden relative"
            onTouchStart={handleSnapshotTouchStart}
            onTouchMove={handleSnapshotTouchMove}
            onTouchEnd={handleSnapshotTouchEnd}
            style={{ touchAction: 'none' }}
          >
            {/* Corkboard Background */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div 
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
                  backgroundSize: '40px 40px',
                  backgroundPosition: '20px 20px',
                }}
              />
            </div>

            {/* Workspace with pan/zoom */}
            <div 
              className="absolute overflow-hidden"
              style={{
                width: WORKSPACE_WIDTH,
                height: WORKSPACE_WIDTH / TARGET_ASPECT_RATIO,
                left: offsetX + mobileOffset.x,
                top: offsetY + mobileOffset.y,
                transform: `scale(${boardScale * mobileScale})`,
                transformOrigin: 'top left',
              }}
            >
              {filteredItems.map((item) => (
                <div 
                  key={item.id}
                  onClick={(e) => {
                    // If this is a menu item, navigate to the meal snapshot
                    if (item.type === 'menu') {
                      e.stopPropagation();
                      const menuForDate = menuEntries.find(m => m.menu_date === selectedSnapshot.snapshot_date);
                      if (menuForDate) {
                        setSelectedSnapshot(null);
                        setSelectedMenu(menuForDate);
                      }
                    }
                  }}
                  style={{ cursor: item.type === 'menu' ? 'pointer' : 'default' }}
                >
                  <PinnedItem
                    item={item}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    isEditMode={false}
                    users={users}
                    isSelected={false}
                    onSelect={() => {}}
                    scale={boardScale * mobileScale}
                    readOnlyContextMenu={!isMobile}
                    activeContextMenuId={activeContextMenuId}
                    onContextMenuOpen={setActiveContextMenuId}
                  />
                </div>
              ))}
            </div>

            {/* Mobile FAB Navigation */}
            {/* Back button - top left */}
            <button
              onClick={() => setSelectedSnapshot(null)}
              className="fixed z-50 flex items-center justify-center"
              style={{
                top: '16px',
                left: '16px',
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <X size={20} className="text-amber-900/80" />
            </button>

            {/* Date indicator - top center */}
            <div
              className="fixed z-50 px-4 py-2 text-center"
              style={{
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(254, 243, 199, 0.95)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <div className="text-sm font-medium text-amber-900/90">
                {formatDate(selectedSnapshot.snapshot_date)}
              </div>
              <div className="text-xs text-amber-900/60">
                {selectedSnapshot.item_count} item{selectedSnapshot.item_count !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Prev/Next FABs - bottom corners */}
            <button
              onClick={() => navigateSnapshot('prev')}
              disabled={!hasPrev}
              className="fixed z-50 flex items-center justify-center disabled:opacity-40"
              style={{
                bottom: '24px',
                left: '24px',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <ChevronLeft size={28} className="text-amber-900/80" />
            </button>

            <button
              onClick={() => navigateSnapshot('next')}
              disabled={!hasNext}
              className="fixed z-50 flex items-center justify-center disabled:opacity-40"
              style={{
                bottom: '24px',
                right: '24px',
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <ChevronRight size={28} className="text-amber-900/80" />
            </button>
          </div>
        </DndProvider>
      );
    }

    // Desktop snapshot view - toolbar in top left
    const toolbarPosition = { x: 32, y: 32 };

    return (
      <DndProvider backend={HTML5Backend}>
        <div className="w-screen h-screen overflow-hidden relative">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
                backgroundSize: '40px 40px',
                backgroundPosition: '20px 20px',
              }}
            />
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                background: `
                  radial-gradient(ellipse 800px 800px at 25% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
                  radial-gradient(ellipse 600px 600px at 75% 75%, rgba(0, 0, 0, 0.2) 0%, transparent 50%)
                `,
              }}
            />
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.08)',
              }}
            />
          </div>

          <div 
            className="absolute overflow-hidden"
            style={{
              width: WORKSPACE_WIDTH,
              height: WORKSPACE_WIDTH / TARGET_ASPECT_RATIO,
              left: offsetX,
              top: offsetY,
              transform: `scale(${boardScale})`,
              transformOrigin: 'top left',
            }}
          >
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                onClick={(e) => {
                  // If this is a menu item, navigate to the meal snapshot
                  if (item.type === 'menu') {
                    e.stopPropagation();
                    const menuForDate = menuEntries.find(m => m.menu_date === selectedSnapshot.snapshot_date);
                    if (menuForDate) {
                      setSelectedSnapshot(null);
                      setSelectedMenu(menuForDate);
                    }
                  }
                }}
                style={{ cursor: item.type === 'menu' ? 'pointer' : 'default' }}
              >
                <PinnedItem
                item={item}
                onUpdate={() => {}}
                onDelete={() => {}}
                isEditMode={false}
                  users={users}
                isSelected={false}
                onSelect={() => {}}
                  scale={boardScale}
                  readOnlyContextMenu={true}
                  activeContextMenuId={activeContextMenuId}
                  onContextMenuOpen={setActiveContextMenuId}
              />
              </div>
            ))}
          </div>

          <div
            className="fixed z-50"
            style={{
              left: toolbarPosition.x,
              top: toolbarPosition.y,
              transform: `rotate(-2deg)`,
              transformOrigin: 'top left',
            }}
          >
            <div 
              className="absolute top-0 left-1/2 z-10 pointer-events-none"
              style={{
                width: '80px',
                height: '35px',
                transform: `translateX(-50%) translateY(-18px) rotate(${tapeRotation}deg)`,
              }}
            >
              <img 
                src={tapeTexture}
                alt="masking tape"
                className="w-full h-full object-cover"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
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
                minWidth: '200px',
                padding: '20px',
              }}
            >
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 text-sm font-medium cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  Back to Timeline
                </button>

                <div className="text-center py-2">
                  <div className="text-sm font-medium text-amber-900/90 mb-1">
                    {formatDate(selectedSnapshot.snapshot_date)}
                  </div>
                  <div className="text-xs text-amber-900/60">
                    {selectedSnapshot.item_count} item{selectedSnapshot.item_count !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigateSnapshot('prev')}
                    disabled={!hasPrev}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <button
                    onClick={() => navigateSnapshot('next')}
                    disabled={!hasNext}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DndProvider>
    );
  }

  // Mobile timeline grid view - Scrollable with header in content
  if (isMobile) {
    return (
      <>
        {/* Main scrollable page */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: 'scroll',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            background: '#8B7355',
          }}
        >
          {/* Background image layer */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />

          {/* Content container - header scrolls with content */}
          <div style={{ position: 'relative', zIndex: 1, paddingTop: '60px', paddingBottom: '100px', paddingLeft: '16px', paddingRight: '16px' }}>
            
            {/* Header - scrolls with content, styled like snapshot date header */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              marginBottom: '32px',
            }}>
              {/* Title and count in a single styled box with post-it texture */}
              <div 
                style={{
                  padding: '16px 24px',
                  borderRadius: '12px',
                  background: `#fef3c7 url('/assets/images/postit/4078c9f7-701f-4168-aee3-4c54c27ef2c2_rw_1920.png')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundBlendMode: 'overlay',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  textAlign: 'center',
                }}
              >
                <h1 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#44250f',
                  margin: '0 0 8px 0',
                }}>
                  Timeline
                </h1>
                
                {/* Filter buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setFilter(current => current === 'menu' ? 'all' : 'menu')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 8px',
                      color: filter === 'menu' ? '#44250f' : 'rgba(68, 37, 15, 0.5)',
                      fontWeight: filter === 'menu' ? '600' : '400',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {menuEntries.length} meals
                  </button>
                  <span style={{ color: 'rgba(68, 37, 15, 0.25)' }}>|</span>
                  <button 
                    onClick={() => setFilter(current => current === 'snapshot' ? 'all' : 'snapshot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 8px',
                      color: filter === 'snapshot' ? '#44250f' : 'rgba(68, 37, 15, 0.5)',
                      fontWeight: filter === 'snapshot' ? '600' : '400',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {snapshots.length} snapshots
                  </button>
                </div>
              </div>
            </div>
            
            {/* Timeline items list */}
            {timelineItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '40px' }}>
                <Calendar size={48} style={{ marginBottom: '16px', color: 'rgba(255, 251, 235, 0.4)' }} />
                <p style={{ color: 'rgba(255, 251, 235, 0.7)', fontSize: '18px' }}>
                  No entries yet!
                </p>
                <p style={{ color: 'rgba(255, 251, 235, 0.6)', fontSize: '14px', marginTop: '8px' }}>
                  Capture a menu or take a snapshot
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {timelineItems.map((item) => (
                  <MobileTimelineCard
                    key={item.data.id}
                    item={item}
                    onView={() => {
                      if (item.type === 'menu') {
                        setSelectedMenu(item.data as MenuEntry);
                      } else {
                        setSelectedSnapshot(item.data as Snapshot);
                      }
                    }}
                    formatDate={formatDate}
                    tapeTexture={tapeTexture}
                    paperTexture={paperTexture}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Back FAB - top left */}
        <a
          href="/"
          style={{
            position: 'fixed',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            top: '12px',
            left: '12px',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: `url(${tapeTexture})`,
            backgroundSize: '200% 200%',
            backgroundPosition: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} style={{ color: 'rgba(68, 37, 15, 0.8)' }} />
        </a>

        {/* Snapshot FAB - bottom right */}
        <button
          onClick={handleCreateSnapshot}
          disabled={isCreatingSnapshot}
          style={{
            position: 'fixed',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: `url(${tapeTexture})`,
            backgroundSize: '200% 200%',
            backgroundPosition: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: 'none',
            cursor: isCreatingSnapshot ? 'not-allowed' : 'pointer',
            opacity: isCreatingSnapshot ? 0.5 : 1,
          }}
        >
          <Camera size={24} style={{ color: 'rgba(68, 37, 15, 0.8)' }} />
        </button>
      </>
    );
  }

  // Desktop timeline grid view
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '20px 20px',
          }}
        />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `
              radial-gradient(ellipse 800px 800px at 25% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 600px 600px at 75% 75%, rgba(0, 0, 0, 0.2) 0%, transparent 50%)
            `,
          }}
        />
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.08)',
          }}
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className="relative"
          style={{
            transform: 'rotate(-1deg)',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
          }}
        >
          <div 
            className="absolute top-0 left-1/2 z-10 pointer-events-none"
            style={{
              width: '80px',
              height: '35px',
              transform: `translateX(-50%) translateY(-18px) rotate(${tapeRotation}deg)`,
            }}
          >
            <img 
              src={tapeTexture}
              alt="masking tape"
              className="w-full h-full object-cover"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
            />
          </div>

          <div 
            className="relative flex flex-col overflow-hidden"
            style={{
              background: '#fef3c7',
              borderRadius: '2px',
              boxShadow: `
                0 4px 8px rgba(0, 0, 0, 0.15),
                0 8px 20px rgba(0, 0, 0, 0.1),
                inset 0 -1px 2px rgba(0, 0, 0, 0.05)
              `,
              padding: '48px 64px 0 64px',
              height: '85vh',
              maxHeight: '85vh',
            }}
          >
            <a
              href="/"
              className="absolute top-4 -left-8 flex items-center gap-2 px-3 py-2 rounded-md text-amber-900/80 transition-all hover:bg-amber-900/10"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-medium">Back to Board</span>
            </a>

            <div className="absolute flex justify-end" style={{ top: '25px', right: '30px' }}>
              <button
                onClick={handleCreateSnapshot}
                disabled={isCreatingSnapshot}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <Camera size={14} />
                {isCreatingSnapshot ? 'Saving...' : 'Snapshot Now'}
              </button>
            </div>

            <div style={{ height: '8px' }}></div>

            <div className="mt-12">
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-3xl font-bold text-amber-900/90">
                  Timeline
                </h1>
                <div className="text-right flex items-center gap-1.5 text-sm">
                  <button 
                    onClick={() => setFilter(current => current === 'menu' ? 'all' : 'menu')}
                    className={`transition-colors ${filter === 'menu' ? 'text-amber-900 font-bold' : 'text-amber-900/70 hover:text-amber-900/90'}`}
                  >
                    {menuEntries.length} meal{menuEntries.length !== 1 ? 's' : ''}
                  </button>
                  <span className="text-amber-900/70">·</span>
                  <button 
                    onClick={() => setFilter(current => current === 'snapshot' ? 'all' : 'snapshot')}
                    className={`transition-colors ${filter === 'snapshot' ? 'text-amber-900 font-bold' : 'text-amber-900/70 hover:text-amber-900/90'}`}
                  >
                    {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>

              <div 
                className="overflow-y-auto pr-2 -mr-2"
                style={{ 
                  maxHeight: 'calc(85vh - 160px)',
                  overflowY: 'scroll',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {timelineItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Calendar size={48} className="mb-4 text-amber-900/40" />
                    <p className="text-amber-900/70 text-lg">
                      No entries yet!
                    </p>
                    <p className="text-amber-900/60 text-sm mt-2">
                      Capture a menu or take a snapshot
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timelineItems.map((item) => (
                      <TimelineListItem
                        key={item.data.id}
                        item={item}
                        onView={() => {
                          if (item.type === 'menu') {
                            setSelectedMenu(item.data as MenuEntry);
                          } else {
                            setSelectedSnapshot(item.data as Snapshot);
                          }
                        }}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineListItemProps {
  item: TimelineItem;
  onView: () => void;
  formatDate: (date: string) => string;
}

interface MobileTimelineCardProps {
  item: TimelineItem;
  onView: () => void;
  formatDate: (date: string) => string;
  tapeTexture: string;
  paperTexture: string;
}

function MobileTimelineCard({ item, onView, formatDate, tapeTexture, paperTexture }: MobileTimelineCardProps) {
  const isMenu = item.type === 'menu';
  const menuData = isMenu ? item.data as MenuEntry : null;
  const snapshotData = !isMenu ? item.data as Snapshot : null;
  
  const previewText = isMenu 
    ? (menuData?.sections?.[0]?.items?.[0]?.name || 'Menu')
    : `${snapshotData?.item_count || 0} items`;

  // Subtle rotation for visual interest
  const rotation = useMemo(() => (Math.random() - 0.5) * 3, []);
  const tapeRotation = useMemo(() => (Math.random() - 0.5) * 10, []);
  
  return (
    <div
      onClick={onView}
      className="relative cursor-pointer active:scale-[0.98] transition-transform"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Masking tape */}
      <div 
        className="absolute top-0 left-1/2 z-10 pointer-events-none"
        style={{
          width: '50px',
          height: '22px',
          transform: `translateX(-50%) translateY(-12px) rotate(${tapeRotation}deg)`,
        }}
      >
        <img 
          src={tapeTexture}
          alt="masking tape"
          className="w-full h-full object-cover"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
          loading="lazy"
        />
      </div>

      {/* Card with paper texture */}
      <div
        className="p-4 relative overflow-hidden"
        style={{
          background: '#fefbf6',
          boxShadow: '3px 3px 10px rgba(0,0,0,0.25)',
        }}
      >
        {/* Paper texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: `url(${paperTexture})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            mixBlendMode: 'multiply',
          }}
        />
        
        <div className="flex items-center gap-4 relative z-10">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-amber-900/10 rounded-lg flex items-center justify-center">
            {isMenu ? (
              <Utensils size={18} className="text-amber-900/60" />
            ) : (
              <Camera size={18} className="text-amber-900/60" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-amber-900/90 text-sm">
              {formatDate(item.date)}
            </div>
            <div className="text-xs text-amber-900/60 truncate flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-amber-900/40">
                {isMenu ? 'Menu' : 'Snapshot'}
              </span>
              <span className="text-amber-900/30">•</span>
              {previewText}
            </div>
          </div>

          <div className="flex-shrink-0 text-amber-900/40">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineListItem({ item, onView, formatDate }: TimelineListItemProps) {
  const isMenu = item.type === 'menu';
  const menuData = isMenu ? item.data as MenuEntry : null;
  const snapshotData = !isMenu ? item.data as Snapshot : null;
  
  // Get preview text
  const previewText = isMenu 
    ? (menuData?.sections?.[0]?.items?.[0]?.name || 'Menu')
    : `${snapshotData?.item_count || 0} items`;
  
  return (
    <div
      onClick={onView}
      className="bg-amber-900/5 rounded-lg p-4 cursor-pointer transition-all hover:bg-amber-900/10 border border-amber-900/10 hover:border-amber-900/20 hover:shadow-sm"
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-amber-900/10 rounded-lg flex items-center justify-center">
          {isMenu ? (
            <Utensils size={20} className="text-amber-900/60" />
          ) : (
            <Camera size={20} className="text-amber-900/60" />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-amber-900/90 mb-1">
            {formatDate(item.date)}
          </div>
          <div className="text-sm text-amber-900/60 truncate flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-amber-900/40">
              {isMenu ? 'Menu' : 'Snapshot'}
            </span>
            <span className="text-amber-900/30">•</span>
            {previewText}
          </div>
        </div>

        <div className="flex-shrink-0 text-amber-900/40">
          <ChevronRight size={20} />
        </div>
      </div>
    </div>
  );
}
