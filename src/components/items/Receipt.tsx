import { Input } from '../ui/input';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useMemo } from 'react';

interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptProps {
  content: { store: string; date: string; items: ReceiptItem[]; total: number };
  onChange: (content: { store: string; date: string; items: ReceiptItem[]; total: number }) => void;
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

export function Receipt({ content, onChange, isEditMode }: ReceiptProps) {
  const texture = useMemo(() => 
    paperTextures[Math.floor(Math.random() * paperTextures.length)],
    []
  );
  const handleAddItem = () => {
    onChange({
      ...content,
      items: [...content.items, { name: '', price: 0 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = content.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.price, 0);
    onChange({
      ...content,
      items: newItems,
      total: newTotal
    });
  };

  const handleUpdateItem = (index: number, field: 'name' | 'price', value: string | number) => {
    const newItems = content.items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    const newTotal = newItems.reduce((sum, item) => sum + item.price, 0);
    onChange({
      ...content,
      items: newItems,
      total: newTotal
    });
  };

  return (
    <div
      className="bg-white p-4 relative"
      style={{
        width: '260px',
        minHeight: '300px',
        boxShadow: `
          4px 4px 12px rgba(0,0,0,0.3), 
          0 8px 20px rgba(0,0,0,0.2),
          inset 0 1px 0 rgba(255,255,255,0.8),
          inset 0 -1px 0 rgba(0,0,0,0.05)
        `,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Paper texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `url(${texture})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'multiply',
          transform: 'rotate(90deg) scale(1.2)',
        }}
      />
      
      {/* Header */}
      <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-3 relative z-10">
        {isEditMode ? (
          <Input
            value={content.store}
            onChange={(e) => onChange({ ...content, store: e.target.value })}
            placeholder="Store Name"
            className="text-center border-none !bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        ) : (
          <div>{content.store || 'Store Name'}</div>
        )}
        <div className="text-xs text-gray-600 mt-1">{content.date}</div>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-3 relative z-10">
        {content.items.map((item, index) => (
          <div key={index} className="flex justify-between items-center gap-2 text-sm group">
            {isEditMode ? (
              <>
                <Input
                  value={item.name}
                  onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                  placeholder="Item"
                  className="flex-1 border-none !bg-transparent px-1 h-auto py-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handleUpdateItem(index, 'price', parseFloat(e.target.value) || 0)}
                    className="w-16 border-none !bg-transparent px-1 h-auto py-0 text-sm text-right focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="flex-1">{item.name}</span>
                <span>${item.price.toFixed(2)}</span>
              </>
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
          className="w-full mb-3 h-7 hover:bg-gray-100 !bg-transparent relative z-10"
        >
          <Plus size={14} className="mr-1" />
          Add Item
        </Button>
      )}

      {/* Total */}
      <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-2 relative z-10">
        <div className="flex justify-between">
          <span>TOTAL:</span>
          <span>${content.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer decoration */}
      <div className="text-center mt-3 text-xs text-gray-500 relative z-10">
        * * * * *
      </div>
    </div>
  );
}
