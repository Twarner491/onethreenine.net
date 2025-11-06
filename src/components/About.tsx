import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';

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

export default function About() {
  // Select random masking tape and rotation once
  const tapeTexture = useMemo(() => 
    maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)],
    []
  );
  const tapeRotation = useMemo(() => 
    (Math.random() - 0.5) * 10,
    []
  );

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

      {/* Centered About Post-it */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className="relative"
          style={{
            transform: 'rotate(-1deg)',
            maxWidth: '600px',
            width: '100%',
          }}
        >
          {/* Masking tape */}
          <div 
            className="absolute top-0 left-1/2 z-10 pointer-events-none"
            style={{
              width: '80px',
              height: '35px',
              transform: `translateX(-50%) translateY(-18px) rotate(${tapeRotation}deg)`,
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
              padding: '48px 64px',
            }}
          >
            {/* Back button */}
            <a
              href="/"
              className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-md text-amber-900/80 transition-all hover:bg-amber-900/10"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-medium">Back to Board</span>
            </a>

            {/* Content */}
            <div className="mt-12 space-y-6">
              <h1 className="text-3xl font-bold text-amber-900/90 text-center">
                About Apartment 139
              </h1>

              <div className="space-y-4 text-amber-900/80">
                <p className="leading-relaxed">
                  Welcome to our shared digital corkboard! This is where we keep track of everything that matters in apartment 139.
                </p>

                <p className="leading-relaxed">
                  From grocery lists to photos, receipts to event reminders - everything our apartment needs in one whimsical place.
                </p>

                {/* Placeholder for images */}
                <div className="grid grid-cols-2 gap-4 my-8">
                  <div className="aspect-square bg-amber-900/5 rounded-lg flex items-center justify-center text-amber-900/40 text-sm">
                    Image placeholder
                  </div>
                  <div className="aspect-square bg-amber-900/5 rounded-lg flex items-center justify-center text-amber-900/40 text-sm">
                    Image placeholder
                  </div>
                </div>

                <p className="leading-relaxed italic text-amber-900/60 text-center">
                  Built with ❤️ for the roommates of apartment 139
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

