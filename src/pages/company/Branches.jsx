import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { format } from 'date-fns'

export function Branches() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [branchToDelete, setBranchToDelete] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    address: '',
    is_headquarters: false
  })

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('branches')
        .select(`*, profiles(count)`)
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const saveBranch = useMutation({
    mutationFn: async (newData) => {
      if (editingBranch) {
        const { error } = await insforge.from('branches').update(newData).eq('id', editingBranch.id)
        if (error) throw error
      } else {
        const { error } = await insforge.from('branches').insert([{ ...newData, company_id: company.id }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['branches', company?.id])
      setIsModalOpen(false)
      setEditingBranch(null)
      setFormData({ name: '', city: '', address: '', is_headquarters: false })
    }
  })

  const deleteBranch = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('branches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['branches', company?.id])
      setIsConfirmOpen(false)
      setBranchToDelete(null)
    }
  })

  const openEditModal = (branch) => {
    setEditingBranch(branch)
    setFormData({
      name: branch.name,
      city: branch.city || '',
      address: branch.address || '',
      is_headquarters: branch.is_headquarters
    })
    setIsModalOpen(true)
  }

  const columns = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'City', accessorKey: 'city' },
    { 
      header: 'Is HQ', 
      accessorKey: 'is_headquarters',
      cell: (info) => info.getValue() ? <span style={{ color: '#22C55E', fontWeight: 600 }}>Yes</span> : <span style={{ color: '#9CA3AF' }}>No</span>
    },
    { 
      header: 'Staff Count', 
      accessorKey: 'profiles',
      cell: (info) => info.getValue()?.[0]?.count || 0
    },
    { 
      header: 'Created', 
      accessorKey: 'created_at',
      cell: (info) => {
        const val = info.getValue()
        if (!val) return '—'
        const d = new Date(val)
        return isNaN(d.getTime()) ? '—' : format(d, 'MMM dd, yyyy')
      }
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
          <Button variant="secondary" size="sm" onClick={() => openEditModal(row.original)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => { setBranchToDelete(row.original.id); setIsConfirmOpen(true) }}>Delete</Button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Branches" 
        action={<Button variant="primary" onClick={() => { setEditingBranch(null); setFormData({name: '', city: '', address: '', is_headquarters: false}); setIsModalOpen(true) }}>Add Branch</Button>} 
      />
      
      <div style={{ marginTop: '24px' }}>
        <DataTable data={branches} columns={columns} isLoading={isLoading} onRowClick={openEditModal} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBranch ? 'Edit Branch' : 'Add Branch'}>
        <form onSubmit={(e) => { e.preventDefault(); saveBranch.mutate(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Branch Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <Input label="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
          <Input label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#111827' }}>
            <input 
              type="checkbox" 
              checked={formData.is_headquarters} 
              onChange={e => setFormData({...formData, is_headquarters: e.target.checked})} 
              style={{ width: '16px', height: '16px', borderRadius: 0, border: '1px solid #D1D5DB' }}
            />
            Is Headquarters
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saveBranch.isPending}>{saveBranch.isPending ? 'Saving...' : 'Save Branch'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)}
        title="Delete Branch"
        message="Are you sure you want to delete this branch? This action cannot be undone."
        onConfirm={() => deleteBranch.mutate(branchToDelete)}
      />
    </div>
  )
}
