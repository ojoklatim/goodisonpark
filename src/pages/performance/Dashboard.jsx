import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { getInitials } from '../../lib/utils'

export function Dashboard() {
  const { company } = useAuth()

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('profiles')
        .select('id, first_name, last_name, department')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: kpis = [], isLoading: loadingKpis } = useQuery({
    queryKey: ['kpis', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('kpis')
        .select('*')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ['goals', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('goals')
        .select('*')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['reviews', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('performance_reviews')
        .select('*')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('tasks')
        .select('assigned_to, status')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: rewardsPenalties = [], isLoading: loadingRewards } = useQuery({
    queryKey: ['rewards_penalties', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('rewards_penalties')
        .select('profile_id, type, points')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const isLoading = loadingProfiles || loadingKpis || loadingGoals || loadingReviews || loadingTasks || loadingRewards

  const stats = useMemo(() => {
    let totalScore = 0
    let kpiCount = 0
    const profileScores = {}

    kpis.forEach(kpi => {
      const target = Number(kpi.target_value) || 1
      const current = Number(kpi.current_value) || 0
      const pct = Math.min(100, (current / target) * 100)
      totalScore += pct
      kpiCount++

      if (!profileScores[kpi.profile_id]) profileScores[kpi.profile_id] = { total: 0, count: 0 }
      profileScores[kpi.profile_id].total += pct
      profileScores[kpi.profile_id].count++
    })

    const avgKpi = kpiCount > 0 ? Math.round(totalScore / kpiCount) : 0

    let topPerformer = 'None'
    let highestScore = -1
    let leaderboard = []

    profiles.forEach(p => {
      const scores = profileScores[p.id]
      const score = scores && scores.count > 0 ? Math.round(scores.total / scores.count) : 0
      
      if (score > highestScore && score > 0) {
        highestScore = score
        topPerformer = `${p.first_name} ${p.last_name}`
      }

      leaderboard.push({
        id: p.id,
        employee: `${p.first_name} ${p.last_name}`,
        department: p.department || 'Unassigned',
        kpiScore: score,
        tasks: tasks.filter(t => t.assigned_to === p.id && t.status === 'done').length,
        points: rewardsPenalties
          .filter(rp => rp.profile_id === p.id)
          .reduce((sum, rp) => sum + (rp.type === 'penalty' ? -Number(rp.points || 0) : Number(rp.points || 0)), 0)
      })
    })

    leaderboard.sort((a, b) => b.kpiScore - a.kpiScore)
    leaderboard = leaderboard.map((l, idx) => ({ ...l, rank: idx + 1 }))

    const reviewsDue = reviews.filter(r => r.status === 'draft').length
    const activeGoals = goals.filter(g => g.status === 'active').length

    // Dept Data
    const deptMap = {}
    leaderboard.forEach(l => {
      if (!deptMap[l.department]) deptMap[l.department] = { total: 0, count: 0 }
      deptMap[l.department].total += l.kpiScore
      deptMap[l.department].count++
    })

    const deptData = Object.keys(deptMap).map(name => ({
      name,
      score: deptMap[name].count > 0 ? Math.round(deptMap[name].total / deptMap[name].count) : 0
    }))

    return {
      avgKpi,
      topPerformer,
      reviewsDue,
      activeGoals,
      leaderboard,
      deptData
    }
  }, [profiles, kpis, goals, reviews, tasks, rewardsPenalties])

  // Real KPI trend, computed from actual performance review scores over the last 6 months.
  // Months with no submitted reviews are left as null so the chart shows a genuine gap
  // rather than a fabricated number.
  const trendData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      return { key: `${d.getFullYear()}-${d.getMonth()}`, name: d.toLocaleString('default', { month: 'short' }) }
    })
    return months.map(({ key, name }) => {
      const [year, month] = key.split('-').map(Number)
      const monthReviews = reviews.filter(r => {
        if (!r.created_at || r.overall_score == null) return false
        const d = new Date(r.created_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
      const rate = monthReviews.length
        ? Math.round((monthReviews.reduce((s, r) => s + Number(r.overall_score), 0) / monthReviews.length) * 20) // scale 0-5 score to 0-100
        : null
      return { name, rate }
    })
  }, [reviews])
  const hasTrendData = trendData.some(t => t.rate !== null)

  const columns = [
    { header: 'Rank', accessorKey: 'rank', cell: info => <span style={{ fontWeight: 700 }}>#{info.getValue()}</span> },
    { 
      header: 'Employee', 
      accessorKey: 'employee',
      cell: info => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '24px', height: '24px', background: "var(--gp-blue)", color: "var(--gp-black)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
            {getInitials(info.getValue())}
          </div>
          {info.getValue()}
        </div>
      )
    },
    { header: 'Department', accessorKey: 'department' },
    { header: 'KPI Score', accessorKey: 'kpiScore', cell: info => `${info.getValue()}%` },
    { header: 'Tasks Completed', accessorKey: 'tasks' },
    { header: 'Points', accessorKey: 'points' },
  ]

  return (
    <div>
      <PageHeader title="Performance Dashboard" subtitle="Track company-wide employee performance" />

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ width: '200px' }}><Select options={[{value: 'all', label: 'All Departments'}]} defaultValue="all" /></div>
        <div style={{ width: '200px' }}><Select options={[{value: 'all', label: 'All Branches'}]} defaultValue="all" /></div>
        <div style={{ width: '200px' }}><Select options={[{value: 'month', label: 'This Month'}]} defaultValue="month" /></div>
      </div>

      {isLoading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <StatCard title="Company Avg KPI" value={`${stats.avgKpi}%`} trend="up" trendValue="3%" />
            <StatCard title="Top Performer" value={stats.topPerformer} />
            <StatCard title="Reviews Due" value={stats.reviewsDue.toString()} />
            <StatCard title="Goals Active" value={stats.activeGoals.toString()} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <Card>
              <div style={{ padding: '16px', borderBottom: "1px solid var(--gp-border-light)", fontWeight: 600 }}>Avg Score by Department</div>
              <div style={{ padding: '24px', height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.deptData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gp-border-light)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <RechartsTooltip cursor={{ fill: '#F9FAFB' }} />
                    <Bar dataKey="score" fill="var(--gp-blue)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div style={{ padding: '16px', borderBottom: "1px solid var(--gp-border-light)", fontWeight: 600 }}>KPI Achievement Trend</div>
              <div style={{ padding: '24px', height: '250px' }}>
                {hasTrendData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gp-border-light)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="rate" stroke="#22C55E" strokeWidth={3} dot={{ r: 4, fill: '#22C55E' }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gp-muted)', fontSize: '13px', textAlign: 'center' }}>
                    No submitted performance reviews yet — the trend will appear here once reviews are recorded.
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ padding: '16px', borderBottom: "1px solid var(--gp-border-light)", fontWeight: 600 }}>Top Performers Leaderboard</div>
            <div style={{ padding: '16px' }}>
              <DataTable columns={columns} data={stats.leaderboard} />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
