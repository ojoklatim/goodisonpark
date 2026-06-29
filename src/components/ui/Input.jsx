import React from 'react'

export function Input({
  label,
  error,
  helperText,
  theme = 'light',
  id,
  className,
  style,
  ...props
}) {
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    borderRadius: 0,
    border: error ? '1px solid #EF4444' : '1px solid var(--gp-border-light)',
    background: "var(--gp-card)",
    color: "var(--gp-black)",
    outline: 'none',
    transition: 'border-color 0.15s',
    height: '36px',
    ...style,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gp-muted)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={className}
        style={inputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--gp-blue)"
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#EF4444' : 'var(--gp-border-light)'
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>
      )}
      {helperText && !error && (
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{helperText}</span>
      )}
    </div>
  )
}

export function Textarea({
  label,
  error,
  helperText,
  theme = 'light',
  id,
  rows = 3,
  style,
  ...props
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gp-muted)' }}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 0,
          border: error ? '1px solid #EF4444' : '1px solid var(--gp-border-light)',
          background: "var(--gp-card)",
          color: "var(--gp-black)",
          outline: 'none',
          resize: 'vertical',
          ...style,
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--gp-blue)" }}
        onBlur={(e) => { e.target.style.borderColor = error ? '#EF4444' : "var(--gp-border-light)" }}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{helperText}</span>}
    </div>
  )
}
