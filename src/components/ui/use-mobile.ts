import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Detect if device is mobile based on multiple signals
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check viewport width
  const isNarrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
  
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    // @ts-ignore - for older browsers
    navigator.msMaxTouchPoints > 0;
  
  // Check user agent for mobile devices
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    navigator.userAgent
  );
  
  // Check for mobile-specific CSS media query
  const mobileMediaQuery = window.matchMedia('(pointer: coarse)').matches;
  
  // Consider mobile if: narrow viewport OR (has touch AND mobile user agent) OR mobile media query
  return isNarrowViewport || (hasTouch && mobileUserAgent) || (mobileMediaQuery && mobileUserAgent);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // Initial detection (will be false during SSR)
    if (typeof window === 'undefined') return false;
    return detectMobile();
  });

  React.useEffect(() => {
    // Run detection on mount
    setIsMobile(detectMobile());
    
    // Set up media query listener for viewport changes
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(detectMobile());
    };
    
    mql.addEventListener("change", onChange);
    
    // Also listen for resize (catches orientation changes)
    window.addEventListener('resize', onChange);
    
    // Listen for orientation changes specifically
    window.addEventListener('orientationchange', onChange);
    
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
    };
  }, []);

  return isMobile;
}

// Export the detection function for use outside hooks
export { detectMobile, MOBILE_BREAKPOINT };
