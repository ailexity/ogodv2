import { useState } from 'react'
import { api } from '../api/client.js'
import AuthLayout from './AuthLayout.jsx'

/** Opened from the emailed reset link (`/?reset=<token>`). */
export default function ResetPassword({ token, onDone, onRequestNewLink }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await api.resetPassword(token, password)
      onDone()
    } catch (err) {
      setError(err.message)
      setExpired(err.status === 400 && /link/i.test(err.message))
      setSubmitting(false)
    }
  }

  function clearError(setter) {
    return (e) => {
      setter(e.target.value)
      setError('')
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="This also signs you out on every other device."
      footer={
        <p className="switch-text">
          <button type="button" className="switch-link" onClick={onRequestNewLink}>
            Request a new link
          </button>
        </p>
      }
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">New password</span>
          <input
            type="password"
            value={password}
            onChange={clearError(setPassword)}
            placeholder="Enter new password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="form-hint">At least 8 characters, with a letter and a number.</span>
        </label>

        <label className="field">
          <span className="field-label">Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={clearError(setConfirmPassword)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        {expired ? (
          <button type="button" className="submit" onClick={onRequestNewLink}>
            Request a new link
          </button>
        ) : (
          <button className="submit" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new password'}
          </button>
        )}
      </form>
    </AuthLayout>
  )
}
