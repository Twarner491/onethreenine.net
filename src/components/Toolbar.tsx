import { useState, useEffect, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { StickyNote, Image, List, Receipt, Calendar, LogOut, Plus, X, Settings } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { User as UserType } from './types';
import { toast } from 'sonner';

interface ToolbarProps {
  onAddItem: (type: 'note' | 'photo' | 'list' | 'receipt' | 'menu') => void;
  currentUser: UserType | null;
  onLogin: (userData: { name: string }) => void;
  onLogout: () => void;
  isViewerMode?: boolean;
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

export function Toolbar({ onAddItem, currentUser, onLogin, onLogout, isViewerMode = false }: ToolbarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [position, setPosition] = useState({ x: 32, y: typeof window !== 'undefined' ? window.innerHeight - 200 : 500 });
  const [rotation, setRotation] = useState(-2);

  // Load position and rotation from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('toolbar-position');
    const savedRotation = localStorage.getItem('toolbar-rotation');
    if (savedPosition && currentUser) {
      setPosition(JSON.parse(savedPosition));
    }
    if (savedRotation && currentUser) {
      setRotation(parseFloat(savedRotation));
    }
  }, [currentUser]);

  // Save position to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('toolbar-position', JSON.stringify(position));
    }
  }, [position, currentUser]);

  // Save rotation to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('toolbar-rotation', rotation.toString());
    }
  }, [rotation, currentUser]);

  // Select random masking tape and rotation once
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10,
    []
  );

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'toolbar',
    item: { id: 'toolbar' },
    canDrag: !!currentUser,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (_item, monitor) => {
      const offset = monitor.getSourceClientOffset();
      if (offset) {
        setPosition({ x: offset.x, y: offset.y });
      }
    },
  }), [currentUser]);

  const tools = [
    { type: 'note' as const, icon: StickyNote, label: 'Note' },
    { type: 'photo' as const, icon: Image, label: 'Photo' },
    { type: 'list' as const, icon: List, label: 'List' },
    { type: 'receipt' as const, icon: Receipt, label: 'Receipt' },
    { type: 'menu' as const, icon: Calendar, label: 'Event' },
  ];

  const handleLogin = () => {
    if (loginName.trim()) {
      onLogin({
        name: loginName.trim()
      });
      setLoginName('');
    }
  };

  const handleAddItem = (type: typeof tools[number]['type']) => {
    onAddItem(type);
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added!`);
  };

  // If not logged in, show centered login post-it
  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="relative"
          style={{
            transform: `rotate(-2deg)`,
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

          {/* Login post-it */}
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
              width: '400px',
              padding: '48px 64px',
            }}
          >
            <div className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-amber-900/80">Your Name</Label>
                  <Input
                    id="name"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="Enter your name"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    autoFocus
                    className="bg-white/60 border-amber-900/20 focus:border-amber-900/40"
                  />
                </div>
                
                <button
                  onClick={handleLogin}
                  disabled={!loginName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // In viewer mode, hide the toolbar completely
  if (isViewerMode) {
    return null;
  }

  return (
    <>
      {/* Overlay for settings dialog - greys out everything */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          style={{ zIndex: 999998 }}
          onClick={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Main toolbar as draggable post-it note */}
      <div
        ref={drag as unknown as React.Ref<HTMLDivElement>}
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
          transform: `rotate(${rotation}deg)`,
          cursor: isDragging ? 'grabbing' : 'move',
          opacity: isDragging ? 0.8 : 1,
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

        {/* Post-it note container */}
        <div 
          className="relative transition-all duration-300 flex flex-col pt-2"
          style={{
            background: '#fef3c7',
            borderRadius: '2px',
            boxShadow: `
              0 4px 8px rgba(0, 0, 0, 0.15),
              0 8px 20px rgba(0, 0, 0, 0.1),
              inset 0 -1px 2px rgba(0, 0, 0, 0.05)
            `,
            width: '180px',
          }}
        >
          {/* Top row - Plus button (left) and User section (right) - ALWAYS visible */}
          <div className="flex items-center justify-between px-3 py-2">
            {/* Plus button - left aligned */}
            <button
              onClick={() => setIsToolsExpanded(!isToolsExpanded)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-amber-800/80 transition-all hover:bg-amber-900/10 shrink-0"
            >
              {isToolsExpanded ? <X size={16} /> : <Plus size={16} />}
            </button>

            {/* User section - right aligned */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-amber-900/90 transition-all hover:bg-amber-900/10 min-w-0"
            >
              <span className="text-xs max-w-20 truncate">{currentUser.name}</span>
              <Settings size={12} className="opacity-70 shrink-0" />
            </button>
          </div>
          
          {/* Tool buttons - expand/collapse DOWNWARD beneath the controls */}
          <div 
            className="overflow-hidden transition-all duration-300"
            style={{
              maxHeight: isToolsExpanded ? '210px' : '0px',
            }}
          >
            <div className="px-3 pb-3 pt-1 space-y-1">
              {tools.map((tool) => (
                <button
                  key={tool.type}
                  onClick={() => handleAddItem(tool.type)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 text-left"
                >
                  <tool.icon size={14} />
                  <span className="text-sm">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog as Post-it */}
      {isSettingsOpen && (
        <div 
          className="fixed animate-in zoom-in-95 fade-in-0"
          style={{ 
            zIndex: 999999,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-1deg)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Masking tape */}
          <div 
            className="absolute top-0 left-1/2 z-10 pointer-events-none"
            style={{
              width: '80px',
              height: '35px',
              transform: `translateX(-50%) translateY(-18px) rotate(3deg)`,
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
              width: '400px',
              padding: '48px 64px',
            }}
          >
            <div className="space-y-8">
              {/* Profile Section */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-amber-900/80 mb-3">Signed in as</h3>
                <div className="text-center">
                  <div className="text-xl font-medium text-amber-900/90">{currentUser?.name}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onLogout();
                    setIsSettingsOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
