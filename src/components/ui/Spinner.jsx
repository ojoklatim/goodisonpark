import React from 'react'

export function Spinner({ size = 20, color = "var(--gp-blue)" }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'gpSpin 0.7s linear infinite',
        flexShrink: 0,
      }}
    >
      <style>{`@keyframes gpSpin { to { transform: rotate(360deg) } }`}</style>
    </span>
  )
}

export function PageSpinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '200px',
      width: '100%',
    }}>
      <Spinner size={32} />
    </div>
  )
}
