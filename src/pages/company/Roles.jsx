import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

const ROLES = [
  { id: 'company_admin', title: 'Company Admin', desc: 'Full access to all modules and settings.' },
  { id: 'manager', title: 'Manager', desc: 'Can manage teams, approve requests, view reports.' },
  { id: 'team_leader', title: 'Team Leader', desc: 'Can manage their team tasks and basic operations.' },
  { id: 'employee', title: 'Employee', desc: 'Basic access to their own tasks, leaves, and profile.' }
]

const MODULES = ['sales', 'hr', 'finance', 'operations', 'reports', 'settings']

export function Roles() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  
  const [selectedRole, setSelectedRole] = useState(null)

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role_permissions', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('role_permissions')
        .select('*')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  // Group permissions by role
  const permissionsByRole = {}
  permissions.forEach(p => {
    if (!permissionsByRole[p.role]) permissionsByRole[p.role] = {}
    permissionsByRole[p.role][p.module] = p
  })

  // Local state for editing permissions
  const [editingPerms, setEditingPerms] = useState({})

  const handleSelectRole = (roleId) => {
    setSelectedRole(roleId)
    // Initialize editing state for this role
    const initial = {}
    MODULES.forEach(mod => {
      const p = permissionsByRole[roleId]?.[mod] || { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false }
      initial[mod] = { ...p, module: mod, role: roleId, company_id: company.id }
    })
    setEditingPerms(initial)
  }

  const handleCheckbox = (mod, field, checked) => {
    setEditingPerms(prev => ({
      ...prev,
      [mod]: {
        ...prev[mod],
        [field]: checked
      }
    }))
  }

  const savePermissions = useMutation({
    mutationFn: async () => {
      const updates = Object.values(editingPerms)
      
      // Upsert permissions
      for (const update of updates) {
        if (update.id) {
          await insforge.from('role_permissions').update({
            can_view: update.can_view,
            can_create: update.can_create,
            can_edit: update.can_edit,
            can_delete: update.can_delete,
            can_export: update.can_export
          }).eq('id', update.id)
        } else {
          await insforge.from('role_permissions').insert(update)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['role_permissions', company?.id])
      alert('Permissions saved successfully')
    }
  })

  if (isLoading) return <div className="p-6"><Spinner /></div>

  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Manage access control across the platform." />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginTop: '24px' }}>
        {ROLES.map(role => (
          <div 
            key={role.id} 
            onClick={() => handleSelectRole(role.id)}
            style={{ 
              background: "var(--gp-card)", 
              border: selectedRole === role.id ? '2px solid #38BDF8' : '1px solid #E5E7EB', 
              padding: '24px', 
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: selectedRole === role.id ? '0 4px 12px rgba(56,189,248,0.1)' : 'none'
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: "var(--gp-black)" }}>{role.title}</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>{role.desc}</p>
          </div>
        ))}
      </div>

      {selectedRole && (
        <div style={{ marginTop: '32px', background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: "var(--gp-black)", margin: 0 }}>
              Edit Permissions: {ROLES.find(r => r.id === selectedRole)?.title}
            </h3>
            <Button variant="primary" onClick={() => savePermissions.mutate()} disabled={savePermissions.isPending}>
              {savePermissions.isPending ? 'Saving...' : 'Save Permissions'}
            </Button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: 'var(--gp-black)', borderBottom: '1px solid #2A2A2A', fontWeight: 600, fontSize: '14px' }}>Module</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: 'var(--gp-black)', borderBottom: '1px solid #2A2A2A', fontWeight: 600, fontSize: '14px' }}>View</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: 'var(--gp-black)', borderBottom: '1px solid #2A2A2A', fontWeight: 600, fontSize: '14px' }}>Create</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: 'var(--gp-black)', borderBottom: '1px solid #2A2A2A', fontWeight: 600, fontSize: '14px' }}>Edit</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: 'var(--gp-black)', borderBottom: '1px solid #2A2A2A', fontWeight: 600, fontSize: '14px' }}>Delete</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: 'var(--gp-black)', borderBottom: '1px solid #2A2A2A', fontWeight: 600, fontSize: '14px' }}>Export</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => {
                const perms = editingPerms[mod] || {}
                return (
                  <tr key={mod} style={{ borderBottom: "1px solid var(--gp-border-light)" }}>
                    <td style={{ padding: '16px 12px', fontWeight: 500, color: '#111827', textTransform: 'capitalize' }}>{mod}</td>
                    {['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'].map(field => (
                      <td key={field} style={{ padding: '16px 12px' }}>
                        <input 
                          type="checkbox" 
                          checked={perms[field] || false}
                          onChange={(e) => handleCheckbox(mod, field, e.target.checked)}
                          disabled={selectedRole === 'company_admin'} // Company admin has full rights implicitly in logic, but let's just make it disabled here if wanted. Actually let's allow editing for demo, but typically super admins are locked.
                          style={{ width: '18px', height: '18px', cursor: 'pointer', borderRadius: 0, border: '1px solid #D1D5DB' }}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {selectedRole === 'company_admin' && (
            <p style={{ marginTop: '16px', fontSize: '14px', color: '#F59E0B' }}>
              Note: Company Admins bypass most permission checks by default.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
