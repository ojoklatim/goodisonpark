import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Download, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Clock } from 'lucide-react'

const fmt = (n) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n || 0)

const CHART_COLORS = ["var(--gp-blue)", '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

// Generate last 6 months as { label, year, month (0-indexed) }
const LAST_6 = Array.from({ length: 6 }, (_, i) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - (5 - i))
  return {
    label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
    year: d.getFullYear(),
    month: d.getMonth(),
  }
})

function StatCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div style={{
      background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', borderRadius: 0,
      padding: '20px 22px', flex: 1, minWidth: 160,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        {Icon && (
          <div style={{ background: (accent || "var(--gp-blue)") + '18', padding: 8, borderRadius: 0 }}>
            <Icon size={14} color={accent || "var(--gp-blue)"} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gp-black)', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', borderRadius: 0 },
  labelStyle: { color: '#9CA3AF' },
  itemStyle: { color: 'var(--gp-black)' },
}

function inCurrentMonth(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export function FinanceDashboard() {
  const { company } = useAuth()
  const today = new Date()

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ['invoices-dash', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('invoices')
        .select('id, total, amount_paid, status, due_date, issue_date, department_id')
        .eq('company_id', company.id)
      return data || []
    },
  })

  const { data: expenses = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expenses-dash', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('expenses')
        .select('amount, category, status, expense_date, department_id')
        .eq('company_id', company.id)
      return data || []
    },
  })

  const isLoading = loadingInv || loadingExp

  // --- Stat Cards ---
  const revenueMTD = invoices
    .filter((i) => i.status === 'paid' && inCurrentMonth(i.issue_date))
    .reduce((s, i) => s + (i.total || 0), 0)

  const expensesMTD = expenses
    .filter((e) => ['approved', 'paid'].includes(e.status) && inCurrentMonth(e.expense_date))
    .reduce((s, e) => s + (e.amount || 0), 0)

  const netMTD = revenueMTD - expensesMTD

  const outstanding = invoices
    .filter((i) => ['unpaid', 'partial'].includes(i.status))
    .reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0)

  const overdue = invoices
    .filter((i) => {
      if (i.status === 'paid') return false
      if (i.status === 'overdue') return true
      if (i.due_date && new Date(i.due_date) < today) return true
      return false
    })
    .reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0)

  // --- Row 2: Revenue vs Expenses BarChart (last 6 months) ---
  const barData = LAST_6.map(({ label, year, month }) => {
    const rev = invoices
      .filter((i) => {
        if (i.status !== 'paid' || !i.issue_date) return false
        const d = new Date(i.issue_date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((s, i) => s + (i.total || 0), 0)

    const exp = expenses
      .filter((e) => {
        if (!['approved', 'paid'].includes(e.status) || !e.expense_date) return false
        const d = new Date(e.expense_date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((s, e) => s + (e.amount || 0), 0)

    return { month: label, Revenue: rev, Expenses: exp }
  })

  // --- Row 2: Expense Breakdown PieChart ---
  const expByCat = expenses.reduce((acc, e) => {
    const k = e.category || 'Other'
    acc[k] = (acc[k] || 0) + (e.amount || 0)
    return acc
  }, {})
  const expPieData = Object.entries(expByCat).map(([name, value]) => ({ name, value }))

  // --- Row 3: Invoice Status Distribution ---
  const statusMap = { paid: 0, unpaid: 0, partial: 0, overdue: 0 }
  invoices.forEach((i) => {
    const s = i.status
    if (s === 'paid') statusMap.paid += i.total || 0
    else if (s === 'unpaid') statusMap.unpaid += (i.total || 0) - (i.amount_paid || 0)
    else if (s === 'partial') statusMap.partial += (i.total || 0) - (i.amount_paid || 0)
    else if (s === 'overdue' || (i.due_date && new Date(i.due_date) < today && s !== 'paid')) {
      statusMap.overdue += (i.total || 0) - (i.amount_paid || 0)
    }
  })
  const statusPieData = [
    { name: 'Paid', value: statusMap.paid },
    { name: 'Unpaid', value: statusMap.unpaid },
    { name: 'Partial', value: statusMap.partial },
    { name: 'Overdue', value: statusMap.overdue },
  ].filter((d) => d.value > 0)

  // --- Row 3: Monthly P&L Table ---
  const plRows = LAST_6.map(({ label, year, month }) => {
    const rev = invoices
      .filter((i) => {
        if (i.status !== 'paid' || !i.issue_date) return false
        const d = new Date(i.issue_date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((s, i) => s + (i.total || 0), 0)

    const exp = expenses
      .filter((e) => {
        if (!['approved', 'paid'].includes(e.status) || !e.expense_date) return false
        const d = new Date(e.expense_date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((s, e) => s + (e.amount || 0), 0)

    const net = rev - exp
    const margin = rev > 0 ? (net / rev) * 100 : 0
    return { label, rev, exp, net, margin }
  })

  // Export P&L CSV
  function exportPLCSV() {
    const headers = ['Month', 'Revenue', 'Expenses', 'Net', '% Margin']
    const rows = plRows.map((r) => [r.label, r.rev, r.exp, r.net, r.margin.toFixed(1) + '%'])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'finance-pl.csv'
    a.click()
  }

  return (
    <div style={{ background: "var(--gp-background)", minHeight: "100vh", color: "var(--gp-black)", padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <PageHeader title="Finance Overview" />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}><Spinner /></div>
      ) : (
        <>
          {/* Row 1: Stat Cards */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24, marginBottom: 24 }}>
            <StatCard
              label="Total Revenue MTD"
              value={fmt(revenueMTD)}
              icon={TrendingUp}
              accent="#10B981"
              sub="Paid invoices this month"
            />
            <StatCard
              label="Total Expenses MTD"
              value={fmt(expensesMTD)}
              icon={TrendingDown}
              accent="#EF4444"
              sub="Approved/paid this month"
            />
            <StatCard
              label="Net Profit MTD"
              value={fmt(netMTD)}
              icon={DollarSign}
              accent={netMTD >= 0 ? '#10B981' : '#EF4444'}
              sub={netMTD >= 0 ? 'Profitable month' : 'Loss this month'}
            />
            <StatCard
              label="Outstanding Invoices"
              value={fmt(outstanding)}
              icon={Clock}
              accent="#F59E0B"
              sub="Unpaid + partial"
            />
            <StatCard
              label="Overdue Amount"
              value={fmt(overdue)}
              icon={AlertTriangle}
              accent="#EF4444"
              sub="Past due date"
            />
          </div>

          {/* Row 2: Bar + Pie */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 24 }}>
            {/* Revenue vs Expenses BarChart */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: 22 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: 'var(--gp-black)' }}>
                Revenue vs Expenses — Last 6 Months
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barGap={4}>
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="var(--gp-blue)" radius={0} />
                  <Bar dataKey="Expenses" fill="#EF4444" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Expense Breakdown PieChart */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: 22 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: 'var(--gp-black)' }}>
                Expense Breakdown
              </h3>
              {expPieData.length === 0 ? (
                <div style={{ color: '#4B5563', fontSize: 13, marginTop: 40, textAlign: 'center' }}>No expense data</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expPieData} dataKey="value" nameKey="name"
                      cx="50%" cy="45%" innerRadius={55} outerRadius={90}
                    >
                      {expPieData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
                    <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Row 3: Invoice Status Pie + P&L Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Invoice Status Distribution */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: 22 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: 'var(--gp-black)' }}>
                Invoice Status Distribution
              </h3>
              {statusPieData.length === 0 ? (
                <div style={{ color: '#4B5563', fontSize: 13, marginTop: 40, textAlign: 'center' }}>No invoice data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusPieData} dataKey="value" nameKey="name"
                      cx="50%" cy="45%" outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusPieData.map((entry, idx) => {
                        const colorMap = { Paid: '#10B981', Unpaid: "var(--gp-blue)", Partial: '#F59E0B', Overdue: '#EF4444' }
                        return <Cell key={idx} fill={colorMap[entry.name] || CHART_COLORS[idx]} />
                      })}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
                    <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Monthly P&L Table */}
            <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: 22 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: 'var(--gp-black)' }}>
                Monthly P&amp;L
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                      {['Month', 'Revenue', 'Expenses', 'Net', '% Margin'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1A1A1A' }}>
                        <td style={{ padding: '9px 10px', color: '#9CA3AF', fontWeight: 500 }}>{r.label}</td>
                        <td style={{ padding: '9px 10px', color: '#10B981' }}>{fmt(r.rev)}</td>
                        <td style={{ padding: '9px 10px', color: '#EF4444' }}>{fmt(r.exp)}</td>
                        <td style={{ padding: '9px 10px', color: r.net >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                          {fmt(r.net)}
                        </td>
                        <td style={{ padding: '9px 10px', color: r.margin >= 0 ? '#10B981' : '#EF4444' }}>
                          {r.margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={exportPLCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                background: "var(--gp-blue)", border: 'none', borderRadius: 0,
                color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              }}
            >
              <Download size={15} /> Export P&L CSV
            </button>
          </div>
        </>
      )}
    </div>
  )
}
