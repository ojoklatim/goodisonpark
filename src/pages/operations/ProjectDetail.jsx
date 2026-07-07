import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { getInitials } from '../../lib/utils'

export function ProjectDetail() {
  const { id } = useParams()
  const { company } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('Overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '', description: '', department_id: '', status: 'planning', priority: 'medium', start_date: '', due_date: ''
  })

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('projects')
        .select(`
          *,
          departments(name)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', 'project', id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, job_title)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id
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


  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('projects').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', id])
      queryClient.invalidateQueries(['projects', company?.id])
      setShowEditModal(false)
    }
  })


  const handleEditClick = () => {
    setFormData({
      name: project.name || '',
      description: project.description || '',
      department_id: project.department_id || '',
      status: project.status || 'planning',
      priority: project.priority || 'medium',
      start_date: project.start_date || '',
      due_date: project.due_date || ''
    })
    setShowEditModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  if (loadingProject || loadingTasks) return <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
  if (!project) return <div>Project not found</div>

  const formatStatus = (s) => (s || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  const getStatusColor = (status) => {
    if (status === 'active') return "var(--gp-blue)"
    if (status === 'completed') return '#22C55E'
    if (status === 'planning') return '#F59E0B'
    if (status === 'cancelled') return '#EF4444'
    return "var(--gp-border-light)"
  }

  const completedTasks = tasks.filter(t => t.status === 'done').length
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

  const teamMap = {}
  tasks.forEach(t => {
    if (t.assignee) teamMap[t.assignee.id] = t.assignee
  })
  const team = Object.values(teamMap)

  const tabs = ['Overview', 'Tasks', 'Files', 'Activity']

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => navigate('/dashboard/operations/projects')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          &larr; Back to Projects
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Badge variant="default" label={project.departments?.name || 'No Department'} />
            <Badge variant={project.status === 'completed' ? 'success' : project.status === 'active' ? 'active' : 'default'} label={formatStatus(project.status)} />
            <Badge variant={project.priority === 'high' || project.priority === 'critical' ? 'inactive' : 'default'} label={formatStatus(project.priority)} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>{project.name}</h1>
          <div style={{ color: '#6B7280', fontSize: '14px', marginTop: '8px' }}>Due: {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'None'}</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="primary" onClick={handleEditClick}>Edit Project</Button>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
          <span>Overall Progress ({completedTasks} of {tasks.length} tasks)</span>
          <span style={{ fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ height: '8px', background: "var(--gp-border-light)" }}>
          <div style={{ height: '100%', width: `${progress}%`, background: getStatusColor(project.status), transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: "1px solid var(--gp-border-light)", gap: '24px' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 0', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #38BDF8' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--gp-blue-dim)" : "#6B7280",
              cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '24px' }}>
        {activeTab === 'Overview' && (
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={{ flex: 2 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Description</h3>
              <p style={{ color: '#4B5563', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {project.description || 'No description provided.'}
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '32px' }}>
                <div style={{ padding: '16px', background: '#F9FAFB', border: "1px solid var(--gp-border-light)" }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Total Tasks</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: "var(--gp-black)" }}>{tasks.length}</div>
                </div>
                <div style={{ padding: '16px', background: '#F9FAFB', border: "1px solid var(--gp-border-light)" }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Done</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#22C55E' }}>{completedTasks}</div>
                </div>
                <div style={{ padding: '16px', background: '#F9FAFB', border: "1px solid var(--gp-border-light)" }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>In Progress</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: "var(--gp-blue)" }}>{tasks.filter(t => t.status === 'in_progress').length}</div>
                </div>
                <div style={{ padding: '16px', background: '#F9FAFB', border: "1px solid var(--gp-border-light)" }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>To Do</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#F59E0B' }}>{tasks.filter(t => t.status === 'todo').length}</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Team</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {team.map(member => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: "var(--gp-card)", color: 'var(--gp-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                      {getInitials(member.first_name, member.last_name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{member.first_name} {member.last_name}</div>
                      <div style={{ color: '#6B7280', fontSize: '12px' }}>{member.job_title || 'Team Member'}</div>
                    </div>
                  </div>
                ))}
                {team.length === 0 && (
                  <div style={{ color: '#6B7280', fontSize: '13px' }}>No team members assigned to tasks yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Tasks' && (
          <div style={{ color: '#6B7280' }}>
            <p style={{ marginBottom: '16px' }}>Tasks for {project.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.map(t => (
                <div key={t.id} style={{ padding: '16px', border: "1px solid var(--gp-border-light)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Assigned to: {t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : 'Unassigned'}</div>
                  </div>
                  <Badge variant={t.status === 'done' ? 'success' : 'default'} label={formatStatus(t.status)} />
                </div>
              ))}
              {tasks.length === 0 && <div>No tasks found.</div>}
            </div>
          </div>
        )}
        {activeTab === 'Files' && <div style={{ color: '#6B7280' }}>Document upload + list coming soon.</div>}
        {activeTab === 'Activity' && <div style={{ color: '#6B7280' }}>Timeline of project changes coming soon.</div>}
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project">
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
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
