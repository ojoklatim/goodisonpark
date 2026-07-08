import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'
import { useAuthStore } from '../../store/authStore'

export function RegisterCompany() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRegister = async (e) => {
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
        email: formData.email,
        password: formData.password
      })
      if (authError) throw authError
      
      const user = authData.user
      if (!user) throw new Error("Registration failed. Please try again.")

      // 2. Create Company
      const slug = formData.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      const { data: companyData, error: companyError } = await insforge
        .from('companies')
        .insert({
          name: formData.companyName,
          slug: slug,
          subscription_plan: 'enterprise', // default for first company
          is_active: true
        })
        .select()
        .single()
        
      if (companyError) throw companyError

      // 3. Create Admin Profile
      const { data: profileData, error: profileError } = await insforge
        .from('profiles')
        .insert({
          id: user.id,
          company_id: companyData.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: 'super_admin',
          is_active: true,
          date_joined: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()
        
      if (profileError) throw profileError

      // 4. Set auth session in store
      setAuth({
        user: user,
        profile: profileData,
        company: companyData,
        role: 'super_admin',
        permissions: {} // super_admin has full access anyway, or you can populate default permissions
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

  return (
    <div>
      <Logo size={140} showText={true} style={{ margin: '0 auto 32px' }} />
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: "var(--gp-black)" }}>
        Register Your Company
      </h2>

      {error && (
        <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '16px', borderRadius: 0, fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input label="Company Name" name="companyName" value={formData.companyName} onChange={handleChange} required />
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <Input label="Admin First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="Admin Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
          </div>
        </div>
        
        <Input label="Admin Email Address" type="email" name="email" value={formData.email} onChange={handleChange} required />
        
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
          {loading ? 'Registering...' : 'Register Company'}
        </Button>
      </form>

      <p style={{ marginTop: '24px', fontSize: '14px', textAlign: 'center', color: 'var(--gp-muted)' }}>
        Already have a company account?{' '}
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
