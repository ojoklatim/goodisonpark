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

export function Training() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [deptFilter, setDeptFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')

  const [form, setForm] = useState({
    profile_id: '', title: '', provider: '', date_completed: '', notes: '', certificate_url: ''
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['training_records', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('training_records')
        .select(`*, employee:profiles!profile_id(first_name, last_name, department)`)
        .eq('company_id', company?.id)
        .order('date_completed', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('profiles')
        .select('id, first_name, last_name, department')
        .eq('company_id', company?.id)
        .eq('is_active', true)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const addRecord = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('training_records').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['training_records', company?.id])
      setShowModal(false)
      setForm({ profile_id: '', title: '', provider: '', date_completed: '', notes: '', certificate_url: '' })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    addRecord.mutate({
      company_id: company.id,
      profile_id: form.profile_id,
      title: form.title,
      provider: form.provider || null,
      date_completed: form.date_completed || null,
      notes: form.notes || null,
      certificate_url: form.certificate_url || null
    })
  }

  const depts = [...new Set(profiles.map(p => p.department).filter(Boolean))]

  const filteredRecords = records.filter(r => {
    const matchDept = !deptFilter || r.employee?.department === deptFilter
    const matchEmp = !employeeFilter || r.profile_id === employeeFilter
    return matchDept && matchEmp
  })

  // Summary stats
  const totalTrainings = records.length
  const certifiedEmployees = new Set(records.filter(r => r.certificate_url).map(r => r.profile_id)).size
  const courseFreq = {}
  records.forEach(r => { courseFreq[r.title] = (courseFreq[r.title] || 0) + 1 })
  const mostPopular = Object.entries(courseFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  const columns = [
    { header: 'Employee', accessorKey: 'employee', cell: info => {
      const e = info.getValue()
      return <span style={{ fontWeight: 600 }}>{e?.first_name} {e?.last_name}</span>
    }},
    { header: 'Department', accessorKey: 'employee', id: 'dept', cell: info => info.getValue()?.department || '-' },
    { header: 'Course Title', accessorKey: 'title', cell: info => <span style={{ fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Provider', accessorKey: 'provider', cell: info => info.getValue() || '-' },
    { header: 'Date', accessorKey: 'date_completed', cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : '-' },
    { header: 'Certificate', accessorKey: 'certificate_url', cell: info => {
      const url = info.getValue()
      if (!url) return <span style={{ color: '#9CA3AF', fontSize: '12px' }}>None</span>
      return <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--gp-blue)", fontSize: '13px' }}>Download</a>
    }},
    { header: 'Notes', accessorKey: 'notes', cell: info => <span style={{ color: '#6B7280', fontSize: '13px' }}>{info.getValue() || '-'}</span> }
  ]

  return (
    <div>
      <PageHeader
        title="Training Records"
        subtitle="Track employee training, certifications and development"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>Add Record</Button>}
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '24px', marginBottom: '24px' }}>
        {[
          { label: 'Total Trainings', value: totalTrainings, color: "var(--gp-blue)" },
          { label: 'Certified Employees', value: certifiedEmployees, color: '#22C55E' },
          { label: 'Most Popular Course', value: mostPopular, color: '#A855F7', isText: true }
        ].map(stat => (
          <div key={stat.label} style={{ padding: '20px', border: "1px solid var(--gp-border-light)", background: "var(--gp-card)" }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: stat.isText ? '16px' : '28px', fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'flex-end' }}>
        <div style={{ width: '200px' }}>
          <Select
            label="Department"
            value={deptFilter}
            onChange={e => { setDeptFilter(e.target.value); setEmployeeFilter('') }}
            options={[{ value: '', label: 'All Departments' }, ...depts.map(d => ({ value: d, label: d }))]}
          />
        </div>
        <div style={{ width: '220px' }}>
          <Select
            label="Employee"
            value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}
            options={[
              { value: '', label: 'All Employees' },
              ...profiles
                .filter(p => !deptFilter || p.department === deptFilter)
                .map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))
            ]}
          />
        </div>
        {(deptFilter || employeeFilter) && (
          <button onClick={() => { setDeptFilter(''); setEmployeeFilter('') }}
            style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer', fontWeight: 600, fontSize: '13px', paddingBottom: '2px' }}>
            Clear Filters
          </button>
        )}
      </div>

      <DataTable columns={columns} data={filteredRecords} isLoading={isLoading} />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Training Record">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Select
            label="Employee"
            value={form.profile_id}
            onChange={e => setForm({ ...form, profile_id: e.target.value })}
            options={[{ value: '', label: '-- Select Employee --' }, ...profiles.map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))]}
            required
          />
          <Input label="Course Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <Input label="Provider / Institution" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} />
          <Input label="Date Completed" type="date" value={form.date_completed} onChange={e => setForm({ ...form, date_completed: e.target.value })} />
          <Input label="Certificate URL" type="url" value={form.certificate_url} onChange={e => setForm({ ...form, certificate_url: e.target.value })} placeholder="https://..." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ width: '100%', minHeight: '80px', padding: '10px', border: '1px solid #D1D5DB', borderRadius: 0, resize: 'vertical', fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={addRecord.isPending}>{addRecord.isPending ? 'Saving...' : 'Add Record'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
