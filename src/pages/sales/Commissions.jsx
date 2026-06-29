import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StatCard } from '../../components/ui/StatCard'
import { DollarSign, Clock, Trophy } from 'lucide-react'

export function Commissions() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState([])

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('commissions')
        .select(`
          *,
          profiles(first_name, last_name),
          deals(title, value)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const bulkApprove = useMutation({
    mutationFn: async (ids) => {
      const { error } = await insforge.from('commissions').update({ status: 'approved' }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['commissions', company?.id])
      setSelectedIds([])
    }
  })

  const markPaid = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('commissions').update({ status: 'paid' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['commissions', company?.id])
    }
  })

  const totalPending = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount || 0), 0)
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount || 0), 0)
  
  // Calculate top earner
  const earnerMap = {}
  commissions.forEach(c => {
    if (c.status === 'paid') {
      const agentId = c.profile_id
      if (!earnerMap[agentId]) earnerMap[agentId] = { amount: 0, name: `${c.profiles?.first_name} ${c.profiles?.last_name}` }
      earnerMap[agentId].amount += Number(c.amount || 0)
    }
  })
  const topEarner = Object.values(earnerMap).sort((a, b) => b.amount - a.amount)[0]

  const columns = [
    {
      id: 'select',
      header: ({ table }) => (
        <input 
          type="checkbox" 
          onChange={(e) => {
            const pendingIds = table.getRowModel().rows.filter(r => r.original.status === 'pending').map(r => r.original.id)
            setSelectedIds(e.target.checked ? pendingIds : [])
          }}
          checked={table.getRowModel().rows.filter(r => r.original.status === 'pending').length > 0 && selectedIds.length === table.getRowModel().rows.filter(r => r.original.status === 'pending').length}
          style={{ width: '16px', height: '16px', borderRadius: 0 }}
        />
      ),
      cell: ({ row }) => (
        row.original.status === 'pending' ? (
          <input 
            type="checkbox" 
            checked={selectedIds.includes(row.original.id)}
            onChange={(e) => {
              if (e.target.checked) setSelectedIds(prev => [...prev, row.original.id])
              else setSelectedIds(prev => prev.filter(id => id !== row.original.id))
            }}
            style={{ width: '16px', height: '16px', borderRadius: 0 }}
          />
        ) : null
      )
    },
    { header: 'Agent', accessorKey: 'profiles', cell: (info) => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : '-' },
    { header: 'Deal', accessorKey: 'deals.title', cell: (info) => info.getValue() || '-' },
    { header: 'Deal Value', accessorKey: 'deals.value', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Rate', accessorKey: 'rate', cell: (info) => `${info.getValue()}%` },
    { header: 'Commission', accessorKey: 'amount', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Status', accessorKey: 'status', cell: (info) => <Badge variant={info.getValue() === 'paid' ? 'active' : info.getValue() === 'pending' ? 'amber' : 'blue'}>{info.getValue()}</Badge> },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          {row.original.status === 'pending' && (
            <Button variant="secondary" size="sm" onClick={() => bulkApprove.mutate([row.original.id])}>Approve</Button>
          )}
          {row.original.status === 'approved' && (
            <Button variant="primary" size="sm" onClick={() => markPaid.mutate(row.original.id)}>Mark Paid</Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader title="Commissions" />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '24px 0' }}>
        <StatCard title="Total Pending" value={`UGX ${totalPending.toLocaleString()}`} icon={<Clock size={20} />} />
        <StatCard title="Total Paid" value={`UGX ${totalPaid.toLocaleString()}`} icon={<DollarSign size={20} />} />
        <StatCard title="Top Earner (All Time)" value={topEarner ? topEarner.name : '-'} icon={<Trophy size={20} />} />
      </div>

      <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '14px', color: '#4B5563', fontWeight: 500 }}>{selectedIds.length} commissions selected</span>
        </div>
        <Button variant="primary" disabled={selectedIds.length === 0 || bulkApprove.isPending} onClick={() => bulkApprove.mutate(selectedIds)}>
          Approve Selected
        </Button>
      </div>

      <DataTable data={commissions} columns={columns} isLoading={isLoading} />
    </div>
  )
}
