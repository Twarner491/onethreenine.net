import { useState, useEffect } from 'react';
import { X, Hand, Plus, Move } from 'lucide-react';

interface MobileOnboardingProps {
  onComplete: () => void;
  forceShow?: boolean; // When true, always show regardless of localStorage
}

const ONBOARDING_KEY = 'pegboard-mobile-onboarding-seen';

export function MobileOnboarding({ onComplete, forceShow = false }: MobileOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If forced, always show
    if (forceShow) {
      setTimeout(() => setIsVisible(true), 100);
      return;
    }
    
    // Check if user has seen onboarding
    const hasSeen = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeen) {
      // Small delay for smoother appearance
      setTimeout(() => setIsVisible(true), 500);
    } else {
      onComplete();
    }
  }, [onComplete, forceShow]);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const steps = [
    {
      icon: Hand,
      title: 'Pan & Zoom',
      description: 'Drag with one finger to pan around. Pinch with two fingers to zoom in and out.',
    },
    {
      icon: Plus,
      title: 'Add Items',
      description: 'Tap the + button in the corner to add notes, photos, and lists to the board.',
    },
    {
      icon: Move,
      title: 'Edit & Move',
      description: 'Tap an item to edit it. Long-press to enter arrange mode, then drag to move items around.',
    },
  ];

  if (!isVisible) return null;

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 20000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* Post-it note card */}
      <div 
        style={{
          position: 'relative',
          maxWidth: '320px',
          width: '100%',
          animation: 'slideUp 0.3s ease-out',
          transform: 'rotate(-1.5deg)',
        }}
        key={currentStep}
      >
        {/* Post-it note background */}
        <div
          style={{
            position: 'relative',
            background: '#fef3c7',
            borderRadius: '3px',
            boxShadow: `
              4px 4px 12px rgba(0,0,0,0.25),
              0 8px 24px rgba(0,0,0,0.15),
              inset 0 -1px 2px rgba(0, 0, 0, 0.05)
            `,
            padding: '40px 32px 36px',
          }}
        >
          {/* Skip button */}
          <button
            onClick={handleComplete}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(120, 53, 15, 0.1)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} color="#78350f" />
          </button>

          {/* Icon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(120, 53, 15, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 28px',
            }}
          >
            <CurrentIcon size={36} color="#78350f" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#78350f',
              marginBottom: '14px',
              textAlign: 'center',
              fontFamily: 'Georgia, serif',
            }}
          >
            {steps[currentStep].title}
          </h2>

          {/* Description */}
          <p
            style={{
              fontSize: '15px',
              color: '#92400e',
              lineHeight: 1.6,
              marginBottom: '32px',
              textAlign: 'center',
            }}
          >
            {steps[currentStep].description}
          </p>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
            {steps.map((_, index) => (
              <div
                key={index}
                style={{
                  width: index === currentStep ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: index === currentStep ? '#78350f' : 'rgba(120, 53, 15, 0.3)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={handleNext}
            className="w-full px-6 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all active:bg-amber-900/20 font-medium text-sm"
          >
            {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) rotate(-1.5deg); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) rotate(-1.5deg); 
          }
        }
      `}</style>
    </div>
  );
}

export function useMobileOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem(ONBOARDING_KEY);
  });

  return {
    hasSeenOnboarding,
    markAsSeen: () => setHasSeenOnboarding(true),
  };
}
