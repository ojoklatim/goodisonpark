import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

export function Clients() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', company?.id],
    queryFn: async () => {
      // Get clients, we also want active deals count
      const { data, error } = await insforge
        .from('clients')
        .select(`*, deals(count)`)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const filteredClients = clients.filter(c => {
    const s = search.toLowerCase()
    return c.name.toLowerCase().includes(s) || (c.company_name || '').toLowerCase().includes(s)
  })

  const columns = [
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

  return (
    <div>
      <PageHeader title="Clients" subtitle="Manage your converted leads and ongoing clients." />

      <div style={{ padding: '16px 0' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #D1D5DB', borderRadius: 0, fontSize: '14px' }}
          />
        </div>
      </div>

      <DataTable data={filteredClients} columns={columns} isLoading={isLoading} onRowClick={(row) => navigate(`/dashboard/sales/clients/${row.id}`)} />
    </div>
  )
}
