import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

export function Tasks() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState('table')
  const [showModal, setShowModal] = useState(false)

  const [formData, setFormData] = useState({
    title: '', description: '', project_id: '', assigned_to: '', priority: 'medium', status: 'todo', due_date: '', estimated_hours: ''
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('tasks')
        .select(`
          *,
          projects(name),
          assignee:profiles!assigned_to(first_name, last_name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('projects').select('id, name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('profiles').select('id, first_name, last_name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const createTask = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('tasks').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', company?.id])
      setShowModal(false)
      setFormData({ title: '', description: '', project_id: '', assigned_to: '', priority: 'medium', status: 'todo', due_date: '', estimated_hours: '' })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createTask.mutate({
      ...formData,
      company_id: company.id,
      assigned_by: user.id,
      project_id: formData.project_id || null,
      assigned_to: formData.assigned_to || null,
      due_date: formData.due_date || null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null
    })
  }

  const formatStatus = (s) => s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  const columns = [
    { header: 'Title', accessorKey: 'title', cell: info => <span style={{ fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Project', accessorKey: 'projects.name', cell: info => info.getValue() || '-' },
    { header: 'Assignee', accessorKey: 'assignee', cell: info => info.getValue() ? `${info.getValue().first_name} ${info.getValue().last_name}` : 'Unassigned' },
    { 
      header: 'Priority', 
      accessorKey: 'priority',
      cell: info => <Badge variant={info.getValue() === 'high' || info.getValue() === 'critical' ? 'inactive' : 'default'} label={formatStatus(info.getValue())} />
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: info => {
        const val = info.getValue()
        const variants = { 'todo': 'default', 'in_progress': 'active', 'in_review': 'inactive', 'done': 'success', 'cancelled': 'inactive' }
        return <Badge variant={variants[val] || 'default'} label={formatStatus(val)} />
      }
    },
    { header: 'Due Date', accessorKey: 'due_date', cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : '-' },
    { 
      header: 'Actions', 
      id: 'actions',
      cell: () => <button style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer' }}>View</button>
    }
  ]

  return (
    <div>
      <PageHeader 
        title="Tasks" 
        subtitle="Manage all operational tasks"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>New Task</Button>}
      />

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--gp-background)', padding: '4px', border: '1px solid var(--gp-border-light)' }}>
          <button onClick={() => setViewMode('table')} style={{ padding: '6px 16px', background: viewMode === 'table' ? 'var(--gp-card)' : 'transparent', color: 'var(--gp-black)', border: 'none', cursor: 'pointer', fontWeight: viewMode === 'table' ? 600 : 400 }}>List</button>
          <button onClick={() => setViewMode('board')} style={{ padding: '6px 16px', background: viewMode === 'board' ? 'var(--gp-card)' : 'transparent', color: 'var(--gp-black)', border: 'none', cursor: 'pointer', fontWeight: viewMode === 'board' ? 600 : 400 }}>Board</button>
        </div>
        <div style={{ width: '150px' }}><Select options={[{value: 'all', label: 'All Projects'}]} defaultValue="all" /></div>
        <div style={{ width: '150px' }}><Select options={[{value: 'all', label: 'All Assignees'}]} defaultValue="all" /></div>
        <div style={{ width: '150px' }}><Select options={[{value: 'all', label: 'All Statuses'}]} defaultValue="all" /></div>
      </div>

      {viewMode === 'table' ? (
        <DataTable columns={columns} data={tasks} isLoading={loadingTasks} />
      ) : (
        <div style={{ color: '#6B7280' }}>Kanban board view across all tasks...</div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Task">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Task Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          <Input label="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Select 
                label="Project" 
                value={formData.project_id} 
                onChange={e => setFormData({...formData, project_id: e.target.value})}
                options={[{value: '', label: '-- None --'}, ...projects.map(p => ({value: p.id, label: p.name}))]} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select 
                label="Assigned To" 
                value={formData.assigned_to} 
                onChange={e => setFormData({...formData, assigned_to: e.target.value})}
                options={[{value: '', label: '-- None --'}, ...profiles.map(p => ({value: p.id, label: `${p.first_name} ${p.last_name}`}))]} 
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Select label="Status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} options={[{value: 'todo', label: 'To Do'}, {value: 'in_progress', label: 'In Progress'}, {value: 'in_review', label: 'In Review'}, {value: 'done', label: 'Done'}]} />
            </div>
            <div style={{ flex: 1 }}>
              <Select label="Priority" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} options={[{value: 'low', label: 'Low'}, {value: 'medium', label: 'Medium'}, {value: 'high', label: 'High'}, {value: 'critical', label: 'Critical'}]} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Due Date" type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /></div>
            <div style={{ flex: 1 }}><Input label="Est. Hours" type="number" step="0.5" value={formData.estimated_hours} onChange={e => setFormData({...formData, estimated_hours: e.target.value})} /></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createTask.isPending}>{createTask.isPending ? 'Saving...' : 'Create Task'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
