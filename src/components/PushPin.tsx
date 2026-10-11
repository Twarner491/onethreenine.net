import React, { useMemo } from 'react';

interface PushPinProps {
  color?: string;
  rotation?: number;
  tiltX?: number;
  tiltY?: number;
  size?: number;
  className?: string;
}

export interface PinPalette {
  name: string;
  primary: string;
  light: string;
  dark: string;
  highlight: string;
  rimShadow: string;
  faceGradient: [string, string, string];
}

// Color palettes matched directly to classic molded push pins (Red, Yellow, Blue, Green, White)
export const pushPinColors: Record<string, PinPalette> = {
  red: {
    name: 'Classic Red',
    primary: '#e11d48',
    light: '#fb7185',
    dark: '#9f1239',
    highlight: '#ffffff',
    rimShadow: '#4c0519',
    faceGradient: ['#fda4af', '#f43f5e', '#be123c'],
  },
  yellow: {
    name: 'Classic Yellow',
    primary: '#eab308',
    light: '#fef08a',
    dark: '#854d0e',
    highlight: '#ffffff',
    rimShadow: '#422006',
    faceGradient: ['#fef9c3', '#facc15', '#ca8a04'],
  },
  blue: {
    name: 'Classic Blue',
    primary: '#2563eb',
    light: '#93c5fd',
    dark: '#1e3a8a',
    highlight: '#ffffff',
    rimShadow: '#172554',
    faceGradient: ['#bfdbfe', '#3b82f6', '#1d4ed8'],
  },
  green: {
    name: 'Classic Green',
    primary: '#16a34a',
    light: '#86efac',
    dark: '#14532d',
    highlight: '#ffffff',
    rimShadow: '#052e16',
    faceGradient: ['#bbf7d0', '#22c55e', '#15803d'],
  },
  white: {
    name: 'Classic White',
    primary: '#f1f5f9',
    light: '#ffffff',
    dark: '#94a3b8',
    highlight: '#ffffff',
    rimShadow: '#475569',
    faceGradient: ['#ffffff', '#f8fafc', '#cbd5e1'],
  },
  orange: {
    name: 'Tangerine',
    primary: '#ea580c',
    light: '#fdba74',
    dark: '#9a3412',
    highlight: '#ffffff',
    rimShadow: '#431407',
    faceGradient: ['#fed7aa', '#f97316', '#c2410c'],
  },
  purple: {
    name: 'Purple',
    primary: '#9333ea',
    light: '#d8b4fe',
    dark: '#6b21a8',
    highlight: '#ffffff',
    rimShadow: '#3b0764',
    faceGradient: ['#e9d5ff', '#a855f7', '#7e22ce'],
  },
};

export function PushPin({
  color = 'red',
  rotation = 0,
  tiltX = 26,
  tiltY = 0,
  size = 90,
  className = '',
}: PushPinProps) {
  const pinPalette = useMemo(() => {
    if (color && pushPinColors[color]) {
      return pushPinColors[color];
    }
    return pushPinColors.red;
  }, [color]);

  // Unique ID for SVG gradients to prevent multi-element collision
  const uid = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  const width = size;
  // Sized proportionally to viewBox 120 x 140
  const height = Math.round(size * (140 / 120));

  // Dynamic cast shadow offset driven by the pin's tilt
  // Light from top-left (approx. 10:30 on the clock)
  const shadowOffsetX = 10 + tiltY * 0.45;
  const shadowOffsetY = 6 + (tiltX - 20) * 0.3;

  return (
    <div
      className={`pointer-events-none select-none relative overflow-visible ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        overflow: 'visible',
      }}
    >
      <svg
        viewBox="0 0 120 140"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Contact shadow at puncture point */}
          <radialGradient id={`contact-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.70)" />
            <stop offset="35%" stopColor="rgba(0, 0, 0, 0.40)" />
            <stop offset="70%" stopColor="rgba(0, 0, 0, 0.12)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>

          {/* Flared base contact shadow (close to paper, zero clipping) */}
          <radialGradient id={`base-shadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(25, 18, 12, 0.45)" />
            <stop offset="35%" stopColor="rgba(25, 18, 12, 0.28)" />
            <stop offset="65%" stopColor="rgba(25, 18, 12, 0.10)" />
            <stop offset="85%" stopColor="rgba(25, 18, 12, 0.02)" />
            <stop offset="100%" stopColor="rgba(25, 18, 12, 0)" />
          </radialGradient>

          {/* Elevated fat stalk & top cap cast shadow (soft, feathered, zero harsh edges) */}
          <radialGradient id={`cast-shadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(20, 15, 10, 0.36)" />
            <stop offset="30%" stopColor="rgba(20, 15, 10, 0.22)" />
            <stop offset="60%" stopColor="rgba(20, 15, 10, 0.08)" />
            <stop offset="85%" stopColor="rgba(20, 15, 10, 0.02)" />
            <stop offset="100%" stopColor="rgba(20, 15, 10, 0)" />
          </radialGradient>

          {/* Stainless Steel Needle Gradient */}
          <linearGradient id={`needle-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="25%" stopColor="#d1d5db" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="75%" stopColor="#9ca3af" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>

          {/* Flared Base Bell Face Gradient */}
          <linearGradient id={`base-flare-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={pinPalette.dark} />
            <stop offset="18%" stopColor={pinPalette.light} />
            <stop offset="48%" stopColor={pinPalette.primary} />
            <stop offset="80%" stopColor={pinPalette.dark} />
            <stop offset="100%" stopColor={pinPalette.rimShadow} />
          </linearGradient>

          {/* Flared Base Underside / Bottom Rim Gradient */}
          <linearGradient id={`base-bottom-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={pinPalette.dark} />
            <stop offset="100%" stopColor={pinPalette.rimShadow} />
          </linearGradient>

          {/* Fat Cylindrical Stalk Gradient */}
          <linearGradient id={`stalk-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={pinPalette.dark} />
            <stop offset="18%" stopColor={pinPalette.light} />
            <stop offset="48%" stopColor={pinPalette.primary} />
            <stop offset="82%" stopColor={pinPalette.dark} />
            <stop offset="100%" stopColor={pinPalette.rimShadow} />
          </linearGradient>

          {/* Top Thumb Cap Bevel Rim Gradient */}
          <linearGradient id={`cap-rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={pinPalette.dark} />
            <stop offset="20%" stopColor={pinPalette.light} />
            <stop offset="52%" stopColor={pinPalette.primary} />
            <stop offset="82%" stopColor={pinPalette.dark} />
            <stop offset="100%" stopColor={pinPalette.rimShadow} />
          </linearGradient>

          {/* Top Thumb Cap Face Radial Gradient (High-gloss molded plastic surface) */}
          <radialGradient id={`cap-face-${uid}`} cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor={pinPalette.highlight} stopOpacity="0.95" />
            <stop offset="22%" stopColor={pinPalette.faceGradient[0]} />
            <stop offset="65%" stopColor={pinPalette.faceGradient[1]} />
            <stop offset="90%" stopColor={pinPalette.faceGradient[2]} />
            <stop offset="100%" stopColor={pinPalette.rimShadow} />
          </radialGradient>
        </defs>

        {/* ============================================================== */}
        {/* SHADOW LAYER: Soft Feathered Cast Shadows (Zero Hard Edges)    */}
        {/* Fully contained within viewBox with ample margin to edge       */}
        {/* ============================================================== */}
        {/* Elevated Stalk & Cap Cast Shadow */}
        <ellipse
          cx={60 + shadowOffsetX}
          cy={106 + shadowOffsetY}
          rx={21 + Math.abs(tiltX) * 0.08}
          ry={10 + Math.abs(tiltY) * 0.06}
          transform={`rotate(${24 + tiltY * 0.5} ${60 + shadowOffsetX} ${106 + shadowOffsetY})`}
          fill={`url(#cast-shadow-${uid})`}
        />

        {/* Flared Base Contact Shadow */}
        <ellipse
          cx={60 + shadowOffsetX * 0.4}
          cy={106 + shadowOffsetY * 0.3}
          rx="21"
          ry="6.5"
          fill={`url(#base-shadow-${uid})`}
        />

        {/* Dense Ambient Occlusion at Puncture Hole */}
        <ellipse
          cx="60"
          cy="106.5"
          rx="8"
          ry="3"
          fill={`url(#contact-${uid})`}
        />

        {/* Paper Puncture Hole (where needle penetrates note into corkboard) */}
        <ellipse cx="60" cy="106.5" rx="3.5" ry="1.4" fill="#18181b" />
        <ellipse cx="60" cy="106.2" rx="2.4" ry="0.9" fill="#09090b" />
        {/* Paper crease / tear highlight on top edge of puncture */}
        <path
          d="M57 106.2 Q60 104.8 63 106.2"
          stroke="rgba(255, 255, 255, 0.75)"
          strokeWidth="0.75"
          strokeLinecap="round"
          fill="none"
        />

        {/* ============================================================== */}
        {/* PIN BODY: Modeled directly after the real push pins            */}
        {/* - Needle entering puncture                                     */}
        {/* - Wide Flared Base Collar (flared compared to top)             */}
        {/* - Fat Stalk (thick sturdy cylinder)                            */}
        {/* - Top Thumb Cap (smaller circular disc angled toward viewer)   */}
        {/* ============================================================== */}
        <g transform={`rotate(${rotation + tiltY * 0.7} 60 106)`}>
          {/* 1. Exposed Stainless Steel Needle entering paper */}
          <path
            d="M58.7 94 L61.3 94 L60.7 106 L59.3 106 Z"
            fill={`url(#needle-${uid})`}
          />
          {/* Needle Specular Streak */}
          <line
            x1="60.1"
            y1="94"
            x2="60.1"
            y2="105.5"
            stroke="#ffffff"
            strokeWidth="0.5"
            strokeLinecap="round"
            opacity="0.95"
          />

          {/* 2. Wide Flared Base (Lower Collar next to needle) */}
          {/* Lower collar bottom edge thickness / rim */}
          <path
            d="M39 92.5 C39 96 48.4 98.5 60 98.5 C71.6 98.5 81 96 81 92.5 L81 94.5 C81 98 71.6 100.5 60 100.5 C48.4 100.5 39 98 39 94.5 Z"
            fill={`url(#base-bottom-${uid})`}
          />

          {/* Flared bell body: sweeping curve from stalk (X=49,71) out to wide base (X=39,81) */}
          <path
            d="M49 80 C44 86 39 90.5 39 92.5 C39 96 48.4 98.5 60 98.5 C71.6 98.5 81 96 81 92.5 C81 90.5 76 86 71 80 Z"
            fill={`url(#base-flare-${uid})`}
          />

          {/* Specular curved highlight on flared rim */}
          <path
            d="M41 93.5 C49 97.2 71 97.2 79 93.5"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth="0.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Diffuse light bloom on left flare */}
          <path
            d="M48 81 C44 86 40.5 90 40.5 92"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* 3. Fat Cylindrical Stalk (Sturdy thick connector) */}
          <path
            d="M48.5 46 Q49.5 63 49 80 L71 80 Q70.5 63 71.5 46 Z"
            fill={`url(#stalk-${uid})`}
          />
          {/* Stalk specular highlight stripe */}
          <line
            x1="54"
            y1="48"
            x2="54.5"
            y2="78"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.55"
          />
          {/* Ambient occlusion crease where stalk meets flared base */}
          <path
            d="M49 80 C54 81.8 66 81.8 71 80"
            stroke="rgba(0, 0, 0, 0.35)"
            strokeWidth="0.9"
            fill="none"
          />

          {/* 4. Top Thumb Cap (Smaller circular head, angled toward viewer) */}
          {/* Cap side bevel / rim */}
          <path
            d="M46 39 C46 43.5 52.3 46.5 60 46.5 C67.7 46.5 74 43.5 74 39 L74 42 C74 46.5 67.7 49.5 60 49.5 C52.3 49.5 46 46.5 46 42 Z"
            fill={`url(#cap-rim-${uid})`}
          />
          {/* Lower bevel rim highlight */}
          <path
            d="M47.5 42.5 C53 47 67 47 72.5 42.5"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="0.6"
            fill="none"
          />
          {/* Ambient occlusion shadow under top cap where stalk joins */}
          <path
            d="M48 46.5 C53 48.5 67 48.5 72 46.5"
            stroke="rgba(0, 0, 0, 0.45)"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Top Cap Face (Tilted circular thumb surface) */}
          <ellipse
            cx="60"
            cy="38.5"
            rx="14"
            ry="7.8"
            fill={`url(#cap-face-${uid})`}
          />

          {/* Inner concentric molded depression ring on thumb face */}
          <ellipse
            cx="60"
            cy="38.8"
            rx="8.8"
            ry="4.6"
            stroke={pinPalette.dark}
            strokeWidth="0.5"
            strokeOpacity="0.35"
            fill="none"
          />

          {/* High-Gloss Specular Reflections on Thumb Face */}
          {/* Primary glossy reflection spot */}
          <ellipse
            cx="55.8"
            cy="35.8"
            rx="4.8"
            ry="2.2"
            transform="rotate(-15 55.8 35.8)"
            fill="#ffffff"
            opacity="0.9"
          />
          {/* Top-left rim highlight arc */}
          <path
            d="M49 37.5 C52 33.5 68 33.5 71 37.5"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.8"
            fill="none"
          />
          {/* Delicate ambient rim highlight on the outer circumference */}
          <ellipse
            cx="60"
            cy="38.3"
            rx="13.4"
            ry="7.3"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="0.5"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}
