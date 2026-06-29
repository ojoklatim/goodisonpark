import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { FileText, Download, RefreshCw, Clock, CheckCircle } from 'lucide-react'

const REPORT_DEFINITIONS = [
  {
    name: 'Weekly Sales Summary',
    type: 'Sales',
    description: 'Revenue, deals, agent performance',
    schedule: 'Auto every Monday',
  },
  {
    name: 'Monthly Employee Performance',
    type: 'HR',
    description: 'KPI scores, attendance, reviews',
    schedule: 'Monthly',
  },
  {
    name: 'Financial P&L Report',
    type: 'Finance',
    description: 'Revenue, expenses, net profit',
    schedule: 'Monthly',
  },
  {
    name: 'Department Activity Report',
    type: 'Operations',
    description: 'Projects, tasks, approvals',
    schedule: 'Weekly',
  },
]

const TYPE_COLORS = {
  Sales: "var(--gp-blue)",
  HR: '#10B981',
  Finance: '#F59E0B',
  Operations: '#8B5CF6',
}

function mockCSVDownload(reportName) {
  const headers = ['Report', 'Generated At', 'Status']
  const row = [reportName, new Date().toISOString(), 'Complete']
  const csv = [headers, row].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportCenter() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [generatingId, setGeneratingId] = useState(null)
  const [generatedIds, setGeneratedIds] = useState([])

  const { data: recentDocs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['generated-reports', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await insforge
        .from('documents')
        .select('id, name, created_at, created_by')
        .eq('company_id', company.id)
        .eq('category', 'generated_report')
        .order('created_at', { ascending: false })
        .limit(5)
      return data || []
    }
  })

  const generateMutation = useMutation({
    mutationFn: async (report) => {
      const { data, error } = await insforge
        .from('documents')
        .insert({
          company_id: company.id,
          name: report.name,
          category: 'generated_report',
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, report) => {
      queryClient.invalidateQueries({ queryKey: ['generated-reports', company?.id] })
      setGeneratedIds(prev => [...prev, report.name])
      window.print()
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={{ background: "var(--gp-background)", minHeight: '100vh', padding: '24px' }}>
      <PageHeader title="Report Export Center" />

      {/* Report Definitions Table */}
      <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileText size={18} color="var(--gp-blue)" />
          <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '600' }}>Available Reports</h3>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2A2A2A' }}>
              {['Report Name','Type','Description','Schedule','Actions'].map(col => (
                <th key={col} style={{ padding: '10px 12px', textAlign: 'left', color: '#4B5563', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REPORT_DEFINITIONS.map((report, idx) => {
              const isGenerating = generatingId === report.name
              const wasGenerated = generatedIds.includes(report.name)
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #2A2A2A' }}>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={16} color="#4B5563" />
                      <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{report.name}</span>
                      {wasGenerated && <CheckCircle size={14} color="#10B981" />}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <span style={{
                      padding: '3px 10px',
                      background: `${TYPE_COLORS[report.type] || "var(--gp-blue)"}20`,
                      color: TYPE_COLORS[report.type] || "var(--gp-blue)",
                      border: `1px solid ${TYPE_COLORS[report.type] || "var(--gp-blue)"}40`,
                      fontSize: '12px',
                      fontWeight: '600',
                      letterSpacing: '0.03em'
                    }}>{report.type}</span>
                  </td>
                  <td style={{ padding: '14px 12px', color: '#9CA3AF', fontSize: '14px' }}>{report.description}</td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4B5563', fontSize: '13px' }}>
                      <Clock size={13} />
                      {report.schedule}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleGenerate(report)}
                        disabled={isGenerating}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 14px',
                          background: "var(--gp-blue)",
                          color: "var(--gp-black)",
                          border: 'none',
                          borderRadius: '0px',
                          cursor: isGenerating ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                          opacity: isGenerating ? 0.7 : 1,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        {isGenerating ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                        {isGenerating ? 'Generating...' : 'Generate Now'}
                      </button>
                      <button
                        onClick={() => mockCSVDownload(report.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 14px',
                          background: "var(--gp-card)",
                          color: '#9CA3AF',
                          border: '1px solid #2A2A2A',
                          borderRadius: '0px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '13px',
                          transition: 'color 0.2s'
                        }}
                        onMouseOver={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = "var(--gp-blue)" }}
                        onMouseOut={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = "var(--gp-border-light)" }}
                      >
                        <Download size={13} /> Download CSV
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recently Generated */}
      <div style={{ background: "var(--gp-card)", border: '1px solid #2A2A2A', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Clock size={18} color="#F59E0B" />
          <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '600' }}>Recently Generated</h3>
        </div>

        {docsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
        ) : recentDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#4B5563', border: '1px dashed #2A2A2A' }}>
            <FileText size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ margin: 0 }}>No reports generated yet. Click 'Generate Now' on any report above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {recentDocs.map((doc, idx) => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px',
                background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: '1px solid #2A2A2A',
                transition: 'background 0.2s'
              }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(56,189,248,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
              >
                <div style={{ width: '36px', height: '36px', background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} color="var(--gp-blue)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#FFFFFF', fontWeight: '500', fontSize: '14px' }}>{doc.name}</div>
                  <div style={{ color: '#4B5563', fontSize: '12px', marginTop: '2px' }}>{formatDate(doc.created_at)}</div>
                </div>
                <button
                  onClick={() => mockCSVDownload(doc.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px',
                    background: 'transparent',
                    color: "var(--gp-blue)",
                    border: '1px solid #38BDF8',
                    borderRadius: '0px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = "var(--gp-blue)"; e.currentTarget.style.color = "var(--gp-white)" }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = "var(--gp-blue)" }}
                >
                  <Download size={12} /> Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
