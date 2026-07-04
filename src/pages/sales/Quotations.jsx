import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

export function Quotations() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('quotations')
        .select(`
          *,
          clients(id, name),
          deals(id, title),
          profiles(first_name, last_name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const deleteQuotation = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('quotations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quotations', company?.id])
    }
  })

  const getStatusColor = (s) => {
    switch (s) {
      case 'draft': return 'gray'
      case 'sent': return 'blue'
      case 'accepted': return 'active'
      case 'rejected': return 'danger'
      case 'expired': return 'amber'
      default: return 'gray'
    }
  }

  const columns = [
    { header: 'Quote #', accessorKey: 'quotation_number', cell: ({ row }) => <span style={{ fontWeight: 600, color: "var(--gp-black)" }}>{row.original.quotation_number}</span> },
    { header: 'Client', accessorKey: 'clients.name', cell: (info) => info.getValue() || '-' },
    { header: 'Deal', accessorKey: 'deals.title', cell: (info) => info.getValue() || '-' },
    { header: 'Total', accessorKey: 'total', cell: (info) => `UGX ${Number(info.getValue() || 0).toLocaleString()}` },
    { header: 'Status', accessorKey: 'status', cell: (info) => <Badge variant={getStatusColor(info.getValue())}>{info.getValue()}</Badge> },
    { header: 'Valid Until', accessorKey: 'valid_until', cell: (info) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : '-' },
    { header: 'Created By', accessorKey: 'profiles', cell: (info) => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : '-' },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/dashboard/sales/quotations/${row.original.id}`)}>Edit</Button>
          {row.original.status === 'accepted' && (
            <Button variant="primary" size="sm" onClick={() => navigate(`/dashboard/sales/invoices/new?from_quotation=${row.original.id}`)}>
              To Invoice
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => { if(window.confirm('Delete quotation?')) deleteQuotation.mutate(row.original.id) }}>Del</Button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Quotations" 
        action={<Button variant="primary" onClick={() => navigate('/dashboard/sales/quotations/new')}>New Quotation</Button>} 
      />
      <div style={{ marginTop: '24px' }}>
        <DataTable data={quotations} columns={columns} isLoading={isLoading} />
      </div>
    </div>
  )
}
