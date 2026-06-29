import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Settings, TrendingUp, Download, Plus, Calendar } from 'lucide-react'

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', initial: 'YT', color: '#FF0000' },
  { id: 'twitter', name: 'X', initial: 'X', color: '#1DA1F2' },
  { id: 'instagram', name: 'Instagram', initial: 'IG', color: '#E1306C' },
  { id: 'tiktok', name: 'TikTok', initial: 'TK', color: '#000000' },
  { id: 'linkedin', name: 'LinkedIn', initial: 'LI', color: '#0077B5' },
]

const PLATFORM_TABS = ['All', 'YouTube', 'X', 'Instagram', 'TikTok', 'LinkedIn']

const PLATFORM_NAME_MAP = {
  youtube: 'YouTube',
  twitter: 'X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

const emptyForm = {
  platform: 'youtube',
  date: new Date().toISOString().slice(0, 10),
  followers: '',
  views_count: '',
  likes: '',
  comments: '',
  shares: '',
  reach: '',
  impressions: '',
}

export function Social() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('All')
  const [showLogModal, setShowLogModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['social_media_accounts', company?.id],
    queryFn: async () => {
      if (!company?.id) return []
      const { data, error } = await insforge
        .from('social_media_accounts')
        .select('*')
        .eq('company_id', company.id)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id,
  })

  // Fetch metrics
  const { data: metrics = [], isLoading: loadingMetrics } = useQuery({
    queryKey: ['social_media_metrics', company?.id],
    queryFn: async () => {
      if (!company?.id) return []
      const { data, error } = await insforge
        .from('social_media_metrics')
        .select('*')
        .eq('company_id', company.id)
        .order('date', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id,
  })

  const connectedPlatforms = accounts.filter((a) => a.is_connected).map((a) => a.platform)

  // Filter metrics by active tab and date range
  const filteredMetrics = useMemo(() => {
    let m = metrics
    if (activeTab !== 'All') {
      const pid = PLATFORMS.find((p) => p.name === activeTab || p.initial === activeTab)?.id
      if (pid) m = m.filter((x) => x.platform === pid)
    }
    if (dateStart) m = m.filter((x) => x.date >= dateStart)
    if (dateEnd) m = m.filter((x) => x.date <= dateEnd)
    return m
  }, [metrics, activeTab, dateStart, dateEnd])

  // Last 30 days metrics
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])

  const last30 = useMemo(
    () => filteredMetrics.filter((m) => m.date >= thirtyDaysAgo),
    [filteredMetrics, thirtyDaysAgo]
  )

  // Stat card values
  const latestFollowers = useMemo(() => {
    if (!last30.length) return 0
    const sorted = [...last30].sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.followers || 0
  }, [last30])

  const totalEngagements = useMemo(
    () => last30.reduce((s, m) => s + (m.likes || 0) + (m.comments || 0) + (m.shares || 0), 0),
    [last30]
  )
  const totalViews = useMemo(() => last30.reduce((s, m) => s + (m.views_count || 0), 0), [last30])
  const totalPosts = last30.length

  // Growth chart data (followers last 30 days)
  const growthData = useMemo(() => {
    const byDate = {}
    last30.forEach((m) => {
      if (!byDate[m.date] || m.followers > byDate[m.date]) byDate[m.date] = m.followers
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, followers]) => ({ date: date.slice(5), followers }))
  }, [last30])

  // Engagement bar chart (last 7 days)
  const last7Days = useMemo(() => {
    const sevenAgo = new Date()
    sevenAgo.setDate(sevenAgo.getDate() - 7)
    const cutoff = sevenAgo.toISOString().slice(0, 10)
    const byDate = {}
    filteredMetrics
      .filter((m) => m.date >= cutoff)
      .forEach((m) => {
        if (!byDate[m.date]) byDate[m.date] = { date: m.date.slice(5), likes: 0, comments: 0, shares: 0 }
        byDate[m.date].likes += m.likes || 0
        byDate[m.date].comments += m.comments || 0
        byDate[m.date].shares += m.shares || 0
      })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredMetrics])

  // Comparative chart (all platforms)
  const comparativeData = useMemo(() => {
    const byDate = {}
    metrics.forEach((m) => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date.slice(5) }
      const pName = PLATFORM_NAME_MAP[m.platform] || m.platform
      byDate[m.date][pName] = (byDate[m.date][pName] || 0) + (m.followers || 0)
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [metrics])

  // Growth summary
  const followerGrowth = useMemo(() => {
    const sorted = [...last30].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length < 2) return 0
    return (sorted[sorted.length - 1]?.followers || 0) - (sorted[0]?.followers || 0)
  }, [last30])

  const bestDay = useMemo(() => {
    let max = -Infinity
    let bestDate = null
    last30.forEach((m) => {
      const eng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0)
      if (eng > max) {
        max = eng
        bestDate = m.date
      }
    })
    return bestDate
  }, [last30])

  const logMutation = useMutation({
    mutationFn: async () => {
      const matchingAccount = accounts.find((a) => a.platform === form.platform)
      const { error } = await insforge.from('social_media_metrics').insert([
        {
          company_id: company?.id,
          platform: form.platform,
          date: form.date,
          followers: Number(form.followers) || 0,
          views_count: Number(form.views_count) || 0,
          likes: Number(form.likes) || 0,
          comments: Number(form.comments) || 0,
          shares: Number(form.shares) || 0,
          reach: Number(form.reach) || 0,
          impressions: Number(form.impressions) || 0,
          account_id: matchingAccount?.id || null,
        },
      ])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social_media_metrics'])
      setShowLogModal(false)
      setForm(emptyForm)
    },
  })

  const handleExportCSV = () => {
    const headers = ['Date', 'Platform', 'Followers', 'Views', 'Likes', 'Comments', 'Shares', 'Engagements', 'Reach']
    const rows = filteredMetrics.map((m) => [
      m.date,
      m.platform,
      m.followers,
      m.views_count,
      m.likes,
      m.comments,
      m.shares,
      (m.likes || 0) + (m.comments || 0) + (m.shares || 0),
      m.reach,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'social_media_metrics.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const chartTooltipStyle = {
    backgroundColor: "var(--gp-card)",
    border: '1px solid #2A2A2A',
    color: '#FFFFFF',
    fontSize: 12,
  }

  return (
    <div style={{ padding: '24px', background: "var(--gp-background)", minHeight: '100vh' }}>
      <PageHeader
        title="Social Media"
        subtitle="Track your social media performance"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => setShowLogModal(true)}>
              <Plus size={14} style={{ marginRight: 4 }} />
              Log Metrics
            </Button>
            <button
              onClick={() => navigate('/dashboard/social/settings')}
              style={{
                background: 'transparent',
                color: '#9CA3AF',
                border: '1px solid #2A2A2A',
                padding: '8px 14px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'transparent',
                color: '#9CA3AF',
                border: '1px solid #2A2A2A',
                padding: '8px 14px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Platform Status Row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        {PLATFORMS.map((p) => {
          const isConnected = connectedPlatforms.includes(p.id)
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: "var(--gp-card)",
                border: '1px solid #2A2A2A',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: p.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                {p.initial}
              </div>
              <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isConnected ? '#10B981' : '#4B5563',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Platform Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #2A2A2A',
          marginTop: 28,
        }}
      >
        {PLATFORM_TABS.map((tab) => (
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
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 24 }}>
        <StatCard title="Latest Followers" value={latestFollowers.toLocaleString()} icon={TrendingUp} />
        <StatCard title="Total Engagements (30d)" value={totalEngagements.toLocaleString()} />
        <StatCard title="Total Views (30d)" value={totalViews.toLocaleString()} />
        <StatCard title="Total Posts (30d)" value={totalPosts.toLocaleString()} />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        {/* Growth Line Chart */}
        <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: 20 }}>
          <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
            Follower Growth (Last 30 Days)
          </div>
          {growthData.length === 0 ? (
            <div style={{ color: '#4B5563', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growthData}>
                <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="followers" stroke="var(--gp-blue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Engagement Bar Chart */}
        <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: 20 }}>
          <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
            Daily Engagements (Last 7 Days)
          </div>
          {last7Days.length === 0 ? (
            <div style={{ color: '#4B5563', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last7Days}>
                <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
                <Bar dataKey="likes" fill="var(--gp-blue)" />
                <Bar dataKey="comments" fill="#10B981" />
                <Bar dataKey="shares" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Comparative Line Chart */}
      <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: 20, marginTop: 16 }}>
        <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          Comparative Follower Growth (All Platforms)
        </div>
        {comparativeData.length === 0 ? (
          <div style={{ color: '#4B5563', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={comparativeData}>
              <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              {Object.keys(PLATFORM_NAME_MAP).map((pid, i) => (
                <Line
                  key={pid}
                  type="monotone"
                  dataKey={PLATFORM_NAME_MAP[pid]}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Growth Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: 20 }}>
          <div style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>Follower Growth This Month</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: followerGrowth >= 0 ? '#10B981' : '#EF4444',
            }}
          >
            {followerGrowth >= 0 ? '+' : ''}
            {followerGrowth.toLocaleString()}
          </div>
          <div style={{ color: '#4B5563', fontSize: 12, marginTop: 4 }}>followers vs 30 days ago</div>
        </div>
        <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: 20 }}>
          <div style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>Best Performing Day</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>
            {bestDay ? new Date(bestDay).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
          </div>
          <div style={{ color: '#4B5563', fontSize: 12, marginTop: 4 }}>highest engagement in last 30 days</div>
        </div>
      </div>

      {/* Date Range Filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginTop: 28,
          marginBottom: 12,
        }}
      >
        <span style={{ color: '#9CA3AF', fontSize: 13 }}>
          <Calendar size={13} style={{ marginRight: 4 }} />
          Filter by date:
        </span>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          style={{
            background: "var(--gp-card)",
            border: '1px solid #2A2A2A',
            color: '#FFFFFF',
            padding: '6px 10px',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <span style={{ color: '#4B5563', fontSize: 13 }}>to</span>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          style={{
            background: "var(--gp-card)",
            border: '1px solid #2A2A2A',
            color: '#FFFFFF',
            padding: '6px 10px',
            fontSize: 13,
            outline: 'none',
          }}
        />
        {(dateStart || dateEnd) && (
          <button
            onClick={() => { setDateStart(''); setDateEnd('') }}
            style={{
              background: 'transparent',
              color: '#9CA3AF',
              border: '1px solid #2A2A2A',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Metrics Table */}
      <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2A2A2A' }}>
              {['Date', 'Platform', 'Followers', 'Views', 'Likes', 'Comments', 'Shares', 'Engagements', 'Reach'].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      color: '#9CA3AF',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loadingMetrics && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>
                  <Spinner />
                </td>
              </tr>
            )}
            {!loadingMetrics && filteredMetrics.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#4B5563' }}>
                  No metrics found
                </td>
              </tr>
            )}
            {filteredMetrics.map((m, i) => (
              <tr
                key={m.id || i}
                style={{
                  borderBottom: '1px solid #1A1A1A',
                  background: i % 2 === 0 ? 'transparent' : '#161616',
                }}
              >
                <td style={{ padding: '10px 16px', color: '#9CA3AF' }}>{m.date}</td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF', fontWeight: 500 }}>
                  {PLATFORM_NAME_MAP[m.platform] || m.platform}
                </td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF' }}>{(m.followers || 0).toLocaleString()}</td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF' }}>{(m.views_count || 0).toLocaleString()}</td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF' }}>{(m.likes || 0).toLocaleString()}</td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF' }}>{(m.comments || 0).toLocaleString()}</td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF' }}>{(m.shares || 0).toLocaleString()}</td>
                <td style={{ padding: '10px 16px', color: "var(--gp-blue)", fontWeight: 600 }}>
                  {((m.likes || 0) + (m.comments || 0) + (m.shares || 0)).toLocaleString()}
                </td>
                <td style={{ padding: '10px 16px', color: '#FFFFFF' }}>{(m.reach || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log Metrics Modal */}
      {showLogModal && (
        <Modal onClose={() => setShowLogModal(false)} title="Log Today's Metrics">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                style={{
                  width: '100%',
                  background: "var(--gp-card)",
                  border: '1px solid #2A2A2A',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                style={{
                  width: '100%',
                  background: "var(--gp-card)",
                  border: '1px solid #2A2A2A',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['followers', 'Followers'],
                ['views_count', 'Views'],
                ['likes', 'Likes'],
                ['comments', 'Comments'],
                ['shares', 'Shares'],
                ['reach', 'Reach'],
                ['impressions', 'Impressions'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>{label}</label>
                  <input
                    type="number"
                    min="0"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder="0"
                    style={{
                      width: '100%',
                      background: "var(--gp-card)",
                      border: '1px solid #2A2A2A',
                      color: '#FFFFFF',
                      padding: '8px 12px',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  background: 'transparent',
                  color: '#9CA3AF',
                  border: '1px solid #2A2A2A',
                  padding: '8px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => logMutation.mutate()}
                disabled={logMutation.isPending}
                style={{
                  background: "var(--gp-blue)",
                  color: "var(--gp-black)",
                  border: 'none',
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {logMutation.isPending ? 'Saving...' : 'Save Metrics'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
