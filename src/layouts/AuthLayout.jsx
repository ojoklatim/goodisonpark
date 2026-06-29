import React from 'react'
import { Outlet } from 'react-router-dom'
import { Building2 } from 'lucide-react'

export function AuthLayout() {
  return (
    <div 
      className="auth-page-wrapper"
      style={{ 
        minHeight: '100vh', 
        backgroundColor: "var(--gp-background)", 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <Outlet />
      </div>
    </div>
  )
}
