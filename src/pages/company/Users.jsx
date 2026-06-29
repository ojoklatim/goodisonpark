import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export function Users() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userToDeactivate, setUserToDeactivate] = useState(null)

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    department: '',
    branch_id: ''
  })

  // Queries
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('profiles')
        .select(`*, branches(name), auth_users:id(email)`)
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('branches').select('id, name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('departments').select('id, name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  // Mutations
  const inviteUser = useMutation({
    mutationFn: async (newData) => {
      // Create user via admin api if available, otherwise regular sign up
      // Note: for production, a magic link or admin invite API is better
      const { data, error } = await insforge.auth.signUp({
        email: newData.email,
        password: Math.random().toString(36).slice(-8) + 'A1!' // Temp password
      })
      if (error) throw error
      
      const { error: profileError } = await insforge.from('profiles').update({
        company_id: company.id,
        first_name: newData.first_name,
        last_name: newData.last_name,
        role: newData.role,
        department: newData.department,
        branch_id: newData.branch_id || null
      }).eq('id', data.user.id)

      if (profileError) throw profileError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['profiles', company?.id])
      setIsInviteOpen(false)
      setFormData({ email: '', first_name: '', last_name: '', role: 'employee', department: '', branch_id: '' })
    }
  })

  const updateUser = useMutation({
    mutationFn: async (newData) => {
      const { error } = await insforge.from('profiles').update(newData).eq('id', editingUser.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['profiles', company?.id])
      setIsEditOpen(false)
      setEditingUser(null)
    }
  })

  const deactivateUser = useMutation({
    mutationFn: async (id) => {
      const { error } = await insforge.from('profiles').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['profiles', company?.id])
      setIsConfirmOpen(false)
      setUserToDeactivate(null)
    }
  })

  const openEdit = (user) => {
    setEditingUser(user)
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      department: user.department || '',
      branch_id: user.branch_id || ''
    })
    setIsEditOpen(true)
  }

  const columns = [
    { 
      header: 'Name', 
      accessorKey: 'first_name',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: "var(--gp-card)", color: "var(--gp-blue)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
            {row.original.first_name[0]}{row.original.last_name[0]}
          </div>
          <span style={{ fontWeight: 500 }}>{row.original.first_name} {row.original.last_name}</span>
        </div>
      )
    },
    { header: 'Role', accessorKey: 'role', cell: (info) => <Badge variant={info.getValue() === 'company_admin' ? 'blue' : 'gray'}>{info.getValue().replace('_', ' ')}</Badge> },
    { header: 'Department', accessorKey: 'department' },
    { header: 'Branch', accessorKey: 'branches.name' },
    { header: 'Status', accessorKey: 'is_active', cell: (info) => <Badge variant={info.getValue() ? 'active' : 'inactive'}>{info.getValue() ? 'Active' : 'Inactive'}</Badge> },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={() => openEdit(row.original)}>Edit</Button>
          {row.original.is_active && (
            <Button variant="danger" size="sm" onClick={() => { setUserToDeactivate(row.original.id); setIsConfirmOpen(true) }}>Deactivate</Button>
          )}
        </div>
      )
    }
  ]

  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))
  const deptOptions = departments.map(d => ({ value: d.name, label: d.name }))

  return (
    <div>
      <PageHeader 
        title="Users" 
        action={<Button variant="primary" onClick={() => { setFormData({ email: '', first_name: '', last_name: '', role: 'employee', department: '', branch_id: '' }); setIsInviteOpen(true) }}>Invite User</Button>} 
      />
      
      <div style={{ marginTop: '24px' }}>
        <DataTable data={users} columns={columns} isLoading={isLoading} />
      </div>

      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite User">
        <form onSubmit={(e) => { e.preventDefault(); inviteUser.mutate(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="First Name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required /></div>
            <div style={{ flex: 1 }}><Input label="Last Name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required /></div>
          </div>
          <Select label="Role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} options={[{value: 'company_admin', label: 'Company Admin'}, {value: 'manager', label: 'Manager'}, {value: 'team_leader', label: 'Team Leader'}, {value: 'employee', label: 'Employee'}]} required />
          <Select label="Branch (Optional)" value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} options={[{value: '', label: 'None'}, ...branchOptions]} />
          <Select label="Department (Optional)" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} options={[{value: '', label: 'None'}, ...deptOptions]} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={inviteUser.isPending}>{inviteUser.isPending ? 'Inviting...' : 'Send Invite'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit User">
        <form onSubmit={(e) => { e.preventDefault(); updateUser.mutate({ first_name: formData.first_name, last_name: formData.last_name, role: formData.role, department: formData.department, branch_id: formData.branch_id || null }); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="First Name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required /></div>
            <div style={{ flex: 1 }}><Input label="Last Name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required /></div>
          </div>
          <Select label="Role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} options={[{value: 'company_admin', label: 'Company Admin'}, {value: 'manager', label: 'Manager'}, {value: 'team_leader', label: 'Team Leader'}, {value: 'employee', label: 'Employee'}]} required />
          <Select label="Branch (Optional)" value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} options={[{value: '', label: 'None'}, ...branchOptions]} />
          <Select label="Department (Optional)" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} options={[{value: '', label: 'None'}, ...deptOptions]} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={updateUser.isPending}>{updateUser.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user? They will no longer be able to log in."
        onConfirm={() => deactivateUser.mutate(userToDeactivate)}
      />
    </div>
  )
}
