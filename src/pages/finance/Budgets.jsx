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
import { StatCard } from '../../components/ui/StatCard'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { PlusCircle, Edit2, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react'

const fmt = (n) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n || 0)

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const LAST_6_MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date()
  d.setMonth(d.getMonth() - (5 - i))
  return d.toLocaleString('default', { month: 'short', year: '2-digit' })
})

function getBudgetStatus(pct) {
  if (pct >= 90) return { label: 'Over Budget', color: 'red' }
  if (pct >= 75) return { label: 'Warning', color: 'amber' }
  return { label: 'On Track', color: 'green' }
}

function ProgressBar({ pct }) {
  const color = pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : "var(--gp-blue)"
  return (
    <div style={{ background: "var(--gp-border-light)", height: 8, borderRadius: 0, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
    </div>
  )
}

const EMPTY_FORM = {
  department_id: '',
  category: '',
  amount: '',
  currency: 'UGX',
  period: '',
  start_date: '',
  end_date: '',
}

export function Budgets() {
  const { company } = useAuth()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editBudget, setEditBudget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedBudget, setSelectedBudget] = useState(null)

  // Queries
  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['budgets', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('budgets')
        .select('*, dept:departments!department_id(name)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
      return data || []
    },
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge.from('departments').select('id, name').eq('company_id', company.id)
      return data || []
    },
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('expenses')
        .select('amount, category, department_id, expense_date, status')
        .eq('company_id', company.id)
      return data || []
    },
  })

  // Compute spent per budget (client-side)
  function computeSpent(budget) {
    return expenses
      .filter(
        (e) =>
          e.department_id === budget.department_id &&
          (!budget.category || e.category === budget.category)
      )
      .reduce((acc, e) => acc + (e.amount || 0), 0)
  }

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editBudget) {
        await insforge.from('budgets').update(payload).eq('id', editBudget.id)
      } else {
        await insforge.from('budgets').insert([{ ...payload, company_id: company.id }])
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['budgets', company?.id])
      setShowModal(false)
      setEditBudget(null)
      setForm(EMPTY_FORM)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await insforge.from('budgets').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries(['budgets', company?.id]),
  })

  function openNew() {
    setEditBudget(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(budget) {
    setEditBudget(budget)
    setForm({
      department_id: budget.department_id || '',
      category: budget.category || '',
      amount: budget.amount || '',
      currency: budget.currency || 'UGX',
      period: budget.period || '',
      start_date: budget.start_date || '',
      end_date: budget.end_date || '',
    })
    setShowModal(true)
  }

  function handleSave() {
    saveMutation.mutate({
      department_id: form.department_id,
      category: form.category,
      amount: parseFloat(form.amount) || 0,
      currency: form.currency,
      period: form.period,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    })
  }

  // Export CSV
  function exportCSV() {
    const headers = ['Department', 'Category', 'Period', 'Budget', 'Spent', 'Remaining', '% Used', 'Status']
    const rows = budgets.map((b) => {
      const spent = computeSpent(b)
      const pct = b.amount ? (spent / b.amount) * 100 : 0
      const status = getBudgetStatus(pct).label
      return [
        b.dept?.name || '',
        b.category || '',
        b.period || '',
        b.amount,
        spent.toFixed(0),
        (b.amount - spent).toFixed(0),
        pct.toFixed(1) + '%',
        status,
      ]
    })
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'budgets.csv'
    a.click()
  }

  // Detail panel data
  const detailBudget = selectedBudget
    ? budgets.find((b) => b.id === selectedBudget)
    : null
  const detailExpenses = detailBudget
    ? expenses.filter(
        (e) =>
          e.department_id === detailBudget.department_id &&
          (!detailBudget.category || e.category === detailBudget.category)
      )
    : []

  // Category breakdown for detail
  const categoryBreakdown = detailExpenses.reduce((acc, e) => {
    const key = e.category || 'Uncategorised'
    acc[key] = (acc[key] || 0) + (e.amount || 0)
    return acc
  }, {})
  const categoryData = Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value }))

  // Budget vs Actual – last 6 months (mock fill)
  const lineData = LAST_6_MONTHS.map((month, i) => ({
    month,
    Budget: detailBudget?.amount || 0,
    Actual: detailExpenses
      .filter((e) => {
        if (!e.expense_date) return false
        const d = new Date(e.expense_date)
        const target = new Date()
        target.setMonth(target.getMonth() - (5 - i))
        return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear()
      })
      .reduce((s, e) => s + (e.amount || 0), 0),
  }))

  const columns = [
    {
      key: 'department',
      header: 'Department',
      render: (_, b) => b.dept?.name || '—',
    },
    { key: 'category', header: 'Category', render: (_, b) => b.category || '—' },
    { key: 'period', header: 'Period', render: (_, b) => b.period || '—' },
    { key: 'amount', header: 'Budget', render: (_, b) => fmt(b.amount) },
    {
      key: 'spent',
      header: 'Spent',
      render: (_, b) => fmt(computeSpent(b)),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (_, b) => {
        const rem = b.amount - computeSpent(b)
        return (
          <span style={{ color: rem < 0 ? '#EF4444' : '#10B981' }}>{fmt(rem)}</span>
        )
      },
    },
    {
      key: 'pct',
      header: '% Used',
      render: (_, b) => {
        const pct = b.amount ? (computeSpent(b) / b.amount) * 100 : 0
        return (
          <div style={{ minWidth: 80 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>
              {pct.toFixed(1)}%
            </span>
            <ProgressBar pct={pct} />
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, b) => {
        const pct = b.amount ? (computeSpent(b) / b.amount) * 100 : 0
        const { label, color } = getBudgetStatus(pct)
        const colorMap = { green: '#10B981', amber: '#F59E0B', red: '#EF4444' }
        return (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 0,
              fontSize: 11,
              fontWeight: 600,
              background: colorMap[color] + '22',
              color: colorMap[color],
              border: `1px solid ${colorMap[color]}44`,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, b) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(b) }}
            style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer', padding: 4 }}
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(b.id) }}
            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedBudget((prev) => (prev === b.id ? null : b.id))
            }}
            style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4 }}
          >
            {selectedBudget === b.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      ),
    },
  ]

  const tooltipStyle = {
    contentStyle: { background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', borderRadius: 0 },
    labelStyle: { color: '#9CA3AF' },
    itemStyle: { color: 'var(--gp-black)' },
  }

  return (
    <div style={{ background: "var(--gp-background)", minHeight: "100vh", color: "var(--gp-black)", padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <PageHeader
        title="Budget Tracking"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={exportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', borderRadius: 0,
                color: '#9CA3AF', cursor: 'pointer', fontSize: 13,
              }}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={openNew}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: "var(--gp-blue)", border: 'none', borderRadius: 0,
                color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}
            >
              <PlusCircle size={14} /> New Budget
            </button>
          </div>
        }
      />

      {loadingBudgets ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}>
          <Spinner />
        </div>
      ) : (
        <>
          <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', borderRadius: 0, marginTop: 24 }}>
            <DataTable
              columns={columns}
              data={budgets}
              onRowClick={(b) => setSelectedBudget((prev) => (prev === b.id ? null : b.id))}
            />
          </div>

          {/* Expanded detail panel */}
          {detailBudget && (
            <div
              style={{
                background: "var(--gp-dark)", border: '1px solid var(--gp-border-light)', borderRadius: 0,
                marginTop: 16, padding: 24,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {detailBudget.dept?.name} {detailBudget.category ? `— ${detailBudget.category}` : ''}
                  </h3>
                  <p style={{ color: '#9CA3AF', margin: '4px 0 0', fontSize: 13 }}>Period: {detailBudget.period || 'N/A'}</p>
                </div>
                <button
                  onClick={() => setSelectedBudget(null)}
                  style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer' }}
                >
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* Big Progress Bar */}
              {(() => {
                const spent = computeSpent(detailBudget)
                const pct = detailBudget.amount ? (spent / detailBudget.amount) * 100 : 0
                const color = pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : "var(--gp-blue)"
                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#9CA3AF', fontSize: 13 }}>
                        Spent: <strong style={{ color: 'var(--gp-black)' }}>{fmt(spent)}</strong> of {fmt(detailBudget.amount)}
                      </span>
                      <span style={{ color, fontWeight: 700, fontSize: 13 }}>{pct.toFixed(1)}% Used</span>
                    </div>
                    <div style={{ background: "var(--gp-border-light)", height: 8, borderRadius: 0, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: '#4B5563', fontSize: 11 }}>0</span>
                      <span style={{ color: '#4B5563', fontSize: 11 }}>{fmt(detailBudget.amount)}</span>
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Category Horizontal BarChart */}
                <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: 16 }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#9CA3AF', fontWeight: 600 }}>Expenses by Category</h4>
                  {categoryData.length === 0 ? (
                    <p style={{ color: '#4B5563', fontSize: 13 }}>No expense data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
                        <Bar dataKey="value" radius={0}>
                          {categoryData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Budget vs Actual LineChart */}
                <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: 16 }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#9CA3AF', fontWeight: 600 }}>Budget vs Actual (6 Months)</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={lineData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                      <Line type="monotone" dataKey="Budget" stroke="var(--gp-blue)" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                      <Line type="monotone" dataKey="Actual" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Related Expenses List */}
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#9CA3AF', fontWeight: 600 }}>Related Expenses</h4>
                {detailExpenses.length === 0 ? (
                  <p style={{ color: '#4B5563', fontSize: 13 }}>No related expenses found.</p>
                ) : (
                  <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                          {['Date', 'Category', 'Amount', 'Status'].map((h) => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#9CA3AF', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailExpenses.slice(0, 20).map((e, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                            <td style={{ padding: '10px 14px' }}>{e.expense_date || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#9CA3AF' }}>{e.category || '—'}</td>
                            <td style={{ padding: '10px 14px' }}>{fmt(e.amount)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ padding: '2px 8px', fontSize: 11, background: "var(--gp-border-light)", color: '#9CA3AF' }}>
                                {e.status || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* New/Edit Budget Modal */}
      {showModal && (
        <Modal
          title={editBudget ? 'Edit Budget' : 'New Budget'}
          onClose={() => { setShowModal(false); setEditBudget(null); setForm(EMPTY_FORM) }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            <div>
              <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Department</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                style={{
                  width: '100%', background: "var(--gp-background)", border: '1px solid var(--gp-border-light)',
                  borderRadius: 0, color: 'var(--gp-black)', padding: '8px 12px', fontSize: 13,
                }}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Category (optional)</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Marketing, Salaries"
                style={{
                  width: '100%', background: "var(--gp-background)", border: '1px solid var(--gp-border-light)',
                  borderRadius: 0, color: 'var(--gp-black)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Amount (UGX)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                style={{
                  width: '100%', background: "var(--gp-background)", border: '1px solid var(--gp-border-light)',
                  borderRadius: 0, color: 'var(--gp-black)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Period</label>
              <input
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                placeholder="e.g. Q1 2026, Jan 2026"
                style={{
                  width: '100%', background: "var(--gp-background)", border: '1px solid var(--gp-border-light)',
                  borderRadius: 0, color: 'var(--gp-black)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  style={{
                    width: '100%', background: "var(--gp-background)", border: '1px solid var(--gp-border-light)',
                    borderRadius: 0, color: 'var(--gp-black)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
                    colorScheme: 'dark',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  style={{
                    width: '100%', background: "var(--gp-background)", border: '1px solid var(--gp-border-light)',
                    borderRadius: 0, color: 'var(--gp-black)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
                    colorScheme: 'dark',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                onClick={() => { setShowModal(false); setEditBudget(null); setForm(EMPTY_FORM) }}
                style={{
                  flex: 1, padding: '9px 0', background: "var(--gp-card)", border: '1px solid var(--gp-border-light)',
                  borderRadius: 0, color: '#9CA3AF', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isLoading}
                style={{
                  flex: 1, padding: '9px 0', background: "var(--gp-blue)", border: 'none',
                  borderRadius: 0, color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}
              >
                {saveMutation.isLoading ? 'Saving…' : editBudget ? 'Update Budget' : 'Create Budget'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
