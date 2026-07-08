import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'

function fmt(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function Announcements() {
  const { company, user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [expandedIds, setExpandedIds] = useState([])

  const [form, setForm] = useState({
    title: '', content: '', audience: 'all', audience_filter: '', is_pinned: false, expires_at: ''
  })

  const isManager = ['manager', 'company_admin', 'super_admin', 'team_leader'].includes(profile?.role)

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('announcements')
        .select(`*, author:profiles!created_by(first_name, last_name, job_title)`)
        .eq('company_id', company?.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const createAnnouncement = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('announcements').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements', company?.id])
      setShowModal(false)
      setForm({ title: '', content: '', audience: 'all', audience_filter: '', is_pinned: false, expires_at: '' })
    }
  })

  const deleteAnnouncement = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('announcements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['announcements', company?.id])
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createAnnouncement.mutate({
      company_id: company.id,
      created_by: user.id,
      title: form.title,
      content: form.content,
      audience: form.audience,
      audience_filter: form.audience_filter || null,
      is_pinned: form.is_pinned,
      expires_at: form.expires_at || null
    })
  }

  const toggleExpand = (id) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const TRUNCATE_LENGTH = 300

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Company-wide communications and updates"
        action={isManager ? <Button variant="primary" onClick={() => setShowModal(true)}>New Announcement</Button> : null}
      />

      {isLoading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px', maxWidth: '800px' }}>
          {announcements.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', background: '#F9FAFB', border: '1px dashed #D1D5DB', color: '#6B7280' }}>
              No announcements yet.
            </div>
          )}
          {announcements.map(ann => {
            const isExpanded = expandedIds.includes(ann.id)
            const isTruncated = ann.content.length > TRUNCATE_LENGTH
            const displayContent = isTruncated && !isExpanded ? ann.content.slice(0, TRUNCATE_LENGTH) + '...' : ann.content

            return (
              <div
                key={ann.id}
                style={{
                  border: `1px solid ${ann.is_pinned ? "var(--gp-blue)" : "var(--gp-border-light)"}`,
                  borderLeft: `4px solid ${ann.is_pinned ? "var(--gp-blue)" : "var(--gp-border-light)"}`,
                  padding: '24px',
                  background: ann.is_pinned ? 'rgba(56, 189, 248, 0.04)' : 'var(--gp-card)',
                  position: 'relative'
                }}
              >
                {ann.is_pinned && (
                  <div style={{ position: 'absolute', top: '12px', right: '16px', fontSize: '11px', fontWeight: 700, color: "var(--gp-blue)", textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📌 Pinned
                  </div>
                )}

                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: "var(--gp-black)", paddingRight: '80px' }}>{ann.title}</h3>
                <div style={{ fontSize: '13px', color: 'var(--gp-muted)', marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>By <strong>{ann.author?.first_name} {ann.author?.last_name}</strong></span>
                  <span>{new Date(ann.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {ann.audience !== 'all' && <Badge variant="default" label={`${fmt(ann.audience)}: ${ann.audience_filter || ''}`} />}
                </div>

                <p style={{ color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{displayContent}</p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  {isTruncated && (
                    <button onClick={() => toggleExpand(ann.id)} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: 0 }}>
                      {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                  {!isTruncated && <div />}
                  {isManager && ann.created_by === user?.id && (
                    <button 
                      onClick={() => { if (window.confirm('Delete this announcement?')) deleteAnnouncement.mutate(ann.id) }}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#EF4444', 
                        cursor: 'pointer', 
                        fontSize: '13px',
                        fontWeight: 500,
                        padding: '12px',
                        marginRight: '-12px'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isManager && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Announcement">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
            <Input label="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600 }}>Content</label>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                required
                style={{ width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #D1D5DB', borderRadius: 0, resize: 'vertical', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <Select
                  label="Audience"
                  value={form.audience}
                  onChange={e => setForm({ ...form, audience: e.target.value })}
                  options={[{ value: 'all', label: 'All Staff' }, { value: 'department', label: 'By Department' }, { value: 'role', label: 'By Role' }]}
                />
              </div>
              {form.audience !== 'all' && (
                <div style={{ flex: 1 }}>
                  <Input label={form.audience === 'department' ? 'Department Name' : 'Role'} value={form.audience_filter} onChange={e => setForm({ ...form, audience_filter: e.target.value })} />
                </div>
              )}
            </div>
            <Input label="Expires At (optional)" type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} />
              📌 Pin this announcement
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={createAnnouncement.isPending}>
                {createAnnouncement.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
