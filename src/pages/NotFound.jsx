import React from 'react'
import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: "var(--gp-background)",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      padding: 40,
    }}>
      {/* Giant 404 */}
      <div style={{
        fontSize: 'clamp(120px, 20vw, 200px)',
        fontWeight: 800,
        color: "var(--gp-card)",
        lineHeight: 1,
        letterSpacing: '-0.05em',
        userSelect: 'none',
        marginBottom: 0,
      }}>
        404
      </div>

      {/* Accent bar */}
      <div style={{ width: 64, height: 3, background: "var(--gp-blue)", marginBottom: 28 }} />

      <h1 style={{
        fontSize: 22,
        fontWeight: 700,
        color: 'var(--gp-black)',
        marginBottom: 12,
        textAlign: 'center',
      }}>
        Page not found
      </h1>
      <p style={{
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 40,
        textAlign: 'center',
        maxWidth: 360,
      }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 24px',
            background: 'transparent',
            color: '#9CA3AF',
            border: '1px solid #2A2A2A',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 24px',
            background: "var(--gp-blue)",
            color: "var(--gp-black)",
            border: 'none',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Dashboard
        </button>
      </div>
    </div>
  )
}
