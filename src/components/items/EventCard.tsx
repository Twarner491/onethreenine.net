import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useMemo } from 'react';

interface EventItem {
  name: string;
  description: string;
}

interface EventCardProps {
  content: { title: string; date?: string; items: EventItem[] };
  onChange: (content: { title: string; date?: string; items: EventItem[] }) => void;
  isEditMode: boolean;
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

export function EventCard({ content, onChange, isEditMode }: EventCardProps) {
  const texture = useMemo(() => 
    paperTextures[Math.floor(Math.random() * paperTextures.length)],
    []
  );
  const handleAddItem = () => {
    onChange({
      ...content,
      items: [...content.items, { name: '', description: '' }]
    });
  };

  const handleRemoveItem = (index: number) => {
    onChange({
      ...content,
      items: content.items.filter((_, i) => i !== index)
    });
  };

  const handleUpdateItem = (index: number, field: 'name' | 'description', value: string) => {
    onChange({
      ...content,
      items: content.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    });
  };

  return (
    <div
      className="bg-gradient-to-b from-amber-50 to-amber-100 p-6 shadow-lg border border-amber-900/20"
      style={{
        width: '320px',
        minHeight: '280px',
        boxShadow: `
          4px 4px 8px rgba(0,0,0,0.25), 
          0 8px 16px rgba(0,0,0,0.15),
          inset 0 1px 0 rgba(255,255,255,0.6)
        `,
      }}
    >
      {/* Paper texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage: `url(${texture})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'multiply',
          transform: 'rotate(180deg)',
        }}
      />

      {/* Header */}
      <div className="text-center mb-4 pb-3 border-b border-amber-900/30 relative z-10">
        {isEditMode ? (
          <>
            <Input
              value={content.title}
              onChange={(e) => onChange({ ...content, title: e.target.value })}
              placeholder="Event Name"
              className="text-center border-none !bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 mb-2"
              style={{
                fontFamily: 'Outfit, sans-serif'
              }}
            />
            <Input
              value={content.date || ''}
              onChange={(e) => onChange({ ...content, date: e.target.value })}
              placeholder="Date (optional)"
              className="text-center border-none !bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              style={{
                fontFamily: 'Inter, sans-serif'
              }}
            />
          </>
        ) : (
          <>
            <h3 
              style={{
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {content.title || 'Event'}
            </h3>
            {content.date && (
              <div 
                className="text-sm mt-1 text-amber-800"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {content.date}
              </div>
            )}
          </>
        )}
      </div>

      {/* Event items */}
      <div className="space-y-3 relative z-10">
        {content.items.map((item, index) => (
          <div key={index} className="group relative">
            {isEditMode ? (
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    value={item.name}
                    onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                    placeholder="Item name"
                    className="border-none !bg-white/50 px-2 h-auto py-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  />
                  <Textarea
                    value={item.description}
                    onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="border-none !bg-white/50 px-2 h-auto py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-0"
                    rows={2}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                >
                  <X size={16} className="text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            ) : (
              <div>
                <div 
                  className="text-sm"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  • {item.name}
                </div>
                {item.description && (
                  <div 
                    className="text-xs text-amber-900/70 mt-1 ml-3"
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

      {/* Add button */}
      {isEditMode && (
        <Button
          onClick={handleAddItem}
          variant="ghost"
          size="sm"
          className="mt-4 w-full border border-amber-900/20 !bg-transparent hover:bg-white/30 relative z-10"
        >
          <Plus size={16} className="mr-1" />
          Add Item
        </Button>
      )}
    </div>
  );
}
