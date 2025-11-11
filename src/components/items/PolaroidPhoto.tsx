import { Camera, Upload, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { useState, useRef } from 'react';
import { uploadImage } from '../../lib/supabase';
import { toast } from 'sonner';

interface PolaroidPhotoProps {
  content: { imageUrl: string | null; caption: string };
  onChange: (content: { imageUrl: string | null; caption: string }) => void;
  isEditMode: boolean;
  userId?: string;
}

export function PolaroidPhoto({ content, onChange, isEditMode, userId }: PolaroidPhotoProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    if (!userId) {
      toast.error('You must be logged in to upload photos');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image');
      return;
    }

    setIsUploading(true);
    
    const toastId = toast.loading('Uploading image...');

    try {
      const imageUrl = await uploadImage(file, userId);
      
      // Update content with new image URL
      const newContent = {
        imageUrl: imageUrl,
        caption: content.caption
      };
      
      onChange(newContent);
      
      toast.dismiss(toastId);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Failed to upload image: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
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
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
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
      <div className="w-full h-56 bg-gray-100 mb-3 relative overflow-hidden">
        {content.imageUrl ? (
          <img 
            src={content.imageUrl}
            alt={content.caption || 'Polaroid photo'}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Camera size={48} />
          </div>
        )}
        
        {/* Upload button overlay (edit mode only) */}
        {isEditMode && (isHovering || isUploading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            {isUploading ? (
              <div className="text-white flex flex-col items-center gap-2">
                <Loader2 size={32} className="animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <button
                onClick={handleUploadClick}
                className="text-white flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                type="button"
              >
                <Upload size={32} />
                <span className="text-sm">Upload Photo</span>
              </button>
            )}
          </div>
        )}
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading || !isEditMode}
        />
      </div>
      
      {/* Caption area */}
      {isEditMode ? (
        <Input
          value={content.caption}
          onChange={(e) => onChange({ ...content, caption: e.target.value })}
          placeholder="Add a caption..."
          spellCheck={false}
          className="text-center border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: '#374151'
          }}
        />
      ) : (
        <div 
          className="text-center"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: '#374151',
            minHeight: '24px'
          }}
        >
          {content.caption}
        </div>
      )}
    </div>
  );
}
