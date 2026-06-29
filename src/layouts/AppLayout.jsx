import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { TopBar } from '../components/layout/TopBar'
import { ToastContainer } from '../components/ui/Toast'
import { useUiStore } from '../store/uiStore'

export function AppLayout() {
  const { sidebarOpen } = useUiStore()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: "var(--gp-background)" }}>
      <ToastContainer />
      <Sidebar />
      <div 
        className="app-main"
        style={{ 
          flex: 1, 
          marginLeft: sidebarOpen ? 240 : 0, 
          transition: 'margin-left 0.3s ease'
        }}
      >
        <TopBar />
        <main 
          style={{ 
            marginTop: 56, 
            padding: 24, 
            minHeight: 'calc(100vh - 56px)' 
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
