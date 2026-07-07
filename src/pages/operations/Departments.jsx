import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'

export function Departments() {
  const { company } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingDeptId, setEditingDeptId] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', head_id: '' })

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('departments')
        .select(`
          *,
          head:profiles!head_id(first_name, last_name)
        `)
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('profiles')
        .select('id, first_name, last_name, department')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('projects')
        .select('id, department_id, status')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingDeptId) {
        const { error } = await insforge
          .from('departments')
          .update({
            name: payload.name,
            description: payload.description,
            head_id: payload.head_id
          })
          .eq('id', editingDeptId)
        if (error) throw error
      } else {
        const { error } = await insforge.from('departments').insert([payload])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['departments', company?.id])
      setShowModal(false)
      setEditingDeptId(null)
      setFormData({ name: '', description: '', head_id: '' })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    saveMutation.mutate({
      company_id: company.id,
      name: formData.name,
      description: formData.description,
      head_id: formData.head_id || null
    })
  }

  const handleEditClick = (dept) => {
    setEditingDeptId(dept.id)
    setFormData({
      name: dept.name,
      description: dept.description || '',
      head_id: dept.head_id || ''
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingDeptId(null)
    setFormData({ name: '', description: '', head_id: '' })
  }

  const getEmpCount = (deptName) => profiles.filter(p => p.department === deptName).length
  const getProjCount = (deptId) => projects.filter(p => p.department_id === deptId && p.status !== 'completed' && p.status !== 'cancelled').length

  const isLoading = loadingDepts || loadingProfiles || loadingProjects

  return (
    <div>
      <PageHeader 
        title="Departments" 
        subtitle="Manage company departments and teams"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>New Department</Button>}
      />

      {isLoading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '24px' }}>
          {departments.map(dept => (
            <Card key={dept.id}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{dept.name}</h3>
                  <button onClick={() => handleEditClick(dept)} style={{ background: 'none', border: 'none', color: "var(--gp-blue)", cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Edit</button>
                </div>
                <div style={{ marginBottom: '16px', color: '#4B5563', fontSize: '14px' }}>
                  <strong>Head:</strong> {dept.head ? `${dept.head.first_name} ${dept.head.last_name}` : 'Not assigned'}
                </div>
                {dept.description && (
                  <div style={{ marginBottom: '16px', color: '#6B7280', fontSize: '13px' }}>
                    {dept.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '24px', borderTop: "1px solid var(--gp-border-light)", paddingTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employees</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: "var(--gp-black)" }}>{getEmpCount(dept.name)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Projects</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: "var(--gp-blue)" }}>{getProjCount(dept.id)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <Button variant="secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => navigate('/dashboard/employees', { state: { department: dept.name } })}>View Employees</Button>
                  <Button variant="secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => navigate('/dashboard/operations/projects', { state: { departmentId: dept.id } })}>View Projects</Button>
                </div>
              </div>
            </Card>
          ))}
          {departments.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
              No departments found. Create one to get started.
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={handleCloseModal} title={editingDeptId ? "Edit Department" : "New Department"}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            label="Department Name" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
          <Input 
            label="Description" 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})} 
          />
          <Select 
            label="Department Head" 
            value={formData.head_id} 
            onChange={e => setFormData({...formData, head_id: e.target.value})}
            options={[
              { value: '', label: '-- None --' },
              ...profiles.map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
