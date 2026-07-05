import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { FileText, Download, RefreshCw, Clock, CheckCircle } from 'lucide-react'

const TYPE_COLORS = {
  Sales: "var(--gp-blue)",
  HR: '#10B981',
  Finance: '#F59E0B',
  Operations: '#8B5CF6',
}

function daysAgoISO(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function toCSV(headers, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
}

function downloadCSV(filename, headers, rows) {
  const csv = toCSV(headers, rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Each report pulls real rows from InsForge for its data. No mock/sample data.
const REPORT_DEFINITIONS = [
  {
    name: 'Weekly Sales Summary',
    type: 'Sales',
    description: 'Deals from the last 7 days: value, stage, and assigned agent',
    schedule: 'Covers last 7 days',
    fetch: async (company) => {
      const { data, error } = await insforge
        .from('deals')
        .select('title, value, stage, expected_close_date, created_at, profiles(first_name, last_name)')
        .eq('company_id', company.id)
        .gte('created_at', daysAgoISO(7))
        .order('created_at', { ascending: false })
      if (error) throw error
      const headers = ['Deal', 'Value (UGX)', 'Stage', 'Expected Close', 'Agent', 'Created']
      const rows = (data || []).map(d => [
        d.title, d.value, d.stage, d.expected_close_date || '',
        d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : '', d.created_at
      ])
      return { headers, rows }
    }
  },
  {
    name: 'Monthly Employee Performance',
    type: 'HR',
    description: 'KPI scores, attendance rate, and latest review per employee this month',
    schedule: 'Covers current calendar month',
    fetch: async (company) => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const [{ data: profiles }, { data: attendance }, { data: reviews }, { data: kpis }] = await Promise.all([
        insforge.from('profiles').select('id, first_name, last_name, department').eq('company_id', company.id).eq('is_active', true),
        insforge.from('attendance').select('profile_id, status').eq('company_id', company.id).gte('date', monthStart),
        insforge.from('performance_reviews').select('profile_id, overall_score, period').eq('company_id', company.id).order('created_at', { ascending: false }),
        insforge.from('kpis').select('profile_id, current_value, target_value').eq('company_id', company.id).eq('period', 'monthly')
      ])
      const headers = ['Employee', 'Department', 'Attendance Rate', 'Latest Review Score', 'Avg KPI Progress']
      const rows = (profiles || []).map(p => {
        const att = (attendance || []).filter(a => a.profile_id === p.id)
        const present = att.filter(a => a.status === 'present' || a.status === 'late').length
        const attRate = att.length ? `${Math.round((present / att.length) * 100)}%` : 'No data'
        const review = (reviews || []).find(r => r.profile_id === p.id)
        const empKpis = (kpis || []).filter(k => k.profile_id === p.id && k.target_value)
        const avgKpi = empKpis.length
          ? `${Math.round(empKpis.reduce((s, k) => s + (k.current_value / k.target_value) * 100, 0) / empKpis.length)}%`
          : 'No data'
        return [`${p.first_name} ${p.last_name}`, p.department || '—', attRate, review?.overall_score ?? 'No data', avgKpi]
      })
      return { headers, rows }
    }
  },
  {
    name: 'Financial P&L Report',
    type: 'Finance',
    description: 'Paid invoice revenue vs approved/paid expenses this month',
    schedule: 'Covers current calendar month',
    fetch: async (company) => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const [{ data: invoices }, { data: expenses }] = await Promise.all([
        insforge.from('invoices').select('invoice_number, total, status, due_date').eq('company_id', company.id).gte('due_date', monthStart),
        insforge.from('expenses').select('category, amount, status, date').eq('company_id', company.id).gte('date', monthStart)
      ])
      const headers = ['Type', 'Reference', 'Category/Status', 'Amount (UGX)', 'Date']
      const rows = [
        ...(invoices || []).map(i => ['Revenue', i.invoice_number, i.status, i.total, i.due_date]),
        ...(expenses || []).map(e => ['Expense', '—', `${e.category} (${e.status})`, e.amount, e.date])
      ]
      const totalRevenue = (invoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
      const totalExpenses = (expenses || []).filter(e => e.status === 'approved' || e.status === 'paid').reduce((s, e) => s + Number(e.amount || 0), 0)
      rows.push(['—', '—', '—', '—', '—'])
      rows.push(['Net Profit', '', '', totalRevenue - totalExpenses, ''])
      return { headers, rows }
    }
  },
  {
    name: 'Department Activity Report',
    type: 'Operations',
    description: 'Project, task, and approval counts by department',
    schedule: 'Current snapshot',
    fetch: async (company) => {
      const [{ data: departments }, { data: projects }, { data: tasks }, { data: approvals }] = await Promise.all([
        insforge.from('departments').select('id, name').eq('company_id', company.id),
        insforge.from('projects').select('id, department_id, status').eq('company_id', company.id),
        insforge.from('tasks').select('project_id, status').eq('company_id', company.id),
        insforge.from('approvals').select('status').eq('company_id', company.id)
      ])
      const headers = ['Department', 'Active Projects', 'Completed Projects', 'Open Tasks', 'Done Tasks']
      const rows = (departments || []).map(dept => {
        const deptProjects = (projects || []).filter(p => p.department_id === dept.id)
        const deptProjectIds = deptProjects.map(p => p.id)
        const deptTasks = (tasks || []).filter(t => deptProjectIds.includes(t.project_id))
        return [
          dept.name,
          deptProjects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length,
          deptProjects.filter(p => p.status === 'completed').length,
          deptTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
          deptTasks.filter(t => t.status === 'done').length
        ]
      })
      const pendingApprovals = (approvals || []).filter(a => a.status === 'pending').length
      rows.push(['—', '—', '—', '—', '—'])
      rows.push([`Company-wide pending approvals: ${pendingApprovals}`, '', '', '', ''])
      return { headers, rows }
    }
  },
]

export function ExportCenter() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [generatingId, setGeneratingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [generatedIds, setGeneratedIds] = useState([])

  const { data: recentDocs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['generated-reports', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('documents')
        .select('id, title, created_at, uploaded_by, metadata')
        .eq('company_id', company.id)
        .eq('category', 'generated_report')
        .order('created_at', { ascending: false })
        .limit(5)
      return data || []
    }
  })

  const generateMutation = useMutation({
    mutationFn: async (report) => {
      const { headers, rows } = await report.fetch(company)
      const { data, error } = await insforge
        .from('documents')
        .insert({
          company_id: company.id,
          title: report.name,
          category: 'generated_report',
          uploaded_by: user.id,
          metadata: { row_count: rows.length, generated_at: new Date().toISOString() }
        })
        .select()
        .single()
      if (error) throw error
      downloadCSV(`${report.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.csv`, headers, rows)
      return data
    },
    onSuccess: (_, report) => {
      queryClient.invalidateQueries({ queryKey: ['generated-reports', company?.id] })
      setGeneratedIds(prev => [...prev, report.name])
    }
  })

  const handleGenerate = async (report) => {
    setGeneratingId(report.name)
    try {
      await generateMutation.mutateAsync(report)
    } finally {
      setGeneratingId(null)
    }
  }

  const handleDownload = async (report) => {
    setDownloadingId(report.name)
    try {
      const { headers, rows } = await report.fetch(company)
      downloadCSV(`${report.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.csv`, headers, rows)
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={{ background: "var(--gp-background)", minHeight: '100vh', padding: '24px' }}>
      <PageHeader title="Report Export Center" />

      <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px', marginBottom: '24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileText size={18} color="var(--gp-blue)" />
          <h3 style={{ color: 'var(--gp-black)', margin: 0, fontSize: '16px', fontWeight: '600' }}>Available Reports</h3>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
              {['Report Name', 'Type', 'Description', 'Coverage', 'Actions'].map(col => (
                <th key={col} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--gp-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REPORT_DEFINITIONS.map((report, idx) => {
              const isGenerating = generatingId === report.name
              const isDownloading = downloadingId === report.name
              const wasGenerated = generatedIds.includes(report.name)
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--gp-border-light)' }}>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={16} color="var(--gp-muted)" />
                      <span style={{ color: 'var(--gp-black)', fontWeight: '500' }}>{report.name}</span>
                      {wasGenerated && <CheckCircle size={14} color="#10B981" />}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <span style={{
                      padding: '3px 10px',
                      background: `${TYPE_COLORS[report.type] || "var(--gp-blue)"}20`,
                      color: TYPE_COLORS[report.type] || "var(--gp-blue)",
                      border: `1px solid ${TYPE_COLORS[report.type] || "var(--gp-blue)"}40`,
                      fontSize: '12px', fontWeight: '600', letterSpacing: '0.03em'
                    }}>{report.type}</span>
                  </td>
                  <td style={{ padding: '14px 12px', color: 'var(--gp-muted)', fontSize: '14px' }}>{report.description}</td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gp-muted)', fontSize: '13px' }}>
                      <Clock size={13} />
                      {report.schedule}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleGenerate(report)}
                        disabled={isGenerating}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px',
                          background: "var(--gp-blue)", color: "#FFFFFF", border: 'none', borderRadius: 0,
                          cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px',
                          opacity: isGenerating ? 0.7 : 1,
                        }}
                      >
                        <RefreshCw size={13} style={isGenerating ? { animation: 'spin 1s linear infinite' } : {}} />
                        {isGenerating ? 'Generating…' : 'Generate & Save'}
                      </button>
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={isDownloading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px',
                          background: "var(--gp-card)", color: 'var(--gp-muted)', border: '1px solid var(--gp-border-light)',
                          borderRadius: 0, cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '13px',
                        }}
                        onMouseOver={e => { e.currentTarget.style.color = 'var(--gp-black)'; e.currentTarget.style.borderColor = "var(--gp-blue)" }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--gp-muted)'; e.currentTarget.style.borderColor = "var(--gp-border-light)" }}
                      >
                        <Download size={13} /> {isDownloading ? 'Preparing…' : 'Download CSV'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ background: "var(--gp-card)", border: '1px solid var(--gp-border-light)', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Clock size={18} color="#F59E0B" />
          <h3 style={{ color: 'var(--gp-black)', margin: 0, fontSize: '16px', fontWeight: '600' }}>Recently Generated</h3>
        </div>

        {docsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
        ) : recentDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gp-muted)', border: '1px dashed var(--gp-border-light)' }}>
            <FileText size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ margin: 0 }}>No reports generated yet. Click 'Generate & Save' on any report above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {recentDocs.map((doc) => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                border: '1px solid var(--gp-border-light)', flexWrap: 'wrap'
              }}>
                <div style={{ width: '36px', height: '36px', background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} color="var(--gp-blue)" />
                </div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ color: 'var(--gp-black)', fontWeight: '500', fontSize: '14px' }}>{doc.title}</div>
                  <div style={{ color: 'var(--gp-muted)', fontSize: '12px', marginTop: '2px' }}>
                    {formatDate(doc.created_at)}{doc.metadata?.row_count !== undefined ? ` · ${doc.metadata.row_count} rows` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
