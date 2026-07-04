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

export function SOPs() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [viewSOPModal, setViewSOPModal] = useState({ show: false, sop: null })

  const [formData, setFormData] = useState({ title: '', department_id: '', version: 'v1.0', content: '', status: 'draft' })

  const { data: sops = [], isLoading } = useQuery({
    queryKey: ['sops', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('sops')
        .select(`
          *,
          departments(name),
          reviewer:profiles!reviewed_by(first_name, last_name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('departments').select('id, name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const createSOP = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('sops').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sops', company?.id])
      setShowModal(false)
      setFormData({ title: '', department_id: '', version: 'v1.0', content: '', status: 'draft' })
    }
  })

  const markReviewed = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge
        .from('sops')
        .update({ reviewed_by: user.id, last_reviewed_at: new Date().toISOString(), status: 'active' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sops', company?.id])
      setViewSOPModal({ show: false, sop: null })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createSOP.mutate({
      company_id: company.id,
      title: formData.title,
      department_id: formData.department_id || null,
      version: formData.version,
      content: formData.content,
      status: formData.status
    })
  }

  const columns = [
    { header: 'Title', accessorKey: 'title', cell: info => <span style={{ fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Department', accessorKey: 'departments.name', cell: info => info.getValue() || '-' },
    { header: 'Version', accessorKey: 'version' },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: info => {
        const val = info.getValue()
        return <Badge variant={val === 'active' ? 'active' : val === 'archived' ? 'inactive' : 'default'} label={val.charAt(0).toUpperCase() + val.slice(1)} />
      }
    },
    { header: 'Last Reviewed', accessorKey: 'last_reviewed_at', cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'Never' },
    { header: 'Reviewed By', accessorKey: 'reviewer', cell: info => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : '-' },
    { 
      header: 'Actions', 
      id: 'actions',
      cell: (info) => (
        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setViewSOPModal({ show: true, sop: info.row.original })} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer' }}>View</button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Standard Operating Procedures (SOPs)" 
        subtitle="Manage company guidelines and workflows"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>New SOP</Button>}
      />

      <div style={{ marginTop: '24px' }}>
        <DataTable columns={columns} data={sops} isLoading={isLoading} onRowClick={(sop) => setViewSOPModal({ show: true, sop })} />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New SOP">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="SOP Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          <Select 
            label="Department" 
            value={formData.department_id} 
            onChange={e => setFormData({...formData, department_id: e.target.value})}
            options={[{value: '', label: '-- General / None --'}, ...departments.map(d => ({value: d.id, label: d.name}))]} 
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Version" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} required /></div>
            <div style={{ flex: 1 }}><Select label="Status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} options={[{value: 'draft', label: 'Draft'}, {value: 'active', label: 'Active'}, {value: 'archived', label: 'Archived'}]} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600 }}>Content</label>
            <textarea 
              value={formData.content} 
              onChange={e => setFormData({...formData, content: e.target.value})} 
              style={{ width: '100%', minHeight: '150px', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 0, resize: 'vertical' }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createSOP.isPending}>{createSOP.isPending ? 'Saving...' : 'Save SOP'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={viewSOPModal.show} onClose={() => setViewSOPModal({ show: false, sop: null })} title={viewSOPModal.sop?.title || 'SOP'}>
        {viewSOPModal.sop && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Badge variant="default" label={viewSOPModal.sop.departments?.name || 'General'} />
              <Badge variant="inactive" label={`Version ${viewSOPModal.sop.version}`} />
            </div>
            <div style={{ background: '#F9FAFB', padding: '24px', border: "1px solid var(--gp-border-light)", minHeight: '300px', whiteSpace: 'pre-wrap' }}>
              {viewSOPModal.sop.content || <span style={{ color: '#9CA3AF' }}>No content provided.</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>
                Last reviewed: {viewSOPModal.sop.last_reviewed_at ? new Date(viewSOPModal.sop.last_reviewed_at).toLocaleDateString() : 'Never'}
              </div>
              <Button 
                variant="primary" 
                onClick={() => markReviewed.mutate(viewSOPModal.sop.id)}
                disabled={markReviewed.isPending}
              >
                {markReviewed.isPending ? 'Processing...' : 'Mark as Reviewed'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
