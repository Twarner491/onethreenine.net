import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { User } from '../types';
import { useMemo } from 'react';

interface ListItem {
  text: string;
  checked: boolean;
}

interface ListCardProps {
  content: { title: string; items: ListItem[] };
  onChange: (content: { title: string; items: ListItem[] }) => void;
  isEditMode: boolean;
  users: User[];
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

export function ListCard({ content, onChange, isEditMode, users }: ListCardProps) {
  const texture = useMemo(() => 
    paperTextures[Math.floor(Math.random() * paperTextures.length)],
    []
  );
  const handleAddItem = () => {
    onChange({
      ...content,
      items: [...content.items, { text: '', checked: false }]
    });
  };

  const handleRemoveItem = (index: number) => {
    onChange({
      ...content,
      items: content.items.filter((_, i) => i !== index)
    });
  };

  const handleToggleItem = (index: number) => {
    onChange({
      ...content,
      items: content.items.map((item, i) => 
        i === index ? { ...item, checked: !item.checked } : item
      )
    });
  };

  const handleUpdateItemText = (index: number, text: string) => {
    onChange({
      ...content,
      items: content.items.map((item, i) => 
        i === index ? { ...item, text } : item
      )
    });
  };

  // Render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const handle = part.slice(1);
        const user = users.find(u => u.twitterHandle === handle || u.name === handle);
        if (user) {
          return (
            <span 
              key={i}
              className="inline-flex items-center gap-1 bg-blue-100 px-1 rounded text-xs"
            >
              {user.profilePic && (
                <img 
                  src={user.profilePic} 
                  alt={user.name}
                  className="w-3 h-3 rounded-full inline"
                />
              )}
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className="bg-white p-5 shadow-lg relative"
      style={{
        width: '280px',
        minHeight: '200px',
        boxShadow: `
          4px 4px 12px rgba(0,0,0,0.3), 
          0 8px 20px rgba(0,0,0,0.2),
          inset 0 1px 0 rgba(255,255,255,0.8),
          inset 0 -1px 0 rgba(0,0,0,0.05)
        `,
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
      
      {/* Title */}
      {isEditMode ? (
        <Input
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
          spellCheck={false}
          className="mb-4 border-none !bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 relative z-10"
          style={{
            fontFamily: 'Outfit, sans-serif'
          }}
        />
      ) : (
        <h3 
          className="mb-4 relative z-10"
          style={{
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          {content.title}
        </h3>
      )}

      {/* Divider */}
      <div className="border-b border-gray-300 mb-3" />

      {/* List items */}
      <div className="space-y-2 relative z-10">
        {content.items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 group">
            <Checkbox
              checked={item.checked}
              onCheckedChange={() => handleToggleItem(index)}
              disabled={!isEditMode}
            />
            {isEditMode ? (
              <Input
                value={item.text}
                onChange={(e) => handleUpdateItemText(index, e.target.value)}
                placeholder="List item"
                spellCheck={false}
                className="flex-1 border-none !bg-transparent px-1 h-auto py-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                style={{
                  textDecoration: item.checked ? 'line-through' : 'none',
                  opacity: item.checked ? 0.6 : 1,
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            ) : (
              <span
                className="flex-1 text-sm"
                style={{
                  textDecoration: item.checked ? 'line-through' : 'none',
                  opacity: item.checked ? 0.6 : 1,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {item.text ? renderTextWithMentions(item.text) : ''}
              </span>
            )}
            {isEditMode && (
              <button
                onClick={() => handleRemoveItem(index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} className="text-gray-400 hover:text-gray-600" />
              </button>
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
          className="mt-3 w-full !bg-transparent hover:bg-gray-100 relative z-10"
        >
          <Plus size={16} className="mr-1" />
          Add Item
        </Button>
      )}
    </div>
  );
}
