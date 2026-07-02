import React from 'react'

export function PageHeader({ title, subtitle, actions, action, style }) {
  const renderActions = actions || action
  return (
    <div style={{
      paddingBottom: '16px',
      marginBottom: '24px',
      borderBottom: "1px solid var(--gp-border-light)",
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      ...style,
    }}>
      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: "var(--gp-black)", lineHeight: 1.2, margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '14px', color: '#9CA3AF', marginTop: '4px', margin: '4px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {renderActions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {renderActions}
        </div>
      )}
    </div>
  )
}

export function FormSection({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: "var(--gp-black)", whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        <div style={{ flex: 1, height: '1px', background: "var(--gp-border-light)" }} />
      </div>
      {children}
    </div>
  )
}
