import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell
} from 'recharts'
import { Download, Medal, Star } from 'lucide-react'

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const RANK_STYLES = [
  { border: '#F59E0B', label: '🥇' },
  { border: '#9CA3AF', label: '🥈' },
  { border: '#CD7F32', label: '🥉' },
]

export function PerformanceAnalytics() {
  const { company, user } = useAuth()
  const [deptFilter, setDeptFilter] = useState('')
  const [period, setPeriod] = useState('Monthly')
  const [leaderPeriod, setLeaderPeriod] = useState('Monthly')
  const [selectedEmployees, setSelectedEmployees] = useState([])

  // Returns the earliest timestamp to include for a given period tab, computed
  // from the real current date (not a fixed/fake cutoff).
  const periodStart = (label) => {
    const now = new Date()
    if (label === 'Monthly') return new Date(now.getFullYear(), now.getMonth(), 1)
    if (label === 'Quarterly') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    return new Date(now.getFullYear(), 0, 1) // Yearly
  }

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('departments').select('id, name').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-perf', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('profiles').select('id, first_name, last_name, department').eq('company_id', company.id)
      return (data || []).map(p => ({ ...p, full_name: `${p.first_name} ${p.last_name}` }))
    }
  })

  const { data: reviews = [], isLoading: revLoading } = useQuery({
    queryKey: ['performance-reviews', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('performance_reviews').select('id, profile_id, overall_score, period, created_at').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: attendance = [], isLoading: attLoading } = useQuery({
    queryKey: ['attendance', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('attendance').select('id, profile_id, status, date').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-perf', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('tasks').select('id, assigned_to, status, completed_at, created_at').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['rewards', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('rewards_penalties').select('id, profile_id, type, amount, points, created_at').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['goals-perf', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('goals').select('id, profile_id, status').eq('company_id', company.id)
      return data || []
    }
  })

  const isLoading = revLoading || attLoading || tasksLoading || rewardsLoading || goalsLoading

  // Departments are matched to people by profiles.department (free-text), since
  // that's how department is actually stored on the profile — there's no
  // department_id foreign key on reviews/attendance/tasks/profiles.
  const profilesInDept = (deptName) => profiles.filter(p => p.department === deptName)

  const withinPeriod = (dateStr, label) => {
    if (!dateStr) return false
    return new Date(dateStr) >= periodStart(label)
  }

  // Dept KPI Scores — average overall_score of reviews for employees in that dept
  const deptKpiData = departments.map(d => {
    const deptProfileIds = profilesInDept(d.name).map(p => p.id)
    const deptReviews = reviews.filter(r => deptProfileIds.includes(r.profile_id) && withinPeriod(r.created_at, period))
    const avg = deptReviews.length ? (deptReviews.reduce((s, r) => s + (Number(r.overall_score) || 0), 0) / deptReviews.length).toFixed(1) : 0
    return { dept: d.name, score: parseFloat(avg) }
  })

  // Attendance Rate by Dept
  const deptAttData = departments.map(d => {
    const deptProfileIds = profilesInDept(d.name).map(p => p.id)
    const deptAtt = attendance.filter(a => deptProfileIds.includes(a.profile_id) && withinPeriod(a.date, period))
    const present = deptAtt.filter(a => a.status === 'present' || a.status === 'late').length
    const rate = deptAtt.length ? ((present / deptAtt.length) * 100).toFixed(1) : 0
    return { dept: d.name, rate: parseFloat(rate) }
  })

  // Task Completion Rate by Dept
  const deptTaskData = departments.map(d => {
    const deptProfileIds = profilesInDept(d.name).map(p => p.id)
    const deptTasks = tasks.filter(t => deptProfileIds.includes(t.assigned_to) && withinPeriod(t.created_at, period))
    const done = deptTasks.filter(t => t.status === 'done').length
    const rate = deptTasks.length ? ((done / deptTasks.length) * 100).toFixed(1) : 0
    return { dept: d.name, rate: parseFloat(rate) }
  })

  // Rewards vs Penalties by month (current year, from real created_at timestamps)
  const rewardsByMonth = MONTHS.map((m, idx) => {
    const monthRewards = rewards.filter(r => r.created_at && new Date(r.created_at).getMonth() === idx && new Date(r.created_at).getFullYear() === new Date().getFullYear())
    return {
      month: m,
      rewards: monthRewards.filter(r => r.type === 'reward').reduce((s, r) => s + Number(r.amount || 0), 0),
      penalties: monthRewards.filter(r => r.type === 'penalty').reduce((s, r) => s + Number(r.amount || 0), 0),
    }
  })

  // Leaderboard: compute score per employee, optionally scoped to the selected department
  const leaderboard = profiles
    .filter(p => !deptFilter || p.department === departments.find(d => d.id === deptFilter)?.name)
    .map(p => {
      const empReviews = reviews.filter(r => r.profile_id === p.id && withinPeriod(r.created_at, leaderPeriod))
      const kpi = empReviews.length ? (empReviews.reduce((s, r) => s + (Number(r.overall_score) || 0), 0) / empReviews.length).toFixed(1) : 0
      const empAtt = attendance.filter(a => a.profile_id === p.id && withinPeriod(a.date, leaderPeriod))
      const attRate = empAtt.length ? ((empAtt.filter(a => a.status === 'present' || a.status === 'late').length / empAtt.length) * 100).toFixed(1) : 0
      const empTasks = tasks.filter(t => t.assigned_to === p.id && withinPeriod(t.created_at, leaderPeriod))
      const tasksDone = empTasks.filter(t => t.status === 'done').length
      const score = ((parseFloat(kpi) * 0.4) + (parseFloat(attRate) * 0.3) + (empTasks.length ? (tasksDone / empTasks.length) * 100 * 0.3 : 0)).toFixed(1)
      return { id: p.id, name: p.full_name, dept: p.department || '—', kpi, attRate, tasksDone, score: parseFloat(score) }
    }).sort((a, b) => b.score - a.score)

  // Radar comparison data — Goals axis uses real completion rate from the goals table
  const radarData = [
    { axis: 'KPI' }, { axis: 'Attendance' }, { axis: 'Tasks' }, { axis: 'Goals' }, { axis: 'Score' }
  ].map(item => {
    const row = { axis: item.axis }
    selectedEmployees.forEach(id => {
      const emp = leaderboard.find(e => e.id === id)
      if (emp) {
        if (item.axis === 'KPI') row[emp.name] = parseFloat(emp.kpi) * 10
        else if (item.axis === 'Attendance') row[emp.name] = parseFloat(emp.attRate)
        else if (item.axis === 'Tasks') row[emp.name] = Math.min(emp.tasksDone * 5, 100)
        else if (item.axis === 'Goals') {
          const empGoals = goals.filter(g => g.profile_id === id)
          row[emp.name] = empGoals.length ? Math.round((empGoals.filter(g => g.status === 'completed').length / empGoals.length) * 100) : 0
        }
        else if (item.axis === 'Score') row[emp.name] = parseFloat(emp.score)
      }
    })
    return row
  })

  const toggleEmployee = (id) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const handleExportCSV = () => {
    const rows = [['Rank','Employee','Department','KPI Score','Attendance %','Tasks Done','Score']]
    leaderboard.forEach((e, i) => rows.push([i + 1, e.name, e.dept, e.kpi, e.attRate, e.tasksDone, e.score]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'performance_analytics.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const tabStyle = (active) => ({
    padding: '8px 20px',
    background: active ? "var(--gp-blue)" : "var(--gp-card)",
    color: active ? "var(--gp-background)" : '#9CA3AF',
    border: `1px solid ${active ? "var(--gp-blue)" : "var(--gp-border-light)"}`,
    borderRadius: '0px',
    cursor: 'pointer',
    fontWeight: active ? '600' : '400',
    fontSize: '14px',
    transition: 'all 0.2s'
  })

  return (
    <div style={{ background: "var(--gp-background)", minHeight: '100vh', padding: '24px' }}>
      <PageHeader title="Performance Analytics" />

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', padding: '8px 12px', borderRadius: '0px', fontSize: '14px' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0' }}>
          {['Monthly','Quarterly','Yearly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={tabStyle(period === p)}>{p}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><Spinner /></div>
      ) : (
        <>
          {/* 2x2 Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

            {/* 1. Dept KPI Score */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Dept KPI Score (Avg)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptKpiData}>
                  <XAxis dataKey="dept" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                  <Bar dataKey="score" fill="var(--gp-blue)" radius={0}>
                    {deptKpiData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Attendance Rate by Dept */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Attendance Rate by Dept (%)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptAttData}>
                  <XAxis dataKey="dept" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} formatter={v => [`${v}%`, 'Attendance']} />
                  <Bar dataKey="rate" fill="#10B981" radius={0}>
                    {deptAttData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Task Completion Rate by Dept */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Task Completion Rate by Dept (%)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptTaskData}>
                  <XAxis dataKey="dept" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} formatter={v => [`${v}%`, 'Completion']} />
                  <Bar dataKey="rate" fill="#F59E0B" radius={0}>
                    {deptTaskData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 4. Rewards vs Penalties by Month */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Rewards vs Penalties by Month</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rewardsByMonth}>
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Bar dataKey="rewards" fill="#10B981" radius={0} name="Rewards" />
                  <Bar dataKey="penalties" fill="#EF4444" radius={0} name="Penalties" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard */}
          <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Medal size={18} color="#F59E0B" /> Top Performers
              </h3>
              <div style={{ display: 'flex', gap: 0 }}>
                {['Monthly','Quarterly','Yearly'].map(p => (
                  <button key={p} onClick={() => setLeaderPeriod(p)} style={tabStyle(leaderPeriod === p)}>{p}</button>
                ))}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                  {['Rank','Employee','Dept','KPI Score','Attendance %','Tasks Done','Score'].map(col => (
                    <th key={col} style={{ padding: '10px 12px', textAlign: 'left', color: '#4B5563', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((emp, idx) => {
                  const rankStyle = idx < 3 ? RANK_STYLES[idx] : null
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--gp-border-light)', borderLeft: rankStyle ? `3px solid ${rankStyle.border}` : '3px solid transparent' }}>
                      <td style={{ padding: '12px 12px', color: idx < 3 ? RANK_STYLES[idx].border : '#9CA3AF', fontWeight: '700' }}>
                        {rankStyle ? rankStyle.label : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '12px 12px', color: 'var(--gp-black)', fontWeight: '500' }}>{emp.name}</td>
                      <td style={{ padding: '12px 12px', color: '#9CA3AF' }}>{emp.dept}</td>
                      <td style={{ padding: '12px 12px', color: "var(--gp-blue)" }}>{emp.kpi}</td>
                      <td style={{ padding: '12px 12px', color: '#10B981' }}>{emp.attRate}%</td>
                      <td style={{ padding: '12px 12px', color: '#F59E0B' }}>{emp.tasksDone}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--gp-black)', fontWeight: '700' }}>{emp.score}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Individual Comparison */}
          <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
            <h3 style={{ color: 'var(--gp-black)', margin: '0 0 8px', fontSize: '16px', fontWeight: '600' }}>Individual Comparison</h3>
            <p style={{ color: '#4B5563', fontSize: '13px', marginBottom: '16px' }}>Select up to 4 employees to compare on radar chart</p>

            {/* Employee Multi-select */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {profiles.map(p => {
                const checked = selectedEmployees.includes(p.id)
                return (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                    background: checked ? 'rgba(56,189,248,0.1)' : "var(--gp-background)", border: `1px solid ${checked ? "var(--gp-blue)" : "var(--gp-border-light)"}`,
                    cursor: 'pointer', fontSize: '13px', color: checked ? "var(--gp-blue)" : '#9CA3AF' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleEmployee(p.id)}
                      disabled={!checked && selectedEmployees.length >= 4}
                      style={{ accentColor: "var(--gp-blue)" }} />
                    {p.full_name}
                  </label>
                )
              })}
            </div>

            {selectedEmployees.length < 2 ? (
              <div style={{ color: '#4B5563', textAlign: 'center', padding: '60px', border: '1px dashed var(--gp-border-light)' }}>
                Select at least 2 employees to see comparison
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--gp-border-light)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#9CA3AF', fontSize: 13 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#4B5563', fontSize: 11 }} />
                  {selectedEmployees.map((id, idx) => {
                    const emp = profiles.find(p => p.id === id)
                    return emp ? (
                      <Radar key={id} name={emp.full_name} dataKey={emp.full_name}
                        stroke={CHART_COLORS[idx]} fill={CHART_COLORS[idx]} fillOpacity={0.15} />
                    ) : null
                  })}
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  )
}
