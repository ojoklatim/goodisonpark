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
import { Spinner } from '../../components/ui/Spinner'

const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'compassionate', 'unpaid']
const LEAVE_COLORS = {
  annual: "var(--gp-blue)", sick: '#EF4444', maternity: '#A855F7',
  paternity: '#3B82F6', compassionate: '#F59E0B', unpaid: '#6B7280'
}

function calcDays(start, end) {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
}

function fmt(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function Leave() {
  const { company, user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('requests')
  const [showModal, setShowModal] = useState(false)
  const [calDate, setCalDate] = useState(new Date())

  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })

  const isManager = ['manager', 'company_admin', 'super_admin', 'team_leader'].includes(profile?.role)

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leave_requests', company?.id],
    queryFn: async () => {
      let q = insforge.from('leave_requests')
        .select(`*, employee:profiles!profile_id(first_name, last_name, department, avatar_url)`)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (!isManager) q = q.eq('profile_id', user?.id)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const requestLeave = useMutation({
    mutationFn: async (payload) => {
      // Insert leave request
      const { data: lr, error } = await insforge.from('leave_requests').insert([payload]).select().single()
      if (error) throw error
      // Insert approval record
      await insforge.from('approvals').insert([{
        company_id: company.id,
        requested_by: user.id,
        type: 'leave',
        reference_id: lr.id,
        reference_table: `${fmt(payload.leave_type)} Leave Request`,
        status: 'pending'
      }])
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['leave_requests', company?.id])
      queryClient.invalidateQueries(['approvals', company?.id])
      setShowModal(false)
      setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
    }
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await insforge.from('leave_requests')
        .update({ status, approved_by: user.id })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['leave_requests', company?.id])
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    requestLeave.mutate({
      company_id: company.id,
      profile_id: user.id,
      ...form,
      days_count: calcDays(form.start_date, form.end_date),
      status: 'pending'
    })
  }

  const columns = [
    { header: 'Employee', accessorKey: 'employee', cell: info => {
      const e = info.getValue()
      return e ? `${e.first_name} ${e.last_name}` : '-'
    }},
    { header: 'Leave Type', accessorKey: 'leave_type', cell: info => (
      <Badge variant="default" label={fmt(info.getValue())} />
    )},
    { header: 'Start', accessorKey: 'start_date', cell: info => info.getValue() },
    { header: 'End', accessorKey: 'end_date', cell: info => info.getValue() },
    { header: 'Days', accessorKey: 'days_count', cell: info => info.getValue() || '-' },
    { header: 'Status', accessorKey: 'status', cell: info => {
      const v = info.getValue()
      return <Badge variant={v === 'approved' ? 'success' : v === 'rejected' ? 'inactive' : 'active'} label={fmt(v)} />
    }},
    { header: 'Actions', id: 'actions', cell: info => {
      const row = info.row.original
      if (isManager && row.status === 'pending') {
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => updateStatus.mutate({ id: row.id, status: 'approved' })} style={{ background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
            <button onClick={() => updateStatus.mutate({ id: row.id, status: 'rejected' })} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
          </div>
        )
      }
      return <span style={{ color: '#6B7280', fontSize: '13px' }}>{fmt(row.status)}</span>
    }}
  ]

  // Calendar logic
  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const approvedLeaves = leaves.filter(l => l.status === 'approved')

  const getLeavesForDay = (dayNum) => {
    const d = new Date(year, month, dayNum)
    return approvedLeaves.filter(l => {
      const s = new Date(l.start_date)
      const e = new Date(l.end_date)
      return d >= s && d <= e
    })
  }

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Manage employee leave requests and balances"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>Request Leave</Button>}
      />

      <div style={{ display: 'flex', gap: '24px', borderBottom: "1px solid var(--gp-border-light)", marginTop: '24px', marginBottom: '24px' }}>
        {['requests', 'calendar'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--gp-blue-dim)" : "#6B7280", borderBottom: tab === t ? '2px solid #38BDF8' : '2px solid transparent', textTransform: 'capitalize' }}>
            {t === 'requests' ? 'Leave Requests' : 'Leave Calendar'}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <DataTable columns={columns} data={leaves} isLoading={isLoading} />
      )}

      {tab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '18px' }}>
              {calDate.toLocaleString('default', { month: 'long' })} {year}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setCalDate(new Date(year, month - 1, 1))}>Prev</Button>
              <Button variant="secondary" onClick={() => setCalDate(new Date(year, month + 1, 1))}>Next</Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {LEAVE_TYPES.map(lt => (
              <div key={lt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <div style={{ width: 12, height: 12, background: LEAVE_COLORS[lt] }} />
                {fmt(lt)}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: "var(--gp-border-light)", border: "1px solid var(--gp-border-light)" }}>
            {days.map(d => (
              <div key={d} style={{ background: '#F9FAFB', padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 600 }}>{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} style={{ background: '#F9FAFB', minHeight: '100px' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayLeaves = getLeavesForDay(day)
              return (
                <div key={day} style={{ background: "var(--gp-card)", padding: '8px', minHeight: '100px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>{day}</div>
                  {dayLeaves.map(l => (
                    <div key={l.id} title={`${l.employee?.first_name} ${l.employee?.last_name}`}
                      style={{ background: LEAVE_COLORS[l.leave_type] + '22', borderLeft: `2px solid ${LEAVE_COLORS[l.leave_type]}`, padding: '2px 4px', fontSize: '10px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.employee?.first_name} ({fmt(l.leave_type)})
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Request Leave">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Leave Type"
            value={form.leave_type}
            onChange={e => setForm({ ...form, leave_type: e.target.value })}
            options={LEAVE_TYPES.map(lt => ({ value: lt, label: fmt(lt) }))}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required /></div>
            <div style={{ flex: 1 }}><Input label="End Date" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required /></div>
          </div>
          {form.start_date && form.end_date && (
            <div style={{ fontSize: '14px', color: "var(--gp-blue)", fontWeight: 600 }}>
              Duration: {calcDays(form.start_date, form.end_date)} working day(s)
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600 }}>Reason</label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief reason for leave..."
              style={{ width: '100%', minHeight: '80px', padding: '10px', border: '1px solid #D1D5DB', borderRadius: 0, resize: 'vertical', fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={requestLeave.isPending}>{requestLeave.isPending ? 'Submitting...' : 'Submit Request'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
