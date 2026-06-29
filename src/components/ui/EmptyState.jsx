import React from 'react'
import { Button } from './Button'

export function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      textAlign: 'center',
    }}>
      {Icon && (
        <div style={{
          width: 56, height: 56,
          background: '#F5F5F5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <Icon size={24} color="#9CA3AF" />
        </div>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: "var(--gp-black)", margin: '0 0 6px' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: '14px', color: '#9CA3AF', maxWidth: 320, margin: '0 0 20px' }}>{description}</p>
      )}
      {action && actionLabel && (
        <Button variant="primary" onClick={action}>{actionLabel}</Button>
      )}
    </div>
  )
}
