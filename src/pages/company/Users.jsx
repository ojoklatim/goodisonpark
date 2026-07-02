import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { useCreateInvitation } from '../../hooks/useCreateInvitation'
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
  const [createdInvite, setCreatedInvite] = useState(null)

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
        .from('profiles_view')
        .select(`*, branches(name)`)
        .eq('company_id', company?.id)
      if (error) throw error
      
      return data.map(u => ({
        ...u,
        auth_users: { email: u.email }
      }))
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
  const inviteUser = useCreateInvitation()

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

      <Modal isOpen={isInviteOpen} onClose={() => { setIsInviteOpen(false); setCreatedInvite(null); inviteUser.reset(); }} title="Invite User">
        {createdInvite ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0', width: '450px' }}>
            <div style={{ padding: '16px', background: '#ECFDF5', border: '1px solid #10B981', color: '#065F46' }}>
              <h4 style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Invitation Created Successfully!</h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                An invitation email has been sent to <strong>{createdInvite.email}</strong>. 
                You can also manually copy and share the link below:
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                readOnly 
                value={`${window.location.origin}/auth/register?token=${createdInvite.token}`} 
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--gp-border-light)', background: '#F9FAFB', fontSize: '13px', color: 'var(--gp-muted)' }}
                onClick={(e) => e.target.select()}
              />
              <Button 
                variant="secondary" 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/auth/register?token=${createdInvite.token}`);
                  alert('Copied to clipboard!');
                }}
              >
                Copy Link
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <Button 
                variant="primary" 
                onClick={() => {
                  setIsInviteOpen(false);
                  setCreatedInvite(null);
                  inviteUser.reset();
                  setFormData({ email: '', first_name: '', last_name: '', role: 'employee', department: '', branch_id: '' });
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); inviteUser.mutate(formData, { onSuccess: (data) => setCreatedInvite(data) }); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {inviteUser.isError && (
              <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', fontSize: '14px' }}>
                {inviteUser.error.message}
              </div>
            )}
            <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}><Input label="First Name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required /></div>
              <div style={{ flex: 1 }}><Input label="Last Name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required /></div>
            </div>
            <Select label="Role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} options={[{value: 'employee', label: 'Employee'}, {value: 'team_leader', label: 'Team Leader'}, {value: 'manager', label: 'Manager'}, {value: 'company_admin', label: 'Company Admin'}]} required />
            <Select label="Branch (Optional)" value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} options={[{value: '', label: 'None'}, ...branchOptions]} />
            <Select label="Department (Optional)" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} options={[{value: '', label: 'None'}, ...deptOptions]} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <Button type="button" variant="secondary" onClick={() => { setIsInviteOpen(false); inviteUser.reset(); }}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={inviteUser.isPending}>{inviteUser.isPending ? 'Inviting...' : 'Send Invite'}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit User">
        <form onSubmit={(e) => { e.preventDefault(); updateUser.mutate({ first_name: formData.first_name, last_name: formData.last_name, role: formData.role, department: formData.department, branch_id: formData.branch_id || null }); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {updateUser.isError && (
            <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', fontSize: '14px' }}>
              {updateUser.error.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="First Name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required /></div>
            <div style={{ flex: 1 }}><Input label="Last Name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required /></div>
          </div>
          <Select label="Role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} options={[{value: 'employee', label: 'Employee'}, {value: 'team_leader', label: 'Team Leader'}, {value: 'manager', label: 'Manager'}, {value: 'company_admin', label: 'Company Admin'}]} required />
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
