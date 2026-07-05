import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Bell, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

const FILTER_TABS = ['All', 'Unread', 'Info', 'Success', 'Warning', 'Error']

const TYPE_CONFIG = {
  info: { icon: Info, color: "var(--gp-blue)", label: 'Info' },
  success: { icon: CheckCircle, color: '#10B981', label: 'Success' },
  warning: { icon: AlertTriangle, color: '#F59E0B', label: 'Warning' },
  error: { icon: XCircle, color: '#EF4444', label: 'Error' },
}

export function Notifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('All')

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await insforge
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await insforge
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', user?.id])
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', user?.id])
    },
  })

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) markReadMutation.mutate(notif.id)
    if (notif.link) navigate(notif.link)
  }

  const filtered = notifications.filter((n) => {
    if (activeTab === 'All') return true
    if (activeTab === 'Unread') return !n.is_read
    return n.type?.toLowerCase() === activeTab.toLowerCase()
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: "var(--gp-background)" }}>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        actions={
          <Button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || unreadCount === 0}
            variant="secondary"
          >
            {markAllReadMutation.isPending ? 'Marking...' : 'Mark All Read'}
          </Button>
        }
      />

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--gp-border-light)',
          marginBottom: 0,
          marginTop: 24,
        }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #38BDF8' : '2px solid transparent',
              color: activeTab === tab ? "var(--gp-blue)" : '#9CA3AF',
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab}
            {tab === 'Unread' && unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: "var(--gp-blue)",
                  color: "var(--gp-black)",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div
        style={{
          background: "var(--gp-card)",
          border: '1px solid var(--gp-border-light)',
          borderTop: 'none',
        }}
      >
        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Spinner />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div
            style={{
              padding: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Bell size={40} color="var(--gp-border-light)" />
            <span style={{ color: '#4B5563', fontSize: 15 }}>No notifications yet</span>
          </div>
        )}

        {filtered.map((notif, idx) => {
          const typeKey = notif.type?.toLowerCase() || 'info'
          const typeConf = TYPE_CONFIG[typeKey] || TYPE_CONFIG.info
          const IconComp = typeConf.icon

          return (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                padding: '16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid #1A1A1A' : 'none',
                display: 'flex',
                gap: 12,
                cursor: 'pointer',
                background: !notif.is_read ? '#0D0D0D' : 'transparent',
                borderLeft: !notif.is_read ? '3px solid #38BDF8' : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Type Icon */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: typeConf.color + '22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconComp size={16} color={typeConf.color} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: '#FFFFFF',
                    fontWeight: !notif.is_read ? 600 : 400,
                    fontSize: 14,
                    marginBottom: 3,
                  }}
                >
                  {notif.title}
                </div>
                {notif.body && (
                  <div
                    style={{
                      color: '#9CA3AF',
                      fontSize: 13,
                      marginBottom: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {notif.body}
                  </div>
                )}
                <div style={{ color: '#4B5563', fontSize: 11 }}>{formatDate(notif.created_at)}</div>
              </div>

              {/* Unread Dot */}
              {!notif.is_read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: "var(--gp-blue)",
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
