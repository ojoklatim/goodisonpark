import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'

const STATUS_OPTIONS = ['present', 'absent', 'late', 'on_leave']
const STATUS_COLORS = { present: '#22C55E', absent: '#EF4444', late: '#F59E0B', on_leave: "var(--gp-blue)" }

function fmt(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function Attendance() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkStatuses, setBulkStatuses] = useState({})
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7))

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('profiles')
        .select('id, first_name, last_name, department, job_title')
        .eq('company_id', company?.id)
        .eq('is_active', true)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: attendance = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['attendance', company?.id, monthFilter],
    queryFn: async () => {
      const [yr, mo] = monthFilter.split('-').map(Number)
      const startDate = `${monthFilter}-01`
      const endDate = new Date(yr, mo, 0).toISOString().split('T')[0]
      const { data, error } = await insforge
        .from('attendance')
        .select('*')
        .eq('company_id', company?.id)
        .gte('date', startDate)
        .lte('date', endDate)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const bulkMarkAttendance = useMutation({
    mutationFn: async (records) => {
      const { error } = await insforge.from('attendance').upsert(records, { onConflict: 'profile_id,date' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance', company?.id, monthFilter])
      setShowBulkModal(false)
      setBulkStatuses({})
    }
  })

  const handleBulkSave = (e) => {
    e.preventDefault()
    const records = profiles
      .filter(p => bulkStatuses[p.id])
      .map(p => ({
        company_id: company.id,
        profile_id: p.id,
        date: bulkDate,
        status: bulkStatuses[p.id],
        marked_by: user.id
      }))
    if (records.length) bulkMarkAttendance.mutate(records)
  }

  // Compute per-employee monthly stats
  const tableData = profiles.map(p => {
    const empAtt = attendance.filter(a => a.profile_id === p.id)
    const present = empAtt.filter(a => a.status === 'present').length
    const absent = empAtt.filter(a => a.status === 'absent').length
    const late = empAtt.filter(a => a.status === 'late').length
    const onLeave = empAtt.filter(a => a.status === 'on_leave').length
    const totalMarked = empAtt.length
    const rate = totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : null
    return { ...p, present, absent, late, onLeave, rate }
  })

  const columns = [
    { header: 'Employee', accessorKey: 'first_name', cell: info => (
      <span style={{ fontWeight: 600 }}>{info.row.original.first_name} {info.row.original.last_name}</span>
    )},
    { header: 'Department', accessorKey: 'department', cell: info => info.getValue() || '-' },
    { header: 'Present', accessorKey: 'present', cell: info => <span style={{ color: '#22C55E', fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Absent', accessorKey: 'absent', cell: info => <span style={{ color: '#EF4444', fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Late', accessorKey: 'late', cell: info => <span style={{ color: '#F59E0B', fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Leave', accessorKey: 'onLeave', cell: info => <span style={{ color: "var(--gp-blue)", fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Rate', accessorKey: 'rate', cell: info => {
      const v = info.getValue()
      if (v === null) return <span style={{ color: '#9CA3AF' }}>N/A</span>
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '6px', background: "var(--gp-border-light)", minWidth: '60px' }}>
            <div style={{ height: '100%', width: `${v}%`, background: v >= 90 ? '#22C55E' : v >= 75 ? '#F59E0B' : '#EF4444' }} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '30px' }}>{v}%</span>
        </div>
      )
    }}
  ]

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Track employee attendance and punctuality"
        action={<Button variant="primary" onClick={() => setShowBulkModal(true)}>Mark Attendance</Button>}
      />

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', marginBottom: '24px', alignItems: 'center' }}>
        <div>
          <Input
            label="Month"
            type="month"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
          {[
            { label: 'Present', color: '#22C55E', key: 'present' },
            { label: 'Absent', color: '#EF4444', key: 'absent' },
            { label: 'Late', color: '#F59E0B', key: 'late' },
            { label: 'Leave', color: "var(--gp-blue)", key: 'onLeave' }
          ].map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <div style={{ width: 10, height: 10, background: s.color }} />
              {s.label}: <strong>{tableData.reduce((sum, r) => sum + r[s.key], 0)}</strong>
            </div>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={tableData} isLoading={loadingProfiles || loadingAtt} />

      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Mark Attendance">
        <form onSubmit={handleBulkSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Date" type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} required />
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: "1px solid var(--gp-border-light)" }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', borderBottom: "1px solid var(--gp-border-light)" }}>Employee</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', borderBottom: "1px solid var(--gp-border-light)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 16px', fontSize: '14px' }}>{p.first_name} {p.last_name}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <select
                        value={bulkStatuses[p.id] || ''}
                        onChange={e => setBulkStatuses({ ...bulkStatuses, [p.id]: e.target.value })}
                        style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 0, fontSize: '13px', background: "var(--gp-card)", cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="">-- Skip --</option>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fmt(s)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowBulkModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={bulkMarkAttendance.isPending}>
              {bulkMarkAttendance.isPending ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
