import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Building2 } from 'lucide-react'
import { Logo } from '../../components/ui/Logo'

export function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    companyName: '', industry: 'Real Estate', country: '', city: '', companyEmail: '', phone: '', website: '',
    firstName: '', lastName: '', workEmail: '', password: '', confirmPassword: '',
    plan: 'trial'
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleNext = () => setStep(step + 1)
  const handleBack = () => setStep(step - 1)

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await insforge.auth.signUp({
        email: formData.workEmail,
        password: formData.password
      })
      if (authError) throw authError

      const slug = formData.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()
      const { data: companyData, error: companyError } = await insforge
        .from('companies')
        .insert({
          name: formData.companyName,
          slug,
          industry: formData.industry,
          country: formData.country,
          city: formData.city,
          email: formData.companyEmail,
          phone: formData.phone,
          website: formData.website,
          subscription_plan: formData.plan
        })
        .select()
        .single()
      
      if (companyError) throw companyError

      const { error: profileError } = await insforge
        .from('profiles')
        .update({
          company_id: companyData.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: 'company_admin',
          phone: formData.phone
        })
        .eq('id', authData.user.id)
      
      if (profileError) throw profileError

      // Insert default role permissions
      const roles = ['company_admin', 'manager', 'team_leader', 'employee']
      const modules = ['sales', 'hr', 'finance', 'operations', 'reports', 'settings']
      const permsToInsert = []

      for (const role of roles) {
        for (const module of modules) {
          const isSuper = role === 'company_admin'
          const isManager = role === 'manager'
          permsToInsert.push({
            company_id: companyData.id,
            role: role,
            module: module,
            can_view: isSuper || isManager || role === 'employee',
            can_create: isSuper || isManager,
            can_edit: isSuper || isManager,
            can_delete: isSuper,
            can_export: isSuper || isManager
          })
        }
      }

      const { error: permsError } = await insforge
        .from('role_permissions')
        .insert(permsToInsert)

      if (permsError) throw permsError

      navigate('/dashboard/overview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const stepIndicatorColors = (s) => {
    if (step === s) return { bg: "var(--gp-blue)", border: "var(--gp-blue)", color: "var(--gp-black)" }
    if (step > s) return { bg: "var(--gp-background)", border: "var(--gp-background)", color: '#FFFFFF' }
    return { bg: 'transparent', border: '#D1D5DB', color: '#9CA3AF' }
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
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: "var(--gp-black)" }}>Register Company</h2>
      
      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {[1, 2, 3].map(s => {
          const style = stepIndicatorColors(s)
          return (
            <div key={s} style={{ 
              flex: 1, 
              height: '8px', 
              background: style.bg,
              border: `1px solid ${style.border}`,
              transition: 'all 0.3s',
              borderRadius: 0
            }} />
          )
        })}
      </div>
      <p style={{ marginBottom: '24px', fontWeight: 600, color: "var(--gp-black)", fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Step {step} of 3
      </p>

      {error && <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '16px', borderRadius: 0, fontSize: '14px' }}>{error}</div>}

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Company Name" name="companyName" value={formData.companyName} onChange={handleChange} required />
          <Select 
            label="Industry" 
            name="industry" 
            value={formData.industry} 
            onChange={handleChange}
            options={[
              { value: 'Real Estate', label: 'Real Estate' },
              { value: 'Finance', label: 'Finance' },
              { value: 'Retail', label: 'Retail' },
              { value: 'Technology', label: 'Technology' },
              { value: 'Healthcare', label: 'Healthcare' },
              { value: 'Other', label: 'Other' },
            ]}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Country" name="country" value={formData.country} onChange={handleChange} required /></div>
            <div style={{ flex: 1 }}><Input label="City" name="city" value={formData.city} onChange={handleChange} required /></div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Company Email" type="email" name="companyEmail" value={formData.companyEmail} onChange={handleChange} required /></div>
            <div style={{ flex: 1 }}><Input label="Phone" name="phone" value={formData.phone} onChange={handleChange} required /></div>
          </div>
          <Input label="Website (Optional)" name="website" value={formData.website} onChange={handleChange} />
          <Button type="submit" variant="primary" style={{ marginTop: '8px' }}>Next</Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required /></div>
            <div style={{ flex: 1 }}><Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required /></div>
          </div>
          <Input label="Work Email" type="email" name="workEmail" value={formData.workEmail} onChange={handleChange} required />
          
          <div>
            <Input label="Password" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={8} />
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              <div style={{ flex: 1, height: '4px', background: pwdStrength >= 1 ? '#EF4444' : "var(--gp-border-light)", transition: 'background 0.3s' }} />
              <div style={{ flex: 1, height: '4px', background: pwdStrength >= 2 ? '#F59E0B' : "var(--gp-border-light)", transition: 'background 0.3s' }} />
              <div style={{ flex: 1, height: '4px', background: pwdStrength >= 3 ? "var(--gp-blue)" : "var(--gp-border-light)", transition: 'background 0.3s' }} />
              <div style={{ flex: 1, height: '4px', background: pwdStrength >= 4 ? '#22C55E' : "var(--gp-border-light)", transition: 'background 0.3s' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px', display: 'block' }}>Min 8 chars, uppercase, number</span>
          </div>

          <Input label="Confirm Password" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <Button type="button" onClick={handleBack} variant="secondary" style={{ flex: 1 }}>Back</Button>
            <Button type="submit" variant="primary" style={{ flex: 1 }}>Next</Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#F9FAFB', padding: '16px', border: "1px solid var(--gp-border-light)", fontSize: '14px', borderRadius: 0 }}>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: "var(--gp-black)" }}>Company:</strong> {formData.companyName} ({formData.industry})</p>
            <p style={{ margin: 0 }}><strong style={{ color: "var(--gp-black)" }}>Admin:</strong> {formData.firstName} {formData.lastName} ({formData.workEmail})</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <input type="radio" name="plan" value="trial" checked={formData.plan === 'trial'} onChange={handleChange} style={{ display: 'none' }} />
              <div style={{ border: formData.plan === 'trial' ? '2px solid #38BDF8' : '1px solid #E5E7EB', padding: '16px', display: 'flex', justifyContent: 'space-between', transition: 'all 0.2s', background: formData.plan === 'trial' ? 'rgba(56,189,248,0.05)' : '#FFF' }}>
                <div><h4 style={{ fontWeight: 600, margin: '0 0 4px 0', color: "var(--gp-black)" }}>Trial</h4><p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>Free 14 days</p></div>
              </div>
            </label>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <input type="radio" name="plan" value="starter" checked={formData.plan === 'starter'} onChange={handleChange} style={{ display: 'none' }} />
              <div style={{ border: formData.plan === 'starter' ? '2px solid #38BDF8' : '1px solid #E5E7EB', padding: '16px', display: 'flex', justifyContent: 'space-between', transition: 'all 0.2s', background: formData.plan === 'starter' ? 'rgba(56,189,248,0.05)' : '#FFF' }}>
                <div><h4 style={{ fontWeight: 600, margin: '0 0 4px 0', color: "var(--gp-black)" }}>Starter</h4><p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>UGX 150,000/mo</p></div>
              </div>
            </label>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <input type="radio" name="plan" value="professional" checked={formData.plan === 'professional'} onChange={handleChange} style={{ display: 'none' }} />
              <div style={{ border: formData.plan === 'professional' ? '2px solid #38BDF8' : '1px solid #E5E7EB', padding: '16px', display: 'flex', justifyContent: 'space-between', transition: 'all 0.2s', background: formData.plan === 'professional' ? 'rgba(56,189,248,0.05)' : '#FFF' }}>
                <div><h4 style={{ fontWeight: 600, margin: '0 0 4px 0', color: "var(--gp-black)" }}>Professional</h4><p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>UGX 350,000/mo</p></div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <Button onClick={handleBack} variant="secondary" style={{ flex: 1 }}>Back</Button>
            <Button onClick={handleSubmit} variant="primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </div>
      )}

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
