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
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { format } from 'date-fns'

export function Directory() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone: '', email: '', employee_code: '',
    department: '', job_title: '', branch_id: '', role: 'employee', date_joined: new Date().toISOString().split('T')[0]
  })

  // Queries
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', company?.id],
    queryFn: async () => {
      // 1. Fetch active profiles
      const { data: activeProfiles, error: activeErr } = await insforge
        .from('profiles')
        .select(`*, branches(name), auth_users:id(email)`)
        .eq('company_id', company?.id)
        .order('first_name', { ascending: true })
      if (activeErr) throw activeErr

      // 2. Fetch pending invitations
      const { data: invitations, error: inviteErr } = await insforge
        .from('employee_invitations')
        .select(`*, branches(name)`)
        .eq('company_id', company?.id)
      if (inviteErr) throw inviteErr

      // 3. Map invitations to profile structure
      const pendingEmployees = (invitations || []).map(inv => ({
        id: inv.id,
        first_name: inv.first_name,
        last_name: inv.last_name,
        phone: inv.phone,
        employee_code: inv.employee_code,
        department: inv.department,
        job_title: inv.job_title,
        branch_id: inv.branch_id,
        branches: inv.branches,
        role: inv.role,
        date_joined: inv.date_joined,
        is_active: false,
        status: 'pending',
        auth_users: { email: inv.email }
      }))

      // 4. Combine them
      return [
        ...pendingEmployees,
        ...activeProfiles.map(p => ({ ...p, status: p.is_active ? 'active' : 'inactive' }))
      ]
    },
    enabled: !!company?.id
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('departments').select('name').eq('company_id', company?.id)
      if (error) throw error
      return data.map(d => d.name)
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

  const addEmployee = useMutation({
    mutationFn: async (newData) => {
      const { error } = await insforge.from('employee_invitations').insert([{
        company_id: company.id,
        first_name: newData.first_name,
        last_name: newData.last_name,
        phone: newData.phone || null,
        email: newData.email,
        employee_code: newData.employee_code || null,
        department: newData.department || null,
        job_title: newData.job_title || null,
        branch_id: newData.branch_id || null,
        role: newData.role,
        date_joined: newData.date_joined || null
      }])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['employees', company?.id])
      setIsAddOpen(false)
      setFormData({
        first_name: '', last_name: '', phone: '', email: '', employee_code: '',
        department: '', job_title: '', branch_id: '', role: 'employee', date_joined: new Date().toISOString().split('T')[0]
      })
    }
  })

  const filteredEmployees = employees.filter(emp => {
    const s = search.toLowerCase()
    const matchesSearch = emp.first_name.toLowerCase().includes(s) || 
                          emp.last_name.toLowerCase().includes(s) || 
                          (emp.employee_code || '').toLowerCase().includes(s)
    const matchesDept = deptFilter ? emp.department === deptFilter : true
    const matchesRole = roleFilter ? emp.role === roleFilter : true
    const matchesStatus = statusFilter === 'active' ? emp.is_active : statusFilter === 'inactive' ? !emp.is_active : true
    
    return matchesSearch && matchesDept && matchesRole && matchesStatus
  })

  const columns = [
    {
      header: 'Avatar',
      cell: ({ row }) => (
        <div style={{ width: '32px', height: '32px', background: "var(--gp-card)", color: "var(--gp-blue)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
          {row.original.avatar_url ? <img src={row.original.avatar_url} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : `${(row.original.first_name || '')[0] || ''}${(row.original.last_name || '')[0] || ''}`}
        </div>
      )
    },
    { header: 'Emp Code', accessorKey: 'employee_code', cell: (info) => info.getValue() || '-' },
    { 
      header: 'Name', 
      cell: ({ row }) => {
        const isPending = row.original.status === 'pending'
        return (
          <span 
            style={{ 
              fontWeight: 600, 
              color: isPending ? 'var(--gp-muted)' : "var(--gp-blue)", 
              cursor: isPending ? 'default' : 'pointer' 
            }} 
            onClick={() => { if (!isPending) navigate(`/dashboard/employees/${row.original.id}`) }}
          >
            {row.original.first_name} {row.original.last_name}
          </span>
        )
      } 
    },
    { header: 'Department', accessorKey: 'department', cell: (info) => info.getValue() || '-' },
    { header: 'Job Title', accessorKey: 'job_title', cell: (info) => info.getValue() || '-' },
    { header: 'Role', accessorKey: 'role', cell: (info) => <Badge variant="gray">{info.getValue().replace('_', ' ')}</Badge> },
    { header: 'Date Joined', accessorKey: 'date_joined', cell: (info) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : '-' },
    { 
      header: 'Status', 
      accessorKey: 'status', 
      cell: ({ row }) => {
        if (row.original.status === 'pending') {
          return <Badge status="pending" label="Pending Sign Up" />
        }
        return <Badge status={row.original.is_active ? 'active' : 'inactive'} />
      } 
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => {
        const isPending = row.original.status === 'pending'
        return (
          <Button 
            variant="secondary" 
            size="sm" 
            disabled={isPending} 
            onClick={() => navigate(`/dashboard/employees/${row.original.id}`)}
          >
            Profile
          </Button>
        )
      }
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Employee Directory" 
        action={<Button variant="primary" onClick={() => setIsAddOpen(true)}>Add Employee</Button>}
      />

      <div style={{ display: 'flex', gap: '16px', margin: '24px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search by name or code..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #D1D5DB', borderRadius: 0, fontSize: '14px' }}
          />
        </div>
        <div style={{ width: '160px' }}>
          <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} options={[{value: '', label: 'All Departments'}, ...departments.map(d => ({value: d, label: d}))]} />
        </div>
        <div style={{ width: '160px' }}>
          <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} options={[{value: '', label: 'All Roles'}, {value: 'company_admin', label: 'Company Admin'}, {value: 'manager', label: 'Manager'}, {value: 'team_leader', label: 'Team Leader'}, {value: 'employee', label: 'Employee'}]} />
        </div>
        <div style={{ width: '160px' }}>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{value: 'all', label: 'All Statuses'}, {value: 'active', label: 'Active'}, {value: 'inactive', label: 'Inactive'}]} />
        </div>
      </div>

      <DataTable data={filteredEmployees} columns={columns} isLoading={isLoading} />

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Employee">
        <form onSubmit={e => { e.preventDefault(); addEmployee.mutate(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '600px' }}>
          
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: "var(--gp-black)", margin: '0 0 12px 0', borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px' }}>Personal Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input label="First Name*" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
              <Input label="Last Name*" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required />
              <Input label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: "var(--gp-black)", margin: '0 0 12px 0', borderBottom: "1px solid var(--gp-border-light)", paddingBottom: '8px' }}>Work Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input label="Email* (for login)" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              <Input label="Employee Code" value={formData.employee_code} onChange={e => setFormData({...formData, employee_code: e.target.value})} />
              <Input label="Job Title" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} />
              <Select label="Department" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} options={[{value: '', label: 'None'}, ...departments.map(d => ({value: d, label: d}))]} />
              <Select label="Branch" value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} options={[{value: '', label: 'None'}, ...branches.map(b => ({value: b.id, label: b.name}))]} />
              <Select label="Role*" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} options={[{value: 'company_admin', label: 'Company Admin'}, {value: 'manager', label: 'Manager'}, {value: 'team_leader', label: 'Team Leader'}, {value: 'employee', label: 'Employee'}]} required />
              <Input label="Date Joined" type="date" value={formData.date_joined} onChange={e => setFormData({...formData, date_joined: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={addEmployee.isPending}>{addEmployee.isPending ? 'Saving...' : 'Add Employee'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
