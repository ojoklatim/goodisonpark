import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import { X, Calendar, Phone, Mail, FileText, CheckCircle, UploadCloud, Download } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

const STAGES = [
  { id: 'new_lead', label: 'New Lead', color: "var(--gp-blue)" },
  { id: 'contacted', label: 'Contacted', color: '#9CA3AF' },
  { id: 'negotiation', label: 'Negotiation', color: '#F59E0B' },
  { id: 'proposal', label: 'Proposal', color: '#A78BFA' },
  { id: 'closed_won', label: 'Closed Won', color: '#22C55E' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#EF4444' }
]

export function DealDrawer({ dealId, onClose }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [uploading, setUploading] = useState(false)

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      if (!dealId) return null
      const { data, error } = await insforge
        .from('deals')
        .select(`*, profiles!deals_assigned_to_fkey(id, first_name, last_name)`)
        .eq('id', dealId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!dealId
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['deal_activities', dealId],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('deal_activities')
        .select(`*, profiles(first_name, last_name)`)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!dealId
  })

  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations', dealId],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('quotations')
        .select('*')
        .eq('deal_id', dealId)
      if (error) throw error
      return data
    },
    enabled: !!dealId && activeTab === 'quotations'
  })

  // We reuse documents for files, where category='deal' and deal_id matches? Wait, schema doesn't have deal_id on documents.
  // The prompt says "Files tab: Drag-and-drop file upload zone, List of uploaded files". 
  // We can just query `documents` where tags contains `deal:${dealId}`.
  const { data: files = [] } = useQuery({
    queryKey: ['deal_files', dealId],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('documents')
        .select('*')
        .contains('tags', [`deal:${dealId}`])
      if (error) throw error
      return data
    },
    enabled: !!dealId && activeTab === 'files'
  })

  const updateDeal = useMutation({
    mutationFn: async (newData) => {
      const { error } = await insforge.from('deals').update(newData).eq('id', dealId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['deal', dealId])
      queryClient.invalidateQueries(['deals'])
    }
  })

  const logActivity = useMutation({
    mutationFn: async (newData) => {
      const { error } = await insforge.from('deal_activities').insert([{ ...newData, deal_id: dealId }])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['deal_activities', dealId])
    }
  })

  const uploadFile = useMutation({
    mutationFn: async (file) => {
      const fileExt = file.name.split('.').pop()
      const filePath = `deals/${dealId}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await insforge.storage.from('documents').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: urlData } = insforge.storage.from('documents').getPublicUrl(filePath)
      
      const { error: docError } = await insforge.from('documents').insert([{
        company_id: deal.company_id,
        title: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        tags: [`deal:${dealId}`]
      }])
      if (docError) throw docError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['deal_files', dealId])
      setUploading(false)
    }
  })

  if (!dealId) return null

  const getStageColor = (s) => STAGES.find(x => x.id === s)?.color || '#9CA3AF'
  const getStageLabel = (s) => STAGES.find(x => x.id === s)?.label || s

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 299 }} onClick={onClose} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: '480px', background: "var(--gp-card)", borderLeft: "1px solid var(--gp-border-light)", zIndex: 300, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)' }}>
        
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: "1px solid var(--gp-border-light)", display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: "var(--gp-black)" }}>{deal?.title || 'Loading...'}</h2>
            {deal && <Badge style={{ backgroundColor: getStageColor(deal.stage), color: '#FFF' }}>{getStageLabel(deal.stage)}</Badge>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: "1px solid var(--gp-border-light)" }}>
          {['overview', 'activities', 'quotations', 'files'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #38BDF8' : '2px solid transparent',
                color: activeTab === tab ? "var(--gp-blue-dim)" : "#6B7280",
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <>
              {activeTab === 'overview' && <OverviewTab deal={deal} updateDeal={updateDeal} />}
              {activeTab === 'activities' && <ActivitiesTab activities={activities} logActivity={logActivity} />}
              {activeTab === 'quotations' && <QuotationsTab quotations={quotations} />}
              {activeTab === 'files' && <FilesTab files={files} uploadFile={uploadFile} uploading={uploading} setUploading={setUploading} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function OverviewTab({ deal, updateDeal }) {
  const [formData, setFormData] = useState({
    title: deal.title,
    value: deal.value,
    probability: deal.probability,
    expected_close_date: deal.expected_close_date || '',
    notes: deal.notes || ''
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); updateDeal.mutate(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Stage visualizer */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {STAGES.map(s => (
          <div 
            key={s.id} 
            onClick={() => updateDeal.mutate({ stage: s.id })}
            style={{
              flex: '1 1 auto',
              padding: '8px 4px',
              textAlign: 'center',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              background: deal.stage === s.id ? "var(--gp-blue)" : '#F3F4F6',
              color: deal.stage === s.id ? '#FFF' : '#6B7280',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: deal.stage === s.id ? "var(--gp-blue)" : "var(--gp-border-light)"
            }}
          >
            {s.label}
          </div>
        ))}
      </div>

      <Input label="Deal Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Input label="Value (UGX)" type="number" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
        <Input label="Probability (%)" type="number" min="0" max="100" value={formData.probability} onChange={e => setFormData({...formData, probability: e.target.value})} />
      </div>
      
      <Input label="Expected Close Date" type="date" value={formData.expected_close_date} onChange={e => setFormData({...formData, expected_close_date: e.target.value})} />
      
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: 'var(--gp-black)' }}>Notes</label>
        <textarea 
          value={formData.notes} 
          onChange={e => setFormData({...formData, notes: e.target.value})}
          style={{ width: '100%', minHeight: '100px', border: '1px solid #D1D5DB', padding: '8px', borderRadius: 0, fontFamily: 'inherit', fontSize: '14px' }}
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        <Button type="submit" variant="primary" style={{ width: '100%' }} disabled={updateDeal.isPending}>
          {updateDeal.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

function ActivitiesTab({ activities, logActivity }) {
  const [formData, setFormData] = useState({
    type: 'note',
    title: '',
    description: '',
    completed_at: new Date().toISOString()
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Form */}
      <div style={{ background: '#F9FAFB', border: "1px solid var(--gp-border-light)", padding: '16px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Log Activity</h4>
        <form onSubmit={e => { e.preventDefault(); logActivity.mutate(formData); setFormData({ type: 'note', title: '', description: '', completed_at: new Date().toISOString() }); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} options={[
            {value: 'note', label: 'Note'}, {value: 'call', label: 'Call'}, {value: 'email', label: 'Email'}, {value: 'meeting', label: 'Meeting'}
          ]} />
          <Input placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          <textarea 
            placeholder="Description..." 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})}
            style={{ width: '100%', minHeight: '60px', border: '1px solid #D1D5DB', padding: '8px', borderRadius: 0, fontFamily: 'inherit', fontSize: '14px' }}
          />
          <Button type="submit" variant="primary" disabled={logActivity.isPending}>
            {logActivity.isPending ? 'Saving...' : 'Log Activity'}
          </Button>
        </form>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activities.map(act => {
          const Icon = act.type === 'call' ? Phone : act.type === 'email' ? Mail : act.type === 'meeting' ? Calendar : FileText;
          return (
            <div key={act.id} style={{ display: 'flex', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color="#4B5563" />
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: 'var(--gp-black)' }}>{act.title || act.type}</p>
                {act.description && <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#4B5563' }}>{act.description}</p>}
                <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
                  {act.profiles?.first_name} {act.profiles?.last_name} • {formatDistanceToNow(new Date(act.created_at))} ago
                </p>
              </div>
            </div>
          )
        })}
        {activities.length === 0 && <p style={{ color: '#6B7280', fontSize: '14px', textAlign: 'center' }}>No activities logged yet.</p>}
      </div>
    </div>
  )
}

function QuotationsTab({ quotations }) {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Button variant="primary" style={{ width: '100%' }}>Create Quotation</Button>
      </div>
      {quotations.length === 0 ? (
        <p style={{ color: '#6B7280', fontSize: '14px', textAlign: 'center' }}>No quotations generated.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {quotations.map(q => (
            <div key={q.id} style={{ border: "1px solid var(--gp-border-light)", padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '14px' }}>{q.quotation_number}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>Total: UGX {Number(q.total).toLocaleString()}</p>
              </div>
              <Badge variant={q.status === 'accepted' ? 'active' : q.status === 'draft' ? 'gray' : 'blue'}>{q.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilesTab({ files, uploadFile, uploading, setUploading }) {
  return (
    <div>
      <div style={{ 
        border: '2px dashed #D1D5DB', 
        padding: '32px', 
        textAlign: 'center', 
        background: '#F9FAFB',
        marginBottom: '24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
      }}>
        <UploadCloud size={32} color="#9CA3AF" />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Upload new file</p>
        <input 
          type="file" 
          onChange={(e) => {
            if (e.target.files[0]) {
              setUploading(true)
              uploadFile.mutate(e.target.files[0])
            }
          }}
          disabled={uploading}
          style={{ fontSize: '12px', marginTop: '8px' }}
        />
        {uploading && <p style={{ margin: 0, fontSize: '12px', color: "var(--gp-blue)" }}>Uploading...</p>}
      </div>

      {files.length === 0 ? (
        <p style={{ color: '#6B7280', fontSize: '14px', textAlign: 'center' }}>No files uploaded.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: "1px solid var(--gp-border-light)" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={20} color="#9CA3AF" />
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 500, color: 'var(--gp-black)' }}>{f.title}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{format(new Date(f.created_at), 'MMM dd, yyyy')}</p>
                </div>
              </div>
              <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color: "var(--gp-blue)" }}><Download size={16} /></a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
