import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/DataTable'
import { ArrowLeft, DollarSign, FileText, CheckSquare, UploadCloud, Download } from 'lucide-react'
import { format } from 'date-fns'

export function ClientProfile() {
  const { id } = useParams()
  const { company } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await insforge.from('clients').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  const { data: deals = [] } = useQuery({
    queryKey: ['client_deals', id],
    queryFn: async () => {
      const { data: dealsData, error: dealsErr } = await insforge.from('deals').select('*').eq('lead_id', client?.lead_id)
      if (dealsErr) throw dealsErr
      return dealsData || []
    },
    enabled: !!client?.lead_id
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['client_invoices', id],
    queryFn: async () => {
      const { data, error } = await insforge.from('invoices').select('*').eq('client_id', id)
      if (error) throw error
      return data || []
    },
    enabled: !!id && activeTab === 'invoices'
  })

  const { data: files = [] } = useQuery({
    queryKey: ['client_files', id],
    queryFn: async () => {
      const { data, error } = await insforge.from('documents').select('*').contains('tags', [`client:${id}`])
      if (error) throw error
      return data || []
    },
    enabled: !!id && activeTab === 'files'
  })

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company_name: '', address: ''
  })

  const openEdit = () => {
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      company_name: client.company_name || '',
      address: client.address || ''
    })
    setIsEditOpen(true)
  }

  const updateClient = useMutation({
    mutationFn: async (newData) => {
      const { error } = await insforge.from('clients').update(newData).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['client', id])
      setIsEditOpen(false)
    }
  })

  const uploadFile = useMutation({
    mutationFn: async (file) => {
      const fileExt = file.name.split('.').pop()
      const filePath = `clients/${id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await insforge.storage.from('documents').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: urlData } = insforge.storage.from('documents').getPublicUrl(filePath)
      
      const { error: docError } = await insforge.from('documents').insert([{
        company_id: company.id,
        title: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        tags: [`client:${id}`]
      }])
      if (docError) throw docError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['client_files', id])
    }
  })

  if (isLoading) return <div>Loading profile...</div>
  if (!client) return <div>Client not found.</div>

  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length
  const totalRevenue = deals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + Number(d.value || 0), 0)
  const outstandingInvoices = invoices.filter(i => ['unpaid', 'partial', 'overdue'].includes(i.status)).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/dashboard/sales/clients')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 700, color: "var(--gp-black)" }}>{client.name}</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#6B7280', fontSize: '14px' }}>{client.company_name}</span>
            <Badge variant={client.is_active ? 'active' : 'inactive'}>{client.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="secondary" onClick={openEdit}>Edit Client</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard title="Total Revenue" value={`UGX ${totalRevenue.toLocaleString()}`} icon={<DollarSign size={20} />} />
        <StatCard title="Active Deals" value={activeDeals} icon={<CheckSquare size={20} />} />
        <StatCard title="Outstanding Invoices" value={outstandingInvoices} icon={<FileText size={20} />} />
      </div>

      <div style={{ display: 'flex', borderBottom: "1px solid var(--gp-border-light)", marginBottom: '24px' }}>
        {['overview', 'deals', 'invoices', 'files'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
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

      <div>
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div><strong>Email:</strong> {client.email || '-'}</div>
                <div><strong>Phone:</strong> {client.phone || '-'}</div>
                <div><strong>Address:</strong> {client.address || '-'}</div>
                <div><strong>Added:</strong> {format(new Date(client.created_at), 'MMM dd, yyyy')}</div>
              </div>
            </div>
            {/* Notes could go here */}
          </div>
        )}

        {activeTab === 'deals' && (
          <DataTable 
            data={deals} 
            columns={[
              { header: 'Title', accessorKey: 'title' },
              { header: 'Stage', accessorKey: 'stage', cell: info => <Badge>{info.getValue()}</Badge> },
              { header: 'Value', accessorKey: 'value', cell: info => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
              { header: 'Expected Close', accessorKey: 'expected_close_date', cell: info => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : '-' }
            ]} 
          />
        )}

        {activeTab === 'invoices' && (
          <DataTable 
            data={invoices} 
            columns={[
              { header: 'Invoice #', accessorKey: 'invoice_number' },
              { header: 'Total', accessorKey: 'total', cell: info => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
              { header: 'Status', accessorKey: 'status', cell: info => <Badge>{info.getValue()}</Badge> },
              { header: 'Due Date', accessorKey: 'due_date', cell: info => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : '-' }
            ]} 
          />
        )}

        {activeTab === 'files' && (
          <div>
            <div style={{ 
              border: '2px dashed #D1D5DB', padding: '32px', textAlign: 'center', background: '#F9FAFB', marginBottom: '24px'
            }}>
              <UploadCloud size={32} color="#9CA3AF" style={{ margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Upload new file</p>
              <input type="file" onChange={(e) => { if (e.target.files[0]) uploadFile.mutate(e.target.files[0]) }} style={{ marginTop: '8px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {files.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} color="#9CA3AF" />
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 500 }}>{f.title}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{format(new Date(f.created_at), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color: "var(--gp-blue)" }}><Download size={16} /></a>
                </div>
              ))}
              {files.length === 0 && <p style={{ textAlign: 'center', color: '#6B7280' }}>No files found.</p>}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Client">
        <form onSubmit={(e) => { e.preventDefault(); updateClient.mutate(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <Input label="Company Name" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
          <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <Input label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <Input label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={updateClient.isPending}>{updateClient.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
