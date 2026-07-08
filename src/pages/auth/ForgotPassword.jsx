import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function ForgotPassword() {
  const navigate = useNavigate()
  
  // States
  const [step, setStep] = useState(1) // 1 = request code, 2 = enter code & new password
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [status, setStatus] = useState(null) // null, 'loading', 'success', 'error'
  const [message, setMessage] = useState('')

  const handleSendCode = async (e) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const { error } = await insforge.auth.sendResetPasswordEmail({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      
      setStatus('success')
      setMessage('A reset code has been sent to your email.')
      setTimeout(() => {
        setStep(2)
        setStatus(null)
        setMessage('')
      }, 1500)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }

    setStatus('loading')
    try {
      // Exchange email + code for session token
      const res = await insforge.auth.exchangeResetPasswordToken({ email, code })
      if (res.error) throw res.error
      
      const token = res.data.token

      // Update password
      const { error } = await insforge.auth.resetPassword({
        newPassword: password,
        otp: token,
      })
      if (error) throw error
      
      setStatus('success')
      setMessage('Password updated successfully! Redirecting to login...')
      
      setTimeout(() => {
        navigate('/auth/login')
      }, 2000)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        {step === 1 ? 'Forgot Password' : 'Reset Password'}
      </h2>
      <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>
        {step === 1 ? 'Enter your email to receive a reset code.' : 'Enter the 6-digit code and your new password.'}
      </p>
      
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

      {step === 1 && (
        <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            label="Email" 
            type="email" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }} disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending...' : 'Send Reset Code'}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            label="6-Digit Code" 
            type="text" 
            required 
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
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
          
          <Button type="button" variant="ghost" onClick={() => setStep(1)} style={{ width: '100%' }}>
            Back to Email
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
