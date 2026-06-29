import React from 'react'
import { ChevronDown } from 'lucide-react'

export function Select({
  label,
  error,
  helperText,
  theme = 'light',
  id,
  options = [],
  placeholder = 'Select...',
  style,
  ...props
}) {
  const isDark = theme === 'dark'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gp-muted)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={id}
          style={{
            width: '100%',
            padding: '8px 32px 8px 12px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            borderRadius: 0,
            border: error ? '1px solid #EF4444' : '1px solid var(--gp-border-light)',
            background: "var(--gp-card)",
            color: "var(--gp-black)",
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            height: '36px',
            ...style,
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) =>
            typeof opt === 'string' ? (
              <option key={opt} value={opt}>{opt}</option>
            ) : (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            )
          )}
        </select>
        <ChevronDown
          size={14}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#9CA3AF',
          }}
        />
      </div>
      {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{helperText}</span>}
    </div>
  )
}
