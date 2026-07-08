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
import { RecordDetailModal } from '../../components/ui/RecordDetailModal'

export function Approvals() {
  const { company, user, profile, role } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('pending') // pending | myRequests
  const [selectedApproval, setSelectedApproval] = useState(null)

  const [rejectModal, setRejectModal] = useState({ show: false, approval: null, notes: '' })

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('approvals')
        .select(`
          *,
          requester:profiles!requested_by(first_name, last_name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const updateApproval = useMutation({
    mutationFn: async ({ approval, status, notes }) => {
      console.log('[Approvals] updating', { approval, status, profileId: profile?.id })
      const { data, error } = await insforge
        .from('approvals')
        .update({ status, notes, approved_by: profile?.id, resolved_at: new Date().toISOString() })
        .eq('id', approval.id)
        .select()
      console.log('[Approvals] update result:', { data, error })
      if (error) throw error
      
      if (approval.type === 'leave' && approval.reference_id) {
        const { error: lrErr } = await insforge.from('leave_requests').update({ status, approved_by: profile?.id }).eq('id', approval.reference_id)
        console.log('[Approvals] leave_requests sync:', lrErr)
      } else if (approval.type === 'expense' && approval.reference_id) {
        await insforge.from('expenses').update({ status }).eq('id', approval.reference_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals', company?.id])
      queryClient.invalidateQueries(['leave_requests', company?.id])
      setRejectModal({ show: false, approval: null, notes: '' })
    },
    onError: (err) => {
      console.error('[Approvals] mutation error:', err)
      alert('Approval failed: ' + (err?.message || JSON.stringify(err)))
    }
  })

  const handleApprove = (approval) => {
    updateApproval.mutate({ approval, status: 'approved' })
  }

  const handleReject = (e) => {
    e.preventDefault()
    updateApproval.mutate({ approval: rejectModal.approval, status: 'rejected', notes: rejectModal.notes })
  }

  const filteredApprovals = approvals.filter(app => {
    if (tab === 'pending') {
      return app.status === 'pending'
    } else if (tab === 'history') {
      return true // Admins see all requests in History
    } else {
      return app.requested_by === user?.id // Employees see only their requests
    }
  })

  const formatType = (s) => {
    if (!s) return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  const columns = [
    { header: 'Type', accessorKey: 'type', cell: info => <Badge variant="default" label={formatType(info.getValue())} /> },
    { header: 'Title/Ref', accessorKey: 'reference_table', cell: info => <span style={{ fontWeight: 600 }}>{info.getValue() || 'Request'}</span> },
    { header: 'Requested By', accessorKey: 'requester', cell: info => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : '-' },
    { header: 'Date', accessorKey: 'created_at', cell: info => new Date(info.getValue()).toLocaleDateString() },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: info => {
        const val = info.getValue()
        const variants = { 'pending': 'active', 'approved': 'success', 'rejected': 'inactive' }
        return <Badge variant={variants[val] || 'default'} label={formatType(val)} />
      }
    },
    { 
      header: 'Actions', 
      id: 'actions',
      cell: (info) => {
        const row = info.row.original
        return (
          <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
            {tab === 'pending' && row.status === 'pending' ? (
              <>
                <button onClick={() => handleApprove(row)} style={{ background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
                <button onClick={() => setRejectModal({ show: true, approval: row, notes: '' })} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
              </>
            ) : (
              <button onClick={() => setSelectedApproval(row)} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer' }}>View</button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Approvals" 
        subtitle="Manage pending requests and workflow approvals"
      />

      <div style={{ display: 'flex', gap: '24px', borderBottom: "1px solid var(--gp-border-light)", marginTop: '24px', marginBottom: '24px' }}>
        <button 
          onClick={() => setTab('pending')}
          style={{ padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === 'pending' ? 600 : 400, color: tab === 'pending' ? "var(--gp-blue-dim)" : "#6B7280", borderBottom: tab === 'pending' ? '2px solid #38BDF8' : '2px solid transparent' }}
        >
          Pending My Approval
        </button>
        {role === 'employee' ? (
          <button 
            onClick={() => setTab('myRequests')}
            style={{ padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === 'myRequests' ? 600 : 400, color: tab === 'myRequests' ? "var(--gp-blue-dim)" : "#6B7280", borderBottom: tab === 'myRequests' ? '2px solid #38BDF8' : '2px solid transparent' }}
          >
            My Requests
          </button>
        ) : (
          <button 
            onClick={() => setTab('history')}
            style={{ padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === 'history' ? 600 : 400, color: tab === 'history' ? "var(--gp-blue-dim)" : "#6B7280", borderBottom: tab === 'history' ? '2px solid #38BDF8' : '2px solid transparent' }}
          >
            History
          </button>
        )}
      </div>

      <DataTable columns={columns} data={filteredApprovals} isLoading={isLoading} onRowClick={setSelectedApproval} />

      <RecordDetailModal
        isOpen={!!selectedApproval}
        onClose={() => setSelectedApproval(null)}
        title={formatType(selectedApproval?.type) || 'Approval Request'}
        fields={selectedApproval ? [
          { label: 'Type', value: formatType(selectedApproval.type) },
          { label: 'Reference', value: selectedApproval.reference_table },
          { label: 'Requested By', value: selectedApproval.requester ? `${selectedApproval.requester.first_name} ${selectedApproval.requester.last_name}` : null },
          { label: 'Date', value: new Date(selectedApproval.created_at).toLocaleDateString() },
          { label: 'Status', value: formatType(selectedApproval.status) },
          { label: 'Notes', value: selectedApproval.notes },
        ] : []}
      />

      <Modal isOpen={rejectModal.show} onClose={() => setRejectModal({ show: false, approval: null, notes: '' })} title="Reject Request">
        <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            label="Reason for Rejection" 
            value={rejectModal.notes} 
            onChange={e => setRejectModal({...rejectModal, notes: e.target.value})} 
            required 
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setRejectModal({ show: false, approvalId: null, notes: '' })}>Cancel</Button>
            <Button type="submit" variant="primary" style={{ background: '#EF4444', borderColor: '#EF4444' }}>Reject Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
