import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { Users, Briefcase, FileText, DollarSign, Clock, CheckCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import { formatCurrency } from '../../lib/utils'
import { CheckInWidget } from '../../components/hr/CheckInWidget'

const COLORS = {
  blue: "var(--gp-blue)",
  dark: "var(--gp-background)",
  green: '#22C55E',
  amber: '#F59E0B',
  gray: '#9CA3AF'
}

export function Overview() {
  const { company, role } = useAuth()
  const companyId = company?.id
  const queryClient = useQueryClient()

  // 1. Fetch Stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard_stats', companyId],
    queryFn: async () => {
      if (!companyId) return null
      
      const [profilesRes, projectsRes, dealsRes, invoicesRes, approvalsRes] = await Promise.all([
        insforge.from('profiles').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        insforge.from('projects').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active'),
        insforge.from('deals').select('*', { count: 'exact', head: true }).eq('company_id', companyId).not('stage', 'in', '("closed_won","closed_lost")'),
        insforge.from('invoices').select('total').eq('company_id', companyId).eq('status', 'paid').gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        insforge.from('approvals').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending')
      ])

      const revenueMTD = invoicesRes.data?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0

      return {
        employees: profilesRes.count || 0,
        activeProjects: projectsRes.count || 0,
        openDeals: dealsRes.count || 0,
        revenueMTD,
        pendingApprovals: approvalsRes.count || 0
      }
    },
    enabled: !!companyId
  })

  // 2. Fetch Live Monthly Revenue vs Expenses Chart Data
  const { data: chartData = [], isLoading: loadingChart } = useQuery({
    queryKey: ['dashboard_monthly_finance', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      const dateStr = sixMonthsAgo.toISOString()

      const [invoicesRes, expensesRes] = await Promise.all([
        insforge.from('invoices').select('total, created_at').eq('company_id', companyId).eq('status', 'paid').gte('created_at', dateStr),
        insforge.from('expenses').select('amount, created_at').eq('company_id', companyId).eq('status', 'approved').gte('created_at', dateStr)
      ])

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthlyDataMap = {}

      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const monthName = months[d.getMonth()]
        monthlyDataMap[monthName] = { name: monthName, revenue: 0, expenses: 0 }
      }

      invoicesRes.data?.forEach(inv => {
        const m = months[new Date(inv.created_at).getMonth()]
        if (monthlyDataMap[m]) monthlyDataMap[m].revenue += Number(inv.total || 0)
      })

      expensesRes.data?.forEach(exp => {
        const m = months[new Date(exp.created_at).getMonth()]
        if (monthlyDataMap[m]) monthlyDataMap[m].expenses += Number(exp.amount || 0)
      })

      return Object.values(monthlyDataMap)
    },
    enabled: !!companyId
  })

  // 3. Fetch Live Task Distribution Chart Data
  const { data: taskData = [] } = useQuery({
    queryKey: ['dashboard_task_stats', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const { data, error } = await insforge.from('tasks').select('status').eq('company_id', companyId)
      if (error) throw error

      const counts = data.reduce((acc, t) => {
        if (t.status === 'todo') acc.todo++
        else if (t.status === 'in_progress') acc.in_progress++
        else if (t.status === 'done') acc.done++
        return acc
      }, { todo: 0, in_progress: 0, done: 0 })

      // Render fallbacks if no tasks exist so PieChart renders correctly
      const total = counts.todo + counts.in_progress + counts.done
      return [
        { name: 'Todo', value: total === 0 ? 1 : counts.todo, color: COLORS.gray },
        { name: 'In Progress', value: counts.in_progress, color: COLORS.blue },
        { name: 'Done', value: counts.done, color: COLORS.green }
      ]
    },
    enabled: !!companyId
  })

  // 4. Fetch Live Pending Approvals List
  const { data: approvals = [], isLoading: loadingApprovals } = useQuery({
    queryKey: ['pending_approvals', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const { data, error } = await insforge
        .from('approvals')
        .select('*, requester:profiles!requested_by(first_name, last_name)')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .limit(5)
      if (error) throw error
      return data || []
    },
    enabled: !!companyId
  })

  // 5. Approvals Mutations
  const approveApproval = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('approvals').update({ status: 'approved' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pending_approvals', companyId])
      queryClient.invalidateQueries(['dashboard_stats', companyId])
    }
  })

  const rejectApproval = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('approvals').update({ status: 'rejected' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pending_approvals', companyId])
      queryClient.invalidateQueries(['dashboard_stats', companyId])
    }
  })

  const isManager = role === 'company_admin' || role === 'manager'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader title="Overview" subtitle={`Welcome to ${company?.name || 'Goodison Park'} operations.`} />

      <CheckInWidget />
      
      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard title="Total Employees" value={stats?.employees || 0} icon={<Users size={20} />} loading={loadingStats} />
        <StatCard title="Active Projects" value={stats?.activeProjects || 0} icon={<Briefcase size={20} />} loading={loadingStats} />
        <StatCard title="Open Deals" value={stats?.openDeals || 0} icon={<FileText size={20} />} loading={loadingStats} />
        <StatCard title="Revenue (MTD)" value={`UGX ${stats?.revenueMTD?.toLocaleString() || 0}`} icon={<DollarSign size={20} />} loading={loadingStats} />
        <StatCard title="Pending Approvals" value={stats?.pendingApprovals || 0} icon={<Clock size={20} />} loading={loadingStats} />
      </div>

      {isManager ? (
        <>
          {/* ROW 2 */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {/* Chart */}
            <div style={{ flex: '3 1 500px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px', color: "var(--gp-black)" }}>Revenue vs Expenses (Last 6 Months)</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => `UGX ${val/1000000}M`} />
                    <RechartsTooltip cursor={{ fill: '#F9FAFB' }} />
                    <Bar dataKey="revenue" fill={COLORS.blue} radius={0} name="Revenue" />
                    <Bar dataKey="expenses" fill={COLORS.dark} radius={0} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pending Approvals List */}
            <div style={{ flex: '2 1 300px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '0' }}>
              <div style={{ padding: '20px 24px', borderBottom: "1px solid var(--gp-border-light)" }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: "var(--gp-black)", margin: 0 }}>Pending Approvals</h3>
              </div>
              <div>
                {loadingApprovals ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gp-muted)', fontSize: '14px' }}>Loading approvals...</div>
                ) : approvals.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gp-muted)', fontSize: '14px' }}>No pending approvals.</div>
                ) : (
                  approvals.map(app => (
                    <div key={app.id} className="list-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--gp-border-light)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Badge variant={app.type === 'expense' ? 'red' : app.type === 'leave' ? 'amber' : 'blue'}>
                            {app.type}
                          </Badge>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--gp-black)' }}>
                            {app.requester ? `${app.requester.first_name} ${app.requester.last_name}` : 'Requester'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--gp-muted)' }}>{app.description || 'No description provided'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => approveApproval.mutate(app.id)}
                          disabled={approveApproval.isPending}
                          style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => rejectApproval.mutate(app.id)}
                          disabled={rejectApproval.isPending}
                          style={{ background: '#EF4444', color: '#FFF', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ROW 3 */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)" }}>
              <div style={{ padding: '20px 24px', borderBottom: "1px solid var(--gp-border-light)" }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: "var(--gp-black)", margin: 0 }}>Task Status</h3>
              </div>
              <div style={{ height: '300px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {taskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: '280px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)" }}>
              <div style={{ padding: '20px 24px', borderBottom: "1px solid var(--gp-border-light)" }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: "var(--gp-black)", margin: 0 }}>Recent Activity</h3>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', background: 'var(--gp-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle size={16} color="#22C55E" />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--gp-black)' }}><span style={{ fontWeight: 600 }}>Active Projects</span> update real-time dashboard events.</p>
                    <span style={{ fontSize: '12px', color: 'var(--gp-muted)' }}>Just now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        // Employee View
        <div>
          <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>My Tasks Due Today</h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>You have no tasks due today.</p>
          </div>
        </div>
      )}
    </div>
  )
}
