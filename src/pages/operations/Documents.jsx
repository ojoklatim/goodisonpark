import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { RecordDetailModal } from '../../components/ui/RecordDetailModal'

export function Documents() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const [formData, setFormData] = useState({ title: '', description: '', category: 'hr', is_public: true })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('documents')
        .select(`
          *,
          uploader:profiles!uploaded_by(first_name, last_name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const createDoc = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('documents').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', company?.id])
      setShowUploadModal(false)
      setFormData({ title: '', description: '', category: 'hr', is_public: true })
    }
  })

  const deleteDoc = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', company?.id])
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    // Stub upload for demonstration since actual Supabase storage bucket is not configured
    createDoc.mutate({
      company_id: company.id,
      uploaded_by: user.id,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      is_public_to_company: formData.is_public,
      file_url: 'https://example.com/stub-document.pdf',
      file_type: 'application/pdf',
      file_size: Math.floor(Math.random() * 5000000) + 100000 // Random size
    })
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDoc.mutate(id)
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return '-'
    const mb = bytes / 1024 / 1024
    return mb.toFixed(1) + ' MB'
  }

  const categories = ['All', 'hr', 'finance', 'marketing', 'project', 'other']
  const formatCategory = (c) => c === 'All' ? 'All Documents' : c === 'hr' ? 'HR & Policies' : c.charAt(0).toUpperCase() + c.slice(1)

  const filteredDocs = documents.filter(d => {
    const matchesCat = activeCategory === 'All' || d.category === activeCategory
    const matchesSearch = !search || d.title.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  const columns = [
    { header: 'Title', accessorKey: 'title', cell: info => <span style={{ fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Category', accessorKey: 'category', cell: info => formatCategory(info.getValue()) },
    { header: 'Uploaded By', accessorKey: 'uploader', cell: info => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : '-' },
    { header: 'Date', accessorKey: 'created_at', cell: info => new Date(info.getValue()).toLocaleDateString() },
    { header: 'Size', accessorKey: 'file_size', cell: info => formatSize(info.getValue()) },
    { 
      header: 'Actions', 
      id: 'actions',
      cell: (info) => (
        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => window.open(info.row.original.file_url, '_blank')} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer' }}>Download</button>
          <button onClick={() => handleDelete(info.row.original.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Delete</button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Documents" 
        subtitle="Manage company files and resources"
        action={<Button variant="primary" onClick={() => setShowUploadModal(true)}>Upload Document</Button>}
      />

      <div className="documents-layout" style={{ display: 'flex', gap: '24px', marginTop: '24px' }}>
        <div className="documents-sidebar" style={{ width: '240px', borderRight: "1px solid var(--gp-border-light)", paddingRight: '16px', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--gp-black)' }}>Categories</div>
          <ul className="documents-categories-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.map(cat => (
              <li 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                style={{ 
                  color: activeCategory === cat ? "var(--gp-blue-dim)" : "#6B7280", 
                  fontWeight: activeCategory === cat ? 600 : 400, 
                  cursor: 'pointer' 
                }}
              >
                {formatCategory(cat)}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '16px' }}>
            <Input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <DataTable columns={columns} data={filteredDocs} isLoading={isLoading} onRowClick={setSelectedDoc} />

          <RecordDetailModal
            isOpen={!!selectedDoc}
            onClose={() => setSelectedDoc(null)}
            title={selectedDoc?.title || 'Document'}
            fields={selectedDoc ? [
              { label: 'Category', value: formatCategory(selectedDoc.category) },
              { label: 'Uploaded By', value: selectedDoc.uploader ? `${selectedDoc.uploader.first_name} ${selectedDoc.uploader.last_name}` : null },
              { label: 'Date', value: new Date(selectedDoc.created_at).toLocaleDateString() },
              { label: 'Size', value: formatSize(selectedDoc.file_size) },
              { label: 'Visibility', value: selectedDoc.is_public_to_company ? 'Public to Company' : 'Restricted' },
              { label: 'Description', value: selectedDoc.description },
            ] : []}
            footer={selectedDoc && <Button variant="primary" onClick={() => window.open(selectedDoc.file_url, '_blank')}>Download</Button>}
          />
        </div>
      </div>

      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Document">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ border: '2px dashed #D1D5DB', padding: '32px', textAlign: 'center', cursor: 'pointer' }}>
            <p style={{ color: '#6B7280' }}>Click or drag file here to upload</p>
            <p style={{ fontSize: '12px', color: '#9CA3AF' }}>(File upload is stubbed for this demo)</p>
          </div>
          <Input label="Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          <Input label="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <Select 
            label="Category" 
            value={formData.category} 
            onChange={e => setFormData({...formData, category: e.target.value})}
            options={[
              {value: 'hr', label: 'HR & Policies'},
              {value: 'finance', label: 'Finance'},
              {value: 'marketing', label: 'Marketing'},
              {value: 'project', label: 'Project'},
              {value: 'other', label: 'Other'}
            ]} 
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', color: 'var(--gp-black)' }}>
            <input type="checkbox" style={{ borderRadius: 0, border: '1px solid var(--gp-border-light)' }} checked={formData.is_public} onChange={e => setFormData({...formData, is_public: e.target.checked})} />
            Make Public to Company
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createDoc.isPending}>{createDoc.isPending ? 'Saving...' : 'Save Document'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
