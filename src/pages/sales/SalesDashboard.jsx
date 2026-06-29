import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { DollarSign, FileText, Activity, Users, Target } from 'lucide-react'

const COLORS = ["var(--gp-blue)", '#9CA3AF', '#F59E0B', '#A78BFA', '#22C55E', '#EF4444']

export function SalesDashboard() {
  const { company } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['sales_dashboard', company?.id],
    queryFn: async () => {
      const [dealsRes, leadsRes, invoicesRes] = await Promise.all([
        insforge.from('deals').select('*, profiles!deals_assigned_to_fkey(first_name, last_name)').eq('company_id', company?.id),
        insforge.from('leads').select('*').eq('company_id', company?.id),
        insforge.from('invoices').select('*').eq('company_id', company?.id)
      ])

      const deals = dealsRes.data || []
      const leads = leadsRes.data || []
      
      const totalRevenue = deals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + Number(d.value || 0), 0)
      const totalDeals = deals.length
      const wonDeals = deals.filter(d => d.stage === 'closed_won').length
      const conversionRate = leads.length > 0 ? ((wonDeals / leads.length) * 100).toFixed(1) : 0
      const pendingDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length
      
      // Stage funnel data
      const stages = ['new_lead', 'contacted', 'negotiation', 'proposal', 'closed_won', 'closed_lost']
      const funnelData = stages.map(stage => ({
        name: stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: deals.filter(d => d.stage === stage).length
      }))

      // Agent rankings
      const agentMap = {}
      deals.filter(d => d.stage === 'closed_won').forEach(d => {
        const id = d.assigned_to
        if (id && d.profiles) {
          if (!agentMap[id]) agentMap[id] = { name: `${d.profiles.first_name} ${d.profiles.last_name}`, deals: 0, revenue: 0 }
          agentMap[id].deals += 1
          agentMap[id].revenue += Number(d.value || 0)
        }
      })
      const topAgents = Object.values(agentMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

      // Lead sources
      const sourceMap = {}
      leads.forEach(l => {
        const source = l.source || 'Other'
        if (!sourceMap[source]) sourceMap[source] = 0
        sourceMap[source] += 1
      })
      const sourceData = Object.keys(sourceMap).map(k => ({ name: k.replace('_', ' '), value: sourceMap[k] }))

      // Revenue over time (won deals by month)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthlyRevenue = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const monthName = months[d.getMonth()]
        monthlyRevenue[monthName] = { name: monthName, revenue: 0 }
      }

      deals.filter(d => d.stage === 'closed_won').forEach(d => {
        const m = months[new Date(d.updated_at).getMonth()]
        if (monthlyRevenue[m]) monthlyRevenue[m].revenue += Number(d.value || 0)
      })
      const revenueChartData = Object.values(monthlyRevenue)

      return {
        totalRevenue,
        totalDeals,
        conversionRate,
        pendingDeals,
        funnelData,
        topAgents,
        sourceData,
        deals,
        revenueChartData
      }
    },
    enabled: !!company?.id
  })

  const revenueChartData = stats?.revenueChartData || []

  return (
    <div>
      <PageHeader title="Sales Dashboard" subtitle="Overview of your sales performance and pipeline." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
        <StatCard title="Total Revenue (Won)" value={`UGX ${(stats?.totalRevenue || 0).toLocaleString()}`} icon={<DollarSign size={20} />} loading={isLoading} />
        <StatCard title="Total Deals" value={stats?.totalDeals || 0} icon={<FileText size={20} />} loading={isLoading} />
        <StatCard title="Conversion Rate" value={`${stats?.conversionRate || 0}%`} icon={<Target size={20} />} loading={isLoading} />
        <StatCard title="Avg Deal Size" value={`UGX ${stats?.totalDeals ? Math.round(stats.totalRevenue / stats.totalDeals).toLocaleString() : 0}`} icon={<Activity size={20} />} loading={isLoading} />
        <StatCard title="Pending Deals" value={stats?.pendingDeals || 0} icon={<Users size={20} />} loading={isLoading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Deal Stage Funnel</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.funnelData || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#111827' }} width={100} />
                <RechartsTooltip cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="count" fill="var(--gp-blue)" radius={0} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Lead Sources</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.sourceData || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                  {(stats?.sourceData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: "1px solid var(--gp-border-light)" }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Top Performing Agents</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 24px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px' }}>Rank</th>
                <th style={{ padding: '12px 24px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px' }}>Agent</th>
                <th style={{ padding: '12px 24px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px' }}>Deals Won</th>
                <th style={{ padding: '12px 24px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.topAgents || []).map((agent, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--gp-border-light)" }}>
                  <td style={{ padding: '16px 24px', fontWeight: 600, color: "var(--gp-blue)" }}>#{idx + 1}</td>
                  <td style={{ padding: '16px 24px', fontWeight: 500, color: '#111827' }}>{agent.name}</td>
                  <td style={{ padding: '16px 24px', color: '#4B5563' }}>{agent.deals}</td>
                  <td style={{ padding: '16px 24px', fontWeight: 500, color: '#111827' }}>UGX {agent.revenue.toLocaleString()}</td>
                </tr>
              ))}
              {(!stats?.topAgents || stats.topAgents.length === 0) && (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No closed deals yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: "1px solid var(--gp-border-light)" }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Sales Forecast</h3>
          </div>
          <div style={{ padding: '24px' }}>
            {['negotiation', 'proposal'].map(stage => {
              const stageDeals = (stats?.deals || []).filter(d => d.stage === stage)
              const count = stageDeals.length
              const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0)
              const weightedValue = stageDeals.reduce((sum, d) => sum + (Number(d.value || 0) * (Number(d.probability || 0) / 100)), 0)
              
              return (
                <div key={stage} style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{stage}</span>
                    <span style={{ fontSize: '12px', color: '#6B7280', background: '#F3F4F6', padding: '2px 8px' }}>{count} deals</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#4B5563', marginBottom: '4px' }}>
                    <span>Pipeline Value:</span>
                    <span>UGX {totalValue.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, color: "var(--gp-blue)" }}>
                    <span>Weighted Forecast:</span>
                    <span>UGX {weightedValue.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
