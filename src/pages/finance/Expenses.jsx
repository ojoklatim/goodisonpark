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

const CATEGORIES = ['Travel', 'Office Supplies', 'Meals', 'Software', 'Equipment', 'Marketing', 'Utilities', 'Other']
const THRESHOLD = 500000

function fmt(s) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'
}

function currencyFmt(n) {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n || 0)
}

export function Expenses() {
  const { company, user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [rejectModal, setRejectModal] = useState({ show: false, id: null, notes: '' })

  const [filters, setFilters] = useState({ status: '', category: '', department_id: '' })
  const [form, setForm] = useState({ category: 'Travel', description: '', amount: '', currency: 'UGX', date: new Date().toISOString().split('T')[0], receipt_url: '' })

  const isManager = ['manager', 'company_admin', 'super_admin', 'team_leader'].includes(profile?.role)

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('expenses')
        .select(`*, submitter:profiles!submitted_by(first_name, last_name, department), dept:departments!department_id(name)`)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('departments').select('id, name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const submitExpense = useMutation({
    mutationFn: async (payload) => {
      const amount = parseFloat(payload.amount)
      // Insert expense
      const { data: exp, error } = await insforge.from('expenses').insert([{
        company_id: company.id,
        submitted_by: user.id,
        category: payload.category,
        description: payload.description,
        amount,
        currency: payload.currency,
        date: payload.date,
        receipt_url: payload.receipt_url || null,
        status: isManager ? 'approved' : 'pending'
      }]).select().single()
      if (error) throw error

      // Create approval request if above threshold
      if (amount > THRESHOLD && !isManager) {
        await insforge.from('approvals').insert([{
          company_id: company.id,
          requested_by: user.id,
          type: 'expense',
          reference_id: exp.id,
          reference_table: `Expense: ${payload.description || payload.category}`,
          status: 'pending'
        }])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['expenses', company?.id])
      setShowSubmitModal(false)
      setForm({ category: 'Travel', description: '', amount: '', currency: 'UGX', date: new Date().toISOString().split('T')[0], receipt_url: '' })
    }
  })

  const updateExpense = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await insforge.from('expenses').update({ ...updates, approved_by: user.id }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['expenses', company?.id])
      setRejectModal({ show: false, id: null, notes: '' })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    submitExpense.mutate(form)
  }

  const handleReject = (e) => {
    e.preventDefault()
    updateExpense.mutate({ id: rejectModal.id, updates: { status: 'rejected', description: rejectModal.notes } })
  }

  const exportCSV = () => {
    const filtered = filteredExpenses
    const header = ['ID', 'Employee', 'Department', 'Category', 'Description', 'Amount', 'Currency', 'Date', 'Status']
    const rows = filtered.map(e => [
      e.id.slice(0, 8),
      `${e.submitter?.first_name} ${e.submitter?.last_name}`,
      e.submitter?.department || e.dept?.name || '-',
      e.category, e.description || '',
      e.amount, e.currency, e.date, e.status
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `expenses_report.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filteredExpenses = expenses.filter(e => {
    if (filters.status && e.status !== filters.status) return false
    if (filters.category && e.category !== filters.category) return false
    if (filters.department_id && e.department_id !== filters.department_id) return false
    return true
  })

  const columns = [
    { header: '#', accessorKey: 'id', cell: info => <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{info.getValue().slice(0, 8)}</span> },
    { header: 'Employee', accessorKey: 'submitter', cell: info => info.getValue() ? <span style={{ fontWeight: 600 }}>{info.getValue().first_name} {info.getValue().last_name}</span> : '-' },
    { header: 'Category', accessorKey: 'category', cell: info => <Badge variant="default" label={info.getValue()} /> },
    { header: 'Description', accessorKey: 'description', cell: info => <span style={{ color: '#4B5563', fontSize: '13px' }}>{info.getValue() || '-'}</span> },
    { header: 'Amount', accessorKey: 'amount', cell: info => <span style={{ fontWeight: 700 }}>{currencyFmt(info.getValue())}</span> },
    { header: 'Date', accessorKey: 'date', cell: info => new Date(info.getValue()).toLocaleDateString() },
    { header: 'Receipt', accessorKey: 'receipt_url', cell: info => info.getValue() ? <a href={info.getValue()} target="_blank" rel="noreferrer" style={{ color: "var(--gp-blue)" }}>View</a> : <span style={{ color: '#9CA3AF', fontSize: '12px' }}>None</span> },
    { header: 'Status', accessorKey: 'status', cell: info => {
      const v = info.getValue()
      return <Badge variant={v === 'approved' || v === 'paid' ? 'success' : v === 'rejected' ? 'inactive' : 'active'} label={fmt(v)} />
    }},
    { header: 'Actions', id: 'actions', cell: info => {
      const row = info.row.original
      if (!isManager || row.status !== 'pending') {
        return row.status === 'approved' ? (
          <button onClick={() => updateExpense.mutate({ id: row.id, updates: { status: 'paid' } })} style={{ background: 'none', border: 'none', color: '#A855F7', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Mark Paid</button>
        ) : null
      }
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => updateExpense.mutate({ id: row.id, updates: { status: 'approved' } })} style={{ background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
          <button onClick={() => setRejectModal({ show: true, id: row.id, notes: '' })} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
        </div>
      )
    }}
  ]

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Submit and manage company expense claims"
        action={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={exportCSV}>Export CSV</Button>
            <Button variant="primary" onClick={() => setShowSubmitModal(true)}>Submit Expense</Button>
          </div>
        }
      />

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '24px', marginBottom: '20px' }}>
        {[
          { label: 'Pending', value: expenses.filter(e => e.status === 'pending').length, color: '#F59E0B' },
          { label: 'Approved', value: currencyFmt(expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0)), color: '#22C55E' },
          { label: 'Paid', value: currencyFmt(expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0)), color: "var(--gp-blue)" },
          { label: 'Rejected', value: expenses.filter(e => e.status === 'rejected').length, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px', border: "1px solid var(--gp-border-light)", background: "var(--gp-card)" }}>
            <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
        <div style={{ width: '160px' }}>
          <Select label="Status" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            options={[{ value: '', label: 'All Statuses' }, ...['pending','approved','rejected','paid'].map(s => ({ value: s, label: fmt(s) }))]} />
        </div>
        <div style={{ width: '180px' }}>
          <Select label="Category" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}
            options={[{ value: '', label: 'All Categories' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} />
        </div>
        <div style={{ width: '180px' }}>
          <Select label="Department" value={filters.department_id} onChange={e => setFilters({ ...filters, department_id: e.target.value })}
            options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
        </div>
        {(filters.status || filters.category || filters.department_id) && (
          <button onClick={() => setFilters({ status: '', category: '', department_id: '' })} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer', fontWeight: 600, fontSize: '13px', paddingBottom: '4px' }}>
            Clear
          </button>
        )}
      </div>

      <DataTable columns={columns} data={filteredExpenses} isLoading={isLoading} />

      {/* Submit Modal */}
      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Submit Expense">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 2 }}><Input label="Amount" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
            <div style={{ flex: 1 }}>
              <Select label="Currency" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                options={['UGX','USD','EUR','GBP','KES'].map(c => ({ value: c, label: c }))} />
            </div>
          </div>
          {form.amount && parseFloat(form.amount) > THRESHOLD && (
            <div style={{ padding: '10px', background: '#FEF3C7', border: '1px solid #F59E0B', fontSize: '13px', color: '#92400E' }}>
              ⚠️ Amount exceeds approval threshold — an approval request will be created automatically.
            </div>
          )}
          <Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
          <Input label="Receipt URL" type="url" value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitExpense.isPending}>{submitExpense.isPending ? 'Submitting...' : 'Submit'}</Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.show} onClose={() => setRejectModal({ show: false, id: null, notes: '' })} title="Reject Expense">
        <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Rejection Reason" value={rejectModal.notes} onChange={e => setRejectModal({ ...rejectModal, notes: e.target.value })} required />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setRejectModal({ show: false, id: null, notes: '' })}>Cancel</Button>
            <Button type="submit" variant="primary" style={{ background: '#EF4444', borderColor: '#EF4444' }}>Reject</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
