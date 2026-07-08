import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(null) // null, 'loading', 'error'
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }

    if (!token && (!email || !code)) {
      setStatus('error')
      setMessage('Please enter your email and the 6-digit reset code.')
      return
    }

    setStatus('loading')
    try {
      let finalToken = token;
      
      // If there's no URL token, exchange the manual email+code for one
      if (!finalToken) {
        const res = await insforge.auth.exchangeResetPasswordToken({ email, code })
        if (res.error) throw res.error
        finalToken = res.data.token
      }

      const { error } = await insforge.auth.resetPassword({
        newPassword: password,
        otp: finalToken,
      })
      if (error) throw error
      
      // Password updated successfully, redirect to login
      navigate('/auth/login')
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Reset Password</h2>
      <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>
        {token ? 'Enter your new password below.' : 'Enter the code from your email and your new password.'}
      </p>
      
      {status === 'error' && (
        <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!token && (
          <>
            <Input 
              label="Email" 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input 
              label="6-Digit Code" 
              type="text" 
              required 
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </>
        )}
        <Input 
          label="New Password" 
          type="password" 
          required 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input 
          label="Confirm Password" 
          type="password" 
          required 
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }} disabled={status === 'loading'}>
          {status === 'loading' ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </div>
  )
}
