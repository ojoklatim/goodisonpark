import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { Building2 } from 'lucide-react'

export function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [invite, setInvite] = useState(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [inviteError, setInviteError] = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [companyLogo, setCompanyLogo] = useState(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setInviteError("This invite link is invalid or has expired. Contact your administrator.")
        setInviteLoading(false)
        return
      }

      try {
        const { data, error: fetchErr } = await insforge
          .from('employee_invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle()

        if (fetchErr) throw fetchErr

        if (!data) {
          setInviteError("This invite link is invalid or has expired. Contact your administrator.")
          return
        }

        const isExpired = new Date(data.expires_at) < new Date()
        if (data.status !== 'pending' || isExpired) {
          setInviteError("This invite link is invalid or has expired. Contact your administrator.")
          return
        }

        setInvite(data)
        setFormData(prev => ({
          ...prev,
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          workEmail: data.email || ''
        }))

        // Fetch company name and logo
        const { data: compData } = await insforge
          .from('companies')
          .select('name, logo_url')
          .eq('id', data.company_id)
          .maybeSingle()
        
        if (compData) {
          setCompanyName(compData.name)
          setCompanyLogo(compData.logo_url)
        }
      } catch (err) {
        console.error("Token validation error:", err)
        setInviteError("An error occurred validating your invitation link.")
      } finally {
        setInviteLoading(false)
      }
    }

    validateToken()
  }, [token])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    setError(null)
    try {
      // 1. Sign up user auth credentials
      const { data: authData, error: authError } = await insforge.auth.signUp({
        email: formData.workEmail,
        password: formData.password
      })
      if (authError) throw authError

      // 2. Insert profile record using fields stored in invitation
      const { error: profileError } = await insforge
        .from('profiles')
        .insert({
          id: authData.user.id,
          company_id: invite.company_id,
          branch_id: invite.branch_id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: invite.phone,
          role: invite.role,
          department: invite.department,
          job_title: invite.job_title,
          employee_code: invite.employee_code,
          date_joined: invite.date_joined,
          is_active: true
        })
      
      if (profileError) throw profileError

      // 3. Fetch company details
      const { data: companyData, error: companyError } = await insforge
        .from('companies')
        .select('*')
        .eq('id', invite.company_id)
        .single()
      if (companyError) throw companyError

      // 4. Fetch role permissions
      const { data: permissionsData, error: permissionsError } = await insforge
        .from('role_permissions')
        .select('*')
        .eq('company_id', invite.company_id)
        .eq('role', invite.role)
      if (permissionsError) throw permissionsError

      const permissionsMap = {}
      if (permissionsData) {
        permissionsData.forEach(perm => {
          permissionsMap[perm.module] = {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
            can_export: perm.can_export
          }
        })
      }

      // 5. Soft-update invitation status to accepted
      const { error: inviteUpdateError } = await insforge
        .from('employee_invitations')
        .update({ status: 'accepted' })
        .eq('id', invite.id)

      if (inviteUpdateError) {
        console.error("Failed to soft-update invitation status:", inviteUpdateError)
      }

      // 6. Set auth session in store
      useAuthStore.getState().setAuth({
        user: authData.user,
        profile: {
          id: authData.user.id,
          company_id: invite.company_id,
          branch_id: invite.branch_id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: invite.phone,
          role: invite.role,
          department: invite.department,
          job_title: invite.job_title,
          employee_code: invite.employee_code,
          date_joined: invite.date_joined,
          is_active: true
        },
        company: companyData,
        role: invite.role,
        permissions: permissionsMap
      })

      navigate('/dashboard/overview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const pwdLength = formData.password.length
  let pwdStrength = 0
  if (pwdLength > 0) pwdStrength = 1
  if (pwdLength >= 6) pwdStrength = 2
  if (pwdLength >= 8) pwdStrength = 3
  if (pwdLength >= 8 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password)) pwdStrength = 4

  if (inviteLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Spinner size="lg" />
        <p style={{ marginTop: '16px', color: 'var(--gp-muted)', fontSize: '14px' }}>Validating invite link...</p>
      </div>
    )
  }

  if (inviteError) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', background: 'var(--gp-blue-glow)', border: '1px solid var(--gp-blue)', color: 'var(--gp-blue)', marginBottom: '16px' }}>
          <Building2 size={32} />
        </div>
        <div style={{ padding: '20px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '24px', borderRadius: 0, fontSize: '14px', lineHeight: 1.5 }}>
          {inviteError}
        </div>
        <Link to="/auth/login" style={{ color: "var(--gp-blue)", fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
          Back to Login
        </Link>
      </div>
    )
  }

  return (
    <div>
      {companyLogo && (
        <img src={companyLogo} alt={companyName} style={{ maxHeight: '64px', maxWidth: '200px', margin: '0 auto 24px', display: 'block', objectFit: 'contain' }} />
      )}

      {error && (
        <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '16px', borderRadius: 0, fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
          </div>
        </div>
        <Input label="Invited Email Address" type="email" name="workEmail" value={formData.workEmail} readOnly required />
        
        <div>
          <Input label="Create Password" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={8} />
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            <div style={{ flex: 1, height: '4px', background: pwdStrength >= 1 ? '#EF4444' : "var(--gp-border-light)", transition: 'background 0.3s' }} />
            <div style={{ flex: 1, height: '4px', background: pwdStrength >= 2 ? '#F59E0B' : "var(--gp-border-light)", transition: 'background 0.3s' }} />
            <div style={{ flex: 1, height: '4px', background: pwdStrength >= 3 ? "var(--gp-blue)" : "var(--gp-border-light)", transition: 'background 0.3s' }} />
            <div style={{ flex: 1, height: '4px', background: pwdStrength >= 4 ? '#22C55E' : "var(--gp-border-light)", transition: 'background 0.3s' }} />
          </div>
          <span style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px', display: 'block' }}>Min 8 chars, uppercase, number</span>
        </div>

        <Input label="Confirm Password" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
        
        <Button type="submit" variant="primary" style={{ marginTop: '8px' }} disabled={loading}>
          {loading ? 'Joining...' : 'Join Company'}
        </Button>
      </form>

      <p style={{ marginTop: '24px', fontSize: '14px', textAlign: 'center', color: 'var(--gp-muted)' }}>
        Already have an account?{' '}
        <Link to="/auth/login" style={{ color: "var(--gp-blue)", fontWeight: 600, textDecoration: 'none' }}>
          Sign In
        </Link>
      </p>
    </div>
  )
}
