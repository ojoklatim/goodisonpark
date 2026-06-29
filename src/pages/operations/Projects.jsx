import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Link } from 'react-router-dom'
import { getInitials } from '../../lib/utils'

export function Projects() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const [formData, setFormData] = useState({
    name: '', description: '', department_id: '', status: 'planning', priority: 'medium', start_date: '', due_date: ''
  })

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('projects')
        .select(`
          *,
          departments(name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('tasks')
        .select(`
          id, project_id, status,
          assignee:profiles!assigned_to(id, first_name, last_name)
        `)
        .eq('company_id', company?.id)
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

  const createProject = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('projects').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', company?.id])
      setShowModal(false)
      setFormData({ name: '', description: '', department_id: '', status: 'planning', priority: 'medium', start_date: '', due_date: '' })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createProject.mutate({
      ...formData,
      company_id: company.id,
      created_by: user.id
    })
  }

  const getStatusColor = (status) => {
    if (status === 'active') return "var(--gp-blue)"
    if (status === 'completed') return '#22C55E'
    if (status === 'planning') return '#F59E0B'
    if (status === 'cancelled') return '#EF4444'
    return "var(--gp-border-light)"
  }

  const formatStatus = (s) => s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  const projectStats = projects.map(proj => {
    const projTasks = tasks.filter(t => t.project_id === proj.id)
    const completedTasks = projTasks.filter(t => t.status === 'done').length
    const progress = projTasks.length > 0 ? Math.round((completedTasks / projTasks.length) * 100) : 0
    
    // Extract unique team members from tasks
    const teamMap = {}
    projTasks.forEach(t => {
      if (t.assignee) teamMap[t.assignee.id] = t.assignee
    })
    const team = Object.values(teamMap)

    return { ...proj, progress, team }
  })

  return (
    <div>
      <PageHeader 
        title="Projects" 
        subtitle="Manage company initiatives"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>New Project</Button>}
      />

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ width: '200px' }}><Select options={[{value: 'all', label: 'All Statuses'}]} defaultValue="all" /></div>
        <div style={{ width: '200px' }}><Select options={[{value: 'all', label: 'All Priorities'}]} defaultValue="all" /></div>
        <div style={{ width: '200px' }}><Select options={[{value: 'all', label: 'All Departments'}]} defaultValue="all" /></div>
      </div>

      {(loadingProjects || loadingTasks) ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {projectStats.map(proj => (
            <Card key={proj.id} style={{ borderLeft: `4px solid ${getStatusColor(proj.status)}` }}>
              <div style={{ padding: '20px' }}>
                <Link to={`/dashboard/operations/projects/${proj.id}`} style={{ fontSize: '16px', fontWeight: 700, color: "var(--gp-black)", textDecoration: 'none', display: 'block', marginBottom: '12px' }}>
                  {proj.name}
                </Link>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <Badge variant={proj.status === 'completed' ? 'success' : proj.status === 'active' ? 'active' : 'default'} label={formatStatus(proj.status)} />
                  <Badge variant={proj.priority === 'high' || proj.priority === 'critical' ? 'inactive' : 'default'} label={formatStatus(proj.priority)} />
                </div>
                <div style={{ color: '#4B5563', fontSize: '13px', marginBottom: '8px' }}>
                  <strong>Department:</strong> {proj.departments?.name || 'None'}
                </div>
                <div style={{ color: '#4B5563', fontSize: '13px', marginBottom: '16px' }}>
                  <strong>Due Date:</strong> {proj.due_date || '-'}
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Progress</span>
                    <span style={{ fontWeight: 600 }}>{proj.progress}%</span>
                  </div>
                  <div style={{ height: '6px', background: "var(--gp-border-light)" }}>
                    <div style={{ height: '100%', width: `${proj.progress}%`, background: getStatusColor(proj.status) }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {proj.team.slice(0, 5).map((member, i) => (
                    <div key={member.id} title={`${member.first_name} ${member.last_name}`} style={{ width: '28px', height: '28px', background: "var(--gp-card)", color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, border: '2px solid #FFFFFF', marginLeft: i > 0 ? '-8px' : 0, zIndex: 10 - i }}>
                      {getInitials(member.first_name, member.last_name)}
                    </div>
                  ))}
                  {proj.team.length > 5 && (
                    <div style={{ width: '28px', height: '28px', background: '#F3F4F6', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, border: '2px solid #FFFFFF', marginLeft: '-8px', zIndex: 1 }}>
                      +{proj.team.length - 5}
                    </div>
                  )}
                  {proj.team.length === 0 && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>No assignees</span>}
                </div>
              </div>
            </Card>
          ))}
          {projectStats.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
              No projects found. Create one to get started.
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Project">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Project Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <Input label="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <Select 
            label="Department" 
            value={formData.department_id} 
            onChange={e => setFormData({...formData, department_id: e.target.value})}
            options={[{value: '', label: '-- None --'}, ...departments.map(d => ({value: d.id, label: d.name}))]} 
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Select label="Status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} options={[{value: 'planning', label: 'Planning'}, {value: 'active', label: 'Active'}, {value: 'on_hold', label: 'On Hold'}, {value: 'completed', label: 'Completed'}, {value: 'cancelled', label: 'Cancelled'}]} />
            </div>
            <div style={{ flex: 1 }}>
              <Select label="Priority" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} options={[{value: 'low', label: 'Low'}, {value: 'medium', label: 'Medium'}, {value: 'high', label: 'High'}, {value: 'critical', label: 'Critical'}]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Start Date" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} /></div>
            <div style={{ flex: 1 }}><Input label="Due Date" type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createProject.isPending}>{createProject.isPending ? 'Creating...' : 'Create Project'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
