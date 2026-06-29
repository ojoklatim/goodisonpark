import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Download, Printer, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react'

const fmt = (n) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n || 0)

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: "var(--gp-card)", border: '1px solid #2A2A2A', borderRadius: 0,
      padding: 24, marginBottom: 24,
    }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#fff', borderBottom: '1px solid #2A2A2A', paddingBottom: 12 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function MiniStatCard({ label, value, icon: Icon, accent }) {
  return (
    <div style={{
      background: "var(--gp-dark)", border: '1px solid #2A2A2A', borderRadius: 0,
      padding: '16px 20px', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {Icon && <Icon size={15} color={accent || '#9CA3AF'} />}
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{value}</div>
    </div>
  )
}

export function Reports() {
  const { company } = useAuth()

  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'reports-print-style'
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #reports-root, #reports-root * { visibility: visible; }
        #reports-root { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
        @page { margin: 20mm; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('reports-print-style')?.remove()
  }, [])

  const today = new Date()
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const sixMonthsAgo = (() => {
    const d = new Date(today)
    d.setMonth(d.getMonth() - 5)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  const [startMonth, setStartMonth] = useState(sixMonthsAgo)
  const [endMonth, setEndMonth] = useState(firstOfMonth)
  const [deptFilter, setDeptFilter] = useState('')

  // Queries
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices-reports', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('invoices')
        .select('id, total, amount_paid, status, department_id, client_id, due_date, issue_date, clients(name)')
        .eq('company_id', company.id)
      return data || []
    },
  })

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses-reports', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('expenses')
        .select('amount, category, department_id, status, expense_date')
        .eq('company_id', company.id)
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

  // Filter helpers
  function inRange(dateStr) {
    if (!dateStr) return true
    const d = dateStr.substring(0, 7)
    return d >= startMonth && d <= endMonth
  }

  const filteredInvoices = invoices.filter(
    (inv) =>
      inRange(inv.issue_date) &&
      (!deptFilter || inv.department_id === deptFilter)
  )

  const filteredExpenses = expenses.filter(
    (e) =>
      inRange(e.expense_date) &&
      (!deptFilter || e.department_id === deptFilter)
  )

  // Invoice stats
  const totalInvoiced = filteredInvoices.reduce((s, i) => s + (i.total || 0), 0)
  const totalCollected = filteredInvoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + (i.total || 0), 0)
  const outstanding = filteredInvoices
    .filter((i) => ['unpaid', 'partial'].includes(i.status))
    .reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0)
  const writeOffs = filteredInvoices
    .filter((i) => i.status === 'void')
    .reduce((s, i) => s + (i.total || 0), 0)

  // Expense stats
  const totalSubmitted = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalApproved = filteredExpenses
    .filter((e) => ['approved', 'paid'].includes(e.status))
    .reduce((s, e) => s + (e.amount || 0), 0)
  const totalPaid = filteredExpenses
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + (e.amount || 0), 0)

  // Expense by category for pie chart
  const expByCat = filteredExpenses.reduce((acc, e) => {
    const k = e.category || 'Other'
    acc[k] = (acc[k] || 0) + (e.amount || 0)
    return acc
  }, {})
  const pieData = Object.entries(expByCat).map(([name, value]) => ({ name, value }))

  // Dept P&L
  const deptMap = {}
  departments.forEach((d) => { deptMap[d.id] = { id: d.id, name: d.name, revenue: 0, expenses: 0 } })

  filteredInvoices.forEach((inv) => {
    if (inv.department_id && deptMap[inv.department_id]) {
      deptMap[inv.department_id].revenue += inv.total || 0
    }
  })
  filteredExpenses.forEach((e) => {
    if (e.department_id && deptMap[e.department_id]) {
      deptMap[e.department_id].expenses += e.amount || 0
    }
  })

  const deptPL = Object.values(deptMap).map((d) => ({
    ...d,
    net: d.revenue - d.expenses,
    margin: d.revenue > 0 ? ((d.revenue - d.expenses) / d.revenue) * 100 : 0,
  }))

  // Top 10 clients
  const clientRevMap = {}
  filteredInvoices.forEach((inv) => {
    if (!inv.client_id) return
    const name = inv.clients?.name || inv.client_id
    if (!clientRevMap[inv.client_id]) clientRevMap[inv.client_id] = { name, total: 0, count: 0 }
    clientRevMap[inv.client_id].total += inv.total || 0
    clientRevMap[inv.client_id].count += 1
  })
  const top10 = Object.values(clientRevMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // CSV Export
  function exportCSV() {
    const sections = [
      ['Revenue Summary'],
      ['Total Invoiced', totalInvoiced],
      ['Total Collected', totalCollected],
      ['Outstanding', outstanding],
      ['Write-offs', writeOffs],
      [],
      ['Expense Summary'],
      ['Total Submitted', totalSubmitted],
      ['Total Approved', totalApproved],
      ['Total Paid', totalPaid],
      [],
      ['Department P&L'],
      ['Department', 'Revenue', 'Expenses', 'Net', '% Margin'],
      ...deptPL.map((d) => [d.name, d.revenue, d.expenses, d.net, d.margin.toFixed(1) + '%']),
      [],
      ['Top 10 Clients'],
      ['Rank', 'Client', 'Revenue', 'Deals'],
      ...top10.map((c, i) => [i + 1, c.name, c.total, c.count]),
    ]
    const csv = sections.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'revenue-report.csv'
    a.click()
  }

  const isLoading = loadingInvoices || loadingExpenses
  const tooltipStyle = {
    contentStyle: { background: "var(--gp-card)", border: '1px solid #2A2A2A', borderRadius: 0 },
    labelStyle: { color: '#9CA3AF' },
    itemStyle: { color: '#fff' },
  }

  return (
    <div
      id="reports-root"
      style={{ background: "var(--gp-background)", minHeight: "100vh", color: "var(--gp-black)", padding: 24, fontFamily: 'Inter, sans-serif' }}
    >
      <PageHeader
        title="Revenue Reports"
        actions={
          <div style={{ display: 'flex', gap: 10 }} className="no-print">
            <button
              onClick={exportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: "var(--gp-card)", border: '1px solid #2A2A2A', borderRadius: 0,
                color: '#9CA3AF', cursor: 'pointer', fontSize: 13,
              }}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: "var(--gp-blue)", border: 'none', borderRadius: 0,
                color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              }}
            >
              <Printer size={14} /> Export PDF
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div
        className="no-print"
        style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: '14px 18px',
          marginTop: 20, marginBottom: 24,
        }}
      >
        <div>
          <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>From</label>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            style={{
              background: "var(--gp-background)", border: '1px solid #2A2A2A', borderRadius: 0,
              color: '#fff', padding: '6px 10px', fontSize: 13, colorScheme: 'dark',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>To</label>
          <input
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            style={{
              background: "var(--gp-background)", border: '1px solid #2A2A2A', borderRadius: 0,
              color: '#fff', padding: '6px 10px', fontSize: 13, colorScheme: 'dark',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>Department</label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{
              background: "var(--gp-background)", border: '1px solid #2A2A2A', borderRadius: 0,
              color: '#fff', padding: '6px 10px', fontSize: 13, minWidth: 160,
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}><Spinner /></div>
      ) : (
        <>
          {/* Section 1: Revenue Summary */}
          <SectionCard title="Revenue Summary">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <MiniStatCard label="Total Invoiced" value={fmt(totalInvoiced)} icon={DollarSign} accent="var(--gp-blue)" />
              <MiniStatCard label="Total Collected" value={fmt(totalCollected)} icon={TrendingUp} accent="#10B981" />
              <MiniStatCard label="Outstanding" value={fmt(outstanding)} icon={AlertCircle} accent="#F59E0B" />
              <MiniStatCard label="Write-offs" value={fmt(writeOffs)} icon={TrendingDown} accent="#EF4444" />
            </div>
          </SectionCard>

          {/* Section 2: Expense Summary */}
          <SectionCard title="Expense Summary">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
              <MiniStatCard label="Total Submitted" value={fmt(totalSubmitted)} icon={DollarSign} accent="#9CA3AF" />
              <MiniStatCard label="Total Approved" value={fmt(totalApproved)} icon={TrendingUp} accent="#10B981" />
              <MiniStatCard label="Total Paid" value={fmt(totalPaid)} icon={TrendingUp} accent="var(--gp-blue)" />
            </div>
            {pieData.length > 0 && (
              <div>
                <p style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 12 }}>Expenses by Category</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
                    <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          {/* Section 3: Department P&L */}
          <SectionCard title="Department P&L">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2A2A2A' }}>
                    {['Department', 'Revenue', 'Expenses', 'Net', '% Margin'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#9CA3AF', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deptPL.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '20px 14px', color: '#4B5563', textAlign: 'center' }}>No department data</td></tr>
                  ) : (
                    deptPL.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #2A2A2A' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{d.name}</td>
                        <td style={{ padding: '10px 14px', color: '#10B981' }}>{fmt(d.revenue)}</td>
                        <td style={{ padding: '10px 14px', color: '#EF4444' }}>{fmt(d.expenses)}</td>
                        <td style={{ padding: '10px 14px', color: d.net >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                          {fmt(d.net)}
                        </td>
                        <td style={{ padding: '10px 14px', color: d.margin >= 0 ? '#10B981' : '#EF4444' }}>
                          {d.margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Section 4: Top 10 Clients */}
          <SectionCard title="Top 10 Clients by Revenue">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2A2A2A' }}>
                    {['Rank', 'Client Name', 'Total Revenue', 'Deal Count'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#9CA3AF', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top10.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '20px 14px', color: '#4B5563', textAlign: 'center' }}>No client data</td></tr>
                  ) : (
                    top10.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #2A2A2A' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 24, height: 24, background: i < 3 ? '#38BDF822' : "var(--gp-border-light)",
                            color: i < 3 ? "var(--gp-blue)" : '#9CA3AF', fontWeight: 700, fontSize: 12,
                          }}>
                            {i + 1}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '10px 14px', color: '#10B981', fontWeight: 600 }}>{fmt(c.total)}</td>
                        <td style={{ padding: '10px 14px', color: '#9CA3AF' }}>{c.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
