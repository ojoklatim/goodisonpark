import React from 'react'

const variants = {
  primary: {
    background: "var(--gp-blue)",
    color: "var(--gp-black)",
    fontWeight: 600,
    border: 'none',
  },
  secondary: {
    background: "var(--gp-dark)",
    color: 'var(--gp-black)',
    fontWeight: 500,
    border: '1px solid var(--gp-border-light)',
  },
  danger: {
    background: '#EF4444',
    color: '#FFFFFF',
    fontWeight: 600,
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: '#9CA3AF',
    fontWeight: 500,
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: "var(--gp-blue)",
    fontWeight: 500,
    border: '1px solid #38BDF8',
  },
}

const sizes = {
  sm: { padding: '5px 12px', fontSize: '12px', height: '30px' },
  md: { padding: '8px 16px', fontSize: '14px', height: '36px' },
  lg: { padding: '10px 20px', fontSize: '15px', height: '42px' },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  style = {},
  className = '',
  ...props
}) {
  const v = variants[variant] || variants.primary
  const s = sizes[size] || sizes.md

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        borderRadius: 0,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, filter 0.15s',
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.01em',
        ...v,
        ...s,
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled && !loading) e.currentTarget.style.filter = 'brightness(0.9)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = '' }}
      {...props}
    >
      {loading && (
        <span style={{
          width: 14, height: 14, border: '2px solid currentColor',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite', display: 'inline-block',
        }} />
      )}
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )
}
