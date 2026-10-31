import { useState } from 'react'
import { api } from '../api/client.js'
import AuthLayout from './AuthLayout.jsx'

export default function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter your account email')
      return
    }

    setSubmitting(true)
    try {
      await api.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={sent ? 'Check your inbox' : 'Reset password'}
      subtitle={
        sent ? (
          <>
            If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent it a link to
            choose a new password. The link expires in 1 hour.
          </>
        ) : (
          "Enter the email on your account and we'll send you a reset link."
        )
      }
      footer={
        <p className="switch-text">
          <button type="button" className="switch-link" onClick={onBackToLogin}>
            Back to sign in
          </button>
        </p>
      }
    >
      {sent ? (
        <button type="button" className="submit" onClick={() => setSent(false)}>
          Use a different email
        </button>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
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

          <button className="submit" type="submit" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
