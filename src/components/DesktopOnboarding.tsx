import { useState, useEffect } from 'react';
import { X, Move, Layers, Pencil, Plus } from 'lucide-react';

interface DesktopOnboardingProps {
  onComplete: () => void;
  forceShow?: boolean;
}

const ONBOARDING_KEY = 'pegboard-desktop-onboarding-seen';

export function DesktopOnboarding({ onComplete, forceShow = false }: DesktopOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setTimeout(() => setIsVisible(true), 100);
      return;
    }
    
    const hasSeen = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeen) {
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
      icon: Plus,
      title: 'Add New Items',
      description: 'Use the toolbar to add notes, photos, lists, and receipts to the board.',
    },
    {
      icon: Move,
      title: 'Drag & Rotate',
      description: 'Click and drag any card to move it. Hover near a corner and drag to rotate.',
    },
    {
      icon: Pencil,
      title: 'Click to Edit',
      description: 'Click on any card to open it for editing. Right-click for more options like delete or reorder.',
    },
    {
      icon: Layers,
      title: 'Undo & Redo',
      description: 'Made a mistake? Press Ctrl+Z to undo, or Ctrl+Shift+Z to redo your last action.',
    },
  ];

  if (!isVisible) return null;

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 20000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          handleComplete();
        }
      }}
    >
      {/* Post-it note card */}
      <div 
        style={{
          position: 'relative',
          maxWidth: '400px',
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
            padding: '44px 40px 40px',
          }}
        >
          {/* Skip button */}
          <button
            onClick={handleComplete}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(120, 53, 15, 0.1)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(120, 53, 15, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(120, 53, 15, 0.1)'}
          >
            <X size={18} color="#78350f" />
          </button>

          {/* Welcome header - only on first step */}
          {currentStep === 0 && (
            <div
              style={{
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: '#92400e',
                textAlign: 'center',
                marginBottom: '12px',
                fontWeight: 500,
              }}
            >
              Welcome to the Board
            </div>
          )}

          {/* Icon */}
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '50%',
              backgroundColor: 'rgba(120, 53, 15, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
            }}
          >
            <CurrentIcon size={40} color="#78350f" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: '26px',
              fontWeight: 600,
              color: '#78350f',
              marginBottom: '16px',
              textAlign: 'center',
              fontFamily: 'Georgia, serif',
            }}
          >
            {steps[currentStep].title}
          </h2>

          {/* Description */}
          <p
            style={{
              fontSize: '16px',
              color: '#92400e',
              lineHeight: 1.7,
              marginBottom: '36px',
              textAlign: 'center',
            }}
          >
            {steps[currentStep].description}
          </p>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                style={{
                  width: index === currentStep ? '24px' : '10px',
                  height: '10px',
                  borderRadius: '5px',
                  backgroundColor: index === currentStep ? '#78350f' : 'rgba(120, 53, 15, 0.25)',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                style={{ flex: 2 }}
                className="px-6 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/15 hover:border-amber-900/25 font-medium text-sm"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{ flex: currentStep > 0 ? 3 : 1 }}
              className="px-6 py-4 rounded-lg bg-amber-900/10 text-amber-900 border border-amber-900/20 transition-all hover:bg-amber-900/20 hover:border-amber-900/30 font-medium text-sm"
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
            </button>
          </div>

          {/* Keyboard shortcut hint */}
          <p
            className="mt-4 text-xs text-amber-800/60 text-center"
          >
            Press Esc or click outside to skip
          </p>
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

export function useDesktopOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem(ONBOARDING_KEY);
  });

  return {
    hasSeenOnboarding,
    markAsSeen: () => setHasSeenOnboarding(true),
  };
}

