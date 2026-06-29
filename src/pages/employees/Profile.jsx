import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { getInitials } from '../../lib/utils'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

export function Profile() {
  const { id } = useParams()
  const { company } = useAuth()
  const [activeTab, setActiveTab] = useState('Profile')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('profiles')
        .select(`*, departments(name)`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner /></div>
  if (!profile) return <div className="p-8">Employee not found.</div>

  const tabs = ['Profile', 'KPIs', 'Attendance', 'Goals', 'Reviews', 'Rewards', 'Training', 'Documents']

  return (
    <div>
      {/* Header Card */}
      <div className="profile-header-card" style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", display: 'flex', alignItems: 'flex-start', padding: '24px', gap: '24px' }}>
        <div style={{ width: '120px', height: '120px', background: "var(--gp-card)", color: "var(--gp-blue)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 700, flexShrink: 0 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}} />
          ) : (
            getInitials(profile.first_name, profile.last_name)
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>{profile.first_name} {profile.last_name}</h2>
              <div style={{ fontSize: '16px', color: '#4B5563', marginBottom: '12px' }}>{profile.job_title || 'No Title'} • {profile.departments?.name || profile.department || 'No Dept'}</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: '#6B7280', fontSize: '14px' }}>Code: {profile.employee_code || '-'}</span>
                <Badge variant={profile.is_active ? 'active' : 'inactive'} label={profile.is_active ? 'Active' : 'Inactive'} />
                <Badge variant="gray" label={profile.role?.replace('_', ' ')} />
              </div>
            </div>
            <Button variant="secondary">Edit Profile</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '24px' }}>
        <StatCard title="KPI Score" value="-" />
        <StatCard title="Tasks Done" value="-" />
        <StatCard title="Attendance Rate" value="-" />
        <StatCard title="Reward Points" value="-" />
      </div>

      {/* Tabs Nav */}
      <div style={{ display: 'flex', borderBottom: "1px solid var(--gp-border-light)", marginTop: '32px', gap: '24px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 0', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #38BDF8' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--gp-blue-dim)" : "#6B7280",
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: '24px' }}>
        {activeTab === 'Profile' && <ProfileDetails profile={profile} />}
        {activeTab === 'KPIs' && <KPITab profileId={profile.id} />}
        {activeTab === 'Attendance' && <AttendanceTab profileId={profile.id} />}
        {['Goals', 'Reviews', 'Rewards', 'Training', 'Documents'].includes(activeTab) && (
          <div style={{ color: '#6B7280', padding: '24px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)" }}>
            {activeTab} module is under construction...
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileDetails({ profile }) {
  return (
    <div style={{ display: 'flex', gap: '32px' }}>
      <div style={{ flex: 1, background: "var(--gp-card)", padding: '24px', border: "1px solid var(--gp-border-light)" }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px' }}>Personal Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="First Name" defaultValue={profile.first_name} disabled />
          <Input label="Last Name" defaultValue={profile.last_name} disabled />
          <Input label="Phone" defaultValue={profile.phone || ''} disabled />
        </div>
      </div>
      <div style={{ flex: 1, background: "var(--gp-card)", padding: '24px', border: "1px solid var(--gp-border-light)" }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px' }}>Work Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Department" defaultValue={profile.department || ''} disabled />
          <Input label="Job Title" defaultValue={profile.job_title || ''} disabled />
          <Input label="Date Joined" defaultValue={profile.date_joined || ''} disabled />
        </div>
      </div>
    </div>
  )
}

function KPITab({ profileId }) {
  const { data: kpis = [], isLoading } = useQuery({
    queryKey: ['kpis', profileId],
    queryFn: async () => {
      const { data, error } = await insforge.from('kpis').select('*').eq('profile_id', profileId)
      if (error) throw error
      return data
    },
    enabled: !!profileId
  })

  const columns = [
    { header: 'Title', accessorKey: 'title' },
    { header: 'Target', accessorKey: 'target_value' },
    { header: 'Current', accessorKey: 'current_value' },
    { header: 'Period', accessorKey: 'period', cell: (info) => <span style={{textTransform:'capitalize'}}>{info.getValue()}</span> },
    { 
      header: 'Progress', 
      id: 'progress',
      cell: ({ row }) => {
        const target = row.original.target_value || 1
        const current = row.original.current_value || 0
        const pct = Math.min(100, Math.round((current / target) * 100))
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '8px', background: "var(--gp-border-light)" }}>
              <div style={{ width: `${pct}%`, height: '100%', background: "var(--gp-blue)" }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, width: '40px' }}>{pct}%</span>
          </div>
        )
      }
    },
    { 
      header: 'Actions', 
      id: 'actions',
      cell: () => <Button variant="secondary" size="sm">Update</Button>
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <Button variant="primary">Add KPI</Button>
      </div>
      <DataTable columns={columns} data={kpis} isLoading={isLoading} />
    </div>
  )
}

function AttendanceTab({ profileId }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance', profileId, year, month],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]
      const { data, error } = await insforge
        .from('attendance')
        .select('*')
        .eq('profile_id', profileId)
        .gte('date', startDate)
        .lte('date', endDate)
      if (error) throw error
      return data
    },
    enabled: !!profileId
  })

  // Basic stats
  const stats = { present: 0, absent: 0, late: 0, leave: 0 }
  attendance.forEach(a => {
    if (a.status === 'present') stats.present++
    if (a.status === 'absent') stats.absent++
    if (a.status === 'late') stats.late++
    if (a.status === 'on_leave') stats.leave++
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}</h3>
      </div>
      
      {isLoading ? <Spinner /> : (
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', fontSize: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 8, height: 8, background: '#22C55E' }} /> Present ({stats.present})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 8, height: 8, background: '#EF4444' }} /> Absent ({stats.absent})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 8, height: 8, background: '#F59E0B' }} /> Late ({stats.late})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 8, height: 8, background: "var(--gp-blue)" }} /> Leave ({stats.leave})</div>
        </div>
      )}

      {/* Real calendar grid would go here, omitting for brevity in favor of a table */}
      <DataTable 
        columns={[
          { header: 'Date', accessorKey: 'date' },
          { header: 'Check In', accessorKey: 'check_in_at', cell: info => info.getValue() ? new Date(info.getValue()).toLocaleTimeString() : '-' },
          { header: 'Check Out', accessorKey: 'check_out_at', cell: info => info.getValue() ? new Date(info.getValue()).toLocaleTimeString() : '-' },
          { header: 'Status', accessorKey: 'status', cell: info => <Badge variant="gray">{info.getValue()}</Badge> },
          { header: 'Notes', accessorKey: 'notes' }
        ]} 
        data={attendance} 
        isLoading={isLoading} 
      />
    </div>
  )
}
