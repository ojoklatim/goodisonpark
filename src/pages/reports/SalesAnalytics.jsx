import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Download, Printer, TrendingUp, Users, DollarSign, Clock } from 'lucide-react'

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DEAL_STAGES = ['New','Contacted','Qualified','Proposal','Negotiation','Won','Lost']

function getDateRange(preset) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  switch (preset) {
    case 'thisMonth':
      return { start: new Date(year, month, 1).toISOString(), end: new Date(year, month + 1, 0, 23, 59, 59).toISOString() }
    case 'lastMonth':
      return { start: new Date(year, month - 1, 1).toISOString(), end: new Date(year, month, 0, 23, 59, 59).toISOString() }
    case 'thisQuarter': {
      const q = Math.floor(month / 3)
      return { start: new Date(year, q * 3, 1).toISOString(), end: new Date(year, q * 3 + 3, 0, 23, 59, 59).toISOString() }
    }
    case 'thisYear':
      return { start: new Date(year, 0, 1).toISOString(), end: new Date(year, 11, 31, 23, 59, 59).toISOString() }
    default:
      return { start: new Date(year, 0, 1).toISOString(), end: new Date(year, 11, 31, 23, 59, 59).toISOString() }
  }
}

export function SalesAnalytics() {
  const { company, user } = useAuth()
  const [preset, setPreset] = useState('thisYear')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const dateRange = preset === 'custom'
    ? { start: customStart || new Date(new Date().getFullYear(), 0, 1).toISOString(), end: customEnd || new Date().toISOString() }
    : getDateRange(preset)

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['sales-invoices', company?.id, dateRange],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('invoices')
        .select('id, amount, created_at, status')
        .eq('company_id', company.id)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
      return data || []
    }
  })

  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['sales-deals', company?.id, dateRange],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('deals')
        .select('id, stage, value, agent_id, created_at, closed_at')
        .eq('company_id', company.id)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
      return data || []
    }
  })

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['sales-leads', company?.id, dateRange],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('leads')
        .select('id, source, agent_id, status, created_at')
        .eq('company_id', company.id)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
      return data || []
    }
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('departments').select('id, name').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-sales', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('profiles').select('id, full_name, department_id').eq('company_id', company.id)
      return data || []
    }
  })

  // Monthly Revenue Chart
  const monthlyRevenue = MONTHS.map((month, idx) => {
    const total = invoices
      .filter(inv => new Date(inv.created_at).getMonth() === idx && inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
    return { month, revenue: total }
  })

  // Deal Stage Funnel
  const stageFunnel = DEAL_STAGES.map(stage => ({
    stage,
    count: deals.filter(d => d.stage === stage).length
  }))

  // Lead Source PieChart
  const sourceMap = {}
  leads.forEach(l => {
    const src = l.source || 'Unknown'
    sourceMap[src] = (sourceMap[src] || 0) + 1
  })
  const leadSourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }))

  // Agent Performance
  const agentMap = {}
  profiles.forEach(p => { agentMap[p.id] = { name: p.full_name, leads: 0, won: 0, revenue: 0, commission: 0 } })
  leads.forEach(l => { if (agentMap[l.agent_id]) agentMap[l.agent_id].leads++ })
  deals.forEach(d => {
    if (agentMap[d.agent_id]) {
      if (d.stage === 'Won') {
        agentMap[d.agent_id].won++
        agentMap[d.agent_id].revenue += d.value || 0
        agentMap[d.agent_id].commission += (d.value || 0) * 0.03
      }
    }
  })
  const agentRows = Object.values(agentMap).filter(a => a.leads > 0).map(a => ({
    ...a,
    convRate: a.leads > 0 ? ((a.won / a.leads) * 100).toFixed(1) : '0.0'
  }))

  // Avg Deal Cycle Time
  const closedDeals = deals.filter(d => d.stage === 'Won' && d.closed_at && d.created_at)
  const avgCycleDays = closedDeals.length
    ? (closedDeals.reduce((sum, d) => {
        const diff = new Date(d.closed_at) - new Date(d.created_at)
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0) / closedDeals.length).toFixed(1)
    : 0

  // Top Clients
  const clientMap = {}
  invoices.filter(i => i.status === 'paid').forEach(inv => {
    const key = inv.client_id || inv.client_name || 'Unknown'
    if (!clientMap[key]) clientMap[key] = { client: key, revenue: 0, deals: 0 }
    clientMap[key].revenue += inv.amount || 0
    clientMap[key].deals++
  })
  const topClients = Object.values(clientMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  const isLoading = invLoading || dealsLoading || leadsLoading

  const handleExportCSV = () => {
    const rows = [['Agent', 'Leads', 'Deals Won', 'Revenue', 'Commission', 'Conv. Rate']]
    agentRows.forEach(a => rows.push([a.name, a.leads, a.won, a.revenue.toFixed(2), a.commission.toFixed(2), a.convRate + '%']))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'sales_analytics.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const presets = [
    { key: 'thisMonth', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'thisQuarter', label: 'This Quarter' },
    { key: 'thisYear', label: 'This Year' },
    { key: 'custom', label: 'Custom' },
  ]

  const agentColumns = [
    { key: 'name', label: 'Agent' },
    { key: 'leads', label: 'Leads' },
    { key: 'won', label: 'Deals Won' },
    { key: 'revenue', label: 'Revenue', render: v => `£${(v||0).toLocaleString()}` },
    { key: 'commission', label: 'Commission', render: v => `£${(v||0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { key: 'convRate', label: 'Conv. Rate %', render: v => `${v}%` },
  ]

  const clientColumns = [
    { key: '_rank', label: 'Rank', render: (_, __, idx) => `#${idx + 1}` },
    { key: 'client', label: 'Client' },
    { key: 'revenue', label: 'Revenue', render: v => `£${(v||0).toLocaleString()}` },
    { key: 'deals', label: 'Deals' },
  ]

  return (
    <div style={{ background: "var(--gp-background)", minHeight: '100vh', padding: '24px' }}>
      <PageHeader title="Sales Analytics" />

      {/* Date Range Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            style={{
              padding: '8px 16px',
              background: preset === p.key ? "var(--gp-blue)" : "var(--gp-card)",
              color: preset === p.key ? "var(--gp-background)" : '#9CA3AF',
              border: `1px solid ${preset === p.key ? "var(--gp-blue)" : "var(--gp-border-light)"}`,
              borderRadius: '0px',
              cursor: 'pointer',
              fontWeight: preset === p.key ? '600' : '400',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >{p.label}</button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', padding: '8px', borderRadius: '0px', fontSize: '14px' }} />
            <span style={{ color: '#9CA3AF' }}>to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', padding: '8px', borderRadius: '0px', fontSize: '14px' }} />
          </>
        )}

        {/* Department Filter */}
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ marginLeft: '16px', background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', padding: '8px 12px', borderRadius: '0px', fontSize: '14px' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {/* Export Buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <Button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Export CSV
          </Button>
          <Button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: "var(--gp-card)", border: '1px solid var(--gp-border-light)' }}>
            <Printer size={16} /> Print
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><Spinner /></div>
      ) : (
        <>
          {/* Top Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <StatCard
              title="Total Revenue"
              value={`£${invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}`}
              icon={<DollarSign size={20} color="var(--gp-blue)" />}
            />
            <StatCard
              title="Total Deals"
              value={deals.length}
              icon={<TrendingUp size={20} color="#10B981" />}
            />
            <StatCard
              title="Total Leads"
              value={leads.length}
              icon={<Users size={20} color="#F59E0B" />}
            />
            <StatCard
              title="Avg Deal Cycle"
              value={`${avgCycleDays} days`}
              icon={<Clock size={20} color="#8B5CF6" />}
            />
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

            {/* 1. Monthly Sales Revenue */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Monthly Sales Revenue</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyRevenue}>
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `£${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }}
                    formatter={v => [`£${v.toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="var(--gp-blue)" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Deal Stage Conversion Funnel */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Deal Stage Funnel</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stageFunnel} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="stage" type="category" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                  <Bar dataKey="count" radius={0}>
                    {stageFunnel.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Lead Source PieChart */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Lead Source Analysis</h3>
              {leadSourceData.length === 0 ? (
                <div style={{ color: '#4B5563', textAlign: 'center', padding: '80px 0' }}>No lead data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={leadSourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#4B5563' }}>
                      {leadSourceData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                    <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 4. Avg Deal Cycle Time */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 24px', fontSize: '16px', fontWeight: '600', alignSelf: 'flex-start' }}>Avg Deal Cycle Time</h3>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '72px', fontWeight: '800', color: "var(--gp-blue)", lineHeight: 1 }}>{avgCycleDays}</div>
                <div style={{ fontSize: '20px', color: '#9CA3AF', marginTop: '8px' }}>days on average</div>
                <div style={{ color: '#4B5563', marginTop: '12px', fontSize: '14px' }}>Based on {closedDeals.length} closed deals</div>
              </div>
            </div>
          </div>

          {/* Agent Performance Table */}
          <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Agent Performance</h3>
            <DataTable columns={agentColumns} data={agentRows} />
          </div>

          {/* Top 10 Clients */}
          <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
            <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Top 10 Clients by Revenue</h3>
            <DataTable columns={clientColumns} data={topClients} />
          </div>
        </>
      )}
    </div>
  )
}
