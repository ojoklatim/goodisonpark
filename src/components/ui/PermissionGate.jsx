import React from 'react'
import { useAuth } from '../../hooks/useAuth'

export function PermissionGate({ module, action, children }) {
  const { can } = useAuth()
  
  if (!can(module, action)) {
    return null
  }
  
  return <>{children}</>
}
