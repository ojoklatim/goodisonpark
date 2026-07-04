import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Plus, Trash2, Check } from 'lucide-react'
import { format } from 'date-fns'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function EmployeeView({ company, profile }) {
  const queryClient = useQueryClient()
  const today = todayStr()
  const [newActivity, setNewActivity] = useState('')
  const [plan, setPlan] = useState('')
  const [activities, setActivities] = useState([])

  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['daily_activity_today', profile?.id, today],
    queryFn: async () => {
      const { data, error } = await insforge.from('daily_activity_logs').select('*').eq('profile_id', profile.id).eq('date', today).maybeSingle()
      if (error) throw error
      if (data) {
        setActivities(data.activities || [])
        setPlan(data.plan_for_tomorrow || '')
      }
      return data
    },
    enabled: !!profile?.id
  })

  const { data: history = [] } = useQuery({
    queryKey: ['daily_activity_history', profile?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('daily_activity_logs').select('*').eq('profile_id', profile.id).order('date', { ascending: false }).limit(14)
      if (error) throw error
      return data || []
    },
    enabled: !!profile?.id
  })

  const submitLog = useMutation({
    mutationFn: async () => {
      const { error } = await insforge.from('daily_activity_logs').upsert([{
        company_id: company.id,
        profile_id: profile.id,
        date: today,
        activities,
        plan_for_tomorrow: plan,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      }], { onConflict: 'profile_id,date' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['daily_activity_today', profile?.id, today])
      queryClient.invalidateQueries(['daily_activity_history', profile?.id])
    }
  })

  const isReviewed = todayLog?.status === 'reviewed'

  const addActivity = () => {
    if (!newActivity.trim()) return
    setActivities(prev => [...prev, { id: Date.now().toString(), text: newActivity.trim(), completed: true }])
    setNewActivity('')
  }

  const toggleActivity = (id) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, completed: !a.completed } : a))
  }

  const removeActivity = (id) => {
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  if (isLoading) return null

  return (
    <div>
      <div style={{ background: 'var(--gp-card)', border: '1px solid var(--gp-border-light)', padding: '24px', maxWidth: '700px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: 'var(--gp-black)' }}>Today's Activity — {format(new Date(), 'MMM d, yyyy')}</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--gp-muted)' }}>
          List what you worked on today, then add your plan for tomorrow before you submit.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            value={newActivity}
            onChange={e => setNewActivity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addActivity())}
            placeholder="e.g. Visited 3 client sites in Nakawa"
            disabled={isReviewed}
            style={{ flex: '1 1 200px', minWidth: 0, padding: '8px 12px', border: '1px solid var(--gp-border-light)', borderRadius: 0, background: 'var(--gp-background)', color: 'var(--gp-black)', fontSize: '13px' }}
          />
          <Button type="button" variant="secondary" onClick={addActivity} disabled={isReviewed}><Plus size={16} /></Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {activities.length === 0 && <p style={{ fontSize: '13px', color: 'var(--gp-muted)' }}>No activities added yet.</p>}
          {activities.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', border: '1px solid var(--gp-border-light)' }}>
              <input type="checkbox" checked={a.completed} onChange={() => toggleActivity(a.id)} disabled={isReviewed} />
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--gp-black)', textDecoration: a.completed ? 'none' : 'line-through', opacity: a.completed ? 1 : 0.6 }}>{a.text}</span>
              {!isReviewed && (
                <button onClick={() => removeActivity(a.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>

        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gp-muted)', display: 'block', marginBottom: '6px' }}>Plan for Tomorrow</label>
        <textarea
          value={plan}
          onChange={e => setPlan(e.target.value)}
          disabled={isReviewed}
          placeholder="What do you plan to focus on tomorrow?"
          style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid var(--gp-border-light)', borderRadius: 0, background: 'var(--gp-background)', color: 'var(--gp-black)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />

        {todayLog?.admin_feedback && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--gp-background)', border: '1px solid var(--gp-border-light)' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 600, color: 'var(--gp-black)' }}>Admin Feedback</p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--gp-muted)' }}>{todayLog.admin_feedback}</p>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {isReviewed && <Badge variant="active">Reviewed</Badge>}
          <Button variant="primary" onClick={() => submitLog.mutate()} disabled={submitLog.isPending || isReviewed}>
            {isReviewed ? 'Submitted & Reviewed' : submitLog.isPending ? 'Saving…' : todayLog ? 'Update Submission' : 'Submit for Today'}
          </Button>
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gp-black)', marginBottom: '12px' }}>Past Submissions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.filter(h => h.date !== today).map(h => (
            <div key={h.id} style={{ background: 'var(--gp-card)', border: '1px solid var(--gp-border-light)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gp-black)' }}>{format(new Date(h.date), 'MMM d, yyyy')}</span>
                <span style={{ fontSize: '12px', color: 'var(--gp-muted)', marginLeft: '10px' }}>{(h.activities || []).length} activities logged</span>
              </div>
              <Badge variant={h.status === 'reviewed' ? 'active' : 'amber'}>{h.status}</Badge>
            </div>
          ))}
          {history.filter(h => h.date !== today).length === 0 && <p style={{ fontSize: '13px', color: 'var(--gp-muted)' }}>No past submissions yet.</p>}
        </div>
      </div>
    </div>
  )
}

function AdminView({ company }) {
  const queryClient = useQueryClient()
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(todayStr())
  const [reviewingLog, setReviewingLog] = useState(null)
  const [feedback, setFeedback] = useState('')

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('profiles').select('id, first_name, last_name').eq('company_id', company?.id)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id
  })

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['daily_activity_logs_admin', company?.id, dateFilter],
    queryFn: async () => {
      let query = insforge.from('daily_activity_logs').select('*, profiles(first_name, last_name)').eq('company_id', company?.id)
      if (dateFilter) query = query.eq('date', dateFilter)
      const { data, error } = await query.order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id
  })

  const filteredLogs = employeeFilter ? logs.filter(l => l.profile_id === employeeFilter) : logs

  const markReviewed = useMutation({
    mutationFn: async ({ id, admin_feedback }) => {
      const { error } = await insforge.from('daily_activity_logs').update({
        status: 'reviewed',
        admin_feedback,
        reviewed_at: new Date().toISOString()
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['daily_activity_logs_admin', company?.id, dateFilter])
      setReviewingLog(null)
      setFeedback('')
    }
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '12px', color: 'var(--gp-muted)', display: 'block', marginBottom: '6px' }}>Date</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--gp-border-light)', borderRadius: 0, background: 'var(--gp-card)', color: 'var(--gp-black)', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Select label="Employee" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
            options={[{ value: '', label: 'All Employees' }, ...profiles.map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))]} />
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--gp-muted)', fontSize: '14px' }}>Loading…</p>
      ) : filteredLogs.length === 0 ? (
        <div style={{ background: 'var(--gp-card)', border: '1px solid var(--gp-border-light)', padding: '32px', textAlign: 'center', color: 'var(--gp-muted)', fontSize: '14px' }}>
          No activity logs for this date.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredLogs.map(log => (
            <div key={log.id} style={{ background: 'var(--gp-card)', border: '1px solid var(--gp-border-light)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--gp-black)' }}>{log.profiles?.first_name} {log.profiles?.last_name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--gp-muted)', marginLeft: '10px' }}>{format(new Date(log.date), 'MMM d, yyyy')}</span>
                </div>
                <Badge variant={log.status === 'reviewed' ? 'active' : 'amber'}>{log.status}</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                {(log.activities || []).map(a => (
                  <div key={a.id} style={{ fontSize: '13px', color: 'var(--gp-black)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {a.completed ? <Check size={13} color="#22C55E" /> : <span style={{ width: 13 }} />}
                    <span style={{ textDecoration: a.completed ? 'none' : 'line-through', opacity: a.completed ? 1 : 0.6 }}>{a.text}</span>
                  </div>
                ))}
                {(!log.activities || log.activities.length === 0) && <span style={{ fontSize: '13px', color: 'var(--gp-muted)' }}>No activities logged.</span>}
              </div>
              {log.plan_for_tomorrow && (
                <p style={{ fontSize: '13px', color: 'var(--gp-muted)', margin: '0 0 10px 0' }}><strong style={{ color: 'var(--gp-black)' }}>Plan for tomorrow:</strong> {log.plan_for_tomorrow}</p>
              )}
              {log.admin_feedback && (
                <p style={{ fontSize: '13px', color: 'var(--gp-muted)', margin: '0 0 10px 0' }}><strong style={{ color: 'var(--gp-black)' }}>Your feedback:</strong> {log.admin_feedback}</p>
              )}
              {log.status !== 'reviewed' && (
                <Button size="sm" variant="secondary" onClick={() => { setReviewingLog(log); setFeedback('') }}>Review</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!reviewingLog} onClose={() => setReviewingLog(null)} title={`Review — ${reviewingLog?.profiles?.first_name || ''} ${reviewingLog?.profiles?.last_name || ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--gp-muted)', display: 'block', marginBottom: '6px' }}>Feedback (optional)</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Any comments for this submission..."
              style={{ width: '100%', minHeight: '90px', padding: '8px 12px', border: '1px solid var(--gp-border-light)', borderRadius: 0, background: 'var(--gp-background)', color: 'var(--gp-black)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setReviewingLog(null)}>Cancel</Button>
            <Button variant="primary" disabled={markReviewed.isPending}
              onClick={() => markReviewed.mutate({ id: reviewingLog.id, admin_feedback: feedback })}>
              Mark Reviewed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function DailyActivity() {
  const { company, profile, role } = useAuth()
  const isManager = role === 'company_admin' || role === 'manager'

  return (
    <div>
      <PageHeader title="Daily Activity" subtitle={isManager ? 'Review field activity logs submitted by your team' : 'Log what you worked on today and your plan for tomorrow'} />
      <div style={{ marginTop: '24px' }}>
        {isManager ? <AdminView company={company} /> : <EmployeeView company={company} profile={profile} />}
      </div>
    </div>
  )
}
