import React from 'react'

export function Logo({ size = 180, showText = true, className = '', style = {} }) {
  return (
    <div 
      className={`logo-container ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        ...style 
      }}
    >
      <svg 
        viewBox="0 0 400 400" 
        width="100%" 
        height="100%"
        style={{ overflow: 'visible' }}
      >
        {/* Outer Circular Ring Background */}
        <circle 
          cx="200" 
          cy="200" 
          r="185" 
          fill="#2D2E30" 
          stroke="#111111" 
          strokeWidth="10" 
        />
        <circle 
          cx="200" 
          cy="200" 
          r="180" 
          fill="none" 
          stroke="#444649" 
          strokeWidth="2" 
        />

        {/* Small House/Window Details Under the Roof */}
        <polygon 
          points="238,205 255,190 272,205" 
          fill="#00BCF2" 
        />
        <rect 
          x="238" 
          y="205" 
          width="34" 
          height="40" 
          fill="#00BCF2" 
        />
        {/* Window Panes Grid */}
        <line x1="238" y1="225" x2="272" y2="225" stroke="#2D2E30" strokeWidth="3" />
        <line x1="255" y1="225" x2="255" y2="245" stroke="#2D2E30" strokeWidth="3" />

        {/* Blue Chevron House Roof */}
        <path 
          d="M 255 115 L 340 220 H 305 L 255 158 L 205 220 H 170 Z" 
          fill="#00BCF2" 
        />

        {/* White Chart Arrow (zig-zag pointing up left slope) */}
        <path 
          d="M 80 240 L 120 195 L 142 218 L 170 172 L 192 195 L 245 128" 
          stroke="#FFFFFF" 
          strokeWidth="12" 
          fill="none" 
          strokeLinecap="square" 
          strokeLinejoin="miter" 
        />
        {/* Arrowhead */}
        <polygon 
          points="230,121 262,110 250,143" 
          fill="#FFFFFF" 
        />

        {showText && (
          <>
            {/* "GoodisonPark" Text */}
            <text 
              x="200" 
              y="295" 
              textAnchor="middle" 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="800" 
              fontSize="38"
            >
              <tspan fill="#FFFFFF">Goodison</tspan>
              <tspan fill="#00BCF2">Park</tspan>
            </text>

            {/* "PROPERTIES" Subtext */}
            <text 
              x="205" 
              y="335" 
              textAnchor="middle" 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="300" 
              fontSize="22" 
              fill="#FFFFFF" 
              letterSpacing="8"
            >
              PROPERTIES
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
