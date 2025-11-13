import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Calendar, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAllSnapshots, createSnapshot } from '../lib/supabase';
import { toast } from 'sonner';
import type { BoardItem } from './types';
import { PinnedItem } from './PinnedItem';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface Snapshot {
  id: string;
  snapshot_date: string;
  items_data: BoardItem[];
  item_count: number;
  created_at: string;
  updated_at: string;
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

export default function Timeline() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // Select random masking tape and rotation once
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10,
    []
  );

  useEffect(() => {
    loadSnapshots();
  }, []);

  // Keyboard navigation for snapshot view
  useEffect(() => {
    if (!selectedSnapshot) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigateSnapshot('prev');
      } else if (e.key === 'ArrowRight') {
        navigateSnapshot('next');
      } else if (e.key === 'Escape') {
        setSelectedSnapshot(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSnapshot, snapshots]);

  const loadSnapshots = async () => {
    try {
      setIsLoading(true);
      const data = await getAllSnapshots();
      // Cast the items_data from Json to BoardItem[]
      const formattedSnapshots: Snapshot[] = data.map(snapshot => ({
        ...snapshot,
        items_data: (snapshot.items_data as unknown as BoardItem[]) || []
      }));
      setSnapshots(formattedSnapshots);
    } catch (error) {
      console.error('Error loading snapshots:', error);
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
      await loadSnapshots();
    } catch (error) {
      console.error('Error creating snapshot:', error);
      toast.error('Failed to create snapshot');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const navigateSnapshot = (direction: 'prev' | 'next') => {
    if (!selectedSnapshot) return;
    
    const currentIndex = snapshots.findIndex(s => s.id === selectedSnapshot.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < snapshots.length) {
      setSelectedSnapshot(snapshots[newIndex]);
    }
  };

  if (isLoading) {
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
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-600/30 border-t-amber-600"></div>
        </div>
      </div>
    );
  }

  // If a snapshot is selected, show it in fullscreen
  if (selectedSnapshot) {
    const currentIndex = snapshots.findIndex(s => s.id === selectedSnapshot.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < snapshots.length - 1;

    // Calculate toolbar position (same logic as main board toolbar)
    const getToolbarPosition = () => {
      if (typeof window === 'undefined') return { x: 32, y: 500 };
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        return { x: window.innerWidth / 2 - 90, y: window.innerHeight - 150 };
      }
      return { x: 32, y: window.innerHeight - 200 };
    };

    const toolbarPosition = getToolbarPosition();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // Calculate scale for board items (same as PegboardCanvas)
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
      
      return scale;
    };
    
    const boardScale = calculateScale();
    const workspaceWidth = WORKSPACE_WIDTH * boardScale;
    const workspaceHeight = workspaceWidth / TARGET_ASPECT_RATIO;
    const offsetX = (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2 - workspaceWidth / 2;
    const offsetY = (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2 - workspaceHeight / 2;

    return (
      <DndProvider backend={HTML5Backend}>
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

          {/* Board items from snapshot - read-only with scaling */}
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
            {selectedSnapshot.items_data.map((item) => (
              <PinnedItem
                key={item.id}
                item={item}
                onUpdate={() => {}}
                onDelete={() => {}}
                isEditMode={false}
                users={[]}
                isSelected={false}
                onSelect={() => {}}
              />
            ))}
          </div>

          {/* Toolbar-styled navigation */}
          <div
            className="fixed z-50"
            style={{
              left: toolbarPosition.x,
              top: toolbarPosition.y,
              transform: `rotate(-2deg) scale(${isMobile ? 0.5 : 1})`,
              transformOrigin: 'top left',
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
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
                }}
              />
            </div>

            {/* Post-it note navigation */}
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
              {/* Navigation controls */}
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 text-sm font-medium cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  Back to Timeline
                </button>

                {/* Date display */}
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
                    title="Previous snapshot (←)"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <button
                    onClick={() => navigateSnapshot('next')}
                    disabled={!hasNext}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                    title="Next snapshot (→)"
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

  // Timeline grid view
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
        
        {/* Subtle shadow highlights */}
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
      </div>

      {/* Centered Post-it Container */}
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
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              }}
            />
          </div>

          {/* Post-it content */}
          <div 
            className="relative flex flex-col"
            style={{
              background: '#fef3c7',
              borderRadius: '2px',
              boxShadow: `
                0 4px 8px rgba(0, 0, 0, 0.15),
                0 8px 20px rgba(0, 0, 0, 0.1),
                inset 0 -1px 2px rgba(0, 0, 0, 0.05)
              `,
              padding: '48px 64px',
              maxHeight: '85vh',
            }}
          >
            {/* Back button */}
            <a
              href="/"
              className="absolute top-4 -left-8 flex items-center gap-2 px-3 py-2 rounded-md text-amber-900/80 transition-all hover:bg-amber-900/10"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-medium">Back to Board</span>
            </a>

            {/* Snapshot button - inline with Back button */}
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

            {/* Content */}
            <div className="mt-12 flex flex-col" style={{ maxHeight: 'calc(85vh - 48px - 64px)' }}>
              {/* Header with title and count */}
              <div className="flex items-start justify-between">
                <h1 className="text-3xl font-bold text-amber-900/90">
                  Board Timeline
                </h1>
                <div className="text-right">
                  <p className="text-sm text-amber-900/70">
                    {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Fixed spacer */}
              <div style={{ height: '16px' }}></div>

              {/* Scrollable snapshot list */}
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
                {snapshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Calendar size={48} className="mb-4 text-amber-900/40" />
                    <p className="text-amber-900/70 text-lg">
                      No snapshots yet!
                    </p>
                    <p className="text-amber-900/60 text-sm mt-2">
                      Click "Snapshot Now" to save the current board state
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-2">
                    {snapshots.map((snapshot) => (
                      <SnapshotListItem
                        key={snapshot.id}
                        snapshot={snapshot}
                        onView={() => setSelectedSnapshot(snapshot)}
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

interface SnapshotListItemProps {
  snapshot: Snapshot;
  onView: () => void;
  formatDate: (date: string) => string;
}

function SnapshotListItem({ snapshot, onView, formatDate }: SnapshotListItemProps) {
  return (
    <div
      onClick={onView}
      className="bg-amber-900/5 rounded-lg p-4 cursor-pointer transition-all hover:bg-amber-900/10 border border-amber-900/10 hover:border-amber-900/20 hover:shadow-sm"
    >
      <div className="flex items-center gap-4">
        {/* Date icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-amber-900/10 rounded-lg flex items-center justify-center">
          <Calendar size={20} className="text-amber-900/60" />
        </div>
        
        {/* Date and info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-amber-900/90 mb-1">
            {formatDate(snapshot.snapshot_date)}
          </div>
          <div className="text-sm text-amber-900/60">
            {snapshot.item_count} item{snapshot.item_count !== 1 ? 's' : ''} saved
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="flex-shrink-0 text-amber-900/40">
          <ChevronRight size={20} />
        </div>
      </div>
    </div>
  );
}

