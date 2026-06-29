import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { format, isPast } from 'date-fns'

export function Invoices() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [paymentData, setPaymentData] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: 'Bank Transfer', reference: '' })

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('invoices')
        .select(`*, clients(name)`)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      
      // Auto-mark overdue
      const updatedData = data.map(inv => {
        if (['unpaid', 'partial'].includes(inv.status) && inv.due_date && isPast(new Date(inv.due_date))) {
          return { ...inv, status: 'overdue' }
        }
        return inv
      })
      return updatedData
    },
    enabled: !!company?.id
  })

  const recordPayment = useMutation({
    mutationFn: async () => {
      const newAmountPaid = Number(selectedInvoice.amount_paid || 0) + Number(paymentData.amount)
      const isFullyPaid = newAmountPaid >= Number(selectedInvoice.total)
      const newStatus = isFullyPaid ? 'paid' : 'partial'
      
      const { error } = await insforge.from('invoices').update({
        amount_paid: newAmountPaid,
        status: newStatus,
        paid_at: isFullyPaid ? new Date().toISOString() : selectedInvoice.paid_at
      }).eq('id', selectedInvoice.id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['invoices', company?.id])
      setIsPaymentOpen(false)
      setSelectedInvoice(null)
      setPaymentData({ amount: '', date: new Date().toISOString().split('T')[0], method: 'Bank Transfer', reference: '' })
    }
  })

  const getStatusColor = (s) => {
    switch (s) {
      case 'draft': return 'gray'
      case 'unpaid': return 'amber'
      case 'partial': return 'blue'
      case 'paid': return 'active'
      case 'overdue': return 'danger'
      case 'cancelled': return 'gray'
      default: return 'gray'
    }
  }

  const columns = [
    { header: 'Invoice #', accessorKey: 'invoice_number', cell: ({ row }) => <span style={{ fontWeight: 600, color: "var(--gp-black)" }}>{row.original.invoice_number}</span> },
    { header: 'Client', accessorKey: 'clients.name', cell: (info) => info.getValue() || '-' },
    { header: 'Total', accessorKey: 'total', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Paid', accessorKey: 'amount_paid', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Balance', cell: ({ row }) => `UGX ${Math.max(0, Number(row.original.total) - Number(row.original.amount_paid || 0)).toLocaleString()}` },
    { header: 'Status', accessorKey: 'status', cell: (info) => <Badge variant={getStatusColor(info.getValue())}>{info.getValue()}</Badge> },
    { header: 'Due Date', accessorKey: 'due_date', cell: (info) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : '-' },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          {['unpaid', 'partial', 'overdue'].includes(row.original.status) && (
            <Button variant="primary" size="sm" onClick={() => {
              setSelectedInvoice(row.original)
              setPaymentData(prev => ({ ...prev, amount: Math.max(0, Number(row.original.total) - Number(row.original.amount_paid || 0)) }))
              setIsPaymentOpen(true)
            }}>Payment</Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader title="Invoices" />
      <div style={{ marginTop: '24px' }}>
        <DataTable data={invoices} columns={columns} isLoading={isLoading} />
      </div>

      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="Record Payment">
        <form onSubmit={e => { e.preventDefault(); recordPayment.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: '0 0 16px 0', color: '#4B5563', fontSize: '14px' }}>
            Recording payment for invoice <strong>{selectedInvoice?.invoice_number}</strong>. <br/>
            Total Balance Due: UGX {selectedInvoice ? Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid || 0)).toLocaleString() : 0}
          </p>
          <Input label="Amount Paid (UGX)" type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} required max={selectedInvoice ? Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid || 0)) : ''} />
          <Input label="Payment Date" type="date" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} required />
          <Select label="Payment Method" value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})} options={['Cash', 'Mobile Money', 'Bank Transfer', 'Card'].map(s => ({value: s, label: s}))} />
          <Input label="Reference # (Optional)" value={paymentData.reference} onChange={e => setPaymentData({...paymentData, reference: e.target.value})} />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={recordPayment.isPending}>{recordPayment.isPending ? 'Saving...' : 'Record Payment'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
