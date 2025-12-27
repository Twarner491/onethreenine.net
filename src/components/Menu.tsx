import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Plus, X, Camera, Upload, Check, Pencil, LogIn } from 'lucide-react';
import { uploadImage, getAllBoardItems, updateBoardItem, createBoardItem, createMenuEntry, getOrCreateUser } from '../lib/supabase';
import { toast, Toaster } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

const MOBILE_BREAKPOINT = 768;

interface MenuItem {
  name: string;
  description?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuContent {
  title?: string;
  date?: string;
  sections: MenuSection[];
  photos?: string[];
}

const paperTextures = [
  '/assets/images/paper/2337696d-9c85-4330-839d-4102c2c8da38_rw_1920.png',
  '/assets/images/paper/44fe7d03-7726-46a0-9b17-5790a11fe42d_rw_3840.png',
  '/assets/images/paper/572e1f03-ee6d-4a6b-95d8-9fec367c58a9_rw_1920.png',
  '/assets/images/paper/6248e7b9-85bc-42bd-9f63-d2e616f0d052_rw_3840.png',
  '/assets/images/paper/7e962015-0433-412b-a317-f61b5443a8d7_rw_1920.png',
  '/assets/images/paper/c2759faf-5614-45ed-8aa1-db8910edd4b1_rw_1920.png',
];

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

export default function Menu() {
  const [menuContent, setMenuContent] = useState<MenuContent>({
    sections: [{ title: '', items: [] }]
  });
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturePhotos, setCapturePhotos] = useState<string[]>([]);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Select random textures once
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

  // Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('pegboard-user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = async () => {
    if (!loginName.trim()) return;
    
    try {
      const user = await getOrCreateUser(loginName.trim());
      const formattedUser = {
        id: user.id,
        name: user.name,
        color: user.color,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
      
      setCurrentUser(formattedUser);
      localStorage.setItem('pegboard-user', JSON.stringify(formattedUser));
      toast.success(`Welcome, ${user.name}!`);
      setShowLoginModal(false);
      setLoginName('');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to log in');
    }
  };

  // Load menu from board items
  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      setIsLoading(true);
      const items = await getAllBoardItems();
      
      // Find the menu item (type === 'menu' with sections structure)
      const menuItem = items.find(item => {
        if (item.type !== 'menu') return false;
        const content = item.content as any;
        return content && 'sections' in content;
      });

      if (menuItem) {
        setMenuItemId(menuItem.id);
        const content = menuItem.content as any;
        
        // Handle backwards compatibility
        if (content.sections) {
          setMenuContent({
            ...content,
            sections: content.sections || [{ title: '', items: [] }]
          });
        } else if (content.items && Array.isArray(content.items)) {
          setMenuContent({
            date: content.date,
            sections: [{
              title: content.title || '',
              items: content.items.map((item: any) => ({
                name: item.name || '',
                description: item.description || ''
              }))
            }]
          });
        } else {
          setMenuContent({ sections: [{ title: '', items: [] }] });
        }
      }
    } catch (error) {
      console.error('Error loading menu:', error);
      toast.error('Failed to load menu');
    } finally {
      setIsLoading(false);
    }
  };

  const saveMenu = async (content: MenuContent) => {
    if (!currentUser) {
      toast.error('Please sign in to edit the menu');
      return;
    }

    try {
      setIsSaving(true);
      
      if (menuItemId) {
        await updateBoardItem(menuItemId, { content: content as any });
      } else {
        const newItem = await createBoardItem(
          'menu',
          150,
          120,
          content,
          currentUser.id,
          -1,
          undefined
        );
        setMenuItemId(newItem.id);
      }
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error('Failed to save menu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: MenuContent) => {
    setMenuContent(newContent);
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveMenu(newContent);
    }, 800);
  };

  const handleAddSection = () => {
    const newContent = {
      ...menuContent,
      sections: [...menuContent.sections, { title: '', items: [] }]
    };
    handleContentChange(newContent);
  };

  const handleRemoveSection = (sectionIndex: number) => {
    const newContent = {
      ...menuContent,
      sections: menuContent.sections.filter((_, i) => i !== sectionIndex)
    };
    handleContentChange(newContent);
  };

  const handleUpdateSectionTitle = (sectionIndex: number, title: string) => {
    const newContent = {
      ...menuContent,
      sections: menuContent.sections.map((section, i) => 
        i === sectionIndex ? { ...section, title } : section
      )
    };
    handleContentChange(newContent);
  };

  const handleAddItem = (sectionIndex: number) => {
    const newContent = {
      ...menuContent,
      sections: menuContent.sections.map((section, i) => 
        i === sectionIndex 
          ? { ...section, items: [...section.items, { name: '', description: '' }] }
          : section
      )
    };
    handleContentChange(newContent);
  };

  const handleRemoveItem = (sectionIndex: number, itemIndex: number) => {
    const newContent = {
      ...menuContent,
      sections: menuContent.sections.map((section, i) => 
        i === sectionIndex 
          ? { ...section, items: section.items.filter((_, j) => j !== itemIndex) }
          : section
      )
    };
    handleContentChange(newContent);
  };

  const handleUpdateItem = (
    sectionIndex: number, 
    itemIndex: number, 
    field: 'name' | 'description', 
    value: string
  ) => {
    const newContent = {
      ...menuContent,
      sections: menuContent.sections.map((section, i) => 
        i === sectionIndex 
          ? {
              ...section,
              items: section.items.map((item, j) => 
                j === itemIndex ? { ...item, [field]: value } : item
              )
            }
          : section
      )
    };
    handleContentChange(newContent);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUser) return;

    try {
      const newPhotos: string[] = [];
      
      for (const file of Array.from(files)) {
        const url = await uploadImage(file, currentUser.id);
        newPhotos.push(url);
      }
      
      setCapturePhotos(prev => [...prev, ...newPhotos]);
      toast.success(`${newPhotos.length} photo(s) uploaded!`);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Failed to upload photos');
    }
  };

  const handleCapture = async () => {
    if (!currentUser) {
      toast.error('Please sign in to capture the menu');
      return;
    }

    try {
      setIsCapturing(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Create a menu entry for the timeline
      await createMenuEntry(
        today,
        menuContent.sections,
        capturePhotos,
        menuContent.title
      );
      
      // Clear dishes but keep section titles
      const clearedSections = menuContent.sections.map(section => ({
        ...section,
        items: []
      }));
      
      const clearedContent = {
        ...menuContent,
        sections: clearedSections,
        photos: []
      };
      
      // Save the cleared menu to the board
      await saveMenu(clearedContent);
      setMenuContent(clearedContent);
      
      toast.success('Menu captured and saved to timeline!');
      setShowCaptureModal(false);
      setCapturePhotos([]);
    } catch (error) {
      console.error('Error capturing menu:', error);
      toast.error('Failed to capture menu');
    } finally {
      setIsCapturing(false);
    }
  };

  const removePhoto = (index: number) => {
    setCapturePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleDoneEditing = () => {
    setIsEditing(false);
    // Force save on done
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveMenu(menuContent);
    toast.success('Menu saved!');
  };

  // Check if menu has actual dishes with names
  const hasContent = menuContent.sections.some(s => 
    s.items.some(item => item.name && item.name.trim() !== '')
  );

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
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-stone-400/30 border-t-stone-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <Toaster />
      
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

      {/* Mobile Back FAB */}
      {isMobile && (
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
          <ArrowLeft size={18} style={{ color: '#44250f' }} />
        </a>
      )}

      {/* Mobile Action FABs */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            zIndex: 50,
            top: '12px',
            right: '12px',
            display: 'flex',
            gap: '8px',
          }}
        >
          {!currentUser && (
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none',
              }}
            >
              <LogIn size={18} style={{ color: '#44250f' }} />
            </button>
          )}
          {currentUser && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none',
              }}
            >
              <Pencil size={18} style={{ color: '#44250f' }} />
            </button>
          )}
          {currentUser && isEditing && (
            <button
              onClick={handleDoneEditing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none',
              }}
            >
              <Check size={18} style={{ color: '#44250f' }} />
            </button>
          )}
          {currentUser && hasContent && (
            <button
              onClick={() => setShowCaptureModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `url(${tapeTexture})`,
                backgroundSize: '200% 200%',
                backgroundPosition: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none',
              }}
            >
              <Camera size={18} style={{ color: '#44250f' }} />
            </button>
          )}
        </div>
      )}

      {/* Centered Menu Paper - Scrollable on mobile, centered on desktop */}
      <div 
        className="absolute inset-0 flex justify-center overflow-auto"
        style={{ 
          alignItems: isMobile ? 'flex-start' : 'center',
          padding: isMobile ? '60px 16px 24px' : '32px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          className="relative"
          style={{
            transform: isMobile ? 'none' : 'rotate(-0.5deg)',
            maxWidth: isMobile ? '100%' : '480px',
            width: '100%',
          }}
        >
          {/* Masking tape */}
          <div 
            className="absolute top-0 left-1/2 z-10 pointer-events-none"
            style={{
              width: isMobile ? '60px' : '80px',
              height: isMobile ? '26px' : '35px',
              transform: `translateX(-50%) translateY(-${isMobile ? '13px' : '18px'}) rotate(${tapeRotation}deg)`,
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
              minHeight: isMobile ? '300px' : '420px',
              padding: isMobile ? '24px 20px' : '48px',
            }}
          >
            {/* Paper texture overlay */}
            <div 
              className="absolute inset-0 opacity-[0.15] pointer-events-none"
              style={{
                backgroundImage: `url(${paperTexture})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                mixBlendMode: 'multiply',
              }}
            />

            {/* Desktop Back button */}
            {!isMobile && (
            <a
              href="/"
              className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1.5 rounded text-stone-500 transition-all hover:bg-stone-100 text-sm z-50 pointer-events-auto"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </a>
            )}

            {/* Desktop Action buttons */}
            {!isMobile && (
              <div className="absolute top-4 right-4 flex gap-2 z-50 pointer-events-auto">
              {!currentUser && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 text-stone-600 border border-stone-200 transition-all hover:bg-stone-200 text-sm shadow-sm"
                >
                  <LogIn size={12} />
                  Sign In
                </button>
              )}
              {currentUser && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 text-stone-600 border border-stone-200 transition-all hover:bg-stone-200 text-sm shadow-sm"
                >
                  <Pencil size={12} />
                  Edit
                </button>
              )}
              {currentUser && isEditing && (
                <button
                  onClick={handleDoneEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 text-stone-600 border border-stone-200 transition-all hover:bg-stone-200 text-sm"
                >
                  <Check size={12} />
                  Done
                </button>
              )}
              {currentUser && hasContent && (
                <button
                  onClick={() => setShowCaptureModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 text-stone-600 border border-stone-200 transition-all hover:bg-stone-200 text-sm"
                >
                  <Camera size={12} />
                  Capture
                </button>
              )}
            </div>
            )}

            {/* Content */}
            <div 
              className="relative z-10"
              style={{ marginTop: isMobile ? '8px' : '40px' }}
            >
              {/* Header */}
              <div className="text-center mb-4">
                <h1 
                  className="font-normal text-stone-600 uppercase"
                  style={{ 
                    fontFamily: 'Cormorant Garamond, Georgia, serif',
                    fontSize: isMobile ? '0.875rem' : '1rem',
                    letterSpacing: '0.2em',
                  }}
                >
                  Menu
                </h1>
                {menuContent.date && (
                  <div 
                    className="text-xs text-stone-400 mt-1"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {menuContent.date}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-b border-gray-200 mb-4" />

              {/* Sections */}
              <div className="space-y-4">
                {menuContent.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="relative group">
                    {/* Section Title */}
                    <div className="mb-2">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            value={section.title}
                            onChange={(e) => handleUpdateSectionTitle(sectionIndex, e.target.value)}
                            placeholder="Section Title"
                            spellCheck={false}
                            className="text-center border border-stone-200 !bg-stone-100 px-3 py-1 h-auto focus-visible:ring-1 focus-visible:ring-stone-300 text-xs font-medium uppercase tracking-wider max-w-[180px] rounded"
                            style={{ 
                              fontFamily: 'Cormorant Garamond, Georgia, serif',
                              color: '#44403c',
                              fontSize: isMobile ? '16px' : 'inherit', // Prevent iOS zoom
                            }}
                          />
                          {menuContent.sections.length > 1 && (
                            <button
                              onClick={() => handleRemoveSection(sectionIndex)}
                              className="p-1 hover:bg-stone-100 rounded"
                            >
                              <X size={12} className="text-stone-400" />
                            </button>
                          )}
                        </div>
                      ) : (
                        section.title && (
                          <div 
                            className="text-xs font-medium uppercase tracking-wider text-center text-stone-400"
                            style={{ 
                              fontFamily: 'Cormorant Garamond, Georgia, serif',
                              letterSpacing: '0.1em',
                            }}
                          >
                            {section.title}
                          </div>
                        )
                      )}
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                      {section.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="relative group/item text-center">
                          {isEditing ? (
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-1.5">
                                <Input
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(sectionIndex, itemIndex, 'name', e.target.value)}
                                  placeholder="Dish name"
                                  spellCheck={false}
                                  className="text-center border border-stone-200 !bg-stone-100 px-3 py-1.5 h-auto focus-visible:ring-1 focus-visible:ring-stone-300 text-sm rounded"
                                  style={{ 
                                    fontFamily: 'Cormorant Garamond, Georgia, serif',
                                    color: '#44403c',
                                    fontSize: isMobile ? '16px' : 'inherit', // Prevent iOS zoom
                                  }}
                                />
                                <Input
                                  value={item.description || ''}
                                  onChange={(e) => handleUpdateItem(sectionIndex, itemIndex, 'description', e.target.value)}
                                  placeholder="Description (optional)"
                                  spellCheck={false}
                                  className="text-center border border-stone-200 !bg-stone-100/80 px-3 py-1 h-auto focus-visible:ring-1 focus-visible:ring-stone-300 text-xs italic rounded"
                                  style={{ 
                                    fontFamily: 'Inter, sans-serif',
                                    color: '#57534e',
                                    fontSize: isMobile ? '16px' : 'inherit', // Prevent iOS zoom
                                  }}
                                />
                              </div>
                              <button
                                onClick={() => handleRemoveItem(sectionIndex, itemIndex)}
                                className="mt-1.5 p-2 hover:bg-red-50 rounded border border-stone-200 hover:border-red-200 transition-colors"
                                title="Remove dish"
                              >
                                <X size={14} className="text-stone-400 hover:text-red-500" />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div 
                                className="text-sm text-stone-600"
                                style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}
                              >
                                {item.name || 'Untitled'}
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
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add item button */}
                    {isEditing && (
                      <button
                        onClick={() => handleAddItem(sectionIndex)}
                        className="w-full mt-4 flex items-center justify-center gap-1 px-2 py-3 rounded text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all border border-dashed border-stone-200"
                      >
                        <Plus size={14} />
                        <span>Add Dish</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add section button */}
              {isEditing && (
                <Button
                  onClick={handleAddSection}
                  variant="ghost"
                  size="sm"
                  className="mt-6 w-full border border-stone-200 !bg-transparent hover:bg-stone-50 text-stone-400 hover:text-stone-600 text-xs py-3"
                >
                  <Plus size={14} className="mr-1" />
                  Add Section
                </Button>
              )}

              {/* Empty state */}
              {!hasContent && !isEditing && (
                <div className="text-center py-8 text-stone-400">
                  <p className="text-sm mb-4">No menu items yet</p>
                  {currentUser && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-stone-100 text-stone-600 border border-stone-200 transition-all hover:bg-stone-200 text-sm"
                    >
                      <Pencil size={12} />
                      Add Items
                    </button>
                  )}
                </div>
              )}

              {/* Saving indicator */}
              {isSaving && (
                <div className="text-center mt-6 text-xs text-stone-400">
                  Saving...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ padding: isMobile ? '16px' : '16px' }}
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="relative w-full"
            style={{
              transform: `rotate(-1deg)`,
              maxWidth: isMobile ? '100%' : '360px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="absolute top-0 left-1/2 z-10 pointer-events-none"
              style={{
                width: isMobile ? '60px' : '80px',
                height: isMobile ? '26px' : '35px',
                transform: `translateX(-50%) translateY(-${isMobile ? '13px' : '18px'}) rotate(2deg)`,
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
              className="relative bg-[#fef3c7] rounded-sm shadow-xl w-full"
              style={{
                boxShadow: `
                  0 4px 8px rgba(0, 0, 0, 0.15),
                  0 8px 20px rgba(0, 0, 0, 0.1),
                  inset 0 -1px 2px rgba(0, 0, 0, 0.05)
                `,
                padding: isMobile ? '24px' : '32px',
              }}
            >
                <div className="space-y-4">
                <p className="text-center text-amber-900/60 text-sm">
                  Welcome! Sign in to edit the menu.
                </p>
                  <div className="space-y-2">
                    <Label htmlFor="login-name" className="text-amber-900/80">Your Name</Label>
                    <Input
                      id="login-name"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      placeholder="Enter your name"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      autoFocus
                      className="bg-white/60 border-amber-900/20 focus:border-amber-900/40"
                    style={{ fontSize: '16px' }} // Prevent iOS zoom
                    />
                  </div>
                  
                  <button
                    onClick={handleLogin}
                    disabled={!loginName.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sign In to Edit
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capture Modal */}
      {showCaptureModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowCaptureModal(false)}
          />
          
          <div 
            className="fixed z-50 animate-in zoom-in-95 fade-in-0"
            style={{ 
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-1deg)',
              width: isMobile ? 'calc(100% - 32px)' : '420px',
              maxWidth: '420px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="absolute top-0 left-1/2 z-10 pointer-events-none"
              style={{
                width: isMobile ? '60px' : '80px',
                height: isMobile ? '26px' : '35px',
                transform: `translateX(-50%) translateY(-${isMobile ? '13px' : '18px'}) rotate(3deg)`,
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
              className="relative bg-white shadow-lg"
              style={{
                boxShadow: `
                  4px 4px 12px rgba(0,0,0,0.3), 
                  0 8px 20px rgba(0,0,0,0.2)
                `,
                padding: isMobile ? '32px 24px' : '48px',
              }}
            >
              <div className="space-y-6">
                <div className="text-center">
                  <h3 
                    className="font-normal text-stone-600 mb-2 uppercase tracking-widest"
                    style={{ 
                      fontFamily: 'Cormorant Garamond, Georgia, serif',
                      fontSize: isMobile ? '1rem' : '1.125rem',
                    }}
                  >
                    Capture Menu
                  </h3>
                  <p className="text-xs text-stone-400 font-light">
                    Add photos of your meal (optional)
                  </p>
                </div>

                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  
                  {capturePhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {capturePhotos.map((photo, index) => (
                        <div key={index} className="relative aspect-square bg-stone-100 shadow-sm group">
                          <img 
                            src={photo} 
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-white text-stone-600 shadow-sm flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border border-dashed border-stone-300 rounded-sm flex flex-col items-center justify-center gap-2 text-stone-400 hover:text-stone-600 hover:border-stone-400 hover:bg-stone-50/50 transition-all group"
                  >
                    <div className="p-3 rounded-full bg-stone-50 group-hover:bg-stone-100 transition-colors">
                      <Upload size={20} className="text-stone-400 group-hover:text-stone-600" />
                    </div>
                    <span className="text-xs uppercase tracking-wider font-medium">Upload photos</span>
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCaptureModal(false);
                      setCapturePhotos([]);
                    }}
                    className="flex-1 px-4 py-3 rounded-sm bg-transparent text-stone-400 transition-all hover:bg-stone-50 hover:text-stone-600 text-xs uppercase tracking-wider font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCapture}
                    disabled={isCapturing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-stone-800 text-stone-50 transition-all hover:bg-stone-900 text-xs uppercase tracking-wider font-medium disabled:opacity-50 shadow-sm"
                  >
                    {isCapturing ? 'Saving...' : (
                      <>
                        <Check size={14} />
                        Done
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
