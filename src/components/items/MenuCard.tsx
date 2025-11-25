import { Utensils } from 'lucide-react';
import { useMemo } from 'react';

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

interface MenuCardProps {
  content: MenuContent;
}

const paperTextures = [
  '/assets/images/paper/2337696d-9c85-4330-839d-4102c2c8da38_rw_1920.png',
  '/assets/images/paper/44fe7d03-7726-46a0-9b17-5790a11fe42d_rw_3840.png',
  '/assets/images/paper/572e1f03-ee6d-4a6b-95d8-9fec367c58a9_rw_1920.png',
  '/assets/images/paper/6248e7b9-85bc-42bd-9f63-d2e616f0d052_rw_3840.png',
  '/assets/images/paper/68a52e56-4965-4abb-be00-23391add258e_rw_3840.png',
  '/assets/images/paper/7e962015-0433-412b-a317-f61b5443a8d7_rw_1920.png',
  '/assets/images/paper/9817efcb-3d41-4636-ab42-03d12cdc8d65_rw_1920.png',
  '/assets/images/paper/bb7c16bc-6117-4c23-b022-7ca3a143c391_rw_1920.png',
  '/assets/images/paper/c2759faf-5614-45ed-8aa1-db8910edd4b1_rw_1920.png',
  '/assets/images/paper/d4c7dcac-c8d9-4198-94c8-57b9c87f546b_rw_1920.png',
  '/assets/images/paper/e3412127-26e3-440d-af30-ab0569d56e47_rw_3840.png',
  '/assets/images/paper/f3fd09d0-a280-4b03-9f09-ab5f8b6f9265_rw_1920.png',
  '/assets/images/paper/faa3b998-f4d4-409d-9066-50a48a86df45_rw_1920.png',
];

export function MenuCard({ content }: MenuCardProps) {
  const texture = useMemo(() => 
    paperTextures[Math.floor(Math.random() * paperTextures.length)],
    []
  );

  // Handle backwards compatibility with old EventCard structure
  const normalizedContent = useMemo(() => {
    if (content.sections) {
      return content;
    }
    const oldContent = content as any;
    if (oldContent.items && Array.isArray(oldContent.items)) {
      return {
        ...content,
        sections: [{
          title: oldContent.title || 'Main',
          items: oldContent.items.map((item: any) => ({
            name: item.name || '',
            description: item.description || ''
          }))
        }]
      };
    }
    return { ...content, sections: [] };
  }, [content]);

  const sections = normalizedContent.sections || [];

  // Check if menu has any actual dishes with names
  const hasContent = sections.some(s => 
    s.items.some((item: MenuItem) => item.name && item.name.trim() !== '')
  );

  return (
    <div
      className="bg-white p-6 shadow-lg relative cursor-pointer"
      style={{
        width: '320px',
        minHeight: '420px',
        paddingTop: '32px', // Extra space for tape
        boxShadow: `
          4px 4px 12px rgba(0,0,0,0.3), 
          0 8px 20px rgba(0,0,0,0.2),
          inset 0 1px 0 rgba(255,255,255,0.8),
          inset 0 -1px 0 rgba(0,0,0,0.05)
        `,
      }}
      onDoubleClick={() => {
        window.location.href = '/menu';
      }}
    >
        {/* Paper texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            backgroundImage: `url(${texture})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            mixBlendMode: 'multiply',
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-4">
            <h2 
              className="text-base tracking-[0.2em] font-normal text-stone-600 uppercase"
              style={{ 
                fontFamily: 'Cormorant Garamond, Georgia, serif',
              }}
            >
              Menu
            </h2>
            {content.date && (
              <div 
                className="text-xs text-stone-400 mt-1"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {content.date}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-b border-gray-200 mb-4" />

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {/* Section Title */}
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

                {/* Items */}
                <div className="space-y-1.5">
                  {section.items.map((item: MenuItem, itemIndex: number) => (
                    <div key={itemIndex} className="text-center">
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
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {!hasContent && (
            <div className="flex flex-col items-center justify-center py-6 text-stone-300">
              <Utensils size={20} className="mb-2 opacity-50" />
              <span className="text-xs">Double-click to edit</span>
            </div>
          )}
        </div>
      </div>
  );
}
