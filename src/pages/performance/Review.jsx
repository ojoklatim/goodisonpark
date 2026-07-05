import React, { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'

function currentQuarterLabel(offset = 0) {
  const now = new Date()
  let quarter = Math.floor(now.getMonth() / 3) + 1
  let year = now.getFullYear()
  quarter -= offset
  while (quarter < 1) { quarter += 4; year -= 1 }
  return `Q${quarter} ${year}`
}

export function Review() {
  const { id } = useParams() // Review ID if editing/viewing
  const [searchParams] = useSearchParams()
  const defaultEmpId = searchParams.get('employee_id') || ''
  
  const { company, user } = useAuth()
  const navigate = useNavigate()
  
  const [status, setStatus] = useState('draft')
  const [selectedEmp, setSelectedEmp] = useState(defaultEmpId)
  const [period, setPeriod] = useState(currentQuarterLabel())
  
  const [kpiScores, setKpiScores] = useState({})
  const [compScores, setCompScores] = useState({})
  const [comments, setComments] = useState({ strengths: '', areas: '', goals: '', overrideReason: '' })
  const [overrideScore, setOverrideScore] = useState(false)
  const [manualScore, setManualScore] = useState('')

  const competencies = ['Communication', 'Teamwork', 'Initiative', 'Technical Skills', 'Attendance']

  const { data: employees = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('profiles').select('id, first_name, last_name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', selectedEmp],
    queryFn: async () => {
      const { data, error } = await insforge.from('kpis').select('*').eq('profile_id', selectedEmp)
      if (error) throw error
      return data
    },
    enabled: !!selectedEmp
  })

  // Calculation
  let calculatedScore = 0
  if (kpis.length > 0 || competencies.length > 0) {
    let totalKpiScore = 0
    kpis.forEach(k => {
      totalKpiScore += Number(kpiScores[k.id] || 3)
    })
    const avgKpiScore = kpis.length > 0 ? totalKpiScore / kpis.length : 0

    let totalCompScore = 0
    competencies.forEach(c => {
      totalCompScore += Number(compScores[c] || 3)
    })
    const avgCompScore = totalCompScore / competencies.length

    // Weight 60% KPI, 40% Competencies
    calculatedScore = (avgKpiScore * 0.6) + (avgCompScore * 0.4)
  }

  const finalScore = overrideScore && manualScore ? Number(manualScore) : calculatedScore

  const saveMutation = useMutation({
    mutationFn: async (submitStatus) => {
      const payload = {
        company_id: company.id,
        profile_id: selectedEmp,
        reviewer_id: user.id,
        period,
        overall_score: finalScore,
        strengths: comments.strengths,
        areas_for_improvement: comments.areas,
        goals_for_next_period: comments.goals,
        status: submitStatus,
      }
      const { error } = await insforge.from('performance_reviews').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      navigate('/dashboard/performance')
    }
  })

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader 
        title={id ? `Performance Review` : `New Performance Review`} 
        subtitle="Evaluation"
        action={<Badge variant={status === 'draft' ? 'default' : 'active'} label={status.toUpperCase()} />}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '32px' }}>
        
        {/* Employee Selection */}
        <div style={{ background: 'var(--gp-card)', padding: '24px', border: "1px solid var(--gp-border-light)", display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <Select 
              label="Select Employee to Review"
              value={selectedEmp}
              onChange={e => setSelectedEmp(e.target.value)}
              options={[
                { value: '', label: '-- Select Employee --' },
                ...employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))
              ]}
            />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <Select
              label="Review Period"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              options={[0, 1, 2, 3].map(offset => ({ value: currentQuarterLabel(offset), label: currentQuarterLabel(offset) }))}
            />
          </div>
        </div>

        {selectedEmp && (
          <>
            {/* Section 1: KPI Evaluation */}
            <section>
              <h3 style={{ fontSize: '18px', fontWeight: 600, borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px', marginBottom: '16px' }}>
                Section 1: KPI Evaluation
              </h3>
              {kpisLoading ? <Spinner /> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: "var(--gp-background)", color: "var(--gp-black)" }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>KPI Title</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Target</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Achieved</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Score (1-5)</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Weight %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.length === 0 ? (
                      <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#6B7280' }}>No KPIs assigned.</td></tr>
                    ) : kpis.map(kpi => (
                      <tr key={kpi.id} style={{ borderBottom: "1px solid var(--gp-border-light)" }}>
                        <td style={{ padding: '12px' }}>{kpi.title}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{kpi.target_value}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{kpi.current_value}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <select 
                            style={{ padding: '6px', border: '1px solid #D1D5DB', borderRadius: 0, width: '60px' }} 
                            value={kpiScores[kpi.id] || 3}
                            onChange={e => setKpiScores({...kpiScores, [kpi.id]: e.target.value})}
                          >
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{Math.round(100 / kpis.length)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Section 2: Core Competencies */}
            <section>
              <h3 style={{ fontSize: '18px', fontWeight: 600, borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px', marginBottom: '16px' }}>
                Section 2: Core Competencies
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {competencies.map(comp => (
                  <div key={comp} style={{ display: 'flex', gap: '24px', alignItems: 'center', background: '#F9FAFB', padding: '16px', border: "1px solid var(--gp-border-light)" }}>
                    <div style={{ width: '200px', fontWeight: 600 }}>{comp}</div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {[1,2,3,4,5].map(n => (
                        <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name={`comp_${comp}`} 
                            value={n} 
                            checked={(compScores[comp] || 3) == n}
                            onChange={() => setCompScores({...compScores, [comp]: n})}
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input placeholder="Comments (optional)" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: Manager Comments */}
            <section>
              <h3 style={{ fontSize: '18px', fontWeight: 600, borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px', marginBottom: '16px' }}>
                Section 3: Manager Comments
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Strengths</label>
                  <textarea value={comments.strengths} onChange={e => setComments({...comments, strengths: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 0 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Areas for Improvement</label>
                  <textarea value={comments.areas} onChange={e => setComments({...comments, areas: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 0 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Goals for Next Period</label>
                  <textarea value={comments.goals} onChange={e => setComments({...comments, goals: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 0 }} />
                </div>
              </div>
            </section>

            {/* Section 4: Overall Score */}
            <section style={{ background: "var(--gp-background)", color: "var(--gp-black)", padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Section 4: Overall Evaluation</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div>
                  <div style={{ fontSize: '48px', fontWeight: 800, color: "var(--gp-blue)", lineHeight: 1 }}>{finalScore.toFixed(1)}</div>
                  <div style={{ fontSize: '14px', color: '#9CA3AF', marginTop: '4px' }}>out of 5.0</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                    <input type="checkbox" checked={overrideScore} onChange={e => setOverrideScore(e.target.checked)} />
                    Override calculated score
                  </label>
                  {overrideScore && (
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <Input type="number" min="1" max="5" step="0.1" value={manualScore} onChange={e => setManualScore(e.target.value)} placeholder="Score (1-5)" style={{ background: "var(--gp-card)", color: 'var(--gp-black)', border: '1px solid var(--gp-border-light)', width: '120px' }} />
                      <Input value={comments.overrideReason} onChange={e => setComments({...comments, overrideReason: e.target.value})} placeholder="Reason for override..." style={{ background: "var(--gp-card)", color: 'var(--gp-black)', border: '1px solid var(--gp-border-light)', flex: 1 }} />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px', marginBottom: '64px' }}>
              <Button variant="secondary" onClick={() => saveMutation.mutate('draft')} disabled={saveMutation.isPending}>Save Draft</Button>
              <Button variant="primary" onClick={() => saveMutation.mutate('submitted')} disabled={saveMutation.isPending}>Submit Review</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
