import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        background: "var(--gp-background)",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <div style={{
            width: 36, height: 36,
            background: "var(--gp-blue)",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--gp-black)" }}>GP</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>GOODISON PARK</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Properties</div>
          </div>
        </div>

        {/* Error icon */}
        <div style={{
          width: 64, height: 64,
          border: '2px solid #EF4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
        }}>
          <span style={{ fontSize: 28, color: '#EF4444', fontWeight: 800 }}>!</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 8, textAlign: 'center', maxWidth: 480 }}>
          An unexpected error occurred. The error has been logged and our team has been notified.
        </p>
        {this.state.error?.message && (
          <p style={{
            fontSize: 12, color: '#4B5563',
            background: "var(--gp-card)", border: '1px solid #2A2A2A',
            padding: '8px 16px', marginBottom: 32,
            maxWidth: 480, wordBreak: 'break-word',
          }}>
            {this.state.error.message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => window.location.reload()}
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
            Reload Page
          </button>
          <a
            href="/dashboard"
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: '#9CA3AF',
              border: '1px solid #2A2A2A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center',
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }
}
