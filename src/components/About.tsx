import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

const MOBILE_BREAKPOINT = 768;

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

// Use a fixed default for SSR, then randomize on client
const DEFAULT_TAPE_INDEX = 0;
const DEFAULT_ROTATION = 0;

export default function About() {
  const [isMobile, setIsMobile] = useState(false);
  const [tapeTexture, setTapeTexture] = useState(maskingTapeTextures[DEFAULT_TAPE_INDEX]);
  const [tapeRotation, setTapeRotation] = useState(DEFAULT_ROTATION);

  // Set random values only on client to avoid hydration mismatch
  useEffect(() => {
    setTapeTexture(maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)]);
    setTapeRotation((Math.random() - 0.5) * 10);
  }, []);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {/* Corkboard Background */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Pegboard holes */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(40, 25, 15, 0.4) 0px, rgba(40, 25, 15, 0.3) 1.5px, rgba(60, 40, 25, 0.15) 2px, transparent 2.5px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '20px 20px',
          }}
        />
        
        {/* Subtle shadow highlights */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `
              radial-gradient(ellipse 800px 800px at 25% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 600px 600px at 75% 75%, rgba(0, 0, 0, 0.2) 0%, transparent 50%)
            `,
          }}
        />
        
        {/* Edge vignette */}
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

      {/* Centered About Post-it */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: isMobile ? '16px' : '32px' }}
      >
        <div
          className="relative"
          style={{
            transform: 'rotate(-1deg)',
            maxWidth: isMobile ? '100%' : '600px',
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

          {/* Post-it content */}
          <div 
            className="relative"
            style={{
              background: '#fef3c7',
              borderRadius: '2px',
              boxShadow: `
                0 4px 8px rgba(0, 0, 0, 0.15),
                0 8px 20px rgba(0, 0, 0, 0.1),
                inset 0 -1px 2px rgba(0, 0, 0, 0.05)
              `,
              padding: isMobile ? '32px 24px' : '48px 64px',
            }}
          >
            {/* Desktop Back button */}
            {!isMobile && (
              <a
                href="/"
                className="absolute top-4 -left-8 flex items-center gap-2 px-3 py-2 rounded-md text-amber-900/80 transition-all hover:bg-amber-900/10"
              >
                <ArrowLeft size={16} />
                <span className="text-sm font-medium">Back to Board</span>
              </a>
            )}

            {/* Content */}
            <div style={{ marginTop: isMobile ? '8px' : '48px' }} className="space-y-4 md:space-y-6">
              <h1 
                className="text-amber-900/90 text-center font-bold"
                style={{ fontSize: isMobile ? '1.5rem' : '1.875rem' }}
              >
                onethreenine.net
              </h1>

              <div className="space-y-4 text-amber-900/80">
                <p 
                  className="leading-relaxed text-center"
                  style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                >
                  A web accessible corkboard broadcast on our apartment's wall.<br/>Leave us a note :)
                </p>

                {/* Image */}
                <div 
                  className="flex justify-center"
                  style={{ margin: isMobile ? '16px 0' : '32px 0' }}
                >
                  <div 
                    className="bg-amber-900/5 rounded-lg overflow-hidden"
                    style={{ 
                      width: isMobile ? '100%' : '50%',
                      aspectRatio: '16/9',
                    }}
                  >
                    <img 
                      src="/assets/images/thumb.jpg" 
                      alt="onethreenine preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <p 
                  className="leading-relaxed text-gray-700 text-center"
                  style={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}
                >
                  by <a href="https://teddywarner.org" target="_blank" style={{ textDecoration: 'underline' }}>Teddy</a> - see <a href="/timeline" style={{ textDecoration: 'underline' }}>past boards</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
