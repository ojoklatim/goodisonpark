import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null) // null, 'loading', 'success', 'error'
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const { error } = await insforge.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setStatus('success')
      setMessage('Password reset link sent to your email.')
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Forgot Password</h2>
      <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>Enter your email to receive a reset link.</p>
      
      {status === 'success' && (
        <div style={{ padding: '12px', background: '#F0FDF4', border: '1px solid #22C55E', color: '#15803D', marginBottom: '16px' }}>
          {message}
        </div>
      )}
      
      {status === 'error' && (
        <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      {status !== 'success' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            label="Email" 
            type="email" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }} disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      )}

      <p style={{ marginTop: '24px', fontSize: '14px', textAlign: 'center', color: '#6B7280' }}>
        Remember your password?{' '}
        <Link to="/auth/login" style={{ color: "var(--gp-blue)", fontWeight: 600, textDecoration: 'none' }}>
          Sign In
        </Link>
      </p>
    </div>
  )
}
