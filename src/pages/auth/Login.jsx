import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Eye, EyeOff, Building2 } from 'lucide-react'

export function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState(() => localStorage.getItem('rememberedEmail') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedEmail'))

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
      } else {
        localStorage.removeItem('rememberedEmail')
      }

      const { data, error: signInError } = await insforge.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
      
      const user = data.user

      // Fetch profile
      let { data: profileData, error: profileError } = await insforge
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileError) throw profileError

      if (!profileData) {
        await insforge.auth.signOut()
        throw new Error("No account found. Contact your administrator.")
      }

      // Fetch company
      const { data: companyData, error: companyError } = await insforge
        .from('companies')
        .select('*')
        .eq('id', profileData.company_id)
        .single()

      if (companyError) throw companyError

      // Fetch role permissions
      const { data: permissionsData, error: permissionsError } = await insforge
        .from('role_permissions')
        .select('*')
        .eq('company_id', profileData.company_id)
        .eq('role', profileData.role)

      if (permissionsError) throw permissionsError

      // Build permissions map
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

      setAuth({ 
        user, 
        profile: profileData, 
        company: companyData, 
        role: profileData.role, 
        permissions: permissionsMap 
      })
      
      navigate('/dashboard/overview')
    } catch (err) {
      if (err.message.includes('Invalid login credentials')) {
        setError('Invalid credentials')
      } else if (err.message.includes('Email not confirmed')) {
        setError('Email not confirmed')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '16px', borderRadius: 0, fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input 
          label="Email" 
          type="email" 
          required 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        <div style={{ position: 'relative' }}>
          <Input 
            label="Password" 
            type={showPassword ? 'text' : 'password'} 
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button 
            type="button" 
            onClick={() => setShowPassword(!showPassword)}
            style={{ 
              position: 'absolute', right: '12px', top: '34px', 
              background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', color: 'var(--gp-black)' }}>
            <input 
              type="checkbox" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ borderRadius: 0, border: '1px solid var(--gp-border-light)', width: '16px', height: '16px', cursor: 'pointer' }} 
            />
            Remember me
          </label>
          <Link to="/auth/forgot-password" style={{ fontSize: '14px', color: "var(--gp-blue)", textDecoration: 'none', fontWeight: 500 }}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p style={{ marginTop: '24px', fontSize: '14px', textAlign: 'center', color: 'var(--gp-muted)' }}>
        Don't have an account?{' '}
        <Link to="/auth/register-company" style={{ color: "var(--gp-blue)", fontWeight: 600, textDecoration: 'none' }}>
          Register Company
        </Link>
      </p>
    </div>
  )
}
