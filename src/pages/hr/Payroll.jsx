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

function fmt(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function Payroll() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [detailModal, setDetailModal] = useState({ show: false, record: null })
  const [processingAll, setProcessingAll] = useState(false)

  const { data: payrollRecords = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['payroll', company?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('payroll')
        .select(`*, employee:profiles!profile_id(first_name, last_name, department, job_title)`)
        .eq('company_id', company?.id)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

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

  const updatePayroll = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await insforge.from('payroll').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll', company?.id, selectedMonth, selectedYear])
      setDetailModal({ show: false, record: null })
    }
  })

  const handleProcessAll = async () => {
    setProcessingAll(true)
    try {
      // For each profile that doesn't have a record yet, create a draft
      const existingIds = payrollRecords.map(r => r.profile_id)
      const newProfiles = profiles.filter(p => !existingIds.includes(p.id))
      if (newProfiles.length) {
        const records = newProfiles.map(p => ({
          company_id: company.id,
          profile_id: p.id,
          month: selectedMonth,
          year: selectedYear,
          basic_salary: 0,
          allowances: { housing: 0, transport: 0, medical: 0 },
          deductions: { paye: 0, nssf: 0, other: 0 },
          gross_salary: 0,
          net_salary: 0,
          status: 'draft'
        }))
        await insforge.from('payroll').insert(records)
      }
      queryClient.invalidateQueries(['payroll', company?.id, selectedMonth, selectedYear])
    } finally {
      setProcessingAll(false)
    }
  }

  const handleApprove = (record) => {
    updatePayroll.mutate({ id: record.id, updates: { status: 'processed', processed_by: user.id } })
  }

  const handleMarkPaid = (record) => {
    updatePayroll.mutate({ id: record.id, updates: { status: 'paid', paid_at: new Date().toISOString() } })
  }

  const sumAllowances = (allowances) => {
    if (!allowances) return 0
    return Object.values(allowances).reduce((s, v) => s + (Number(v) || 0), 0)
  }

  const sumDeductions = (deductions) => {
    if (!deductions) return 0
    return Object.values(deductions).reduce((s, v) => s + (Number(v) || 0), 0)
  }

  const currencyFmt = (n) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n || 0)

  const columns = [
    { header: 'Employee', accessorKey: 'employee', cell: info => {
      const e = info.getValue()
      return <span style={{ fontWeight: 600 }}>{e?.first_name} {e?.last_name}</span>
    }},
    { header: 'Department', accessorKey: 'employee', id: 'dept', cell: info => info.getValue()?.department || '-' },
    { header: 'Basic', accessorKey: 'basic_salary', cell: info => currencyFmt(info.getValue()) },
    { header: 'Allowances', accessorKey: 'allowances', cell: info => currencyFmt(sumAllowances(info.getValue())) },
    { header: 'Deductions', accessorKey: 'deductions', cell: info => currencyFmt(sumDeductions(info.getValue())) },
    { header: 'Gross', accessorKey: 'gross_salary', cell: info => <span style={{ fontWeight: 600 }}>{currencyFmt(info.getValue())}</span> },
    { header: 'Net', accessorKey: 'net_salary', cell: info => <span style={{ fontWeight: 700, color: '#22C55E' }}>{currencyFmt(info.getValue())}</span> },
    { header: 'Status', accessorKey: 'status', cell: info => {
      const v = info.getValue()
      return <Badge variant={v === 'paid' ? 'success' : v === 'processed' ? 'active' : 'default'} label={fmt(v)} />
    }},
    { header: 'Actions', id: 'actions', cell: info => {
      const row = info.row.original
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setDetailModal({ show: true, record: row })} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer' }}>View</button>
          {row.status === 'draft' && (
            <button onClick={() => handleApprove(row)} style={{ background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer', fontWeight: 600 }}>Process</button>
          )}
          {row.status === 'processed' && (
            <button onClick={() => handleMarkPaid(row)} style={{ background: 'none', border: 'none', color: '#A855F7', cursor: 'pointer', fontWeight: 600 }}>Mark Paid</button>
          )}
        </div>
      )
    }}
  ]

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Manage employee payroll and compensation"
        action={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={handleProcessAll} disabled={processingAll}>
              {processingAll ? 'Processing...' : 'Generate Payroll'}
            </Button>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', marginBottom: '24px', alignItems: 'flex-end' }}>
        <div style={{ width: '180px' }}>
          <Select
            label="Month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          />
        </div>
        <div style={{ width: '120px' }}>
          <Select
            label="Year"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            options={years.map(y => ({ value: y, label: String(y) }))}
          />
        </div>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Gross</div>
            <div style={{ fontWeight: 700, color: "var(--gp-black)" }}>{currencyFmt(payrollRecords.reduce((s, r) => s + (r.gross_salary || 0), 0))}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Net</div>
            <div style={{ fontWeight: 700, color: '#22C55E' }}>{currencyFmt(payrollRecords.reduce((s, r) => s + (r.net_salary || 0), 0))}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Paid</div>
            <div style={{ fontWeight: 700 }}>{payrollRecords.filter(r => r.status === 'paid').length} / {payrollRecords.length}</div>
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={payrollRecords} isLoading={loadingPayroll || loadingProfiles} />

      {/* Detail Modal */}
      {detailModal.record && (
        <Modal isOpen={detailModal.show} onClose={() => setDetailModal({ show: false, record: null })} title="Payroll Detail">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{detailModal.record.employee?.first_name} {detailModal.record.employee?.last_name}</div>
                <div style={{ color: '#6B7280', fontSize: '13px' }}>{detailModal.record.employee?.job_title} — {detailModal.record.employee?.department}</div>
              </div>
              <Badge variant={detailModal.record.status === 'paid' ? 'success' : 'default'} label={fmt(detailModal.record.status)} />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--gp-border-light)" }}>
                  <td style={{ padding: '10px 0', color: '#6B7280' }}>Basic Salary</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{currencyFmt(detailModal.record.basic_salary)}</td>
                </tr>
                {Object.entries(detailModal.record.allowances || {}).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 0', color: '#4B5563', paddingLeft: '16px' }}>+ {fmt(k)} Allowance</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#22C55E' }}>{currencyFmt(v)}</td>
                  </tr>
                ))}
                <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>
                  <td style={{ padding: '10px 0', fontWeight: 700 }}>Gross Salary</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}>{currencyFmt(detailModal.record.gross_salary)}</td>
                </tr>
                {Object.entries(detailModal.record.deductions || {}).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 0', color: '#4B5563', paddingLeft: '16px' }}>- {fmt(k)}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#EF4444' }}>{currencyFmt(v)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#F0FDF4' }}>
                  <td style={{ padding: '12px 0', fontWeight: 800, fontSize: '16px' }}>Net Pay</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, fontSize: '16px', color: '#22C55E' }}>{currencyFmt(detailModal.record.net_salary)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setDetailModal({ show: false, record: null })}>Close</Button>
              {detailModal.record.status === 'draft' && (
                <Button variant="primary" onClick={() => handleApprove(detailModal.record)} disabled={updatePayroll.isPending}>Process</Button>
              )}
              {detailModal.record.status === 'processed' && (
                <Button variant="primary" onClick={() => handleMarkPaid(detailModal.record)} disabled={updatePayroll.isPending}>Mark as Paid</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
