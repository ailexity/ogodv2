import { useState } from 'react'
import { api } from '../api/client.js'
import AuthLayout from './AuthLayout.jsx'

const COPY = {
  email: { title: 'Reset password', subtitle: 'Enter the email on your account.' },
  reset: { title: 'Choose a new password' },
  done: { title: 'Password updated', subtitle: 'You can now sign in with your new password.' },
}

export default function ForgotPassword({ onBackToLogin }) {
  const [step, setStep] = useState('email') // 'email' | 'reset' | 'done'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter your account email')
      return
    }
    setStep('reset')
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setError('')
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await api.resetPassword(email, password)
      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={COPY[step].title}
      subtitle={step === 'reset' ? `For ${email}` : COPY[step].subtitle}
      footer={
        step !== 'done' && (
          <p className="switch-text">
            <button type="button" className="switch-link" onClick={onBackToLogin}>
              Back to sign in
            </button>
          </p>
        )
      }
    >
      {step === 'email' && (
        <form className="form" onSubmit={handleEmailSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="submit" type="submit">
            Continue
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form className="form" onSubmit={handleResetSubmit}>
          <label className="field">
            <span className="field-label">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="Enter new password"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setError('')
              }}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="submit" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <button type="button" className="submit" onClick={onBackToLogin}>
          Back to sign in
        </button>
      )}
    </AuthLayout>
  )
}
