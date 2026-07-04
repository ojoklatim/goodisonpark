import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StatCard } from '../../components/ui/StatCard'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { DollarSign, Clock, Trophy, Plus } from 'lucide-react'

export function Commissions() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingRateId, setEditingRateId] = useState(null)
  const [editingRateValue, setEditingRateValue] = useState('')
  const [form, setForm] = useState({ deal_id: '', profile_id: '', rate: '' })

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

  // Deals eligible for a new commission — closed & won, not yet linked to a commission
  const { data: eligibleDeals = [] } = useQuery({
    queryKey: ['commission_eligible_deals', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('deals')
        .select('id, title, value, assigned_to')
        .eq('company_id', company?.id)
        .eq('stage', 'closed_won')
      if (error) throw error
      const commissionedDealIds = new Set(commissions.map(c => c.deal_id))
      return (data || []).filter(d => !commissionedDealIds.has(d.id))
    },
    enabled: !!company?.id && isAddOpen
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('profiles').select('id, first_name, last_name').eq('company_id', company?.id)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id && isAddOpen
  })

  const selectedDeal = eligibleDeals.find(d => d.id === form.deal_id)
  const computedAmount = selectedDeal && form.rate
    ? (Number(selectedDeal.value || 0) * Number(form.rate) / 100)
    : 0

  const createCommission = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('commissions').insert([{
        company_id: company.id,
        deal_id: payload.deal_id,
        profile_id: payload.profile_id,
        rate: Number(payload.rate),
        amount: Number(payload.deal_value || 0) * Number(payload.rate) / 100,
        status: 'pending'
      }])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['commissions', company?.id])
      setIsAddOpen(false)
      setForm({ deal_id: '', profile_id: '', rate: '' })
    }
  })

  const handleDealSelect = (dealId) => {
    const deal = eligibleDeals.find(d => d.id === dealId)
    setForm(f => ({ ...f, deal_id: dealId, profile_id: deal?.assigned_to || f.profile_id }))
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!form.deal_id || !form.profile_id || !form.rate) return
    createCommission.mutate({ ...form, deal_value: selectedDeal?.value })
  }

  const updateRate = useMutation({
    mutationFn: async ({ id, rate, dealValue }) => {
      const { error } = await insforge.from('commissions').update({
        rate: Number(rate),
        amount: Number(dealValue || 0) * Number(rate) / 100
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['commissions', company?.id])
      setEditingRateId(null)
    }
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
    {
      header: 'Rate (%)',
      accessorKey: 'rate',
      cell: (info) => {
        const row = info.row.original
        if (row.status !== 'pending') return `${info.getValue()}%`
        if (editingRateId === row.id) {
          return (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <input
                type="number" step="0.1" autoFocus value={editingRateValue}
                onChange={e => setEditingRateValue(e.target.value)}
                style={{ width: 60, padding: '4px 6px', fontSize: 13, border: '1px solid var(--gp-border-light)', borderRadius: 0, background: 'var(--gp-card)', color: 'var(--gp-black)' }}
              />
              <Button size="sm" variant="primary" disabled={updateRate.isPending}
                onClick={() => updateRate.mutate({ id: row.id, rate: editingRateValue, dealValue: row.deals?.value })}>
                Save
              </Button>
            </div>
          )
        }
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingRateId(row.id); setEditingRateValue(row.rate) }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'var(--gp-black)', fontSize: 13 }}
            title="Click to adjust commission rate"
          >
            {info.getValue()}%
          </button>
        )
      }
    },
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
      <PageHeader title="Commissions" action={
        <Button variant="primary" onClick={() => setIsAddOpen(true)}>
          <Plus size={16} style={{ marginRight: 6 }} /> Add Commission
        </Button>
      } />
      
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

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Commission">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            label="Deal (closed & won)"
            value={form.deal_id}
            onChange={e => handleDealSelect(e.target.value)}
            options={eligibleDeals.map(d => ({ value: d.id, label: `${d.title} — UGX ${Number(d.value || 0).toLocaleString()}` }))}
            placeholder="Select a deal"
            required
          />
          <Select
            label="Agent"
            value={form.profile_id}
            onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
            options={agents.map(a => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))}
            placeholder="Select agent"
            required
          />
          <div>
            <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Commission Rate (%)</label>
            <input
              type="number" step="0.1" min="0" max="100" required
              value={form.rate}
              onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              placeholder="e.g. 5"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--gp-border-light)', borderRadius: 0, background: 'var(--gp-card)', color: 'var(--gp-black)', boxSizing: 'border-box' }}
            />
          </div>
          {selectedDeal && form.rate && (
            <div style={{ padding: '10px 12px', background: 'var(--gp-background)', border: '1px solid var(--gp-border-light)', fontSize: 13, color: 'var(--gp-black)' }}>
              Commission amount: <strong>UGX {computedAmount.toLocaleString()}</strong>
            </div>
          )}
          {eligibleDeals.length === 0 && (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>No closed-won deals are available for a new commission right now.</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createCommission.isPending || !form.deal_id || !form.profile_id || !form.rate}>
              Create Commission
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
