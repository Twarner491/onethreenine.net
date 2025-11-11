import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

const MIN_ASPECT_RATIO = 1.0; // Show prompt for anything less than square (portrait mode)

export function OrientationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const aspectRatio = window.innerWidth / window.innerHeight;
      // Show prompt if in portrait or too narrow
      setShowPrompt(aspectRatio < MIN_ASPECT_RATIO);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!showPrompt) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-8"
      style={{ 
        zIndex: 999999,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="text-center space-y-6">
        {/* Rotation icon */}
        <div className="flex justify-center">
          <RotateCw 
            size={80} 
            className="text-gray-800 animate-spin" 
            style={{ animationDuration: '3s' }}
          />
        </div>

        {/* Message */}
        <h2 className="text-3xl font-semibold text-gray-900">
          Please Rotate to Landscape
        </h2>
      </div>
    </div>
  );
}

