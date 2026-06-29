import React from 'react'

export function Card({ children, header, action, style, bodyStyle }) {
  return (
    <div style={{
      background: "var(--gp-card)",
      border: "1px solid var(--gp-border-light)",
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      ...style,
    }}>
      {header && (
        <div style={{
          padding: '14px 16px',
          borderBottom: "1px solid var(--gp-border-light)",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: "var(--gp-black)" }}>{header}</span>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ padding: '16px', ...bodyStyle }}>
        {children}
      </div>
    </div>
  )
}
