import React, { useEffect } from 'react'
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const colors = {
  info: "var(--gp-blue)",
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
}

function Toast({ id, title, body, type = 'info' }) {
  const { removeNotification } = useUiStore()
  const Icon = icons[type] || Info
  const color = colors[type] || colors.info

  useEffect(() => {
    const timer = setTimeout(() => removeNotification(id), 4000)
    return () => clearTimeout(timer)
  }, [id, removeNotification])

  return (
    <div
      onClick={() => removeNotification(id)}
      style={{
        width: 320,
        background: "var(--gp-dark)",
        border: `1px solid var(--gp-border-light)`,
        borderLeft: `3px solid ${color}`,
        color: 'var(--gp-black)',
        padding: '12px 14px',
        animation: 'slideInRight 0.3s ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: 2 }}>{title}</div>
        {body && <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: 1.4 }}>{body}</div>}
      </div>
      <X size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  )
}

export function ToastContainer() {
  const { notifications } = useUiStore()

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {notifications.map((n) => (
        <Toast key={n.id} {...n} />
      ))}
    </div>
  )
}
