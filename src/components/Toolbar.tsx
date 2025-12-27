import { useState, useEffect, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { StickyNote, Image, List, Receipt, LogOut, Plus, X, Settings, Eye, Pencil, HelpCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { User as UserType } from './types';
import { toast } from 'sonner';
import { useIsMobile, detectMobile } from './ui/use-mobile';

interface ToolbarProps {
  onAddItem: (type: 'note' | 'photo' | 'list' | 'receipt') => void;
  currentUser: UserType | null;
  onLogin: (userData: { name: string }) => void;
  onLogout: () => void;
  isViewerMode?: boolean;
  isUserViewerMode?: boolean;
  onToggleViewerMode?: () => void;
  isJiggleMode?: boolean;
  onExitJiggleMode?: () => void;
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

export function Toolbar({ onAddItem, currentUser, onLogin, onLogout, isViewerMode = false, isUserViewerMode = false, onToggleViewerMode, isJiggleMode = false, onExitJiggleMode }: ToolbarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [isMobileFabOpen, setIsMobileFabOpen] = useState(false);
  const [loginName, setLoginName] = useState('');
  
  // Use robust mobile detection hook
  const isMobile = useIsMobile();
  
  const getInitialPosition = () => {
    if (typeof window === 'undefined') return { x: 32, y: 500 };
    
    const mobile = detectMobile();
    if (mobile) {
      return { x: window.innerWidth / 2 - 90, y: window.innerHeight - 150 };
    }
    return { x: 32, y: window.innerHeight - 200 };
  };
  
  const [position, setPosition] = useState(getInitialPosition());
  const [rotation, setRotation] = useState(-2);

  useEffect(() => {
    const savedPosition = localStorage.getItem('toolbar-position');
    const savedRotation = localStorage.getItem('toolbar-rotation');
    const savedViewport = localStorage.getItem('toolbar-viewport');
    
    if (savedPosition && currentUser) {
      const parsed = JSON.parse(savedPosition);
      const wasMobile = savedViewport === 'mobile';
      const isCurrentlyMobile = detectMobile();
      
      if (wasMobile !== isCurrentlyMobile) {
        setPosition(getInitialPosition());
      } else {
        setPosition(parsed);
      }
    }
    if (savedRotation && currentUser) {
      setRotation(parseFloat(savedRotation));
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('toolbar-position', JSON.stringify(position));
      localStorage.setItem('toolbar-viewport', isMobile ? 'mobile' : 'desktop');
    }
  }, [position, currentUser, isMobile]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('toolbar-rotation', rotation.toString());
    }
  }, [rotation, currentUser]);

  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10,
    []
  );
  const fabTapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
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

  if (!currentUser) {
    return (
      <div data-toolbar className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full"
          style={{
            transform: `rotate(-2deg)`,
            maxWidth: isMobile ? '320px' : '400px',
          }}
        >
          <div 
            className="absolute top-0 left-1/2 z-10 pointer-events-none"
            style={{
              width: isMobile ? '60px' : '80px',
              height: isMobile ? '26px' : '35px',
              transform: `translateX(-50%) translateY(-${isMobile ? 14 : 18}px) rotate(${tapeRotation}deg)`,
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
              width: '100%',
              padding: isMobile ? '32px 24px' : '48px 64px',
            }}
          >
            <div className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-lg font-medium text-amber-900/90">Welcome</h2>
                <p className="text-sm text-amber-900/60 mt-1">Sign in to add to the board</p>
              </div>
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
                    style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
                  />
                </div>
                
                <button
                  onClick={handleLogin}
                  disabled={!loginName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

  // Jiggle/Arrange mode - show "Done" button for mobile
  if (isJiggleMode && isMobile) {
    return (
      <div 
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%) rotate(-1deg)',
          zIndex: 9999,
        }}
      >
        <button
          onClick={onExitJiggleMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: '12px',
            backgroundImage: `url(${fabTapeTexture})`,
            backgroundSize: '500% 500%',
            backgroundPosition: 'center',
            color: '#78350f',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <span style={{ fontSize: '16px' }}>✓</span>
          Done Arranging
        </button>
        
        {/* Hint text */}
        <div 
          style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            fontFamily: 'Georgia, serif',
          }}
        >
          Drag items to move • Tap elsewhere to finish
        </div>
      </div>
    );
  }

  // MonaLisa viewer mode - no toolbar at all
  if (isViewerMode) {
    return null;
  }

  // User-initiated viewer mode - show minimal exit button
  if (isUserViewerMode) {
    // Mobile viewer mode - floating buttons at bottom
    if (isMobile) {
      return (
        <>
          {/* Settings backdrop */}
          {isSettingsOpen && (
            <div 
              className="fixed inset-0 bg-black/60"
              style={{ zIndex: 10000 }}
              onClick={() => setIsSettingsOpen(false)}
            />
          )}

          {/* Mobile viewer mode buttons - masking tape styled, smaller and rounder */}
          <div 
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {/* Settings button - tape texture, smaller and rounder */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundImage: `url(${fabTapeTexture})`,
                backgroundSize: '400% 400%',
                backgroundPosition: 'center',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Settings size={18} color="#78350f" />
            </button>

            {/* Exit viewer mode button - tape texture, rounder */}
            <button
              onClick={onToggleViewerMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundImage: `url(${fabTapeTexture})`,
                backgroundSize: '500% 500%',
                backgroundPosition: 'center',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Eye size={16} color="#78350f" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#78350f', fontFamily: 'Georgia, serif' }}>Viewing</span>
              <Pencil size={14} color="#78350f" />
            </button>
          </div>

          {/* Mobile Settings Sheet */}
          {isSettingsOpen && (
            <div 
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: '#fef3c7',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              zIndex: 10001,
              padding: '28px 28px 44px',
              animation: 'slideUpSheet 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div 
                style={{
                  width: '40px',
                  height: '4px',
                  backgroundColor: 'rgba(120, 53, 15, 0.2)',
                  borderRadius: '2px',
                }}
              />
            </div>

            {/* User info */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#78350f' }}>{currentUser?.name}</div>
              <div style={{ fontSize: '13px', color: '#92400e', marginTop: '6px' }}>Viewer Mode</div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    window.location.hash = 'instructions';
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all active:bg-amber-900/20 font-medium text-sm"
                >
                  <HelpCircle size={16} />
                  Help & Instructions
                </button>

                <button
                  onClick={() => {
                    onLogout();
                    setIsSettingsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all active:bg-amber-900/20 font-medium text-sm"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Animation keyframes */}
          <style>{`
            @keyframes slideUpSheet {
              from {
                transform: translateY(100%);
                opacity: 0.8;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
          `}</style>
        </>
      );
    }

    // Desktop viewer mode
    return (
      <div
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
          transform: `rotate(${rotation}deg)`,
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
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
            }}
          />
        </div>

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
            padding: '12px 16px',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-amber-900/70">
              <Eye size={14} />
              <span className="text-xs font-medium">Viewing</span>
            </div>
            <button
              onClick={onToggleViewerMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 text-xs font-medium"
            >
              <Pencil size={12} />
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile FAB UI
  if (isMobile) {
    return (
      <>
        {/* Mobile FAB backdrop when open */}
        {isMobileFabOpen && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 9998,
            }}
            onClick={() => setIsMobileFabOpen(false)}
          />
        )}

        {/* Settings backdrop */}
        {isSettingsOpen && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 10000,
            }}
            onClick={() => setIsSettingsOpen(false)}
          />
        )}

        {/* Mobile FAB and menu */}
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '12px',
          }}
        >
          {/* Expanded tool options - masking tape styled */}
          {isMobileFabOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
              {tools.map((tool, index) => (
                <button
                  key={tool.type}
                  onClick={() => {
                    handleAddItem(tool.type);
                    setIsMobileFabOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    backgroundImage: `url(${fabTapeTexture})`,
                    backgroundSize: '400% 400%',
                    backgroundPosition: `center ${index * 25}%`,
                    boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
                    border: 'none',
                    cursor: 'pointer',
                    minHeight: '48px',
                    transform: `rotate(${(index - 1.5) * 0.5}deg)`,
                  }}
                >
                  <tool.icon size={20} color="#78350f" />
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#78350f', fontFamily: 'Georgia, serif', paddingRight: '8px' }}>{tool.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* FAB row with settings and add buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Settings button - tape texture, smaller and rounder */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundImage: `url(${fabTapeTexture})`,
                backgroundSize: '400% 400%',
                backgroundPosition: 'center',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Settings size={18} color="#78350f" />
            </button>

            {/* Main FAB - Add button with tape texture, smaller and rounder */}
            <button
              onClick={() => setIsMobileFabOpen(!isMobileFabOpen)}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                backgroundImage: `url(${fabTapeTexture})`,
                backgroundSize: '350% 350%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transform: isMobileFabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease-out',
              }}
            >
              <Plus size={24} color="#78350f" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Mobile Settings Sheet - paper texture with slide-up animation */}
        {isSettingsOpen && (
          <div 
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fef3c7',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              zIndex: 10001,
              padding: '28px 28px 44px',
              animation: 'slideUpSheet 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div 
                style={{
                  width: '40px',
                  height: '4px',
                  backgroundColor: 'rgba(120, 53, 15, 0.2)',
                  borderRadius: '2px',
                }}
              />
            </div>

            {/* User info */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#78350f' }}>{currentUser?.name}</div>
              <div style={{ fontSize: '13px', color: '#92400e', marginTop: '6px' }}>Signed in</div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button
                onClick={() => {
                  onToggleViewerMode?.();
                  setIsSettingsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all active:bg-amber-900/20 font-medium text-sm"
              >
                <Eye size={16} />
                Enter Viewer Mode
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  window.location.hash = 'instructions';
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all active:bg-amber-900/20 font-medium text-sm"
              >
                <HelpCircle size={16} />
                Help & Instructions
              </button>

              <button
                onClick={() => {
                  onLogout();
                  setIsSettingsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all active:bg-amber-900/20 font-medium text-sm"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Animation keyframes */}
        <style>{`
          @keyframes slideUpSheet {
            from {
              transform: translateY(100%);
              opacity: 0.8;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </>
    );
  }

  // Desktop toolbar UI
  return (
    <>
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          style={{ zIndex: 999998 }}
          onClick={() => setIsSettingsOpen(false)}
        />
      )}

      <div
        ref={drag as unknown as React.Ref<HTMLDivElement>}
        data-toolbar
        className="fixed z-50 touch-none"
        style={{
          left: position.x,
          top: position.y,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'top left',
          cursor: isDragging ? 'grabbing' : 'move',
          opacity: isDragging ? 0.8 : 1,
          maxWidth: 'calc(100vw - 40px)',
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
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
            }}
          />
        </div>

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
          <div className="flex items-center justify-between px-3 py-2">
            <button
              onClick={() => setIsToolsExpanded(!isToolsExpanded)}
              className="w-10 h-10 rounded-md flex items-center justify-center text-amber-800/80 transition-all hover:bg-amber-900/10 active:bg-amber-900/20 shrink-0"
              style={{ minWidth: '40px', minHeight: '40px' }}
            >
              {isToolsExpanded ? <X size={18} /> : <Plus size={18} />}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-amber-900/90 transition-all hover:bg-amber-900/10 active:bg-amber-900/20 min-w-0"
              style={{ minHeight: '40px' }}
            >
              <span className="text-xs max-w-20 truncate">{currentUser.name}</span>
              <Settings size={14} className="opacity-70 shrink-0" />
            </button>
          </div>
          
          <div 
            className="overflow-hidden transition-all duration-300"
            style={{
              maxHeight: isToolsExpanded ? '300px' : '0px',
            }}
          >
            <div className="px-3 pb-3 pt-1 space-y-1.5 max-h-[calc(100vh-200px)] overflow-y-auto">
              {tools.map((tool) => (
                <button
                  key={tool.type}
                  onClick={() => handleAddItem(tool.type)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-amber-800/80 transition-all hover:bg-amber-900/10 active:bg-amber-900/20 text-left"
                  style={{ minHeight: '44px' }}
                >
                  <tool.icon size={16} />
                  <span className="text-sm font-medium">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
              width: '380px',
              padding: '44px 48px 44px',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setIsSettingsOpen(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'rgba(120, 53, 15, 0.08)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(120, 53, 15, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(120, 53, 15, 0.08)'}
            >
              <X size={16} color="#78350f" />
            </button>

            {/* Settings title */}
            <h2 
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: '#92400e',
                marginBottom: '28px',
                fontWeight: 500,
              }}
            >
              Settings
            </h2>

            {/* User section */}
            <div style={{ marginBottom: '32px' }}>
              <div 
                style={{
                  fontSize: '12px',
                  color: '#a16207',
                  marginBottom: '8px',
                }}
              >
                Signed in as
              </div>
              <div 
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#78350f',
                  fontFamily: 'Georgia, serif',
                }}
              >
                {currentUser?.name}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'rgba(120, 53, 15, 0.15)', marginBottom: '28px' }} />

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Viewer Mode */}
              <button
                onClick={() => {
                  onToggleViewerMode?.();
                  setIsSettingsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/15 hover:border-amber-900/25 font-medium text-sm"
              >
                <Eye size={16} />
                Enter Viewer Mode
              </button>
              <p className="text-xs text-amber-800/60 text-center -mt-1 mb-2">
                View-only mode for browsing
              </p>

              {/* Help & Instructions */}
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  window.location.hash = 'instructions';
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/15 hover:border-amber-900/25 font-medium text-sm"
              >
                <HelpCircle size={16} />
                Help & Instructions
              </button>

              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: 'rgba(120, 53, 15, 0.1)', margin: '12px 0' }} />

              {/* Sign Out */}
              <button
                onClick={() => {
                  onLogout();
                  setIsSettingsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/15 hover:border-amber-900/25 font-medium text-sm"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
