import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'

export function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    password: '',
    confirmPassword: ''
  })

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
      // 1. Fetch pending invitation
      const { data: invite, error: inviteErr } = await insforge
        .from('employee_invitations')
        .select('*')
        .eq('email', formData.workEmail)
        .maybeSingle()

      if (inviteErr) throw inviteErr
      if (!invite) {
        throw new Error("No pending invitation found for this email address. Please make sure your manager has added you to the Employee Directory first.")
      }

      // 2. Sign up user
      const { data: authData, error: authError } = await insforge.auth.signUp({
        email: formData.workEmail,
        password: formData.password
      })
      if (authError) throw authError

      // 3. Insert profile with invitation details
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

      // 4. Delete the invitation
      await insforge
        .from('employee_invitations')
        .delete()
        .eq('id', invite.id)

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

  return (
    <div>
      <Logo size={140} showText={true} style={{ margin: '0 auto 32px' }} />
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: "var(--gp-black)" }}>
        Join Goodison Park Properties
      </h2>

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
        <Input label="Invited Email Address" type="email" name="workEmail" value={formData.workEmail} onChange={handleChange} required />
        
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

      <div style={{ marginTop: '48px', textAlign: 'center', fontSize: '11px', color: 'var(--gp-muted)', opacity: 0.5, letterSpacing: '1px', textTransform: 'uppercase' }}>
        Goodison Park Properties
      </div>
    </div>
  )
}
