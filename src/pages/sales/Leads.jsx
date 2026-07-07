import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Search } from 'lucide-react'
import { format } from 'date-fns'

const SOURCES = ['referral', 'website', 'cold_call', 'social_media', 'event']
const STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted']
const PRIORITIES = ['low', 'medium', 'high']

export function Leads() {
  const { company, role, profile } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [convertToDeal, setConvertToDeal] = useState(false)

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', company_name: '',
    source: 'website', priority: 'medium', status: 'new', assigned_to: '', notes: ''
  })

  // Queries
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', company?.id, role, profile?.id],
    queryFn: async () => {
      let query = insforge
        .from('leads')
        .select(`*, profiles!leads_assigned_to_fkey(first_name, last_name)`)
        .eq('company_id', company?.id)
      
      if (role === 'employee') {
        query = query.eq('assigned_to', profile?.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('profiles').select('id, first_name, last_name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const saveLead = useMutation({
    mutationFn: async (newData) => {
      // Ensure empty string assigned_to becomes null for the UUID column
      const payload = { ...newData, assigned_to: newData.assigned_to || null };
      if (role === 'employee') {
        payload.assigned_to = profile?.id
      }
      if (editingLead) {
        const { error } = await insforge.from('leads').update(payload).eq('id', editingLead.id)
        if (error) throw error
        
        if (convertToDeal && newData.status !== 'converted') {
          // Update to converted
          await insforge.from('leads').update({ status: 'converted' }).eq('id', editingLead.id)
          // Create deal
          await insforge.from('deals').insert([{
            company_id: company.id,
            lead_id: editingLead.id,
            title: `${payload.company_name || payload.first_name} Deal`,
            stage: 'new_lead',
            assigned_to: payload.assigned_to
          }])
        }
      } else {
        const { data: leadData, error } = await insforge.from('leads').insert([{ ...payload, company_id: company.id }]).select().single()
        if (error) throw error

        if (convertToDeal) {
          await insforge.from('leads').update({ status: 'converted' }).eq('id', leadData.id)
          await insforge.from('deals').insert([{
            company_id: company.id,
            lead_id: leadData.id,
            title: `${payload.company_name || payload.first_name} Deal`,
            stage: 'new_lead',
            assigned_to: payload.assigned_to
          }])
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', company?.id] })
      queryClient.invalidateQueries({ queryKey: ['deals', company?.id] }) // in case a deal was created
      setIsModalOpen(false)
      setEditingLead(null)
      setConvertToDeal(false)
    },
    onError: (err) => {
      console.error(err)
      alert("Error saving lead: " + err.message)
    }
  })

  const deleteLead = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', company?.id] })
    }
  })

  const openEdit = (lead) => {
    setEditingLead(lead)
    setFormData({
      first_name: lead.first_name, last_name: lead.last_name, email: lead.email || '', phone: lead.phone || '', 
      company_name: lead.company_name || '', source: lead.source || 'website', priority: lead.priority || 'medium', 
      status: lead.status || 'new', assigned_to: lead.assigned_to || '', notes: lead.notes || ''
    })
    setConvertToDeal(false)
    setIsModalOpen(true)
  }

  const filteredLeads = leads.filter(l => {
    const s = search.toLowerCase()
    const matchesSearch = l.first_name.toLowerCase().includes(s) || l.last_name.toLowerCase().includes(s) || (l.company_name || '').toLowerCase().includes(s)
    const matchesStatus = statusFilter ? l.status === statusFilter : true
    const matchesSource = sourceFilter ? l.source === sourceFilter : true
    return matchesSearch && matchesStatus && matchesSource
  })

  const getStatusColor = (s) => {
    switch(s) {
      case 'new': return 'blue'
      case 'contacted': return 'amber'
      case 'qualified': return 'active'
      case 'converted': return 'gray'
      default: return 'gray'
    }
  }

  const getPriorityColor = (p) => p === 'high' ? 'inactive' : p === 'medium' ? 'amber' : 'gray'

  const columns = [
    { header: 'Name', exportValue: row => `${row.first_name} ${row.last_name}`, cell: ({ row }) => <span style={{ fontWeight: 600, color: "var(--gp-black)" }}>{row.original.first_name} {row.original.last_name}</span> },
    { header: 'Company', accessorKey: 'company_name', exportValue: row => row.company_name || '-' },
    { header: 'Email/Phone', exportValue: row => `${row.email || ''} ${row.phone || ''}`.trim() || '-', cell: ({ row }) => <div style={{ fontSize: '12px' }}><div>{row.original.email}</div><div style={{ color: '#6B7280' }}>{row.original.phone}</div></div> },
    { header: 'Source', accessorKey: 'source', exportValue: row => row.source?.replace('_', ' ') || '-', cell: (info) => <span style={{ textTransform: 'capitalize', fontSize: '12px', color: '#4B5563' }}>{info.getValue()?.replace('_', ' ')}</span> },
    { header: 'Status', accessorKey: 'status', exportValue: row => row.status?.replace('_', ' ') || '-', cell: (info) => <Badge variant={getStatusColor(info.getValue())}>{info.getValue()?.replace('_', ' ')}</Badge> },
    { header: 'Priority', accessorKey: 'priority', exportValue: row => row.priority || '-', cell: (info) => <Badge variant={getPriorityColor(info.getValue())}>{info.getValue()}</Badge> },
    { header: 'Assigned To', accessorKey: 'profiles', exportValue: row => row.profiles ? `${row.profiles.first_name} ${row.profiles.last_name}` : 'Unassigned', cell: (info) => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : '-' },
    { header: 'Created', accessorKey: 'created_at', exportValue: row => row.created_at ? format(new Date(row.created_at), 'MMM dd, yyyy') : '-', cell: (info) => { const val = info.getValue(); return val ? format(new Date(val), 'MMM dd, yyyy') : '-' } },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => {
        const lead = row.original
        const isOwner = lead.assigned_to === profile?.id
        const isAdminOrManager = role !== 'employee'
        const canAction = isAdminOrManager || isOwner
        return (
          <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <Button variant="secondary" size="sm" onClick={() => openEdit(lead)} disabled={!canAction}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => { if(window.confirm('Delete lead?')) deleteLead.mutate(lead.id) }} disabled={!canAction}>Del</Button>
          </div>
        )
      }
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Leads" 
        action={<Button variant="primary" onClick={() => { 
          setEditingLead(null); 
          setFormData({first_name: '', last_name: '', email: '', phone: '', company_name: '', source: 'website', priority: 'medium', status: 'new', assigned_to: '', notes: ''}); 
          setConvertToDeal(false);
          setIsModalOpen(true); 
        }}>New Lead</Button>} 
      />

      <div style={{ display: 'flex', gap: '16px', margin: '24px 0' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search leads..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #D1D5DB', borderRadius: 0, fontSize: '14px' }}
          />
        </div>
        <div style={{ width: '150px' }}>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{value: '', label: 'All Statuses'}, ...STATUSES.map(s => ({value: s, label: s.replace('_', ' ')}))]} />
        </div>
        <div style={{ width: '150px' }}>
          <Select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} options={[{value: '', label: 'All Sources'}, ...SOURCES.map(s => ({value: s, label: s.replace('_', ' ')}))]} />
        </div>
      </div>

      <DataTable data={filteredLeads} columns={columns} isLoading={isLoading} onRowClick={openEdit} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLead ? 'Edit Lead' : 'New Lead'} width={640}>
        <form onSubmit={(e) => { e.preventDefault(); saveLead.mutate(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input label="First Name*" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
            <Input label="Last Name*" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required />
            <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <Input label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <Input label="Company Name" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
            <Select label="Source" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} options={SOURCES.map(s => ({value: s, label: s.replace('_', ' ')}))} />
            <Select label="Priority" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} options={PRIORITIES.map(s => ({value: s, label: s}))} />
            <Select label="Assigned To" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} options={[{value: '', label: 'Unassigned'}, ...agents.map(a => ({value: a.id, label: `${a.first_name} ${a.last_name}`}))]} />
          </div>
          
          {editingLead && (
            <Select label="Status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} options={STATUSES.map(s => ({value: s, label: s.replace('_', ' ')}))} />
          )}

          <Textarea 
            label="Notes"
            value={formData.notes} 
            onChange={e => setFormData({...formData, notes: e.target.value})}
            rows={4}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, background: 'var(--gp-card)', color: 'var(--gp-black)', padding: '12px', border: '1px solid var(--gp-border-light)' }}>
            <input 
              type="checkbox" 
              checked={convertToDeal} 
              onChange={e => setConvertToDeal(e.target.checked)}
              disabled={formData.status === 'converted'}
              style={{ width: '16px', height: '16px', borderRadius: 0 }}
            />
            Convert this Lead to a Deal upon saving
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saveLead.isPending}>{saveLead.isPending ? 'Saving...' : 'Save Lead'}</Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
