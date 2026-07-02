import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, TrendingUp, Users, Building2, FileText, Receipt, DollarSign,
  FolderOpen, CheckSquare, ClipboardCheck, File, BookOpen,
  Users2, CalendarCheck, BarChart3, Umbrella, Wallet, GraduationCap,
  CreditCard, PieChart, LineChart, LayoutDashboard,
  MessageSquare, Megaphone, Share2, Bell, SlidersHorizontal,
  Activity, Download, BarChart2,
  Settings, UserCog, LogOut, ChevronRight, X,
} from 'lucide-react'
import { insforge } from '../../lib/insforge'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { useAuth } from '../../hooks/useAuth'
import { getInitials } from '../../lib/utils'
import { Logo } from '../ui/Logo'

const NAV = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', icon: Home, to: '/dashboard/overview' }],
  },
  {
    section: 'Sales',
    items: [
      { label: 'Pipeline', icon: TrendingUp, to: '/dashboard/sales/pipeline' },
      { label: 'Leads', icon: Users, to: '/dashboard/sales/leads' },
      { label: 'Clients', icon: Building2, to: '/dashboard/sales/clients' },
      { label: 'Quotations', icon: FileText, to: '/dashboard/sales/quotations' },
      { label: 'Invoices', icon: Receipt, to: '/dashboard/sales/invoices' },
      { label: 'Commissions', icon: DollarSign, to: '/dashboard/sales/commissions' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Projects', icon: FolderOpen, to: '/dashboard/operations/projects' },
      { label: 'Tasks', icon: CheckSquare, to: '/dashboard/operations/tasks' },
      { label: 'Approvals', icon: ClipboardCheck, to: '/dashboard/operations/approvals' },
      { label: 'Documents', icon: File, to: '/dashboard/operations/documents' },
      { label: 'SOPs', icon: BookOpen, to: '/dashboard/operations/sops' },
    ],
  },
  {
    section: 'People',
    items: [
      { label: 'Employees', icon: Users2, to: '/dashboard/employees' },
      { label: 'Attendance', icon: CalendarCheck, to: '/dashboard/hr/attendance' },
      { label: 'Performance', icon: BarChart3, to: '/dashboard/performance' },
      { label: 'Leave', icon: Umbrella, to: '/dashboard/hr/leave' },
      { label: 'Payroll', icon: Wallet, to: '/dashboard/hr/payroll' },
      { label: 'Training', icon: GraduationCap, to: '/dashboard/hr/training' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Overview', icon: LayoutDashboard, to: '/dashboard/finance' },
      { label: 'Expenses', icon: CreditCard, to: '/dashboard/finance/expenses' },
      { label: 'Budgets', icon: PieChart, to: '/dashboard/finance/budgets' },
      { label: 'Reports', icon: LineChart, to: '/dashboard/finance/reports' },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { label: 'Sales Analytics', icon: TrendingUp, to: '/dashboard/reports/sales' },
      { label: 'Performance', icon: Activity, to: '/dashboard/reports/performance' },
      { label: 'Operations', icon: BarChart2, to: '/dashboard/reports/operations' },
      { label: 'Export Center', icon: Download, to: '/dashboard/reports/export' },
    ],
  },
  {
    section: 'Communications',
    items: [
      { label: 'Messages', icon: MessageSquare, to: '/dashboard/messages' },
      { label: 'Notifications', icon: Bell, to: '/dashboard/notifications' },
      { label: 'Announcements', icon: Megaphone, to: '/dashboard/hr/announcements' },
      { label: 'Social Media', icon: Share2, to: '/dashboard/social' },
      { label: 'Social Settings', icon: SlidersHorizontal, to: '/dashboard/social/settings' },
    ],
  },
]

const BOTTOM_NAV = [
  { label: 'Company Settings', icon: Settings, to: '/dashboard/company/settings' },
  { label: 'User Management', icon: UserCog, to: '/dashboard/company/users' },
]

export function Sidebar() {
  const { profile, logout } = useAuthStore()
  const { can } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await insforge.auth.signOut()
    logout()
    navigate('/auth/login')
  }

  const isAdmin = profile?.role === 'company_admin' || profile?.role === 'super_admin'

  // Filter navigation by permissions and role access
  const filteredNav = NAV.map(group => {
    const items = group.items.filter(item => {
      if (isAdmin) return true
      
      // Limit navigation items for employees
      if (group.section === 'Finance' && item.label !== 'Expenses') return false
      if (group.section === 'People' && !['Leave', 'Training'].includes(item.label)) return false
      if (group.section === 'Operations' && item.label === 'Approvals') return false
      if (group.section === 'Analytics') return false
      if (group.section === 'Communications' && ['Social Media', 'Social Settings'].includes(item.label)) return false
      
      return true
    })
    return { ...group, items }
  }).filter(group => {
    if (group.items.length === 0) return false
    if (group.section === 'Overview') return true
    if (group.section === 'Sales') return can('sales', 'view')
    if (group.section === 'Operations') return can('operations', 'view')
    if (group.section === 'People') return can('hr', 'view')
    if (group.section === 'Finance') return can('finance', 'view')
    if (group.section === 'Analytics') return can('reports', 'view')
    if (group.section === 'Communications') return can('communications', 'view')
    return true
  })

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 199, display: 'none',
          }}
          className="sidebar-overlay"
        />
      )}

      <aside
        className={`sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          position: 'fixed',
          left: 0, top: 0, bottom: 0,
          width: 240,
          background: "var(--gp-background)",
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'transform 0.25s ease',
          borderRight: '1px solid var(--gp-border-light)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--gp-border-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Logo size={32} showText={false} />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gp-black)', lineHeight: 1.2 }}>GOODISON PARK</div>
              <div style={{ fontSize: '9px', color: 'var(--gp-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Properties</div>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'var(--close-btn-display, none)' }}
            className="sidebar-close-btn"
          >
            <X size={18} color="var(--gp-black)" />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {filteredNav.map((group) => (
            <div key={group.section} style={{ marginBottom: '4px' }}>
              <div style={{
                padding: '12px 16px 4px',
                fontSize: '9px', fontWeight: 700,
                color: '#4B5563',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                {group.section}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--gp-blue-dim)' : 'var(--gp-muted)',
                    background: isActive ? "var(--gp-blue-glow)" : 'transparent',
                    borderLeft: isActive ? '2px solid var(--gp-blue)' : '2px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  })}
                  onMouseEnter={(e) => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.color = 'var(--gp-black)' }}
                  onMouseLeave={(e) => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.color = 'var(--gp-muted)' }}
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Nav */}
        <div style={{ borderTop: '1px solid var(--gp-border-light)', flexShrink: 0 }}>
          {isAdmin && BOTTOM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--gp-blue-dim)' : 'var(--gp-muted)',
                background: isActive ? "var(--gp-blue-glow)" : 'transparent',
                borderLeft: isActive ? '2px solid var(--gp-blue)' : '2px solid transparent',
                textDecoration: 'none',
              })}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}

          {/* User profile chip */}
          {profile && (
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--gp-border-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: 32, height: 32,
                background: "var(--gp-card)",
                border: '1px solid var(--gp-border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: "var(--gp-blue)",
                flexShrink: 0,
              }}>
                {getInitials(profile.first_name, profile.last_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gp-black)', truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.first_name} {profile.last_name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--gp-muted)', textTransform: 'capitalize' }}>{profile.role?.replace('_', ' ')}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#4B5563' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
