import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, Menu, User, Settings, LogOut, ChevronRight, Sun, Moon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { getInitials, timeAgo } from '../../lib/utils'

export function TopBar({ breadcrumb }) {
  const { profile, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, notifications, removeNotification, clearNotifications } = useUiStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const navigate = useNavigate()
  const userRef = useRef(null)
  const notifRef = useRef(null)

  const companyId = profile?.company_id
  const { data: dbAnnouncements = [] } = useQuery({
    queryKey: ['bell_announcements', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const { data, error } = await insforge
        .from('announcements')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data || []
    },
    enabled: !!companyId
  })

  const allDropdownItems = React.useMemo(() => {
    return [
      ...notifications.map(n => ({ id: n.id, title: n.title, body: n.body, time: n.created_at, type: 'toast' })),
      ...dbAnnouncements.map(a => ({ id: a.id, title: `Announcement: ${a.title}`, body: a.content, time: a.created_at, type: 'announcement' }))
    ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
  }, [notifications, dbAnnouncements])

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  const unread = notifications.filter((n) => !n.read).length + dbAnnouncements.length

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleLogout() {
    await insforge.auth.signOut()
    logout()
    navigate('/auth/login')
  }

  return (
    <header
      className="topbar"
      style={{
        position: 'fixed',
        top: 0, 
        left: sidebarOpen ? 240 : 0, 
        right: 0,
        height: 56,
        background: "var(--gp-card)",
        borderBottom: '1px solid var(--gp-border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 100,
        gap: '16px',
        transition: 'left 0.3s ease',
      }}
    >
      {/* Left: hamburger + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={toggleSidebar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          className="hamburger-btn"
        >
          <Menu size={20} color="var(--gp-black)" />
        </button>
        {breadcrumb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9CA3AF' }}>
            {breadcrumb.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={12} />}
                {item.to ? (
                  <Link to={item.to} style={{ color: '#9CA3AF', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.target.style.color = "var(--gp-black)" }}
                    onMouseLeave={(e) => { e.target.style.color = '#9CA3AF' }}>
                    {item.label}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 700, color: "var(--gp-black)" }}>{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Right: notifications + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', display: 'flex', alignItems: 'center', color: 'var(--gp-black)'
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            id="notifications-bell"
            onClick={() => setNotifOpen((o) => !o)}
            style={{
              position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px', display: 'flex', alignItems: 'center',
            }}
          >
            <Bell size={18} color="var(--gp-black)" />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, background: "var(--gp-blue)", color: "var(--gp-black)",
                fontSize: '9px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 0,
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0,
              width: 320, background: "var(--gp-card)", border: '1px solid var(--gp-border-light)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 200, maxHeight: 400, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--gp-border-light)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>Notifications</span>
                <button onClick={clearNotifications} style={{ background: 'none', border: 'none', fontSize: '11px', color: "var(--gp-blue)", cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Mark all read
                </button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {allDropdownItems.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>No notifications</div>
                ) : (
                  allDropdownItems.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.type === 'toast') {
                          removeNotification(n.id)
                        } else {
                          navigate('/dashboard/hr/announcements')
                        }
                        setNotifOpen(false)
                      }}
                      style={{
                        padding: '10px 14px', borderBottom: '1px solid var(--gp-border-light)',
                        cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'flex-start',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gp-background)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: "var(--gp-black)" }}>{n.title}</div>
                        {n.body && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</div>}
                        <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: 4 }}>{n.time ? timeAgo(n.time) : ''}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Dropdown */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            id="user-avatar-btn"
            onClick={() => setUserMenuOpen((o) => !o)}
            style={{
              width: 32, height: 32,
              background: "var(--gp-card)",
              border: '1px solid var(--gp-border-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: "var(--gp-blue)",
              cursor: 'pointer', borderRadius: 0,
            }}
          >
            {profile ? getInitials(profile.first_name, profile.last_name) : <User size={14} />}
          </button>

          {userMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0,
              width: 200, background: "var(--gp-card)", border: '1px solid var(--gp-border-light)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 200,
            }}>
              {profile && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gp-border-light)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: "var(--gp-black)" }}>{profile.first_name} {profile.last_name}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'capitalize' }}>{profile.role?.replace('_', ' ')}</div>
                </div>
              )}
              {[
                { label: 'Settings', icon: Settings, to: '/dashboard/company/settings' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => { navigate(item.to); setUserMenuOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 14px', background: 'none', border: 'none',
                    fontSize: '13px', color: 'var(--gp-black)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Inter, sans-serif', borderRadius: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gp-background)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                >
                  <item.icon size={14} />
                  {item.label}
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--gp-border-light)' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 14px', background: 'none', border: 'none',
                    fontSize: '13px', color: '#EF4444', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Inter, sans-serif', borderRadius: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hamburger-btn { display: flex !important; }
        }
      `}</style>
    </header>
  )
}
