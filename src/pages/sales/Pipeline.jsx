import React, { useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/DataTable'
import { DealDrawer } from '../../components/sales/DealDrawer'
import {
  format, isPast, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, isWithinInterval, parseISO
} from 'date-fns'
import { Search } from 'lucide-react'

const STAGES = [
  { id: 'new_lead', label: 'New Lead', color: "var(--gp-blue)" },
  { id: 'contacted', label: 'Contacted', color: '#9CA3AF' },
  { id: 'negotiation', label: 'Negotiation', color: '#F59E0B' },
  { id: 'proposal', label: 'Proposal', color: '#A78BFA' },
  { id: 'closed_won', label: 'Closed Won', color: '#22C55E' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#EF4444' }
]

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
]

function getDateRange(filter, customFrom, customTo) {
  const now = new Date()
  switch (filter) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'week':
      return { start: startOfWeek(now), end: endOfWeek(now) }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'custom':
      if (!customFrom || !customTo) return null
      return { start: startOfDay(parseISO(customFrom)), end: endOfDay(parseISO(customTo)) }
    case 'all':
    default:
      return null
  }
}

export function Pipeline() {
  const { company, role, profile } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedDealId, setSelectedDealId] = useState(null)
  const [isNewDealOpen, setIsNewDealOpen] = useState(false)

  // Fetch Deals — reflects leads collected/worked by agents
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', company?.id, role, profile?.id],
    queryFn: async () => {
      let query = insforge
        .from('deals')
        .select(`*, profiles!deals_assigned_to_fkey(id, first_name, last_name), leads(id, first_name, last_name, company_name, email, phone)`)
        .eq('company_id', company?.id)
      
      if (role === 'employee') {
        query = query.eq('assigned_to', profile?.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id
  })

  // Fetch Leads for the New Deal form
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', company?.id, role, profile?.id],
    queryFn: async () => {
      let query = insforge.from('leads').select('id, first_name, last_name, company_name').eq('company_id', company?.id)
      if (role === 'employee') {
        query = query.eq('assigned_to', profile?.id)
      }
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id
  })

  // Fetch Agents for filtering & assigning
  const { data: agents = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('profiles').select('id, first_name, last_name').eq('company_id', company?.id)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id
  })

  const [newDealForm, setNewDealForm] = useState({
    title: '', lead_id: '', stage: 'new_lead', value: '', currency: 'UGX', expected_close_date: '', probability: 50, assigned_to: '', notes: ''
  })

  const createDeal = useMutation({
    mutationFn: async (newData) => {
      const payload = { ...newData, company_id: company.id }
      if (role === 'employee') {
        payload.assigned_to = profile?.id
      }
      const { error } = await insforge.from('deals').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', company?.id] })
      setIsNewDealOpen(false)
      setNewDealForm({ title: '', lead_id: '', stage: 'new_lead', value: '', currency: 'UGX', expected_close_date: '', probability: 50, assigned_to: '', notes: '' })
    }
  })

  const dateRange = useMemo(() => getDateRange(dateFilter, customFrom, customTo), [dateFilter, customFrom, customTo])

  const filteredDeals = deals.filter(d => {
    const leadName = `${d.leads?.first_name || ''} ${d.leads?.last_name || ''}`.trim()
    const matchesSearch = !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      leadName.toLowerCase().includes(search.toLowerCase()) ||
      (d.leads?.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.leads?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.leads?.phone || '').includes(search)
    const matchesAssignee = assigneeFilter ? d.assigned_to === assigneeFilter : true
    const matchesDate = !dateRange || (d.created_at && isWithinInterval(new Date(d.created_at), dateRange))
    return matchesSearch && matchesAssignee && matchesDate
  })

  const totalValue = filteredDeals.reduce((sum, d) => sum + Number(d.value || 0), 0)

  const columns = [
    {
      header: 'Name',
      accessorKey: 'leads',
      cell: (info) => {
        const lead = info.getValue()
        const name = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : ''
        return <span style={{ fontWeight: 600, color: 'var(--gp-black)' }}>{name || lead?.company_name || '—'}</span>
      }
    },
    { header: 'Number', accessorKey: 'leads', cell: (info) => info.getValue()?.phone || '—' },
    { header: 'Email', accessorKey: 'leads', cell: (info) => info.getValue()?.email || '—' },
    { header: 'Deal Value', accessorKey: 'value', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    {
      header: 'Deadline',
      accessorKey: 'expected_close_date',
      cell: (info) => {
        const val = info.getValue()
        if (!val) return '—'
        const overdue = isPast(new Date(val))
        return <span style={{ color: overdue ? '#EF4444' : 'var(--gp-black)' }}>{format(new Date(val), 'MMM dd, yyyy')}</span>
      }
    },
    {
      header: 'Assigned To',
      accessorKey: 'profiles',
      cell: (info) => {
        const p = info.getValue()
        return p ? `${p.first_name} ${p.last_name}` : 'Unassigned'
      }
    },
  ]

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        subtitle={`${filteredDeals.length} deals · UGX ${totalValue.toLocaleString()} total value`}
        action={<Button variant="primary" onClick={() => setIsNewDealOpen(true)}>New Deal</Button>}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', paddingBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '260px' }}>
          <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Search</label>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '34px' }} />
          <input
            type="text"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid var(--gp-border-light)', borderRadius: 0, fontSize: '14px', background: 'var(--gp-card)', color: 'var(--gp-black)', boxSizing: 'border-box', height: 36 }}
          />
        </div>
        <div style={{ width: '200px' }}>
          <Select
            label="Assigned To"
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            options={[{ value: '', label: 'All Agents' }, ...agents.map(a => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))]}
          />
        </div>
        <div style={{ width: '180px' }}>
          <Select
            label="Date Collected"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            options={DATE_FILTERS}
          />
        </div>
        {dateFilter === 'custom' && (
          <>
            <Input label="From" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <Input label="To" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      <DataTable
        data={filteredDeals}
        columns={columns}
        loading={isLoading}
        searchable={false}
        onRowClick={(row) => setSelectedDealId(row.id)}
        emptyTitle="No deals found"
        emptyDescription="No leads have been converted into deals for this period yet."
      />

      {selectedDealId && <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />}

      <Modal isOpen={isNewDealOpen} onClose={() => setIsNewDealOpen(false)} title="New Deal">
        <form onSubmit={(e) => { e.preventDefault(); createDeal.mutate(newDealForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input label="Deal Title*" value={newDealForm.title} onChange={e => setNewDealForm({...newDealForm, title: e.target.value})} required />
            <Select label="Lead" value={newDealForm.lead_id} onChange={e => setNewDealForm({...newDealForm, lead_id: e.target.value})} options={[{value: '', label: 'Select Lead'}, ...leads.map(l => ({ value: l.id, label: l.company_name || `${l.first_name} ${l.last_name}` }))]} />

            <Select label="Stage*" value={newDealForm.stage} onChange={e => setNewDealForm({...newDealForm, stage: e.target.value})} options={STAGES.map(s => ({ value: s.id, label: s.label }))} required />
            <Select label="Assigned To" value={newDealForm.assigned_to} onChange={e => setNewDealForm({...newDealForm, assigned_to: e.target.value})} options={[{value: '', label: 'Select Agent'}, ...agents.map(a => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))]} />

            <Input label="Value (UGX)" type="number" value={newDealForm.value} onChange={e => setNewDealForm({...newDealForm, value: e.target.value})} />
            <Input label="Probability (%)" type="number" min="0" max="100" value={newDealForm.probability} onChange={e => setNewDealForm({...newDealForm, probability: e.target.value})} />

            <Input label="Expected Close Date" type="date" value={newDealForm.expected_close_date} onChange={e => setNewDealForm({...newDealForm, expected_close_date: e.target.value})} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: 'var(--gp-black)' }}>Notes</label>
            <textarea
              value={newDealForm.notes}
              onChange={e => setNewDealForm({...newDealForm, notes: e.target.value})}
              style={{ width: '100%', minHeight: '80px', border: '1px solid var(--gp-border-light)', padding: '8px', borderRadius: 0, fontFamily: 'inherit', background: 'var(--gp-card)', color: 'var(--gp-black)', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsNewDealOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createDeal.isPending}>{createDeal.isPending ? 'Saving...' : 'Save Deal'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
