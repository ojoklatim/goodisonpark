import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/DataTable'
import { DealDrawer } from '../../components/sales/DealDrawer'
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { format, isPast } from 'date-fns'
import { Search, Filter, LayoutGrid, List } from 'lucide-react'

const STAGES = [
  { id: 'new_lead', label: 'New Lead', color: "var(--gp-blue)" },
  { id: 'contacted', label: 'Contacted', color: '#9CA3AF' },
  { id: 'negotiation', label: 'Negotiation', color: '#F59E0B' },
  { id: 'proposal', label: 'Proposal', color: '#A78BFA' },
  { id: 'closed_won', label: 'Closed Won', color: '#22C55E' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#EF4444' }
]

export function Pipeline() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  
  const [view, setView] = useState('board')
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [selectedDealId, setSelectedDealId] = useState(null)
  const [isNewDealOpen, setIsNewDealOpen] = useState(false)

  // Fetch Deals
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('deals')
        .select(`*, profiles!deals_assigned_to_fkey(id, first_name, last_name), leads(id, first_name, last_name, company_name)`)
        .eq('company_id', company?.id)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id
  })

  // Fetch Leads for the New Deal form
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('leads').select('id, first_name, last_name, company_name').eq('company_id', company?.id)
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

  const updateDealStage = useMutation({
    mutationFn: async ({ id, stage }) => {
      const { error } = await insforge.from('deals').update({ stage }).eq('id', id)
      if (error) throw error
      
      // Log activity
      await insforge.from('deal_activities').insert([{
        deal_id: id,
        type: 'stage_change',
        title: `Deal moved to ${STAGES.find(s => s.id === stage)?.label}`
      }])
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['deals', company?.id])
    }
  })

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over) return

    const dealId = active.id
    const newStage = over.id

    const deal = deals.find(d => d.id === dealId)
    if (deal && deal.stage !== newStage) {
      updateDealStage.mutate({ id: dealId, stage: newStage })
    }
  }

  const filteredDeals = deals.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                          (d.leads?.company_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesAssignee = assigneeFilter ? d.assigned_to === assigneeFilter : true
    return matchesSearch && matchesAssignee
  })

  const [newDealForm, setNewDealForm] = useState({
    title: '', lead_id: '', stage: 'new_lead', value: '', currency: 'UGX', expected_close_date: '', probability: 50, assigned_to: '', notes: ''
  })

  const createDeal = useMutation({
    mutationFn: async (newData) => {
      const { error } = await insforge.from('deals').insert([{ ...newData, company_id: company.id }])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['deals', company?.id])
      setIsNewDealOpen(false)
      setNewDealForm({ title: '', lead_id: '', stage: 'new_lead', value: '', currency: 'UGX', expected_close_date: '', probability: 50, assigned_to: '', notes: '' })
    }
  })

  // List View Columns
  const columns = [
    { header: 'Title', accessorKey: 'title', cell: ({ row }) => <span style={{ fontWeight: 600, cursor: 'pointer', color: "var(--gp-blue)" }} onClick={() => setSelectedDealId(row.original.id)}>{row.original.title}</span> },
    { header: 'Stage', accessorKey: 'stage', cell: (info) => <Badge style={{ backgroundColor: STAGES.find(s => s.id === info.getValue())?.color, color: '#FFF' }}>{STAGES.find(s => s.id === info.getValue())?.label}</Badge> },
    { header: 'Client', accessorKey: 'leads', cell: (info) => info.getValue()?.company_name || `${info.getValue()?.first_name || ''} ${info.getValue()?.last_name || ''}` },
    { header: 'Value', accessorKey: 'value', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Agent', accessorKey: 'profiles', cell: (info) => `${info.getValue()?.first_name || ''} ${info.getValue()?.last_name || ''}` },
    { header: 'Close Date', accessorKey: 'expected_close_date', cell: (info) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : '-' },
    { header: 'Prob %', accessorKey: 'probability', cell: (info) => `${info.getValue()}%` }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 104px)' }}>
      <PageHeader 
        title="Sales Pipeline" 
        action={<Button variant="primary" onClick={() => setIsNewDealOpen(true)}>New Deal</Button>}
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '16px', padding: '16px 0', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search deals..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #D1D5DB', borderRadius: 0, fontSize: '14px' }}
          />
        </div>
        <div style={{ width: '200px' }}>
          <Select 
            value={assigneeFilter} 
            onChange={e => setAssigneeFilter(e.target.value)} 
            options={[{value: '', label: 'All Agents'}, ...agents.map(a => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))]} 
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <Button variant={view === 'board' ? 'secondary' : 'ghost'} onClick={() => setView('board')}><LayoutGrid size={16} /></Button>
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')}><List size={16} /></Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {isLoading ? (
          <div>Loading pipeline...</div>
        ) : view === 'board' ? (
          <div style={{ display: 'flex', gap: '16px', height: '100%', overflowX: 'auto', paddingBottom: '16px' }}>
            <DndContext onDragEnd={handleDragEnd}>
              {STAGES.map(stage => (
                <Column 
                  key={stage.id} 
                  stage={stage} 
                  deals={filteredDeals.filter(d => d.stage === stage.id)} 
                  onDealClick={(id) => setSelectedDealId(id)}
                />
              ))}
            </DndContext>
          </div>
        ) : (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <DataTable data={filteredDeals} columns={columns} />
          </div>
        )}
      </div>

      {selectedDealId && <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />}

      <Modal isOpen={isNewDealOpen} onClose={() => setIsNewDealOpen(false)} title="New Deal">
        <form onSubmit={(e) => { e.preventDefault(); createDeal.mutate(newDealForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '600px' }}>
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
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Notes</label>
            <textarea 
              value={newDealForm.notes} 
              onChange={e => setNewDealForm({...newDealForm, notes: e.target.value})}
              style={{ width: '100%', minHeight: '80px', border: '1px solid #D1D5DB', padding: '8px', borderRadius: 0, fontFamily: 'inherit' }}
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

function Column({ stage, deals, onDealClick }) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  })

  const totalValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0)

  return (
    <div 
      ref={setNodeRef}
      style={{ 
        minWidth: '280px', 
        width: '280px',
        background: '#F9FAFB', 
        border: "1px solid var(--gp-border-light)", 
        display: 'flex', 
        flexDirection: 'column' 
      }}
    >
      <div style={{ background: "var(--gp-background)", padding: '12px', borderBottom: `3px solid ${stage.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#FFF', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.label}</h3>
          <span style={{ background: "var(--gp-blue)", color: "var(--gp-black)", fontSize: '11px', fontWeight: 700, padding: '2px 6px' }}>{deals.length}</span>
        </div>
        <p style={{ margin: '4px 0 0 0', color: '#9CA3AF', fontSize: '12px' }}>UGX {totalValue.toLocaleString()}</p>
      </div>
      
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
        {deals.map(deal => (
          <DraggableDeal key={deal.id} deal={deal} color={stage.color} onClick={() => onDealClick(deal.id)} />
        ))}
      </div>
    </div>
  )
}

function DraggableDeal({ deal, color, onClick }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: deal.id,
  })
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100,
    position: 'relative'
  } : undefined

  const overdue = deal.expected_close_date && isPast(new Date(deal.expected_close_date))

  return (
    <div 
      ref={setNodeRef} 
      style={{ 
        ...style,
        background: "var(--gp-card)", 
        border: "1px solid var(--gp-border-light)", 
        borderLeft: `3px solid ${color}`,
        padding: '12px',
        cursor: 'grab',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}
      {...listeners}
      {...attributes}
      onDoubleClick={onClick} // using double click so it doesn't conflict with drag
    >
      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>{deal.title}</h4>
      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6B7280' }}>
        {deal.leads?.company_name || `${deal.leads?.first_name || ''} ${deal.leads?.last_name || ''}`.trim() || 'No Client'}
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: "var(--gp-blue)" }}>UGX {Number(deal.value || 0).toLocaleString()}</span>
        {deal.profiles && (
          <div 
            title={`${deal.profiles.first_name} ${deal.profiles.last_name}`}
            style={{ width: '24px', height: '24px', background: "var(--gp-card)", color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600 }}
          >
            {deal.profiles.first_name[0]}{deal.profiles.last_name[0]}
          </div>
        )}
      </div>
      {deal.expected_close_date && (
        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: overdue ? '#EF4444' : '#9CA3AF' }}>
          Due: {format(new Date(deal.expected_close_date), 'MMM dd, yyyy')}
        </p>
      )}
      <div style={{ marginTop: '8px', fontSize: '11px', color: "var(--gp-blue)", cursor: 'pointer', textAlign: 'right' }} onClick={onClick}>
        View Details →
      </div>
    </div>
  )
}
