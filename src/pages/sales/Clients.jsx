import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { useNavigate } from 'react-router-dom'
import { Search, MessageSquare } from 'lucide-react'

export function Clients() {
  const { company, role, profile } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  
  // SMS Modal State
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false)
  const [smsMessage, setSmsMessage] = useState('')
  const [isSendingSms, setIsSendingSms] = useState(false)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', company?.id, role, profile?.id],
    queryFn: async () => {
      // Get clients
      const { data: clientsData, error: clientsError } = await insforge
        .from('clients')
        .select('*, leads!lead_id(assigned_to)')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (clientsError) throw clientsError

      let filteredData = clientsData || []
      if (role === 'employee') {
        filteredData = filteredData.filter(c => c.leads?.assigned_to === profile?.id)
      }

      // Get deals for these clients (via lead_id)
      const leadIds = filteredData.map(c => c.lead_id).filter(Boolean)
      let dealsData = []
      if (leadIds.length > 0) {
        const { data: deals, error: dealsError } = await insforge
          .from('deals')
          .select('id, lead_id')
          .in('lead_id', leadIds)
        if (dealsError) throw dealsError
        dealsData = deals || []
      }

      // Map deals count to clients
      return filteredData.map(client => {
        const clientDeals = dealsData.filter(d => d.lead_id === client.lead_id)
        return {
          ...client,
          deals: [{ count: clientDeals.length }]
        }
      })
    },
    enabled: !!company?.id
  })

  const filteredClients = clients.filter(c => {
    const s = search.toLowerCase()
    return c.name.toLowerCase().includes(s) || (c.company_name || '').toLowerCase().includes(s)
  })

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredClients.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id))
    }
  }

  const columns = [
    ...(role === 'company_admin' || role === 'super_admin' ? [{
      header: (
        <input 
          type="checkbox" 
          checked={filteredClients.length > 0 && selectedIds.length === filteredClients.length}
          onChange={handleSelectAll}
          style={{ cursor: 'pointer' }}
        />
      ),
      id: 'selection',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={selectedIds.includes(row.original.id)}
            onChange={(e) => handleSelectRow(row.original.id, e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
        </div>
      )
    }] : []),
    { header: 'Name', cell: ({ row }) => <span style={{ fontWeight: 600, color: "var(--gp-blue)", cursor: 'pointer' }} onClick={() => navigate(`/dashboard/sales/clients/${row.original.id}`)}>{row.original.name}</span> },
    { header: 'Company', accessorKey: 'company_name', cell: (info) => info.getValue() || '-' },
    { header: 'Email', accessorKey: 'email', cell: (info) => info.getValue() || '-' },
    { header: 'Phone', accessorKey: 'phone', cell: (info) => info.getValue() || '-' },
    { header: 'Total Value', accessorKey: 'total_deal_value', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Deals', accessorKey: 'deals', cell: (info) => info.getValue()?.[0]?.count || 0 },
    { header: 'Status', accessorKey: 'is_active', cell: (info) => <Badge variant={info.getValue() ? 'active' : 'inactive'}>{info.getValue() ? 'Active' : 'Inactive'}</Badge> },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" onClick={() => navigate(`/dashboard/sales/clients/${row.original.id}`)}>View Profile</Button>
      )
    }
  ]

  const handleSendSms = async () => {
    if (!smsMessage.trim() || selectedIds.length === 0) return
    setIsSendingSms(true)
    try {
      const { data, error } = await insforge.functions.invoke('send-sms', {
        body: { clientIds: selectedIds, messageBody: smsMessage.trim() }
      })
      if (error) throw error
      alert(`SMS successfully queued for ${selectedIds.length} client(s).`)
      setIsSmsModalOpen(false)
      setSmsMessage('')
      setSelectedIds([])
    } catch (err) {
      console.error("SMS Error:", err)
      alert("Failed to send SMS. Please ensure the backend function is deployed.")
    } finally {
      setIsSendingSms(false)
    }
  }

  // Calculate SMS segments (roughly 160 chars per segment for standard GSM-7)
  const prefix = `[${company?.name || 'Notification'}]: `
  const totalChars = prefix.length + smsMessage.length
  const segments = Math.ceil(totalChars / 160) || 1

  return (
    <div>
      <PageHeader title="Clients" subtitle="Manage your converted leads and ongoing clients." />

      <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid var(--gp-border-light)', borderRadius: 0, fontSize: '14px', background: 'var(--gp-card)', color: 'var(--gp-black)' }}
          />
        </div>
        
        {/* Bulk Action Bar for Company Admins */}
        {selectedIds.length > 0 && (role === 'company_admin' || role === 'super_admin') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--gp-blue-glow)', padding: '8px 16px', border: '1px solid var(--gp-blue)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gp-blue)' }}>
              {selectedIds.length} client(s) selected
            </span>
            <Button variant="primary" size="sm" onClick={() => setIsSmsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} />
              Send SMS
            </Button>
          </div>
        )}
      </div>

      <DataTable data={filteredClients} columns={columns} isLoading={isLoading} onRowClick={(row) => navigate(`/dashboard/sales/clients/${row.id}`)} />

      {/* SMS Composer Modal */}
      <Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} title="Compose Bulk SMS">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'var(--gp-background)', border: '1px solid var(--gp-border-light)', fontSize: '13px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--gp-black)' }}>Sending to {selectedIds.length} client(s)</p>
            <p style={{ margin: 0, color: 'var(--gp-muted)' }}>The message will be prefixed with your company name to identify the sender.</p>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--gp-black)' }}>Message Body</label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '0', left: '0', right: '0',
                padding: '12px',
                pointerEvents: 'none',
                color: 'var(--gp-muted)',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif'
              }}>
                {prefix}
              </div>
              <textarea 
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
                style={{
                  width: '100%',
                  padding: `32px 12px 12px 12px`, // Leave room for the prefix at the top
                  border: '1px solid var(--gp-border-light)',
                  borderRadius: 0,
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'Inter, sans-serif',
                  background: 'var(--gp-card)',
                  color: 'var(--gp-black)',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: totalChars > 160 ? 'var(--gp-amber)' : 'var(--gp-muted)' }}>
                {totalChars} characters ({segments} segment{segments !== 1 ? 's' : ''})
              </span>
              <span style={{ fontSize: '12px', color: 'var(--gp-muted)' }}>
                Standard SMS is 160 characters per segment.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsSmsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSendSms} disabled={isSendingSms || !smsMessage.trim()}>
              {isSendingSms ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
