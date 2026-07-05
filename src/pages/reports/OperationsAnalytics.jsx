import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/ui/StatCard'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Download, FolderOpen, CheckSquare, AlertTriangle, Clock } from 'lucide-react'

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function UtilizationBar({ value }) {
  const color = value > 90 ? '#EF4444' : value > 70 ? '#F59E0B' : '#10B981'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, background: "var(--gp-background)", height: '8px', borderRadius: '0px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ color: color, fontSize: '13px', fontWeight: '600', minWidth: '40px', textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

export function OperationsAnalytics() {
  const { company, user } = useAuth()

  const { data: projects = [], isLoading: projLoading } = useQuery({
    queryKey: ['projects-ops', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('projects').select('id, status, department_id, start_date, end_date, created_at').eq('company_id', company.id)
      return data || []
    }
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-ops', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('tasks').select('id, status, priority, project_id, due_date, completed_at, created_at').eq('company_id', company.id)
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
    queryKey: ['profiles-ops', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('profiles').select('id, department').eq('company_id', company.id)
      return data || []
    }
  })

  const isLoading = projLoading || tasksLoading

  const now = new Date()

  // Project Status Distribution
  const statusMap = {}
  projects.forEach(p => { statusMap[p.status || 'unknown'] = (statusMap[p.status || 'unknown'] || 0) + 1 })
  const projectStatusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  // Task Completion Rate Over Time (12 months)
  const taskCompletionOverTime = MONTHS.map((month, idx) => {
    const monthTasks = tasks.filter(t => new Date(t.created_at).getMonth() === idx)
    const done = monthTasks.filter(t => t.status === 'done').length
    const rate = monthTasks.length ? ((done / monthTasks.length) * 100).toFixed(1) : 0
    return { month, rate: parseFloat(rate), total: monthTasks.length }
  })

  // Tasks by Priority
  const priorityData = ['urgent','high','medium','low'].map(priority => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    count: tasks.filter(t => t.priority === priority).length
  }))

  // Summary stats
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length
  const openTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
  const overdueTasks = tasks.filter(t => {
    const due = t.due_date ? new Date(t.due_date) : null
    return due && due < now && t.status !== 'done' && t.status !== 'cancelled'
  }).length

  const completedWithDates = tasks.filter(t => t.status === 'done' && t.completed_at && t.created_at)
  const avgCompletion = completedWithDates.length
    ? (completedWithDates.reduce((sum, t) => {
        const diff = new Date(t.completed_at) - new Date(t.created_at)
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0) / completedWithDates.length).toFixed(1)
    : 0

  // Department Workload Table
  const deptWorkload = departments.map(d => {
    const deptProjects = projects.filter(p => p.department_id === d.id)
    const deptProjectIds = deptProjects.map(p => p.id)
    const activeProj = deptProjects.filter(p => p.status === 'active' || p.status === 'in_progress').length
    const deptTasks = tasks.filter(t => deptProjectIds.includes(t.project_id))
    const openT = deptTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
    const overdueT = deptTasks.filter(t => {
      const due = t.due_date ? new Date(t.due_date) : null
      return due && due < now && t.status !== 'done' && t.status !== 'cancelled'
    }).length
    const teamSize = profiles.filter(p => p.department === d.name).length
    const utilization = teamSize > 0 ? Math.min(Math.round((openT / (teamSize * 3)) * 100), 120) : 0
    return { dept: d.name, activeProjects: activeProj, openTasks: openT, overdueTasks: overdueT, teamSize, utilization }
  })

  const handleExportCSV = () => {
    const rows = [['Department','Active Projects','Open Tasks','Overdue Tasks','Team Size','Utilization %']]
    deptWorkload.forEach(d => rows.push([d.dept, d.activeProjects, d.openTasks, d.overdueTasks, d.teamSize, d.utilization]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'operations_analytics.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: "var(--gp-background)", minHeight: '100vh', padding: '24px' }}>
      <PageHeader title="Operations Analytics" />

      {/* Export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <Button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={16} /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><Spinner /></div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <StatCard title="Active Projects" value={activeProjects} icon={<FolderOpen size={20} color="var(--gp-blue)" />} />
            <StatCard title="Open Tasks" value={openTasks} icon={<CheckSquare size={20} color="#10B981" />} />
            <StatCard title="Overdue Tasks" value={overdueTasks} icon={<AlertTriangle size={20} color="#EF4444" />} />
            <StatCard title="Avg Completion" value={`${avgCompletion}d`} icon={<Clock size={20} color="#F59E0B" />} />
          </div>

          {/* Charts 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

            {/* 1. Project Status Distribution */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Project Status Distribution</h3>
              {projectStatusData.length === 0 ? (
                <div style={{ color: '#4B5563', textAlign: 'center', padding: '80px 0' }}>No project data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={projectStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#4B5563' }}>
                      {projectStatusData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                    <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 2. Task Completion Rate Over Time */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Task Completion Rate Over Time</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={taskCompletionOverTime}>
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }}
                    formatter={v => [`${v}%`, 'Completion Rate']} />
                  <Line type="monotone" dataKey="rate" stroke="var(--gp-blue)" strokeWidth={2} dot={{ fill: "var(--gp-blue)", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Tasks by Priority */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Tasks by Priority</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={priorityData}>
                  <XAxis dataKey="priority" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                  <Bar dataKey="count" radius={0}>
                    {priorityData.map((_, idx) => <Cell key={idx} fill={[CHART_COLORS[3], CHART_COLORS[2], CHART_COLORS[0], CHART_COLORS[1]][idx]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 4. Projects vs Tasks overview */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
              <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Projects & Tasks by Dept</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptWorkload}>
                  <XAxis dataKey="dept" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', color: 'var(--gp-black)', borderRadius: 0 }} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Bar dataKey="activeProjects" fill="var(--gp-blue)" name="Active Projects" />
                  <Bar dataKey="openTasks" fill="#10B981" name="Open Tasks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Workload Table */}
          <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
            <h3 style={{ color: 'var(--gp-black)', margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Department Workload</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                  {['Department','Active Projects','Open Tasks','Overdue Tasks','Team Size','Utilization %'].map(col => (
                    <th key={col} style={{ padding: '10px 12px', textAlign: 'left', color: '#4B5563', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptWorkload.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                    <td style={{ padding: '12px 12px', color: 'var(--gp-black)', fontWeight: '500' }}>{row.dept}</td>
                    <td style={{ padding: '12px 12px', color: "var(--gp-blue)" }}>{row.activeProjects}</td>
                    <td style={{ padding: '12px 12px', color: '#9CA3AF' }}>{row.openTasks}</td>
                    <td style={{ padding: '12px 12px', color: row.overdueTasks > 0 ? '#EF4444' : '#9CA3AF', fontWeight: row.overdueTasks > 0 ? '600' : '400' }}>{row.overdueTasks}</td>
                    <td style={{ padding: '12px 12px', color: '#9CA3AF' }}>{row.teamSize}</td>
                    <td style={{ padding: '12px 12px', minWidth: '160px' }}>
                      <UtilizationBar value={row.utilization} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
